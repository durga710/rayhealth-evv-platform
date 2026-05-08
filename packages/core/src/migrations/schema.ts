import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('agencies'))) {
    await knex.schema.createTable('agencies', (table) => {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('state', 2).notNullable().defaultTo('PA');
      table.jsonb('operating_tracks').notNullable();
      table.string('medicaid_provider_number');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('clients'))) {
    await knex.schema.createTable('clients', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies');
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.date('date_of_birth').notNullable();
      table.string('medicaid_number');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('authorizations'))) {
    await knex.schema.createTable('authorizations', (table) => {
      table.uuid('id').primary();
      table.uuid('client_id').references('id').inTable('clients').notNullable();
      table.string('payer_id').notNullable();
      table.decimal('units_authorized', 10, 2).notNullable();
      table.string('service_code').notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('visit_templates'))) {
    await knex.schema.createTable('visit_templates', (table) => {
      table.uuid('id').primary();
      table.uuid('client_id').references('id').inTable('clients').notNullable();
      table.string('name').notNullable();
      table.jsonb('tasks').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('assignments'))) {
    await knex.schema.createTable('assignments', (table) => {
      table.uuid('id').primary();
      table.uuid('caregiver_id').notNullable(); // In real app, would reference users/staff
      table.uuid('visit_template_id').references('id').inTable('visit_templates').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('evv_visits'))) {
    await knex.schema.createTable('evv_visits', (table) => {
      table.uuid('id').primary();
      table.uuid('assignment_id').references('id').inTable('assignments').notNullable();
      table.uuid('caregiver_id').notNullable();
      table.timestamp('clock_in_time').notNullable();
      table.timestamp('clock_out_time');
      table.jsonb('clock_in_location').notNullable();
      table.jsonb('clock_out_location');
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);
    });
  }
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('role').notNullable();
      table.uuid('caregiver_id');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('sessions'))) {
    await knex.schema.createTable('sessions', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.uuid('user_id').references('id').inTable('users').notNullable();
      table.string('role').notNullable();
      table.uuid('caregiver_id');
      table.string('session_token_hash', 64).notNullable().unique();
      table.string('csrf_token_hash', 64).notNullable();
      table.text('user_agent');
      table.string('ip_address', 64);
      table.timestamp('expires_at').notNullable();
      table.timestamp('revoked_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['agency_id', 'user_id']);
      table.index(['expires_at']);
    });
  }

  if (!(await knex.schema.hasTable('visit_maintenance'))) {
    await knex.schema.createTable('visit_maintenance', (table) => {
      table.uuid('id').primary();
      table.uuid('visit_id').references('id').inTable('evv_visits').notNullable();
      table.uuid('requester_id').notNullable();
      table.text('reason').notNullable();
      table.timestamp('original_start_time');
      table.timestamp('original_end_time');
      table.timestamp('adjusted_start_time');
      table.timestamp('adjusted_end_time');
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('caregivers'))) {
    await knex.schema.createTable('caregivers', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email').notNullable().unique();
      table.string('phone');
      table.string('npi', 10);
      table.date('hire_date');
      table.string('status').notNullable().defaultTo('active');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('caregiver_credentials'))) {
    await knex.schema.createTable('caregiver_credentials', (table) => {
      table.uuid('id').primary();
      table.uuid('caregiver_id').references('id').inTable('caregivers').notNullable();
      table.string('credential_type').notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.date('expires_at').notNullable();
      table.date('issued_at').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('staff_invites'))) {
    await knex.schema.createTable('staff_invites', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('email').notNullable();
      table.string('role').notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.uuid('invited_by').references('id').inTable('users').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('evv_exceptions'))) {
    await knex.schema.createTable('evv_exceptions', (table) => {
      table.uuid('id').primary();
      table.uuid('visit_id').references('id').inTable('evv_visits').notNullable();
      table.string('exception_type').notNullable();
      table.text('reason').notNullable();
      table.uuid('approved_by').nullable();
      table.timestamp('approved_at').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('audit_events'))) {
    await knex.schema.createTable('audit_events', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.uuid('actor_id').notNullable();
      table.string('actor_type').notNullable().defaultTo('user');
      table.string('event_type').notNullable();
      table.string('entity_type').notNullable();
      table.uuid('entity_id').notNullable();
      table.string('outcome').notNullable().defaultTo('success');
      table.string('correlation_id');
      table.jsonb('payload').notNullable().defaultTo('{}');
      table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['agency_id', 'event_type']);
      table.index(['entity_type', 'entity_id']);
      table.index(['occurred_at']);
    });
  }

  if (await knex.schema.hasTable('audit_events')) {
    if (!(await knex.schema.hasColumn('audit_events', 'actor_type'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('actor_type').notNullable().defaultTo('user');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'outcome'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('outcome').notNullable().defaultTo('success');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'correlation_id'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('correlation_id');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'occurred_at'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
      });
    }
    await knex.raw('create index if not exists audit_events_agency_event_idx on audit_events (agency_id, event_type)');
    await knex.raw('create index if not exists audit_events_entity_idx on audit_events (entity_type, entity_id)');
    await knex.raw('create index if not exists audit_events_occurred_at_idx on audit_events (occurred_at)');
  }

  // ── R4 hardening ──────────────────────────────────────────────────────────
  // Convert every `timestamp without time zone` column in the public schema
  // to `timestamptz`. Existing values are reinterpreted as UTC (application
  // emits ISO 8601 via `new Date().toISOString()`, which is UTC). Idempotent:
  // the loop only matches columns that are still timezone-naive.
  await knex.raw(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'
      LOOP
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
          r.table_name, r.column_name, r.column_name
        );
      END LOOP;
    END$$;
  `);

  // sessions.user_id → users.id with ON DELETE CASCADE so a user purge
  // (HIPAA right-to-be-forgotten / staff offboarding) takes active session
  // rows with it instead of leaving orphans that can never be cleaned up.
  // Drop+add is the only portable way to add CASCADE to an existing FK in PG.
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='sessions') THEN
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_foreign;
        ALTER TABLE sessions
          ADD CONSTRAINT sessions_user_id_foreign
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  // CHECK constraints — refuse to ever store a role / status / outcome value
  // outside the documented enum. Caught early at INSERT so a typo or a
  // forged-payload attempt cannot land bogus data in the audit trail.
  // Each block is wrapped in a name-not-exists guard so reruns are no-ops.
  const checkConstraints: Array<{ table: string; name: string; expression: string }> = [
    { table: 'users', name: 'users_role_check', expression: "role IN ('admin','coordinator','caregiver','family')" },
    { table: 'sessions', name: 'sessions_role_check', expression: "role IN ('admin','coordinator','caregiver','family')" },
    { table: 'evv_visits', name: 'evv_visits_status_check', expression: "status IN ('pending','verified','flagged')" },
    { table: 'caregivers', name: 'caregivers_status_check', expression: "status IN ('active','inactive','terminated')" },
    { table: 'audit_events', name: 'audit_events_actor_type_check', expression: "actor_type IN ('user','service','system')" },
    { table: 'audit_events', name: 'audit_events_outcome_check', expression: "outcome IN ('success','failure','denied')" },
    {
      table: 'audit_events',
      name: 'audit_events_event_type_check',
      expression: `event_type IN (
        'auth.login.success','auth.login.failure','auth.logout',
        'session.created','session.revoked','csrf.failure',
        'phi.read','phi.create','phi.update','phi.delete','phi.export',
        'request.write','permission.denied'
      )`
    }
  ];
  for (const c of checkConstraints) {
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name='${c.table}')
           AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                           WHERE table_schema='public'
                             AND table_name='${c.table}'
                             AND constraint_name='${c.name}') THEN
          ALTER TABLE ${c.table}
            ADD CONSTRAINT ${c.name} CHECK (${c.expression});
        END IF;
      END$$;
    `);
  }

  // audit_events is append-only. The compliance position is "audit rows are
  // evidence; nobody — including future-us with a SQL console open — gets to
  // edit them." A BEFORE trigger on UPDATE/DELETE/TRUNCATE raises an exception
  // so the only path to mutation is dropping the trigger first (which itself
  // is auditable in PG's DDL log).
  //
  // Drop+create is idempotent: existing trigger of this name is replaced.
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='audit_events') THEN
        CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $f$
        BEGIN
          RAISE EXCEPTION 'audit_events is append-only; UPDATE/DELETE refused';
        END;
        $f$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS audit_events_block_mutation_trg ON audit_events;
        CREATE TRIGGER audit_events_block_mutation_trg
          BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
          FOR EACH STATEMENT
          EXECUTE FUNCTION audit_events_block_mutation();
      END IF;
    END$$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_events');
  await knex.schema.dropTableIfExists('evv_exceptions');
  await knex.schema.dropTableIfExists('staff_invites');
  await knex.schema.dropTableIfExists('caregiver_credentials');
  await knex.schema.dropTableIfExists('caregivers');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('visit_maintenance');
  await knex.schema.dropTableIfExists('evv_visits');
  await knex.schema.dropTableIfExists('assignments');
  await knex.schema.dropTableIfExists('visit_templates');
  await knex.schema.dropTableIfExists('authorizations');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('agencies');
}
