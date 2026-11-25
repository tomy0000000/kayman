import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import TransactionEventLink


class TransactionEventLinkFactory(SQLAlchemyModelFactory):
    class Meta:
        model = TransactionEventLink
        sqlalchemy_session_persistence = "commit"

    # No FK event: the link is the transaction's only event membership
    transaction = factory.SubFactory(
        "kayman.tests.factories.transaction.TransactionFactory",
        event=None,
        event_id=None,
        index=None,
    )
    transaction_id = factory.SelfAttribute("transaction.id")
    event = factory.SubFactory("kayman.tests.factories.event.EventFactory")
    event_id = factory.SelfAttribute("event.id")
    amount = factory.SelfAttribute("transaction.amount")
    index = factory.Sequence(lambda n: n)
