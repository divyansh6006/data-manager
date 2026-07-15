exports.up = async function(knex) {
  await knex.schema.table('leads', (table) => {
    table.uuid('university_id')
      .references('id')
      .inTable('universities')
      .onDelete('SET NULL')
      .nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.table('leads', (table) => {
    table.dropColumn('university_id');
  });
};
