from sqlmodel import Session

from kayman.crud.currency import create_currency, read_currencies
from kayman.tests.factories import CurrencyFactory


def test_create_currency(session: Session):
    currency = CurrencyFactory.build()
    db_currency = create_currency(session, currency)

    assert db_currency.code == currency.code
    assert db_currency.name == currency.name
    assert db_currency.symbol == currency.symbol


def test_read_currencies(session: Session):
    for _ in range(10):
        CurrencyFactory()

    assert len(read_currencies(session)) == 10
