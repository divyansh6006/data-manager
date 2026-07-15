exports.up = function(knex) {
  return knex.schema.table('lead_assignments', function(table) {
    table.boolean('is_forwarded').defaultTo(false).notNullable();
    table.text('forward_remark').nullable();
    table.timestamp('forwarded_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('lead_assignments', function(table) {
    table.dropColumn('is_forwarded');
    table.dropColumn('forward_remark');
    table.dropColumn('forwarded_at');
  });
};
