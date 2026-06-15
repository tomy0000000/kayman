from loguru import logger
from sqlmodel import Session, select

from kayman.mock_data.seed import seed
from kayman.schemas.currency import Currency


def test_seed_populates_db(session: Session) -> None:
    seed(session, logger)

    assert len(session.exec(select(Currency)).all()) > 0
