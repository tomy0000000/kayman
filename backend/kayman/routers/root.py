from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from kayman.core.config import settings
from kayman.schemas.version import VersionRead

TAG_NAME = "Root"
tag = {
    "name": TAG_NAME,
    "description": "Root-level endpoints, served outside of /api",
}

root_router = APIRouter(tags=[TAG_NAME])


@root_router.get("/ping", name="Ping", response_class=PlainTextResponse)
def ping() -> str:
    return "pong"


@root_router.get("/healthz", name="Healthz", response_class=PlainTextResponse)
def healthz() -> str:
    return "ok"


@root_router.get("/version", name="Read Version", response_model=VersionRead)
def read_version(request: Request) -> VersionRead:
    return VersionRead(version=request.app.version, commit=settings.COMMIT_SHA)
