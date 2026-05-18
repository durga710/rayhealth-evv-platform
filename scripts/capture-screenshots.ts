#!/usr/bin/env tsx
/**
 * capture-screenshots.ts
 *
 * Playwright-driven UI verification per the engineering directive. Logs in
 * with a persona-scoped session, navigates to each key route, and dumps a
 * PNG to ./screenshots/ named by persona + route.
 *
 * Run:
 *   # Against local dev (default)
 *   npx tsx scripts/capture-screenshots.ts
 *
 *   # Against the preview environment
 *   PREVIEW_URL=https://preview.rayhealthevv.com npx tsx scripts/capture-screenshots.ts
 *
 *   # Only the curated set (skip exhaustive coverage)
 *   npx tsx scripts/capture-screenshots.ts --showcase-only
 *
 * Required env vars when running against a real environment:
 *   PREVIEW_URL or PRODUCTION_URL — base URL
 *   FIXTURE_ADMIN_EMAIL + FIXTURE_ADMIN_PASSWORD — admin login
 *   FIXTURE_CAREGIVER_EMAIL + FIXTURE_CAREGIVER_PASSWORD — caregiver login
 *
 * Outputs: ./screenshots/<persona>/<route-slug>.png
 *
 * Dependencies: requires `playwright` to be installed in the workspace.
 * Run `npx playwright install chromium` once before first use.
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import type { Browser, BrowserContext, Page } from 'playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(PROJECT_ROOT, 'screenshots')

interface PersonaRoute {
  /** Output slug used in the filename. */
  slug: string
  /** Path relative to the base URL, e.g. "/admin/learning". */
  path: string
  /** Optional CSS selector to wait for before capturing (ensures content has rendered). */
  waitForSelector?: string
  /** Marked showcase=true is included even when --showcase-only is set. */
  showcase?: boolean
}

interface Persona {
  name: 'admin' | 'coordinator' | 'caregiver'
  email: string
  password: string
  routes: PersonaRoute[]
}

const SHOWCASE_ONLY = process.argv.includes('--showcase-only')
const BASE_URL =
  process.env.PREVIEW_URL ?? process.env.PRODUCTION_URL ?? 'http://localhost:5173'

function envOrDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

const PERSONAS: Persona[] = [
  {
    name: 'admin',
    email: envOrDefault('FIXTURE_ADMIN_EMAIL', 'admin@rayhealthevv.local'),
    password: envOrDefault('FIXTURE_ADMIN_PASSWORD', 'TestAdmin2026!'),
    routes: [
      { slug: 'dashboard', path: '/admin/agency', waitForSelector: 'h2', showcase: true },
      { slug: 'staff', path: '/admin/staff', waitForSelector: 'h2', showcase: true },
      { slug: 'learning-hub', path: '/admin/learning', waitForSelector: 'h2', showcase: true },
      { slug: 'learning-analytics', path: '/admin/learning/analytics', waitForSelector: 'h2', showcase: true },
      { slug: 'learning-catalog', path: '/admin/learning/courses', waitForSelector: 'h2' },
      { slug: 'copilot', path: '/admin/learning/copilot', waitForSelector: 'h2' },
      { slug: 'settings', path: '/admin/settings', waitForSelector: 'h2', showcase: true },
      { slug: 'assignments', path: '/admin/assignments', waitForSelector: 'h2' },
      { slug: 'visit-review', path: '/admin/review', waitForSelector: 'h2' },
    ],
  },
  {
    name: 'coordinator',
    email: envOrDefault('FIXTURE_COORDINATOR_EMAIL', 'coord@rayhealthevv.local'),
    password: envOrDefault('FIXTURE_COORDINATOR_PASSWORD', 'TestCoord2026!'),
    routes: [
      { slug: 'learning-hub', path: '/admin/learning', waitForSelector: 'h2', showcase: true },
      { slug: 'assignments', path: '/admin/assignments', waitForSelector: 'h2', showcase: true },
      { slug: 'visit-review', path: '/admin/review', waitForSelector: 'h2' },
    ],
  },
]

interface CaptureResult {
  persona: string
  slug: string
  ok: boolean
  path?: string
  error?: string
}

async function loginAs(page: Page, persona: Persona): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', persona.email)
  await page.fill('input[type="password"]', persona.password)
  await page.click('button[type="submit"]')
  // Wait for the cookie session to be set; the redirect to /admin/agency tells us auth worked.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}

async function captureRoute(
  context: BrowserContext,
  persona: Persona,
  route: PersonaRoute,
): Promise<CaptureResult> {
  const page = await context.newPage()
  try {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15_000 })
    if (route.waitForSelector) {
      await page.waitForSelector(route.waitForSelector, { timeout: 10_000 })
    }
    const personaDir = join(OUTPUT_DIR, persona.name)
    await mkdir(personaDir, { recursive: true })
    const outPath = join(personaDir, `${route.slug}.png`)
    await page.screenshot({ path: outPath, fullPage: true })
    return { persona: persona.name, slug: route.slug, ok: true, path: outPath }
  } catch (err) {
    return {
      persona: persona.name,
      slug: route.slug,
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
    }
  } finally {
    await page.close()
  }
}

async function main(): Promise<void> {
  // Lazy import so the script can be type-checked without playwright installed.
  const { chromium } = (await import('playwright')) as typeof import('playwright')

  const browser: Browser = await chromium.launch({ headless: true })
  const results: CaptureResult[] = []

  try {
    for (const persona of PERSONAS) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      })
      try {
        await loginAs(await context.newPage(), persona)
      } catch (err) {
        process.stderr.write(
          `[${persona.name}] login failed: ${err instanceof Error ? err.message : 'unknown'}\n`,
        )
        // Continue to the next persona — don't block the whole run on one bad login.
        await context.close()
        continue
      }

      const routes = SHOWCASE_ONLY
        ? persona.routes.filter((r) => r.showcase)
        : persona.routes

      for (const route of routes) {
        const result = await captureRoute(context, persona, route)
        results.push(result)
        if (result.ok) {
          process.stdout.write(`  ✓ ${persona.name}/${result.slug} → ${result.path}\n`)
        } else {
          process.stdout.write(`  ✗ ${persona.name}/${result.slug}: ${result.error}\n`)
        }
      }

      await context.close()
    }
  } finally {
    await browser.close()
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  process.stdout.write(`\nCaptured ${ok} screenshots, ${failed} failed.\n`)
  process.stdout.write(`Output: ${OUTPUT_DIR}\n`)
  if (failed > 0) process.exit(1)
}

main().catch((err: unknown) => {
  process.stderr.write(`capture-screenshots: ${err instanceof Error ? err.message : 'unknown'}\n`)
  process.exit(1)
})
