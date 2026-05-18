import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import {
  agencyEvvConfigUpdateSchema,
  AgencyEvvConfigRepository,
  AgencyHhaexchangeConfigRepository,
  AgencySandataConfigRepository,
  agencyFeaturesSchema,
  AuditEventRepository,
  DEFAULT_AGENCY_FEATURES,
  getStateConfig,
  parseAgencyFeatures,
  type AgencyEvvConfig,
  type AgencyFeatures,
} from '@rayhealth/core'
import { requireCapability } from '../middleware/require-capability.js'

const router = Router()

router.get('/current', requireCapability('agency.read'), (req: Request, res: Response) => {
  res.json({ id: req.auth.agencyId, name: 'Keystone Care', state: 'PA' })
})

/**
 * GET /agencies/me/features
 *
 * Returns the feature-flag map for the caller's agency. Any authenticated
 * user can read this — the UI uses it to gate the AI Copilot panel surface.
 */
router.get('/me/features', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ success: false, error: 'unauthenticated' })
    return
  }
  try {
    const db = req.app.get('db') as Knex | undefined
    if (!db) {
      res.json({ success: true, data: DEFAULT_AGENCY_FEATURES })
      return
    }
    const row = (await db('agencies')
      .where({ id: req.auth.agencyId })
      .first('features')) as { features?: unknown } | undefined
    const features: AgencyFeatures = parseAgencyFeatures(row?.features)
    res.json({ success: true, data: features })
  } catch (error: unknown) {
    // Read failures fall back to defaults rather than blocking the UI.
    process.stderr.write(
      `[agency-features] read failed: ${error instanceof Error ? error.message : 'unknown'}\n`,
    )
    res.json({ success: true, data: DEFAULT_AGENCY_FEATURES })
  }
})

/**
 * PUT /agencies/me/features
 *
 * Admin-only. Updates the agency's feature flags. Validates against
 * agencyFeaturesSchema, persists to the JSONB column, writes a structured
 * audit event with before/after diff so changes are forensically reviewable.
 */
router.put(
  '/me/features',
  requireCapability('agency.write'),
  async (req: Request, res: Response) => {
    try {
      const parsed = agencyFeaturesSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'features payload failed validation',
          details: parsed.error.issues,
        })
        return
      }
      const next = parsed.data

      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }

      // Read current to log a diff in the audit event.
      const currentRow = (await db('agencies')
        .where({ id: req.auth.agencyId })
        .first('features')) as { features?: unknown } | undefined
      const previous = parseAgencyFeatures(currentRow?.features)

      await db('agencies')
        .where({ id: req.auth.agencyId })
        .update({ features: JSON.stringify(next), updated_at: db.fn.now() })

      // Audit the change. Wrapped in try/catch — audit failures must never
      // block the user-facing operation.
      try {
        const auditRepo = new AuditEventRepository(db)
        await auditRepo.create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'agency.feature.changed',
          entityType: 'agency',
          entityId: req.auth.agencyId,
          outcome: 'success',
          payload: {
            previous,
            next,
          },
        })
      } catch (auditErr: unknown) {
        process.stderr.write(
          `[audit-write-failed] agency.feature.changed agency=${req.auth.agencyId} ` +
            `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
        )
      }

      res.json({ success: true, data: next })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

// ----- EVV aggregator config (Sandata vs HHAeXchange) -----

interface EvvConfigResponse extends AgencyEvvConfig {
  /** Whether the agency's state allows aggregator choice. UI uses this to
   * disable the picker for forced-aggregator states (e.g. NJ → HHAeXchange). */
  choiceAvailable: boolean
  /** State's default aggregator — surfaced so the UI can show "(state default)". */
  stateDefaultAggregator: 'sandata' | 'hhaexchange' | 'none'
}

async function readAgencyState(db: Knex, agencyId: string): Promise<string> {
  const row = (await db('agencies').where({ id: agencyId }).first('state')) as
    | { state?: string }
    | undefined
  return (row?.state ?? 'PA').toUpperCase()
}

function decorate(
  config: AgencyEvvConfig,
  stateCode: string,
): EvvConfigResponse {
  const state = getStateConfig(stateCode)
  return {
    ...config,
    choiceAvailable: state?.aggregatorChoice ?? false,
    stateDefaultAggregator: state?.defaultAggregator ?? 'none',
  }
}

router.get(
  '/me/evv-config',
  requireCapability('agency.read'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }

      const stateCode = await readAgencyState(db, req.auth.agencyId)
      const repo = new AgencyEvvConfigRepository(db)
      const config = await repo.findOrInitialize(req.auth.agencyId, stateCode)

      res.json({ success: true, data: decorate(config, stateCode) })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

router.put(
  '/me/evv-config',
  requireCapability('agency.write'),
  async (req: Request, res: Response) => {
    try {
      const parsed = agencyEvvConfigUpdateSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'evv-config payload failed validation',
          details: parsed.error.issues,
        })
        return
      }
      const update = parsed.data

      const db = req.app.get('db') as Knex | undefined
      if (!db) {
        res.status(500).json({ success: false, error: 'database missing' })
        return
      }

      const stateCode = await readAgencyState(db, req.auth.agencyId)
      const state = getStateConfig(stateCode)

      // Reject choices the state doesn't allow. NJ caregivers can't be
      // routed through Sandata even if an admin checks the wrong box.
      if (state && !state.aggregatorChoice && update.aggregator !== state.defaultAggregator) {
        res.status(422).json({
          success: false,
          error: `state ${stateCode} does not allow aggregator choice — must use ${state.defaultAggregator}`,
        })
        return
      }

      const repo = new AgencyEvvConfigRepository(db)
      const previous = await repo.findOrInitialize(req.auth.agencyId, stateCode)

      // production_ready can only be flipped on if the chosen aggregator's
      // config is populated AND enabled. Refuse premature go-live attempts.
      const wantsProduction = update.productionReady ?? previous.productionReady
      if (wantsProduction && !previous.productionReady && update.aggregator === 'sandata') {
        const sandataConfig = await new AgencySandataConfigRepository(db).findByAgency(req.auth.agencyId)
        if (!sandataConfig?.enabled || !sandataConfig.providerId) {
          res.status(422).json({
            success: false,
            error: 'cannot mark production-ready: Sandata provider_id missing or aggregator not enabled',
          })
          return
        }
      }
      if (wantsProduction && !previous.productionReady && update.aggregator === 'hhaexchange') {
        const hhaConfig = await new AgencyHhaexchangeConfigRepository(db).findByAgency(req.auth.agencyId)
        if (!hhaConfig?.enabled || !hhaConfig.agencyTaxId || !hhaConfig.hhaProviderId) {
          res.status(422).json({
            success: false,
            error:
              'cannot mark production-ready: HHAeXchange agency_tax_id / hha_provider_id missing or aggregator not enabled',
          })
          return
        }
      }

      const next = await repo.upsert({
        agencyId: req.auth.agencyId,
        aggregator: update.aggregator,
        stateCode,
        productionReady: wantsProduction,
      })

      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'agency.evv-config.changed',
          entityType: 'agency',
          entityId: req.auth.agencyId,
          outcome: 'success',
          payload: { previous, next },
        })
      } catch (auditErr: unknown) {
        process.stderr.write(
          `[audit-write-failed] agency.evv-config.changed agency=${req.auth.agencyId} ` +
            `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
        )
      }

      res.json({ success: true, data: decorate(next, stateCode) })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'
      res.status(500).json({ success: false, error: message })
    }
  },
)

export default router
