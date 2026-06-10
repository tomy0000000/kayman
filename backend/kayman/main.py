from fastapi import FastAPI
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from kayman.core.config import settings
from kayman.openapi import override_openapi
from kayman.routers import routers, tags
from kayman.util import (
    KustomJSONResponse,
    SPAStaticFiles,
    custom_generate_unique_id,
    lifespan,
)

cors_middleware = Middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app = FastAPI(
    debug=settings.ENVIRONMENT == "local",
    title=settings.PROJECT_NAME,
    description="Kayman is the one-stop solution for personal finance",
    version="0.11.0",
    openapi_tags=tags,
    default_response_class=KustomJSONResponse,
    middleware=[cors_middleware],
    lifespan=lifespan,
    contact={"name": "Tomy Hsieh", "url": "https://github.com/tomy0000000"},
    license_info={
        "name": "MIT",
        "url": "https://github.com/tomy0000000/kayman/blob/main/LICENSE",
    },
    generate_unique_id_function=custom_generate_unique_id,
)
logger.info(f"Application created in {settings.ENVIRONMENT} environment")


# Add all routers under /api
for router in routers:
    app.include_router(router, prefix="/api")

# Serve the built frontend at root
app.mount(
    "/", SPAStaticFiles(directory="static", html=True, check_dir=False), name="static"
)

# Override the OpenAPI generation to customize operationId
override_openapi(app)
