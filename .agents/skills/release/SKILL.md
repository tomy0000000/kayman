---
name: release
description: Cut a new kayman release. Use this whenever the user says "release", "cut a release", "ship a release", "publish a new version", "bump the version", or otherwise asks to roll develop into main and publish to GitHub. Drives the project's release workflow: assumes a minor bump, drafts GitHub release notes from the commit log, asks the user one question to confirm both, then runs `scripts/release.sh`, pushes, and publishes.
---

# Release

Cuts a new kayman release. Most of the mechanical work (branching, version bumps, commit) lives in `scripts/release.sh`. This skill drafts the release notes and gets a single confirmation from the user. After that one answer, it runs to the published release without asking again.

## Versioning

The project uses zero-ver: `0.<minor>.<patch>`. Major is always `0`.

Always assume a **minor** bump (`0.X.0`). The user can pick a patch bump or a custom version when answering the confirmation question.

Tags and GitHub release titles are bare versions like `0.11.0` (no `v` prefix).

## Workflow

### Step 1: Compute the version

```bash
git fetch origin
git describe --tags --abbrev=0
```

Bump the minor of the previous tag and reset patch to `0` (e.g. `0.26.0` → `0.27.0`).

### Step 2: Draft release notes

Get the commits since the previous tag:

```bash
git log <previous-tag>..develop --no-merges --pretty=format:'%h %s'
```

Classify each commit into one of five sections using the template at `assets/release-notes-template.md`. Mapping hints based on the project's emoji-prefixed commit style:

| Commit prefix / theme | Section |
| --- | --- |
| `✨ [feat]`, new user-facing capability | 🌟 Features |
| anything that removes or renames an API, field, schema, or behavior users depend on | 🧨 Breaking Changes |
| refactors, infra moves, docs, repo reorganization | 🪜 Other Notable Changes |
| `🛠 [fix]`, `🐞`, bug fixes | 🐞 Bug fixes |
| `⬆️` / `:arrow_up:` dependabot bumps, CI, lint config, internal tooling | ⚙️ Internal |

Do not just paste commit subjects verbatim. Past releases (`gh release view 0.11.0`) group related commits and rephrase for a human reader. Skip release commits (`🔖 release: …`). Drop sections that end up empty rather than leaving a bare `-`.

Write the draft to `/tmp/kayman-release-<version>.md`.

### Step 3: Confirm in one question

Use `AskUserQuestion` once, with the full release notes in the question text and the version in the first option. Options:

- `Release <minor version> (Recommended)`: proceed with the minor bump.
- `Release <patch version> instead`: proceed with a patch bump (`0.X.Y+1`). Rename the notes file to match.
- `Edit notes first`: stop and let the user edit `/tmp/kayman-release-<version>.md`, then ask the same question again.

The user can also answer "Other" with a custom version or note changes. Apply them and continue without asking again unless the answer is ambiguous.

This answer is the only confirmation. It covers running the script, both pushes, and publishing the GitHub release. Do not ask again before each step.

### Step 4: Run the release script

`scripts/release.sh <version>` performs the local git work without ever leaving `develop`: check that `main` matches `origin/main` and that `develop` fast-forwards from it, stash, bump versions in `frontend/package.json`, `icon/package.json`, `backend/pyproject.toml`, `backend/kayman/main.py`, refresh `backend/uv.lock`, commit `🔖 release: <version>` on `develop`, fast-forward `main` to `develop` with `git branch -f`, and pop the stash. It never checks out `main`, because switching branches would delete and recreate files under `.agents/`, which the sandbox protects via the `.claude` symlink.

```bash
.claude/skills/release/scripts/release.sh <version>
```

The script must be run from a clean-ish working tree on the `develop` branch. It refuses to run otherwise. It does **not** push and does **not** publish — those are deliberate later steps.

If the script fails partway through, do not retry blindly; surface the error to the user. Common causes: `main` is out of sync with `origin/main` or doesn't fast-forward to `develop` (someone pushed to main directly), `uv lock` failed, a version file's pattern didn't match because the file changed shape, or commit signing was refused (the 1Password agent prompt needs approval).

### Step 5: Push and publish

Run these straight after the script succeeds, with no further confirmation:

```bash
git push origin main
git push origin develop
gh release create <version> \
  --target main \
  --title <version> \
  --notes-file /tmp/kayman-release-<version>.md
```

`gh release create` creates the `<version>` tag at the release commit on main as part of publishing — no separate `git tag` is needed.

Report the release URL printed by `gh release create` to the user.

## Files

- `scripts/release.sh` — local git + version-bump automation. Idempotent-ish: it bails early on the second run because the tag already exists.
- `assets/release-notes-template.md` — empty five-section template used as the starting structure when drafting notes.
