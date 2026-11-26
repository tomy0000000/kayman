---
name: release-notes
description: Draft release notes for the next kayman release from the commit log since the last tag. Use this whenever the user asks for release notes, a changelog, or "what's in the next release". The release workflow also runs it unattended, so it never stops to ask questions. It only writes notes. It never bumps versions, commits, pushes, or publishes.
---

# Release notes

Runs unattended: never ask the user a question. Write the notes to the path the prompt gives, or to `/tmp/kayman-release-notes.md` when it gives none.

## Step 1: Collect commits

```bash
git fetch origin --tags
git log "$(git describe --tags --abbrev=0 origin/develop)"..origin/develop --no-merges --pretty=format:'%h %s'
```

## Step 2: Write the notes

Sort commits into the sections of `assets/release-notes-template.md`:

| Commit                                                                | Section                  |
| --------------------------------------------------------------------- | ------------------------ |
| `✨ [feat]`, new user-facing capability                               | 🌟 Features              |
| removes or renames an API, field, schema, or behavior users depend on | 🧨 Breaking Changes      |
| refactors, docs, repo reorganization                                  | 🪜 Other Notable Changes |
| `🛠 [fix]`                                                            | 🐞 Bug fixes             |
| `⬆️ [bump]`, CI, tooling                                              | ⚙️ Internal              |

Group related commits and rephrase them for a reader, like past releases (`gh release view 0.11.0`). Skip `🔖 release:` commits and drop empty sections.

Write the file, then report its path.
