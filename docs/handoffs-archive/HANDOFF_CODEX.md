# Handoff to Codex

**Audience:** OpenAI Codex (this file is written for you to read first in the next session.)  
**Date:** 2026-05-07  
**From:** Cursor agent session  
**Workspace:** `/Users/durgaghimeray/Desktop/rayhealthevv-fresh`

## What the user wanted

1. **Project context** — Earlier messages referenced a full RayHealth EVV–style tree (`AGENTS.md`, `packages/`, `verticals/`, etc.). On disk, a large existing clone also lives at `../Ray Health EVV APP` on the Desktop (separate from this workspace).
2. **“Claude DMG”** — User asked to “send” the Claude Desktop installer for a from-scratch setup. No DMG lives in the repo; official macOS install is via [Claude download](https://claude.ai/download) / [Install Claude Desktop](https://support.claude.com/en/articles/10065433-install-claude-desktop). Clarify with the user if they meant something else (e.g. distributing an internal build).
3. **Superpowers plugin** — Explained in session; no code changes required for that explanation.
4. **Explicit stop** — User said “stop here codex will take over,” then requested this handoff.

**User instruction (verbatim):** “generate the handoff”

## Current workspace contents (this folder)

- `AGENTS.md` — Agent/domain directives (RayHealth EVV style).
- `.cursor/settings.json` — Plugins config (see below).
- `rayhealth-fresh/` — Turborepo-style stub with `packages/` (`app`, `core`, `web`) and root `package.json` / `turbo.json`; verify local edits with `git status` from the real repo root.

## Cursor: Superpowers plugin

- **Enabled in:** `.cursor/settings.json` (`plugins.superpowers.enabled: true`).
- **What it is:** Cursor Marketplace plugin [Superpowers](https://cursor.com/marketplace/superpowers) ([source](https://github.com/obra/superpowers)) — skills/agents/commands that steer the agent (brainstorming, plans, TDD-style discipline, code review agent, finishing branches, parallel dispatch, etc.).
- **Install reference:** `/add-plugin superpowers` in Agent chat (per marketplace).

## File purpose and callers

- **Purpose:** Session handoff **for Codex** only; not imported by application code.
- **Callers:** None — Codex should load this at session start (paste path or attach file).

## Suggested next steps for Codex

1. Confirm with the user which tree is authoritative: **`rayhealthevv-fresh`** (fresh/scratch) vs **`../Ray Health EVV APP`** (full app).
2. If continuing scratch work: align `rayhealth-fresh` with `AGENTS.md` expectations (Node 22, ESM, `.js` imports, etc.) per `AGENTS.md`.
3. Run `git rev-parse --show-toplevel` from this directory before trusting broad `git status` output.

## Open questions for the user

- Is the goal to **develop only in `rayhealthevv-fresh`**, or to **sync/replace** with `Ray Health EVV APP`?
- Did “Claude DMG” mean **Desktop app download**, **Claude Code**, or another artifact?

---

_End of handoff._
