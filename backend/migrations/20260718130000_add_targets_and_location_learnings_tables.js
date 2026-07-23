// Codifies two tables ('targets', 'location_learnings') that the running dev database
// already has but no prior migration ever created — they must have been added by hand
// outside the migration system at some point. Referenced by /api/users/counselors
// (counselor monthly targets) and the counselor Performance tab. Left as-is on any
// database that already has them; only matters for a fresh install, which would
// otherwise crash the moment either table is queried.
exports.up = async function (knex) {
  const isPostgres = knex.client.config.client === 'pg';

  const hasTargets = await knex.schema.hasTable('targets');
  if (!hasTargets) {
    await knex.schema.createTable('targets', (table) => {
      if (isPostgres) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      } else {
        table.uuid('id').primary();
      }
      table.uuid('counselor_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
      table.integer('target_count').notNullable();
      table.string('target_month', 7).notNullable(); // 'YYYY-MM'
      table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

      table.index(['counselor_id', 'target_month']);
    });
  }

  const hasLocationLearnings = await knex.schema.hasTable('location_learnings');
  if (!hasLocationLearnings) {
    await knex.schema.createTable('location_learnings', (table) => {
      if (isPostgres) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      } else {
        table.uuid('id').primary();
      }
      table.string('city_name', 100).notNullable();
      table.string('state_name', 100).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    });
  }
};

exports.down = async function (knex) {
  // Deliberately a no-op: on databases where these tables predate this migration, `down`
  // must not drop tables (and the data in them) that this migration didn't create.
};
