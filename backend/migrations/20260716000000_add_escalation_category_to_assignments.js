exports.up = function(knex) {
  return knex.schema.table('lead_assignments', function(table) {
    table.string('escalation_category').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('lead_assignments', function(table) {
    table.dropColumn('escalation_category');
  });
};
