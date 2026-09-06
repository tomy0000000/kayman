from fastapi import APIRouter

TAG_NAME = "Root"
tag = {
    "name": TAG_NAME,
    "description": "Root-level endpoints, served outside of /api",
}

root_router = APIRouter(tags=[TAG_NAME])


@root_router.get("/ping", name="Ping")
def ping() -> str:
    return "pong"
