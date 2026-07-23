// First migration for the new, fully-isolated Hiring workspace (Phase 1). All tables here
// are brand new (createTable, not alterTable), so real FK constraints are safe to declare
// at creation time — no existing rows, no rebuild risk. See
// 20260721000000_add_lead_type_temperature_existed_university.js for why that distinction
// matters: adding a FK-constrained column to an EXISTING table via alterTable forces a
// table rebuild that, combined with PRAGMA foreign_keys=ON, cascade-deletes every child row
// pointing at it. None of that applies here since every table below starts empty.
exports.up = async function (knex) {
  const isPostgres = knex.client.config.client === 'pg';
  const uuidPk = (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
  };

  // 1. HIRING TEAMS — mirrors `teams`, kept entirely separate so Admissions and Hiring
  // team rosters never mix in any dropdown/report.
  await knex.schema.createTable('hiring_teams', (table) => {
    uuidPk(table);
    table.string('name', 100).unique().notNullable();
    table.uuid('leader_id').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 2. COMPANIES — the client/employer roster recruiters place candidates into.
  await knex.schema.createTable('companies', (table) => {
    uuidPk(table);
    table.string('name', 255).notNullable();
    table.string('industry', 100).nullable();
    table.string('location', 150).nullable();
    table.string('website', 255).nullable();
    table.string('contact_person', 150).nullable();
    table.string('contact_email', 255).nullable();
    table.string('contact_phone', 20).nullable();
    table.text('notes').nullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 3. HIRING UPLOAD BATCHES — mirrors `upload_batches`, for bulk Excel/CSV candidate import.
  await knex.schema.createTable('hiring_upload_batches', (table) => {
    uuidPk(table);
    table.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('file_name', 255).notNullable();
    table.timestamp('upload_date').defaultTo(knex.fn.now()).notNullable();
    table.integer('total_rows').notNullable();
    table.integer('clean_rows').defaultTo(0).notNullable();
    table.integer('duplicate_rows').defaultTo(0).notNullable();
    table.integer('invalid_rows').defaultTo(0).notNullable();
  });

  // 4. HIRING CANDIDATES — the Hiring equivalent of `leads`. Deliberately does NOT reuse
  // any Admissions field (no university/course/country) per the spec's data-isolation
  // requirement. `current_company` is the candidate's existing employer (free text); the
  // company they're actively being PURSUED for lives on hiring_candidate_assignments below,
  // since one candidate can cycle through multiple target companies over time.
  await knex.schema.createTable('hiring_candidates', (table) => {
    uuidPk(table);
    table.string('name', 255).notNullable();
    table.string('phone', 20).notNullable();
    table.string('email', 255).nullable();
    table.string('current_location', 150).nullable();
    table.decimal('experience', 4, 2).nullable();
    table.string('current_company', 255).nullable();
    table.decimal('expected_salary', 15, 2).nullable();
    table.string('notice_period', 50).nullable();
    table.jsonb('skills').nullable();
    table.string('resume_url', 500).nullable();
    table.string('source', 100).nullable();
    table.uuid('upload_batch_id').references('id').inTable('hiring_upload_batches').onDelete('SET NULL');
    table.string('status', 20).defaultTo('active').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['phone']);
    table.index(['email']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // 5. HIRING CANDIDATE ASSIGNMENTS — mirrors `lead_assignments`. The 14-stage flat
  // pipeline_status model mirrors the Admissions counseling_status pattern exactly.
  await knex.schema.createTable('hiring_candidate_assignments', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').unique().notNullable();
    table.uuid('recruiter_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.uuid('assigned_by').references('id').inTable('users').onDelete('SET NULL').notNullable();
    table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
    table.timestamp('assigned_at').defaultTo(knex.fn.now()).notNullable();
    table.string('pipeline_status', 30).defaultTo('New').notNullable();
    table.string('registration_status', 20).defaultTo('Pending').notNullable();
    table.boolean('interview_scheduled').defaultTo(false).notNullable();
    table.string('result_status', 20).defaultTo('Pending').notNullable();
    table.text('status_remark').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['recruiter_id']);
    table.index(['pipeline_status']);
  });

  // 6. HIRING CLOSURES — mirrors `closures`. Terminal pipeline statuses (Selected/
  // Rejected/Joined/Closed) delete the hiring_candidate_assignments row and write here
  // instead, exactly like the Admissions terminal-status pattern.
  await knex.schema.createTable('hiring_closures', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').unique().notNullable();
    table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
    table.uuid('recruiter_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('final_status', 20).notNullable();
    table.jsonb('offer_details').nullable();
    table.string('drop_stage', 30).nullable();
    table.text('drop_remark').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('closed_at').nullable();
  });

  // 7. HIRING ACTIVITY LOG — mirrors `lead_activity_log`, the durable audit trail.
  await knex.schema.createTable('hiring_activity_log', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').nullable();
    table.uuid('recruiter_id').references('id').inTable('users').onDelete('SET NULL').nullable();
    table.string('action', 50).notNullable();
    table.text('remark').nullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now()).notNullable();

    table.index(['candidate_id']);
    table.index(['recruiter_id']);
    table.index(['timestamp']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('hiring_activity_log');
  await knex.schema.dropTableIfExists('hiring_closures');
  await knex.schema.dropTableIfExists('hiring_candidate_assignments');
  await knex.schema.dropTableIfExists('hiring_candidates');
  await knex.schema.dropTableIfExists('hiring_upload_batches');
  await knex.schema.dropTableIfExists('companies');
  await knex.schema.dropTableIfExists('hiring_teams');
};
