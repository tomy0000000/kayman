import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Transaction


class TransactionFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Transaction
        sqlalchemy_session_persistence = "commit"

    account = factory.SubFactory("kayman.tests.factories.account.AccountFactory")
    account_id = factory.SelfAttribute("account.id")
    amount = factory.Faker("pydecimal", left_digits=4, right_digits=2)
    description = factory.Faker("sentence")
    created_at = factory.Faker("date_time")
    posted_at = factory.Faker("date_time")
    cleared_at = factory.Faker("date_time")

    class Params:
        event = factory.SubFactory("kayman.tests.factories.event.EventFactory")
        index = factory.Sequence(lambda n: n)

    # A transaction built with an event carries the link for it
    event_link = factory.Maybe(
        "event",
        factory.RelatedFactory(
            "kayman.tests.factories.transaction_event_link.TransactionEventLinkFactory",
            factory_related_name="transaction",
            event=factory.SelfAttribute("..event"),
            amount=factory.SelfAttribute("..amount"),
            index=factory.SelfAttribute("..index"),
        ),
    )
