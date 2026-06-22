---
name: release
description: Cut a new kayman release. Use this whenever the user says "release", "cut a release", "ship a release", "publish a new version", "bump the version", or otherwise asks to roll develop into main and publish to GitHub. Drives the project's release workflow: picks the next zero-ver version, runs `scripts/release.sh` to do the develop→main→develop merge dance and version bumps, drafts GitHub release notes from the commit log, and publishes after the user confirms.
---

# Release

Cuts a new kayman release. Most of the mechanical work (branching, version bumps, commit) lives in `scripts/release.sh`. This skill drives the parts that need judgment or human confirmation: picking the version, drafting release notes, and publishing.

## Versioning

The project uses zero-ver: `0.<minor>.<patch>`. Major is always `0`.

- **Bump minor** (`0.X.0`) when the release contains any new feature, breaking change, or other notable change — anything that would land in the 🌟 / 🧨 / 🪜 sections of the release notes.
- **Bump patch** (`0.X.Y`) when the only user-visible changes are bug fixes and internal/CI/dependency bumps.

Tags and GitHub release titles are bare versions like `0.11.0` (no `v` prefix).

## Workflow

### Step 1: Pick the version

Find the previous tag and the commits since:

```bash
git fetch origin
git describe --tags --abbrev=0
git log <previous-tag>..develop --oneline
```

Apply the versioning rules above to propose a version and tell the user the choice (e.g., "Previous was 0.11.0, I see new features in the log, so I'd cut 0.12.0 — sound right?"). Let the user override before continuing.

### Step 2: Run the release script

`scripts/release.sh <version>` performs the local git work: stash, checkout main, fast-forward pull, merge develop, bump versions in `frontend/package.json`, `backend/pyproject.toml`, `backend/kayman/main.py`, refresh `backend/uv.lock`, commit `🔖 release: <version>`, fast-forward main into develop, and pop the stash.

```bash
.claude/skills/release/scripts/release.sh <version>
```

The script must be run from a clean-ish working tree on the `develop` branch. It refuses to run otherwise. It does **not** push and does **not** publish — those are deliberate later steps.

If the script fails partway through, do not retry blindly; surface the error to the user. Common causes: merge can't fast-forward (someone pushed to main directly), `uv lock` failed, or a version file's pattern didn't match because the file changed shape.

### Step 3: Draft release notes

Get the commits that landed in this release (now reachable from main, not develop, since main contains the release commit too):

```bash
git log <previous-tag>..main --no-merges --pretty=format:'%h %s'
```

Classify each commit into one of five sections using the template at `assets/release-notes-template.md`. Mapping hints based on the project's emoji-prefixed commit style:

| Commit prefix / theme | Section |
| --- | --- |
| `✨ [feat]`, new user-facing capability | 🌟 Features |
| anything that removes or renames an API, field, schema, or behavior users depend on | 🧨 Breaking Changes |
| refactors, infra moves, docs, repo reorganization | 🪜 Other Notable Changes |
| `🛠 [fix]`, `🐞`, bug fixes | 🐞 Bug fixes |
| `⬆️` / `:arrow_up:` dependabot bumps, CI, lint config, internal tooling | ⚙️ Internal |

Do not just paste commit subjects verbatim — past releases (`gh release view 0.11.0`) group related commits and rephrase for a human reader. Skip the release commit itself (`🔖 release: <version>`). Drop sections that end up empty rather than leaving a bare `-`.

Write the draft to `/tmp/kayman-release-<version>.md` and show it to the user. **Wait for the user to edit or approve before publishing** — release notes are the most visible artifact of a release and benefit most from human review.

### Step 4: Push and publish

Once the user approves the notes, confirm once more before each remote-visible action, then run:

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
