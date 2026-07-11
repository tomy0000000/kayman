from sqlmodel import Session

from kayman.crud.currency import create_currencies, read_currencies
from kayman.schemas.currency import Currency, CurrencyCreate
from kayman.tests.factories import CurrencyFactory


def test_create_currencies(session: Session):
    currencies = [
        CurrencyCreate.model_validate(currency)
        for currency in CurrencyFactory.build_batch(3)
    ]
    db_currencies = create_currencies(session, currencies)

    assert len(db_currencies) == 3
    for db_currency, currency in zip(db_currencies, currencies, strict=True):
        assert db_currency.code == currency.code
        assert db_currency.name == currency.name
        assert db_currency.symbol == currency.symbol


def test_create_currencies_empty(session: Session):
    assert create_currencies(session, []) == []


def test_create_currencies_no_commit(session: Session, session_2: Session):
    currency = CurrencyCreate.model_validate(CurrencyFactory.build())

    # The currency should be created in the session
    session_currency = create_currencies(session, [currency], commit=False)[0]
    assert session_currency.code == currency.code

    # The currency should not be visible to other sessions (yet)
    assert session_2.get(Currency, currency.code) is None

    # Commit the currency from main session
    session.commit()

    # The currency should now be visible to other sessions
    session_2_currency = session_2.get(Currency, currency.code)
    assert session_2_currency is not None
    assert session_2_currency.code == currency.code
    assert session_2_currency.name == currency.name
    assert session_2_currency.symbol == currency.symbol


def test_read_currencies(session: Session):
    for _ in range(10):
        CurrencyFactory()

    assert len(read_currencies(session)) == 10
