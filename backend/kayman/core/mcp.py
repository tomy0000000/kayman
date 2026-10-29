import httpx2
from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.server.dependencies import get_http_headers
from fastmcp.server.providers.openapi import MCPType, RouteMap
from fastmcp.utilities.lifespan import combine_lifespans
from starlette.routing import Route

from kayman.auth import ALGORITHM
from kayman.core.config import settings

# Plumbing, admin setup, and deletes stay with the UI and CLI.
EXCLUDED_ROUTES = [
    RouteMap(tags={"Root"}, mcp_type=MCPType.EXCLUDE),
    RouteMap(tags={"Authorization"}, mcp_type=MCPType.EXCLUDE),
    RouteMap(tags={"Taiwan E-Invoice"}, mcp_type=MCPType.EXCLUDE),
    RouteMap(methods=["DELETE"], mcp_type=MCPType.EXCLUDE),
    RouteMap(
        methods=["POST", "PATCH"],
        pattern=r"^/api/(accounts|currencies|categories)$",
        mcp_type=MCPType.EXCLUDE,
    ),
]


async def _forward_authorization(request: httpx2.Request) -> None:
    authorization = get_http_headers(include={"authorization"}).get("authorization")
    if authorization:
        request.headers["authorization"] = authorization


def mount_mcp(app: FastAPI) -> FastMCP:
    """Expose the API as MCP tools at /mcp, authenticated with the API's own tokens."""
    mcp = FastMCP.from_fastapi(
        app=app,
        route_maps=EXCLUDED_ROUTES,
        httpx_client_kwargs={"event_hooks": {"request": [_forward_authorization]}},
        auth=JWTVerifier(public_key=settings.SECRET_KEY, algorithm=ALGORITHM),
    )
    mcp_app = mcp.http_app(path="/mcp")
    app.router.lifespan_context = combine_lifespans(
        app.router.lifespan_context, mcp_app.lifespan
    )
    # A Route, not a Mount, so the endpoint answers at /mcp without a trailing slash.
    app.router.routes.append(Route("/mcp", mcp_app, methods=["GET", "POST", "DELETE"]))
    return mcp
