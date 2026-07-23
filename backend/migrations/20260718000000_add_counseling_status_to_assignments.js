const { randomUUID } = require('crypto');

// One-time mapping from the old free-text `disposition` (at stage L1 only — L2/L3 are
// handled separately below since stage itself determines the new status there) to the
// new flat `counseling_status`. Values with no 1:1 home in the new 6-status model
// ('Call Back', 'Cold', 'Reference Generated') collapse into 'Interested' — the closest
// non-terminal analog — and the original disposition is preserved in `status_remark` so
// the collapse is auditable rather than a silent data loss.
const L1_DISPOSITION_TO_STATUS = {
  'None': 'Not Contacted',
  'Interested': 'Interested',
  'Call Back': 'Interested',
  'Cold': 'Interested',
  'Reference Generated': 'Interested',
  'Not Picked Up': { status: 'Not Contactable', reason: 'Not Picked' },
  'Switched Off': { status: 'Not Contactable', reason: 'Switch Off' },
  'Wrong Number': { status: 'Not Contactable', reason: 'Wrong Number' },
  'Not Interested': 'Not Interested',
  'Lead Already Exists': 'Duplicate Lead',
  'Looking For Job': 'Job Seeker'
};

const TERMINAL_FINAL_STATUS = {
  'Not Interested': 'lost',
  'Duplicate Lead': 'duplicate',
  'Job Seeker': 'job_seeker'
};

exports.up = async function (knex) {
  await knex.schema.alterTable('lead_assignments', (table) => {
    table.string('counseling_status', 30).notNullable().defaultTo('Not Contacted');
    table.string('not_contactable_reason', 30).nullable();
    table.text('status_remark').nullable();
    table.string('registration_status', 20).nullable().defaultTo('Not Registered');
    table.timestamp('registration_date').nullable();
    table.string('fee_payment_status', 20).nullable().defaultTo('None');
    table.decimal('fee_amount_paid', 15, 2).nullable();
    table.decimal('fee_total_amount', 15, 2).nullable();
    table.timestamp('fee_reminder_due_at').nullable();
    table.text('fee_reminder_note').nullable();
    table.boolean('fee_reminder_acknowledged').notNullable().defaultTo(false);
    table.index(['counseling_status']);
  });

  // Backfill existing rows from the old stage/disposition model into the new flat
  // status. Runs once, in a single transaction (all-or-nothing). Deliberately NOT
  // reversible in `down()` — terminal mappings delete the lead_assignments row and
  // write a closures row, exactly mirroring what the live drop/enroll code already
  // does today, so there is no "old" state left to restore to.
  await knex.transaction(async (trx) => {
    const rows = await trx('lead_assignments')
      .leftJoin('closures', 'lead_assignments.lead_id', 'closures.lead_id')
      .select(
        'lead_assignments.id as assignment_id',
        'lead_assignments.lead_id',
        'lead_assignments.counselor_id',
        'lead_assignments.stage',
        'lead_assignments.disposition',
        'closures.id as closure_id',
        'closures.documents_status',
        'closures.university_id as closure_university_id'
      );

    for (const row of rows) {
      const { assignment_id, lead_id, counselor_id, stage, disposition, closure_id, documents_status, closure_university_id } = row;

      if (stage === 'L2' || stage === 'L3') {
        // Non-terminal: becomes 'Lead Punched' with best-effort registration/fee state
        // recovered from the old L3 document checklist (if any).
        let registrationStatus = 'Not Registered';
        let registrationDate = null;
        let feePaymentStatus = 'None';

        if (stage === 'L3' && documents_status) {
          let docStatus = documents_status;
          if (typeof docStatus === 'string') {
            try { docStatus = JSON.parse(docStatus); } catch (e) { docStatus = {}; }
          }
          if (docStatus.registrationNumber) {
            registrationStatus = 'Registered';
            registrationDate = new Date();
          }
          if (docStatus.feesConfirmed) {
            feePaymentStatus = 'Full';
          } else if (docStatus.feesPaid) {
            feePaymentStatus = 'Partial';
          }
        }

        await trx('lead_assignments').where({ id: assignment_id }).update({
          counseling_status: 'Lead Punched',
          registration_status: registrationStatus,
          registration_date: registrationDate,
          fee_payment_status: feePaymentStatus,
          status_remark: `Migrated from stage=${stage}, disposition=${disposition}`,
          updated_at: new Date()
        });
        continue;
      }

      // stage === 'L1'
      const mapping = L1_DISPOSITION_TO_STATUS[disposition] || 'Not Contacted';

      if (typeof mapping === 'object') {
        await trx('lead_assignments').where({ id: assignment_id }).update({
          counseling_status: mapping.status,
          not_contactable_reason: mapping.reason,
          updated_at: new Date()
        });
        continue;
      }

      if (mapping === 'Not Contacted' || mapping === 'Interested') {
        const collapsed = disposition !== 'None' && disposition !== 'Interested';
        await trx('lead_assignments').where({ id: assignment_id }).update({
          counseling_status: mapping,
          status_remark: collapsed ? `Migrated from: ${disposition}` : null,
          updated_at: new Date()
        });
        continue;
      }

      // Terminal mappings: Not Interested / Duplicate Lead / Job Seeker — mirror the
      // live cross-path: upsert a closures row, flip leads.status, delete the assignment.
      const finalStatus = TERMINAL_FINAL_STATUS[mapping];
      const dropRemark = `Migrated from stage=${stage}, disposition=${disposition}`;

      if (closure_id) {
        await trx('closures').where({ id: closure_id }).update({
          final_status: finalStatus,
          counselor_id,
          drop_stage: mapping,
          drop_remark: dropRemark,
          closed_at: new Date()
        });
      } else {
        await trx('closures').insert({
          id: randomUUID(),
          lead_id,
          university_id: closure_university_id || null,
          documents_status: JSON.stringify({}),
          application_status: 'rejected',
          final_status: finalStatus,
          revenue: 0,
          counselor_id,
          drop_stage: mapping,
          drop_remark: dropRemark,
          created_at: new Date(),
          closed_at: new Date()
        });
      }

      await trx('leads').where({ id: lead_id }).update({
        status: mapping === 'Duplicate Lead' ? 'duplicate' : 'closed',
        updated_at: new Date()
      });

      await trx('lead_assignments').where({ id: assignment_id }).delete();
    }
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('lead_assignments', (table) => {
    table.dropColumn('counseling_status');
    table.dropColumn('not_contactable_reason');
    table.dropColumn('status_remark');
    table.dropColumn('registration_status');
    table.dropColumn('registration_date');
    table.dropColumn('fee_payment_status');
    table.dropColumn('fee_amount_paid');
    table.dropColumn('fee_total_amount');
    table.dropColumn('fee_reminder_due_at');
    table.dropColumn('fee_reminder_note');
    table.dropColumn('fee_reminder_acknowledged');
  });
};
