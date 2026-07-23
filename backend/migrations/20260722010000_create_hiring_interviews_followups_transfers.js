// Second Hiring migration — interview scheduling/history, follow-up reminders, and
// candidate transfer requests. All createTable (brand new, empty tables), so real FK
// constraints are safe here (see 20260722000000 for the reasoning).
exports.up = async function (knex) {
  const isPostgres = knex.client.config.client === 'pg';
  const uuidPk = (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
  };

  // HIRING INTERVIEWS — one row per interview round. Deliberately a single table serves
  // both "Interview Schedule" (rows with status='Scheduled' and a future date) and
  // "Interview History" (all rows, ordered by date) as two views over the same data,
  // rather than two separate tables that would need to be kept in sync.
  await knex.schema.createTable('hiring_interviews', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').notNullable();
    table.uuid('company_id').references('id').inTable('companies').onDelete('SET NULL');
    table.string('round', 50).nullable();
    table.date('scheduled_date').nullable();
    table.string('scheduled_time', 10).nullable();
    table.string('mode', 20).nullable();
    table.string('interviewer', 150).nullable();
    table.string('status', 20).defaultTo('Scheduled').notNullable();
    table.string('result', 20).defaultTo('Pending').notNullable();
    table.text('feedback').nullable();
    table.uuid('scheduled_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['candidate_id']);
    table.index(['scheduled_date']);
    table.index(['status']);
  });

  // HIRING FOLLOW UPS — mirrors `follow_ups` exactly, scoped to candidates/recruiters.
  await knex.schema.createTable('hiring_follow_ups', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').notNullable();
    table.uuid('recruiter_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.timestamp('follow_up_date').notNullable();
    table.text('notes').nullable();
    table.boolean('completed').defaultTo(false).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable();

    table.index(['recruiter_id', 'completed']);
    table.index(['follow_up_date']);
  });

  // HIRING TRANSFER REQUESTS — mirrors `transfer_requests` exactly, scoped to candidates.
  await knex.schema.createTable('hiring_transfer_requests', (table) => {
    uuidPk(table);
    table.uuid('candidate_id').references('id').inTable('hiring_candidates').onDelete('CASCADE').notNullable();
    table.uuid('requested_by').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.string('request_type', 50).notNullable();
    table.string('reason', 255).notNullable();
    table.text('note').nullable();
    table.uuid('target_recruiter_id').references('id').inTable('users').onDelete('RESTRICT');
    table.string('status', 20).defaultTo('pending').notNullable();
    table.uuid('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('hiring_transfer_requests');
  await knex.schema.dropTableIfExists('hiring_follow_ups');
  await knex.schema.dropTableIfExists('hiring_interviews');
};
