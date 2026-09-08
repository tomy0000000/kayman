from datetime import date, timedelta

import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Statement


class StatementFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Statement
        sqlalchemy_session_persistence = "commit"

    account = factory.SubFactory("kayman.tests.factories.account.AccountFactory")
    account_id = factory.SelfAttribute("account.id")
    created_on = factory.LazyFunction(date.today)
    # Periods march forward one month at a time, and the due date trails the
    # period close, so every built statement satisfies the CHECK constraints
    period_start_on = factory.Sequence(
        lambda n: date(2026, 1, 1) + timedelta(days=31 * n)
    )
    period_end_on = factory.LazyAttribute(
        lambda o: o.period_start_on + timedelta(days=30)
    )
    balance = factory.Faker("pydecimal", left_digits=5, right_digits=2)
    due_on = factory.LazyAttribute(lambda o: o.period_end_on + timedelta(days=20))
