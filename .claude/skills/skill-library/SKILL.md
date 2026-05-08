---
name: skill-library
description: Project-scoped router for the Everything Claude Code plugin. Maps stack keywords (TypeScript, React, Vite, Express, Knex, Postgres, EVV, HIPAA, Vitest, Expo) to specific ECC agents and skills. Use when an ECC surface might apply but is not loaded by default.
---

# RayHealth EVV — ECC Skill Library Router

This is a router, not a skill body. The full ECC bundle lives in `~/.claude/plugins/cache/everything-claude-code/` and is reachable through plugin search. Project-level config keeps the daily surface tight; this file restores access to LIBRARY surfaces by keyword.

## DAILY (auto-loaded for this repo)

These are session-loaded by the user-level ECC plugin and rules. No router needed:

- **Reviewers:** `typescript-reviewer`, `code-reviewer`, `security-reviewer`, `healthcare-reviewer`, `database-reviewer`
- **Architecture:** `planner`, `architect`, `code-architect`, `code-explorer`
- **Testing:** `tdd-guide`, `pr-test-analyzer`, `e2e-runner`
- **Refactoring:** `refactor-cleaner`, `code-simplifier`, `comment-analyzer`, `silent-failure-hunter`, `type-design-analyzer`
- **Build/perf:** `build-error-resolver`, `performance-optimizer`, `a11y-architect`
- **Docs:** `doc-updater`, `docs-lookup`
- **Skills:** `postgres-patterns`, `backend-patterns`, `accessibility`, `api-design`, `security-review`, `security-scan`, `coding-standards`, `code-tour`, `codebase-onboarding`
- **Rules:** `typescript/*`, `web/*`, `common/*`

## LIBRARY (search-only, surface by keyword)

| If the user mentions… | Surface to invoke |
|---|---|
| `python`, `pip`, `pyproject`, `pytest`, `django`, `flask`, `fastapi` | `python-reviewer`, `python-patterns`, `python-testing`, `pytorch-build-resolver` |
| `go`, `golang`, `go.mod` | `go-reviewer`, `go-build-resolver`, `golang-patterns`, `golang-testing` |
| `rust`, `cargo`, `crate` | `rust-reviewer`, `rust-build-resolver`, `rust-patterns`, `rust-testing` |
| `java`, `spring`, `maven`, `gradle`, `kotlin` | `java-reviewer`, `java-build-resolver`, `kotlin-reviewer`, `kotlin-build-resolver`, `springboot-*`, `kotlin-*` |
| `swift`, `swiftui`, `xcode` | `swift-*`, `swiftui-patterns` |
| `flutter`, `dart`, `pubspec` | `flutter-reviewer`, `dart-build-resolver`, `compose-multiplatform-patterns` |
| `c++`, `cmake`, `cpp` | `cpp-reviewer`, `cpp-build-resolver` |
| `c#`, `dotnet`, `.net` | `csharp-reviewer` |
| `php`, `laravel`, `composer` | `laravel-patterns`, `laravel-security`, `laravel-tdd` |
| `next`, `nextjs`, `nuxt` | `nextjs-turbopack`, `nuxt4-patterns` |
| `bun`, `bun.lockb` | `bun-runtime` |
| `nestjs` | `nestjs-patterns` |
| `clickhouse`, `analytics db` | `clickhouse-io` |
| `gan`, `evolutionary loop`, `generator/evaluator` | `gan-planner`, `gan-generator`, `gan-evaluator` |
| `open source`, `OSS release`, `sanitize repo` | `opensource-forker`, `opensource-sanitizer`, `opensource-packager` |
| `seo`, `meta tags`, `schema.org`, `core web vitals` | `seo-specialist`, `seo` |
| `agent harness`, `loop operator`, `autonomous loop` | `loop-operator`, `harness-optimizer`, `autonomous-loops`, `continuous-agent-loop` |
| `ECC config`, `install ECC`, `agent sort`, `skill stocktake` | `agent-sort`, `configure-ecc`, `skill-stocktake`, `skill-comply` |

## How to Surface a LIBRARY Item

1. The user's request includes a trigger keyword from the table.
2. Suggest the matching ECC agent or skill explicitly: *"This looks like a Python concern — want me to use the `python-reviewer` agent?"*
3. Invoke via the standard Agent or Skill tool — the surface is loaded on demand from the plugin cache; no project-level install needed.

## Stack Anchors (do not drift)

This repo is **TypeScript-only**: 150 .ts/.tsx files, zero source files in any other language. Frontend = **React 19 + Vite**. Backend = **Express + Knex + PostgreSQL**. Mobile = **Expo + React Native**. Test = **Vitest**. Monorepo = **npm workspaces + Turbo**. Deploy = **Vercel**.

If a request implies a different stack (Next.js, Bun, Django, Spring), ask before running off-stack tooling.
