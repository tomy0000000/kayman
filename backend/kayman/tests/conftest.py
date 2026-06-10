import os
from collections.abc import Generator
from uuid import uuid4

import pytest
from factory.alchemy import SQLAlchemyModelFactory
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from kayman.main import app


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
    session = Session(engine)

    yield session

    session.rollback()
    session.close()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c
