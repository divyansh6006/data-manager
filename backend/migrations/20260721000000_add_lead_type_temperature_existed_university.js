// Extends the Interested/Lead Punched/Duplicate Lead counseling flow: whether this
// contact is a brand-new application ('Created') or one that already existed in another
// university's system before ('Existed', with existed_university_id recording which one),
// plus a Hot/Warm/Cold intent classification independent of the counseling_status pipeline.
//
// existed_university_id is deliberately a PLAIN uuid column with NO .references() constraint,
// even though it points at universities.id. Adding a foreign-key-constrained column to an
// EXISTING table via alterTable forces knex's sqlite3 dialect to rebuild the whole table
// (copy-drop-recreate) to register the constraint — and with PRAGMA foreign_keys=ON, that
// rebuild's internal drop of the old `leads` table cascade-deletes every row in every child
// table with ON DELETE CASCADE pointing at leads.id (lead_assignments, closures, follow_ups,
// transfer_requests), silently wiping the entire active pipeline. university_id on this same
// table is safe because it was declared inside the original CREATE TABLE, not bolted on after
// the table already had data and dependents. The relationship here is enforced at the
// application layer instead (see the leadType/existedUniversityId validation in index.js).
exports.up = function (knex) {
  return knex.schema.alterTable('leads', (table) => {
    table.string('lead_type', 20).nullable();
    table.uuid('existed_university_id').nullable();
    table.string('lead_temperature', 10).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('leads', (table) => {
    table.dropColumn('lead_type');
    table.dropColumn('existed_university_id');
    table.dropColumn('lead_temperature');
  });
};
