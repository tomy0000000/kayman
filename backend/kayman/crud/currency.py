from collections.abc import Sequence

from sqlmodel import Session, select

from kayman.schemas.currency import Currency


def create_currency(session: Session, currency: Currency) -> Currency:
    db_currency = Currency.model_validate(currency)
    session.add(db_currency)
    session.commit()
    session.refresh(db_currency)
    return db_currency


def read_currencies(session: Session) -> Sequence[Currency]:
    return session.exec(select(Currency)).all()
