// Lets a recruiter/hiring_team_leader belong to a hiring_teams row. Deliberately a PLAIN
// column with NO .references() — adding a real FK-constrained column to an EXISTING table
// (users already has rows) via alterTable forces knex's sqlite3 dialect to rebuild the
// whole table, and with PRAGMA foreign_keys=ON that cascade-deletes every child row in
// every table with ON DELETE CASCADE pointing at users/leads — this already happened once
// in this project (see 20260721000000_add_lead_type_temperature_existed_university.js).
// The hiring_teams relationship is enforced at the application layer only, exactly like
// leads.existed_university_id.
exports.up = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.uuid('hiring_team_id').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('hiring_team_id');
  });
};
