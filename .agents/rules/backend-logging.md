---
paths:
  - "backend/**/*.py"
---

# Backend logging

## All logging goes through loguru

- Import as `from loguru import logger`. Do not `import logging` or `getLogger(...)` in app code.
- `setup_logger()` in `kayman/util.py` is called once from `main.py` at import time. It removes the default handler, adds the env-appropriate sink, and installs an `InterceptHandler` so stdlib logging (uvicorn, FastAPI, SQLAlchemy, alembic) is bridged to loguru. Don't add sinks or call `logger.remove()` elsewhere.
- Library-style `logger = logging.getLogger(__name__)` per module is unnecessary in loguru. Use the single global `logger` and rely on loguru's auto-captured `name`/`function`/`line`.

## Level per environment

`settings.ENVIRONMENT` is the single source of truth. Pytest runs auto-coerce it to `testing` (see `_force_testing_under_pytest` in `core/config.py`). The level map lives in `_LOG_LEVELS` in `util.py`:

| Environment   | Level     |
| ------------- | --------- |
| `local`       | `DEBUG`   |
| `development` | `DEBUG`   |
| `testing`     | `WARNING` |
| `production`  | `INFO`    |

- Tests stay quiet by default because pytest forces `testing`. Use loguru's `caplog` shim when a test needs to assert on log output.
- Don't rely on `LOGURU_LEVEL` env var, it doesn't override the explicit `level=` passed to `logger.add(...)`.

## When to use which level

- `DEBUG`: noisy diagnostics useful during development (query params, computed intermediates). Never assume DEBUG is enabled at the call site.
- `INFO`: normal lifecycle events worth keeping in production (app started, migration applied, scheduled job ran).
- `WARNING`: unexpected but recoverable (retry kicked in, falling back to default, deprecated path hit).
- `ERROR`: a request or job failed with user-visible impact. Include the exception with `logger.exception(...)` or `logger.opt(exception=True).error(...)`.
- `CRITICAL`: process can't continue (DB unreachable at startup, required secret missing).
- Don't log at `INFO` inside hot loops. If you're tempted, it's `DEBUG`.

## Structured output

- Production sink uses `serialize=True` (JSON lines) so the log aggregator can parse fields directly.
- Local sink stays human-readable with colors.
- Attach request-scoped context via `logger.bind(request_id=..., user_id=...)` in a FastAPI middleware, not by string-formatting into the message.

## Safety

- In `production`, configure the sink with `diagnose=False` and `backtrace=False`. Loguru's diagnose mode dumps local variables on exception, which can leak secrets, tokens, or PII.
- This is a personal finance app: never log full account numbers, balances tied to an identifiable user, raw auth tokens, password hashes, or `Authorization` headers. Redact or use a stable surrogate (`user_id`, `account_id`).
- Use `enqueue=True` on the production sink if uvicorn runs with multiple workers, to keep writes process-safe.

## Exceptions

- Prefer `logger.exception("what failed")` inside `except` blocks over manual traceback formatting.
- For background tasks and event handlers where an unhandled exception would otherwise be swallowed, wrap the entry point with `@logger.catch(reraise=True)`.
- Don't `except Exception: logger.error(e)` and continue, either re-raise or handle it deliberately.

## Don'ts

- No `print()` for diagnostics, ever. It bypasses sinks, levels, and JSON formatting.
- Don't f-string into the message when the value comes from user input that could include format placeholders. Pass values as `extra=` or as positional args to loguru's `{}`-style template.
- Don't log inside import-time code in `__init__.py`. Sinks aren't necessarily configured yet.
