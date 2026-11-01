# Project name

- Don't hardcode the project name in docs, comments, or strings. In prose, say "the app" or "the system" instead.
- When code must show the name (page titles, templates, API metadata), read it from one source: `settings.PROJECT_NAME` in the backend, one shared constant in the frontend.
- Identifiers that are the name itself (the `kayman` Python package, the Docker image, the repo) are exempt. Renaming those is a separate mechanical rename.

Why: a rename should touch one place, not every page title and doc.
