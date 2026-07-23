// Tracks how/when a counselor's escalation was resolved, separately from the existing
// is_forwarded/forward_remark/forwarded_at fields (which get wiped back to their pre-escalation
// state the moment a manager resolves it — by design, since is_forwarded gates whether the
// counselor can edit the lead). Without a separate record, there was no way to show the
// counselor "this lead just came back from your manager" or what the manager decided, since
// the only trace was an activity log entry attributed to the MANAGER's user id, not
// queryable from the counselor's own leads list.
exports.up = function (knex) {
  return knex.schema.alterTable('lead_assignments', (table) => {
    table.timestamp('escalation_resolved_at').nullable();
    table.string('escalation_resolution_type').nullable(); // 'send_back' | 'reassign'
    table.text('escalation_resolution_note').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('lead_assignments', (table) => {
    table.dropColumn('escalation_resolved_at');
    table.dropColumn('escalation_resolution_type');
    table.dropColumn('escalation_resolution_note');
  });
};
