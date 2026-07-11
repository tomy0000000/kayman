from collections.abc import Sequence

from sqlmodel import Session, select

from kayman.schemas.currency import Currency, CurrencyBase, CurrencyCreate


def create_currencies(
    session: Session,
    currencies: Sequence[CurrencyCreate],
    commit: bool = True,
) -> Sequence[CurrencyBase]:
    db_currencies = [Currency.model_validate(currency) for currency in currencies]
    session.add_all(db_currencies)
    if commit:
        session.commit()
        for db_currency in db_currencies:
            session.refresh(db_currency)
    else:
        session.flush()
    return db_currencies


def read_currencies(session: Session) -> Sequence[Currency]:
    return session.exec(select(Currency)).all()
