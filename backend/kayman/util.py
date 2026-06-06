from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import simplejson
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.exceptions import HTTPException
from starlette.types import Scope

from kayman.auth import setup_clients
from kayman.core.db import alembic_upgrade


# Register startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Auto migrate the database on startup
    if not app.debug:
        alembic_upgrade()

    # Setup clients for authentication
    setup_clients(app)

    yield

    # Shutdown tasks can be added here
    pass


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


def handle_special_types(obj: Any) -> Any:
    print(f"handled type: {type(obj)}, {obj=}")
    if isinstance(obj, BaseModel):
        return obj.dict()
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ZoneInfo):
        return str(obj)
    return str(obj)  # Not sure if this is a good idea, but we'll see


class KustomJSONResponse(JSONResponse):
    """
    This is the default custom response class for Kayman,
    which made improvement on following data types:

    - decimal.Decimal: unlimited precision
    - datetime.datetime: format with dt.isoformat()
    - zoneinfo.ZoneInfo: format with str(zoneinfo.ZoneInfo)
    """

    def render(self, content: Any) -> bytes:
        return simplejson.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=handle_special_types,
            use_decimal=True,
        ).encode("utf-8")


class SPAStaticFiles(StaticFiles):
    """
    Fall back to index.html on 404 to serve SPA fronten app
    """

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise
