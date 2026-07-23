// Plain nullable string column, no .references() — adding a FK-constrained column to an
// existing table via alterTable forces a table rebuild that, with foreign_keys=ON, has
// previously cascade-deleted this project's data (see the fix history on
// 20260721000000_add_lead_type_temperature_existed_university.js). Not a concern here since
// this column isn't a reference anyway, but keeping the same safe shape regardless.
exports.up = (knex) => knex.schema.alterTable('hiring_candidate_assignments', (t) => {
  t.string('not_contactable_reason').nullable();
});

exports.down = (knex) => knex.schema.alterTable('hiring_candidate_assignments', (t) => {
  t.dropColumn('not_contactable_reason');
});
