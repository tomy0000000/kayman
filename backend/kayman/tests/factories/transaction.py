import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Transaction


class TransactionFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Transaction
        sqlalchemy_session_persistence = "commit"

    account = factory.SubFactory("kayman.tests.factories.account.AccountFactory")
    account_id = factory.SelfAttribute("account.id")
    amount = factory.Faker("pydecimal", left_digits=5, right_digits=2)
    description = factory.Faker("sentence")
    index = factory.Sequence(lambda n: n)
    payment = factory.SubFactory("kayman.tests.factories.payment.PaymentFactory")
    payment_id = factory.SelfAttribute("payment.id")
    reconcile = factory.Faker("boolean")
    created_at = factory.Faker("date_time")
    timezone = "UTC"
