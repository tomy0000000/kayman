import os
from collections.abc import Generator
from typing import Any
from uuid import uuid4

import pytest
from factory.alchemy import SQLAlchemyModelFactory
from fastapi.testclient import TestClient
from sqlalchemy import event as sa_event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from kayman.main import app


def _enable_sqlite_fk(engine: Engine) -> None:
    """Enforce foreign keys on SQLite, which defaults them off per connection."""

    @sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection: Any, *_: Any) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


@pytest.fixture(scope="function")
def db_uri() -> Generator[str, None, None]:
    db_file = f"/tmp/kayman-test-{str(uuid4())}.db"
    uri = f"sqlite:///{db_file}"
    yield uri

    # Clean up the database
    os.remove(db_file)


# Reference: https://github.com/fastapi/sqlmodel/discussions/615
@pytest.fixture(scope="function")
def session(db_uri) -> Generator[Session, None, None]:
    from kayman.tests import factories  # noqa: F401

    engine = create_engine(
        db_uri,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _enable_sqlite_fk(engine)
    SQLModel.metadata.create_all(engine)
    session = Session(engine)

    # Ensure that all factories use the same session
    for factory in SQLAlchemyModelFactory.__subclasses__():
        factory._meta.sqlalchemy_session = session

    yield session

    session.rollback()
    session.close()


@pytest.fixture(scope="function")
def session_2(db_uri) -> Generator[Session, None, None]:
    from kayman.tests import factories  # noqa: F401

    engine = create_engine(
        db_uri,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _enable_sqlite_fk(engine)
    session = Session(engine)

    yield session

    session.rollback()
    session.close()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c
