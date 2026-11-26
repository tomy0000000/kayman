# Inline scripts

- Config files (GitHub workflows, `mise.toml`, other YAML/TOML) hold at most a single command per step. Anything more (conditionals, loops, pipes, several commands) lives in a script file the config calls.
- Put the script next to what owns it: mise tasks under `scripts/`, `backend/scripts/`, `frontend/scripts/`, and a skill's helpers under its own `scripts/`.
- Have the script print results to stdout (e.g. `key=value` lines) and let the caller redirect, so it runs the same locally and in CI.

Why: inline strings can't be shellchecked, run locally, or tested, and they hide logic in files nobody reviews as code.
