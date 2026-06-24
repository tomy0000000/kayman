import factory
from factory.alchemy import SQLAlchemyModelFactory

from kayman.schemas import Event
from kayman.schemas.api_models import PaymentCreateDetailed
from kayman.schemas.event import EventType


class EventFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Event
        sqlalchemy_session_persistence = "commit"

    description = factory.Faker("sentence")
    timestamp = factory.Faker("date_time")
    timezone = "UTC"
    type = factory.Faker("random_element", elements=list(EventType))

    @classmethod
    def build_details(cls, type=EventType.Expense, entry_num=1, transaction_num=1):
        from kayman.tests.factories.currency import CurrencyFactory
        from kayman.tests.factories.payment_entry import PaymentEntryFactory
        from kayman.tests.factories.transaction import TransactionFactory

        # Create entries and transactions
        entries_currency = CurrencyFactory.build()
        entries = PaymentEntryFactory.build_batch(entry_num, currency=entries_currency)
        transactions = TransactionFactory.build_batch(transaction_num)

        # Calculate totals
        entries_total = sum([entry.amount * entry.quantity for entry in entries])
        transactions_total = sum([transaction.amount for transaction in transactions])

        if type is EventType.Expense:
            # Update last transaction amount to match the total
            # entries_total == -transactions_total
            transactions[-1].amount -= entries_total + transactions_total

        if type is EventType.Income:
            # Update last transaction amount to match the total
            # entries_total == transactions_total
            transactions[-1].amount -= transactions_total - entries_total

        # Create event
        event = cls.build(
            type=type,
            entries=entries,
            transactions=transactions,
        )

        return PaymentCreateDetailed(
            payment=event, entries=entries, transactions=transactions
        )
