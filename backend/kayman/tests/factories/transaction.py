import factory
from factory.alchemy import SQLAlchemyModelFactory
from sqlmodel import Session

from kayman.schemas import Transaction, TransactionEventLink


class TransactionFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Transaction
        sqlalchemy_session_persistence = "commit"

    account = factory.SubFactory("kayman.tests.factories.account.AccountFactory")
    account_id = factory.SelfAttribute("account.id")
    amount = factory.Faker("pydecimal", left_digits=4, right_digits=2)
    description = factory.Faker("sentence")
    index = factory.Sequence(lambda n: n)
    event = factory.SubFactory("kayman.tests.factories.event.EventFactory")
    event_id = factory.SelfAttribute("event.id")
    created_at = factory.Faker("date_time")
    posted_at = factory.Faker("date_time")
    cleared_at = factory.Faker("date_time")

    # Mirror create_transactions: a leg on an event with a position carries its link
    @factory.post_generation
    def event_link(obj, create, extracted, **kwargs):
        if not create or obj.event_id is None or obj.index is None:
            return
        session = Session.object_session(obj)
        session.add(
            TransactionEventLink(
                transaction_id=obj.id,
                event_id=obj.event_id,
                amount=obj.amount,
                index=obj.index,
            )
        )
        session.commit()
