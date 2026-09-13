from datetime import UTC, datetime

import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Account
from kayman.schemas.account import AccountType


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
    type = factory.Faker("random_element", elements=list(AccountType))
    index = 0
    created_at = factory.LazyFunction(lambda: datetime.now(UTC))
