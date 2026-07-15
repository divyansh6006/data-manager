/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('closures', (table) => {
    table.uuid('counselor_id').nullable();
    table.string('drop_stage', 20).nullable();
    table.text('drop_remark').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('closures', (table) => {
    table.dropColumn('counselor_id');
    table.dropColumn('drop_stage');
    table.dropColumn('drop_remark');
  });
};
