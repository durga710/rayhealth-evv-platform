/**
 * Agency clearinghouse config routes.
 *
 *   GET  /agencies/me/clearinghouse-config , read transport/endpoint/settings + hasCredentials
 *   PUT  /agencies/me/clearinghouse-config , admin-only update (write-only credentials)
 *
 * Sibling to the Sandata / HHAeXchange config routes. Credentials are stored
 * AES-256-GCM encrypted by the repository and never returned to the client.
 */

import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import { z } from 'zod'
import {
  AgencyClearinghouseConfigRepository,
  AuditEventRepository,
  isBlockedOutboundHost,
  isSafeOutboundUrl,
  type PartialClearinghouseConfig,
} from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'
import { buildTransportForAgency } from '../services/clearinghouse-service.js'

const router = Router()

const clearinghouseConfigUpdateSchema = z.object({
  transport: z.enum(['sftp', 'http', 'sandbox']).optional(),
  endpoint: z.string().max(255).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  // Write-only. undefined = leave unchanged; null = clear; object = encrypt+store.
  credentials: z
    .object({
      username: z.string().max(255).optional(),
      password: z.string().max(255).optional(),
      apiKey: z.string().max(512).optional(),
      account: z.string().max(255).optional(),
    })
    .strict()
    .nullable()
    .optional(),
})

type ClearinghouseConfigUpdate = z.infer<typeof clearinghouseConfigUpdateSchema>

function emptyPartialFor(agencyId: string): PartialClearinghouseConfig {
  return {
    agencyId,
    transport: 'sftp',
    endpoint: null,
    settings: {},
    enabled: false,
    hasCredentials: false,
  }
}

function mergeConfig(current: PartialClearinghouseConfig, update: ClearinghouseConfigUpdate): PartialClearinghouseConfig {
  return {
    agencyId: current.agencyId,
    transport: update.transport ?? current.transport,
    endpoint: update.endpoint !== undefined ? update.endpoint : current.endpoint,
    settings: update.settings ?? current.settings,
    enabled: update.enabled ?? current.enabled,
    hasCredentials: current.hasCredentials,
  }
}

function validateForEnable(next: PartialClearinghouseConfig): string | null {
  if (!next.enabled) return null
  // Sandbox is a built-in simulator: no endpoint or credentials needed.
  if (next.transport === 'sandbox') return null
  if (!next.endpoint) return 'cannot enable: endpoint is required'
  if (next.transport === 'sftp') {
    if (next.endpoint.includes('://')) return 'cannot enable: SFTP endpoint must be a bare hostname, not a URL'
    if (isBlockedOutboundHost(next.endpoint)) return 'cannot enable: SFTP host must be a public hostname'
    return null
  }
  if (!isSafeOutboundUrl(next.endpoint)) return 'cannot enable: endpoint must be a public https URL'
  return null
}

function redactForAudit(c: PartialClearinghouseConfig): Record<string, unknown> {
  return {
    transport: c.transport,
    endpointSet: Boolean(c.endpoint),
    enabled: c.enabled,
    hasCredentials: c.hasCredentials,
    settingKeys: Object.keys(c.settings ?? {}).length,
  }
}

router.get('/me/clearinghouse-config', requireCapability('agency.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex | undefined
    if (!db) {
      res.status(500).json({ success: false, error: 'database missing' })
      return
    }
    const stored = await new AgencyClearinghouseConfigRepository(db).findByAgency(req.auth.agencyId)
    res.json({ success: true, data: stored ?? emptyPartialFor(req.auth.agencyId) })
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'unexpected error' })
  }
})

router.put('/me/clearinghouse-config', requireCapability('agency.write'), async (req: Request, res: Response) => {
  try {
    const parsed = clearinghouseConfigUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'clearinghouse-config payload failed validation', details: parsed.error.issues })
      return
    }
    const db = req.app.get('db') as Knex | undefined
    if (!db) {
      res.status(500).json({ success: false, error: 'database missing' })
      return
    }

    const repo = new AgencyClearinghouseConfigRepository(db)
    const previous = (await repo.findByAgency(req.auth.agencyId)) ?? emptyPartialFor(req.auth.agencyId)
    const next = mergeConfig(previous, parsed.data)

    const guardError = validateForEnable(next)
    if (guardError) {
      res.status(422).json({ success: false, error: guardError })
      return
    }

    const stored = await repo.upsert({ ...next, credentials: parsed.data.credentials })

    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'agency.evv-config.changed',
        entityType: 'agency_clearinghouse_config',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { aggregator: 'clearinghouse', previous: redactForAudit(previous), next: redactForAudit(stored) },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] agency.evv-config.changed (clearinghouse) agency=${req.auth.agencyId} ` +
          `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.json({ success: true, data: stored })
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'unexpected error' })
  }
})

/**
 * POST /agencies/me/clearinghouse-config/test, transport connectivity check.
 * SFTP connects and lists the remittance directory, HTTP probes the endpoint,
 * sandbox always succeeds. Responses are sanitized by the transport layer;
 * no remote error text or credentials ever reach the client.
 */
router.post(
  '/me/clearinghouse-config/test',
  requireCapability('agency.write'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }
      const built = await buildTransportForAgency(db, req.auth.agencyId)
      if (built.kind === 'not_configured') {
        res.json({ success: true, data: { ok: false, detail: built.reason } })
        return
      }
      const result = await built.transport.testConnection()
      res.json({
        success: true,
        data:
          result.kind === 'ok'
            ? { ok: true, detail: result.detail }
            : { ok: false, detail: result.message },
      })
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'unexpected error' })
    }
  },
)

export default router
