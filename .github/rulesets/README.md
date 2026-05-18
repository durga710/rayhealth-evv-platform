# GitHub repo hardening — rulesets

These JSON files are the canonical branch and tag protection rules for `github.com/durga710/rayhealth-evv-platform`. They protect the `main` branch from accidental or malicious destruction, enforce code review, and gate merges on CI signal.

## What's protected

### `main-branch-protection.json`

Applies to `refs/heads/main`. Active enforcement, **no bypass actors** — even admins must go through PRs.

| Rule | Effect |
|---|---|
| `deletion` | `main` cannot be deleted |
| `non_fast_forward` | force-push to `main` is blocked |
| `required_linear_history` | merge commits forbidden — squash or rebase only |
| `pull_request` (1 approval, code-owner review, dismiss stale, last-push approval, thread resolution) | every change comes through a PR with a fresh review of the latest commit and all comments resolved |
| `required_status_checks` (strict) | merge blocked until `typecheck`, `lint`, `security-scan`, `test-core`, `test-app`, `test-web` all pass on the latest commit |
| `commit_message_pattern` | enforces Conventional Commits format on every commit |

### `tags-protection.json`

Applies to all tags. No deletion, no force-push, no update — once a release tag is cut, it's immutable forever. Critical for HIPAA evidence (audit trail of what was actually deployed at what point in time).

## Apply via `gh` CLI (recommended)

```bash
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"

# Make sure you're authed as the repo owner
gh auth status

# Apply both rulesets
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/durga710/rayhealth-evv-platform/rulesets \
  --input .github/rulesets/main-branch-protection.json

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/durga710/rayhealth-evv-platform/rulesets \
  --input .github/rulesets/tags-protection.json
```

To list/inspect existing rulesets:

```bash
gh api /repos/durga710/rayhealth-evv-platform/rulesets
```

To update one in place (replace `RULESET_ID`):

```bash
gh api --method PUT \
  /repos/durga710/rayhealth-evv-platform/rulesets/RULESET_ID \
  --input .github/rulesets/main-branch-protection.json
```

## Apply via the GitHub dashboard

If you prefer point-and-click:

1. https://github.com/durga710/rayhealth-evv-platform/settings/rules → **New ruleset** → **New branch ruleset**
2. Name: `main branch protection`
3. Enforcement status: **Active**
4. Target branches: **Include default branch**
5. Bypass list: leave empty
6. Branch rules — turn on:
   - Restrict deletions
   - Block force pushes
   - Require linear history
   - Require a pull request before merging
     - Required approvals: **1**
     - Dismiss stale pull request approvals when new commits are pushed
     - Require review from Code Owners
     - Require approval of the most recent reviewable push
     - Require conversation resolution before merging
   - Require status checks to pass
     - Require branches to be up to date before merging
     - Add: `typecheck`, `lint`, `security-scan`, `test-core`, `test-app`, `test-web`
   - Restrict commit metadata (optional but recommended):
     - Pattern: `^(feat|fix|chore|docs|refactor|perf|test|build|ci|revert)(\(.+\))?: .+`
7. **Create**

Then add a second ruleset for tags:

1. New ruleset → New tag ruleset → Name: `tag protection`
2. Target tags: `~ALL` (include all tags)
3. Turn on: restrict deletions, block force pushes, restrict updates
4. Create

## Why "no bypass actors"

The bypass list (admins, deploy bots, etc.) is intentionally empty. Even you as the owner must open a PR for any change to `main`. This is the HIPAA-aligned posture — every production-bound change has a reviewable audit trail. If you ever need to make an emergency hotfix, you can temporarily disable the ruleset in the dashboard, push, then re-enable — that disable/re-enable itself appears in the audit log.

## Optional hardening (next step)

Once the team grows past one person, layer these on:

- **Require signed commits** (`required_signatures` rule) — every commit must be GPG/SSH signed. Adds friction for first-time setup but is the gold standard for healthcare. Add when ready by including `{ "type": "required_signatures" }` in the rules array.
- **Bump required approving review count to 2** — when there are at least 3 engineers.
- **Restrict who can dismiss reviews** — add a `bypass_actors` entry for senior engineers only.
- **CODEOWNERS auto-assigners** — already wired via `.github/CODEOWNERS`.

## Related files

- `.github/workflows/ci.yml` — the workflow whose jobs produce the status checks named above.
- `.github/CODEOWNERS` — which user(s) get auto-requested as reviewers per path.
- `SECURITY.md` — vulnerability reporting policy.
