/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Database driver initialization, Knex connection manager, schema migrations
 *   handling, and default lookup seeds setup.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

const knex = require('knex');
const knexConfig = require('../knexfile');

const env = process.env.NODE_ENV || 'development';
const config = knexConfig[env];

const db = knex(config);

// Run migrations on startup
db.migrate.latest()
  .then(async () => {
    console.log('Database migrations completed successfully.');
    // Check and create targets table if missing
    const exists = await db.schema.hasTable('targets');
    if (!exists) {
      await db.schema.createTable('targets', (table) => {
        const isPostgres = db.client.config.client === 'pg';
        if (isPostgres) {
          table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        } else {
          table.uuid('id').primary();
        }
        table.uuid('counselor_id').references('id').inTable('users').onDelete('CASCADE').unique().notNullable();
        table.integer('target_count').defaultTo(10).notNullable();
        table.string('target_month', 7).notNullable(); // e.g. '2026-07'
        table.timestamp('created_at').defaultTo(db.fn.now()).notNullable();
      });
      console.log('Targets schema created successfully.');
    }

    // Check and create location_learnings table if missing
    const locExists = await db.schema.hasTable('location_learnings');
    if (!locExists) {
      await db.schema.createTable('location_learnings', (table) => {
        const isPostgres = db.client.config.client === 'pg';
        if (isPostgres) {
          table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        } else {
          table.uuid('id').primary();
        }
        table.string('city_name', 100).unique().notNullable();
        table.string('state_name', 100).nullable();
        table.timestamp('created_at').defaultTo(db.fn.now()).notNullable();
      });
      console.log('Location learnings schema created successfully.');

      // Seed/insert the unique locations
      const locations = [
        { city_name: 'Lucknow', state_name: 'Uttar Pradesh' },
        { city_name: 'Kanpur', state_name: 'Uttar Pradesh' },
        { city_name: 'Ballia', state_name: 'Uttar Pradesh' },
        { city_name: 'Cooch Behar', state_name: 'West Bengal' },
        { city_name: 'Navi Mumbai', state_name: 'Maharashtra' },
        { city_name: 'Hyderabad', state_name: 'Telangana' },
        { city_name: 'Karimnagar', state_name: 'Telangana' },
        { city_name: 'Solapur', state_name: 'Maharashtra' },
        { city_name: 'Bengaluru', state_name: 'Karnataka' },
        { city_name: 'Pune', state_name: 'Maharashtra' },
        { city_name: 'Guwahati', state_name: 'Assam' },
        { city_name: 'Goalpara', state_name: 'Assam' },
        { city_name: 'Nalbari', state_name: 'Assam' },
        { city_name: 'Nagaon', state_name: 'Assam' },
        { city_name: 'Jorhat', state_name: 'Assam' },
        { city_name: 'Tezpur', state_name: 'Assam' },
        { city_name: 'North Lakhimpur', state_name: 'Assam' },
        { city_name: 'Lanka', state_name: 'Assam' },
        { city_name: 'Chandigarh', state_name: 'Punjab' },
        { city_name: 'Prayagraj', state_name: 'Uttar Pradesh' }
      ];

      const isSQLite = db.client.config.client === 'sqlite3';
      const { randomUUID } = require('crypto');
      for (const loc of locations) {
        await db('location_learnings').insert({
          id: isSQLite ? randomUUID() : undefined,
          city_name: loc.city_name,
          state_name: loc.state_name
        }).catch(err => console.log('Insert fail for location learning:', loc.city_name, err.message));
      }
      console.log('Location learnings populated successfully.');
    }
  })
  .catch((err) => {
    console.error('Database migration failed:', err);
  });

module.exports = db;
