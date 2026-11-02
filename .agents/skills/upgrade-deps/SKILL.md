---
name: upgrade-deps
description: Upgrade the app's dependencies (backend uv, frontend pnpm, icon pnpm, cli Go), fix code broken by API changes, and open one PR against develop. Use this whenever the user says "upgrade dependencies", "bump deps", "update packages", or runs /upgrade-deps. Also runs unattended from the scheduled GitHub workflow, so it never stops to ask questions.
---

# Upgrade dependencies

Upgrades every dependency to its latest version, fixes the code that breaks, and opens one PR for the user to review. It runs unattended: never ask the user a question. When a decision is unclear, pick the conservative option and record it in the PR body.

## Step 1: Branch

```bash
git fetch origin
git switch -c deps/upgrade-$(date +%Y-%m-%d) origin/develop
```

If the branch already exists on the remote, stop and report it. A previous run's PR is still open.

## Step 2: Upgrade, one ecosystem at a time

For each ecosystem below, upgrade, then verify, then commit before moving to the next. A failure stays scoped to one ecosystem that way.

| Ecosystem | Upgrade | Verify | Commit subject |
| --- | --- | --- | --- |
| Backend | `uv lock --upgrade` in `backend/` | `mise run lint:backend`, `mise run test:backend` | `⬆️ [bump][backend] Backend dependencies` |
| Frontend | `pnpm update --latest` in `frontend/` | `mise run lint:frontend`, `mise run build:frontend` | `⬆️ [bump][frontend] Frontend dependencies` |
| Icon | `pnpm update --latest` in `icon/` | `mise run build:icon-bundle` | `⬆️ [bump] Icon dependencies` |
| CLI | `go get -u ./... && go mod tidy` in `cli/` | `mise run build:cli` | `⬆️ [bump][cli] CLI dependencies` |

Backend upgrades touch only `uv.lock`. Leave the lower bounds in `pyproject.toml` alone.

Don't bump runtimes or tools pinned in `mise.toml`, `engines`, or `requires-python`. Those are deliberate choices.

## Step 3: Fix what breaks

When verification fails after an upgrade:

1. Find which package caused it. Read its changelog or migration guide for the version range you crossed.
2. Fix the call sites to the new API. Follow the repo's conventions (`AGENTS.md`, `.agents/rules/`). Don't silence errors with `# type: ignore`, `@ts-expect-error`, or lint disables.
3. Commit each fix separately from the bump: `🛠 [fix][<scope>] Adapt to <package> <version>`.
4. If a fix needs more than a mechanical migration (redesigning a component, changing behavior users see, or a schema change), roll that one package back to its previous major instead. Pin it with `pnpm add <pkg>@^<old-major>` or `uv lock --upgrade-package <pkg>==<old-version>`, and list it under "Held back" in the PR.

Re-run the full verification for the ecosystem after each fix.

## Step 4: Open the PR

```bash
git push -u origin HEAD
gh pr create --base develop --title "⬆️ [bump] Dependencies $(date +%Y-%m-%d)" --body-file <file>
```

Write the body for the user, who reviews it after the fact. Sections, dropping any that end up empty:

- **Major upgrades**: each package that crossed a major, with old → new versions.
- **Code changes**: each `🛠 [fix]` commit, what broke, and why the fix is correct. Link the changelog entry.
- **Held back**: packages rolled back and why.
- **Verification**: the commands you ran and whether they passed.

Leave out the full list of minor and patch bumps. The lockfile diff already shows them.

If every ecosystem had nothing to upgrade, delete the branch and open no PR.
