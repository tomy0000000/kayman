from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

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
