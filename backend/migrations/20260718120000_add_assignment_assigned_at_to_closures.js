// Snapshot of lead_assignments.assigned_at at the moment a lead is closed out (enrolled /
// lost / duplicate / job_seeker). The assignment row itself gets deleted on closure, so
// without this copy there is no way to later tell whether a closed lead had been sitting
// as Carry Forward or was Fresh that day — needed for the CF Ahead/Pending reporting split.
// Null on rows written before this migration (no way to recover their original assigned_at).
exports.up = function (knex) {
  return knex.schema.alterTable('closures', (table) => {
    table.timestamp('assignment_assigned_at').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('closures', (table) => {
    table.dropColumn('assignment_assigned_at');
  });
};
