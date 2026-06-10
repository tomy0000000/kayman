import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Account


class AccountFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Account
        sqlalchemy_session_persistence = "commit"

    id = factory.Sequence(lambda n: n + 1)
    name = factory.Faker("name")
    currency = factory.SubFactory("kayman.tests.factories.currency.CurrencyFactory")
    currency_code = factory.SelfAttribute("currency.code")
    balance = factory.Faker("pydecimal", left_digits=5, right_digits=2)
    timezone = "UTC"
