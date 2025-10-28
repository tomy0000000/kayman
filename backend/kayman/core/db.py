from collections.abc import Generator
from typing import Any

from loguru import logger
from sqlmodel import Session, create_engine

from alembic import command
from alembic.config import Config
from kayman.core.config import settings

engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    echo=settings.ENVIRONMENT == "local",
)


def alembic_upgrade() -> None:
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    logger.info("Alembic upgrade completed.")


def get_session() -> Generator[Session, Any, None]:
    with Session(engine) as session:
        yield session
