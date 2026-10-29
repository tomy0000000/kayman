from typing import Annotated

from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse, Response

from kayman.auth import authenticate_client
from kayman.core.oauth import LOGIN_PATH
from kayman.util import templates

# Browser-facing login step of the MCP OAuth flow, so it stays out of the API spec.
oauth_router = APIRouter(tags=["OAuth"], include_in_schema=False)


def _render(
    http_request: Request,
    request_id: str,
    error: str | None = None,
    status_code: int = 200,
) -> Response:
    context = {"action": LOGIN_PATH, "request_id": request_id, "error": error}
    return templates.TemplateResponse(
        http_request, "oauth_login.html", context, status_code=status_code
    )


@oauth_router.get(LOGIN_PATH)
def login_form(http_request: Request, request: str) -> Response:
    return _render(http_request, request)


@oauth_router.post(LOGIN_PATH)
def login(
    http_request: Request,
    request: Annotated[str, Form()],
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
) -> Response:
    client = authenticate_client(username, password, http_request.app.state.clients)
    if client is None:
        return _render(
            http_request, request, "Incorrect client name or password", status_code=401
        )
    redirect = http_request.app.state.oauth.complete_authorization(request, client.name)
    if redirect is None:
        return _render(
            http_request,
            request,
            "This sign-in link has expired. Start again from your MCP client.",
            status_code=400,
        )
    return RedirectResponse(redirect, status_code=303)
