// Adds password-based authentication on top of the existing email-only login.
// Nullable at the DB level because it's backfilled by a follow-up data script for
// pre-existing seed accounts rather than a NOT NULL default (bcrypt hashes can't be
// synthesized inside a migration without a real password to hash).
exports.up = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.string('password_hash', 255).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('password_hash');
  });
};
