exports.up = async function(knex) {
  const isPostgres = knex.client.config.client === 'pg';

  if (isPostgres) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  }

  // 1. TEAMS TABLE
  await knex.schema.createTable('teams', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.string('name', 100).unique().notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 2. USERS TABLE
  await knex.schema.createTable('users', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.string('name', 255).notNullable();
    table.string('company_email', 255).unique().notNullable();
    table.string('role', 50).notNullable();
    table.uuid('team_id').references('id').inTable('teams').onDelete('SET NULL');
    table.string('device_id', 255).nullable();
    table.boolean('active').defaultTo(true).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Add leader_id to teams
  await knex.schema.table('teams', (table) => {
    table.uuid('leader_id').references('id').inTable('users').onDelete('SET NULL');
  });

  // 3. UPLOAD BATCHES TABLE
  await knex.schema.createTable('upload_batches', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('file_name', 255).notNullable();
    table.timestamp('upload_date').defaultTo(knex.fn.now()).notNullable();
    table.integer('total_rows').notNullable();
    table.integer('clean_rows').defaultTo(0).notNullable();
    table.integer('duplicate_rows').defaultTo(0).notNullable();
    table.integer('invalid_rows').defaultTo(0).notNullable();
  });

  // 4. LEADS TABLE
  await knex.schema.createTable('leads', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.string('name', 255).notNullable();
    table.string('phone', 20).notNullable();
    table.string('email', 255).nullable();
    table.string('city', 100).nullable();
    table.string('state', 100).nullable();
    table.decimal('experience', 4, 2).nullable();
    table.string('current_company', 255).nullable();
    table.decimal('salary', 15, 2).nullable();
    table.string('graduation', 255).nullable();
    table.string('course_interest', 255).nullable();
    table.string('source', 100).notNullable();
    table.uuid('upload_batch_id').references('id').inTable('upload_batches').onDelete('SET NULL');
    table.string('status', 50).defaultTo('raw').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    // Indexes
    table.index(['phone']);
    table.index(['email']);
    table.index(['status']);
    table.index(['upload_batch_id']);
    table.index(['created_at']);
  });

  // 5. LEAD ASSIGNMENTS TABLE
  await knex.schema.createTable('lead_assignments', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('lead_id').references('id').inTable('leads').onDelete('CASCADE').unique().notNullable();
    table.uuid('counselor_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.uuid('assigned_by').references('id').inTable('users').onDelete('SET NULL').notNullable();
    table.timestamp('assigned_at').defaultTo(knex.fn.now()).notNullable();
    table.string('stage', 20).defaultTo('L1').notNullable();
    table.string('disposition', 50).defaultTo('None').notNullable();
    table.boolean('locked').defaultTo(true).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['counselor_id']);
    table.index(['stage']);
  });

  // 6. LEAD ACTIVITY LOG TABLE
  await knex.schema.createTable('lead_activity_log', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('lead_id').references('id').inTable('leads').onDelete('CASCADE').nullable();
    table.uuid('counselor_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 50).notNullable();
    table.text('remark').nullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now()).notNullable();

    table.index(['lead_id']);
    table.index(['counselor_id']);
    table.index(['timestamp']);
  });

  // 7. FOLLOW UPS TABLE
  await knex.schema.createTable('follow_ups', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('lead_id').references('id').inTable('leads').onDelete('CASCADE').notNullable();
    table.uuid('counselor_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.timestamp('follow_up_date').notNullable();
    table.text('notes').nullable();
    table.boolean('completed').defaultTo(false).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable();

    table.index(['counselor_id', 'completed']);
    table.index(['follow_up_date']);
  });

  // 8. UNIVERSITIES TABLE
  await knex.schema.createTable('universities', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.string('name', 255).unique().notNullable();
    table.jsonb('courses').notNullable();
    table.jsonb('fees').nullable();
    table.text('eligibility').nullable();
    table.jsonb('specializations').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 9. CLOSURES TABLE
  await knex.schema.createTable('closures', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('lead_id').references('id').inTable('leads').onDelete('CASCADE').unique().notNullable();
    table.uuid('university_id').references('id').inTable('universities').onDelete('SET NULL');
    table.jsonb('documents_status').nullable();
    table.string('application_status', 50).nullable();
    table.string('final_status', 50).notNullable();
    table.decimal('revenue', 15, 2).defaultTo(0).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('closed_at').nullable();
  });

  // 10. DISTRIBUTION BATCHES TABLE
  await knex.schema.createTable('distribution_batches', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('source_batch_id').references('id').inTable('upload_batches').onDelete('SET NULL');
    table.jsonb('filter_criteria').nullable();
    table.integer('total_leads').notNullable();
    table.uuid('distributed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('distributed_at').defaultTo(knex.fn.now()).notNullable();
    table.string('status', 50).defaultTo('confirmed').notNullable();
  });

  // 11. DISTRIBUTION ALLOCATIONS TABLE
  await knex.schema.createTable('distribution_allocations', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('distribution_batch_id').references('id').inTable('distribution_batches').onDelete('CASCADE').notNullable();
    table.uuid('counselor_id').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.integer('requested_count').notNullable();
    table.jsonb('actual_lead_ids').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 12. TRANSFER REQUESTS TABLE
  await knex.schema.createTable('transfer_requests', (table) => {
    if (isPostgres) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.uuid('id').primary();
    }
    table.uuid('lead_id').references('id').inTable('leads').onDelete('CASCADE').notNullable();
    table.uuid('requested_by').references('id').inTable('users').onDelete('RESTRICT').notNullable();
    table.string('request_type', 50).notNullable();
    table.string('reason', 255).notNullable();
    table.text('note').nullable();
    table.uuid('target_counselor_id').references('id').inTable('users').onDelete('RESTRICT');
    table.string('status', 20).defaultTo('pending').notNullable();
    table.uuid('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('transfer_requests');
  await knex.schema.dropTableIfExists('distribution_allocations');
  await knex.schema.dropTableIfExists('distribution_batches');
  await knex.schema.dropTableIfExists('closures');
  await knex.schema.dropTableIfExists('universities');
  await knex.schema.dropTableIfExists('follow_ups');
  await knex.schema.dropTableIfExists('lead_activity_log');
  await knex.schema.dropTableIfExists('lead_assignments');
  await knex.schema.dropTableIfExists('leads');
  await knex.schema.dropTableIfExists('upload_batches');
  
  await knex.schema.hasTable('teams').then(async (exists) => {
    if (exists) {
      await knex.schema.table('teams', (table) => {
        table.dropColumn('leader_id');
      });
    }
  });

  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('teams');
};
