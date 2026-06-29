/**
 * Migration: install the append-only trigger on audit_events and bring the
 * audit_events_archive shape into alignment with the live audit_events shape.
 *
 * Two related issues this fixes:
 *
 *   1. The append-only invariant on `audit_events` was previously documented
 *      and asserted by the retention sweep ("temporarily disables the
 *      trigger inside a transaction") but the trigger itself was never
 *      installed. Until now nothing in Postgres or application code blocked
 *      UPDATE or DELETE against audit_events outside the sweep. This
 *      migration installs `audit_events_block_mutation_trg`.
 *
 *   2. The audit_events_archive shape was modelled against an earlier
 *      audit_events schema that used `actor_user_id`, `actor_caregiver_id`,
 *      `resource_type`, `resource_id`, `user_agent`, `ip_address`. The live
 *      `audit_events` table uses `actor_id`, `actor_type`, `entity_type`,
 *      `entity_id`, `outcome`, `correlation_id` (see schema.ts:171-189).
 *      The retention sweep's INSERT...SELECT therefore referenced columns
 *      that did not exist on `audit_events` and would have failed on the
 *      first non-empty run.
 *
 * The trigger is a default-mode trigger (not ENABLE ALWAYS), which means it
 * respects `SET LOCAL session_replication_role = 'replica'`. This is the
 * exact bypass pattern used by audit-retention-sweep.ts and by test setup
 * helpers, so this migration is compatible with the existing sweep design.
 *
 * Idempotent.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-06-08-add-audit-events-trigger-and-fix-archive.d.ts.map