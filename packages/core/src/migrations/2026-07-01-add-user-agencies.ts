/**
 * Migration: user_agencies membership table for multi-agency caregivers.
 *
 * A caregiver can be contracted at more than one agency while signing in with
 * a single mobile identity. `users` keeps its single `agency_id` as the home
 * (default) agency for backward compatibility; `user_agencies` records every
 * agency the user may act in, with the per-agency role and caregiver link the
 * JWT needs when the user switches context.
 *
 * Backfill inserts one membership per existing user from users.agency_id /
 * users.role / users.caregiver_id, guarded by NOT EXISTS — idempotent, safe
 * to re-run.
 */

import type { Knex } from 'knex'

const TABLE = 'user_agencies'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) {
    await knex.schema.createTable(TABLE, (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
      table.uuid('agency_id').references('id').inTable('agencies').notNullable()
      // Per-agency caregiver record — the same person is a distinct caregivers
      // row at each agency, and EVV visits/schedules hang off that row.
      table.uuid('caregiver_id')
      table.string('role').notNullable()
      // 'active' | 'disconnected' — a disconnected membership stays as an audit
      // trail but no longer grants access; the agency re-approves to restore it.
      table.string('status').notNullable().defaultTo('active')
      table.timestamps(true, true)
      table.unique(['user_id', 'agency_id'])
    })
  }

  await knex.raw(`
    INSERT INTO user_agencies (user_id, agency_id, caregiver_id, role, status)
    SELECT u.id, u.agency_id, u.caregiver_id, u.role, 'active'
    FROM users u
    WHERE u.agency_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_agencies ua
        WHERE ua.user_id = u.id AND ua.agency_id = u.agency_id
      )
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE)
}
