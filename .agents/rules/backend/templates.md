---
paths:
  - "backend/kayman/**/*.py"
  - "backend/kayman/templates/**"
---

# Server-rendered HTML

- Never hardcode HTML or other markup in Python strings. Markup in a `.py` file gets no highlighting, no autoescaping, and `str.format` brace-doubling turns CSS into noise.
- Every page the backend renders is a Jinja2 template under `backend/kayman/templates/`, one file per page, named after the route that serves it (e.g. `oauth_login.html`). Static pages with no variables go there too, so all markup lives in one place.
- Render through the shared `templates` instance in `kayman/util.py`: `templates.TemplateResponse(request, "name.html", context, status_code=...)`. Don't create another `Jinja2Templates` per module.
- Autoescaping is on for `.html` templates. Pass raw values in the context and let Jinja escape them.
- Keep templates self-contained: inline CSS, no CDN assets. These pages are served by the backend alone, without the frontend build.
