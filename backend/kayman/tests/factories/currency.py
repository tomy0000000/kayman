import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Currency


class CurrencyFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Currency
        sqlalchemy_session_persistence = "commit"

    code = factory.Sequence(lambda n: f"CUR{n:03d}")
    name = factory.Faker("currency_name")
    symbol = factory.Faker("currency_symbol")
