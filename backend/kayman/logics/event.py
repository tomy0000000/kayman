from decimal import Decimal

from kayman.schemas.api_models import EventCreateDetailed
from kayman.schemas.event import EventType


def validate_total(details: EventCreateDetailed) -> None:
    # Skip check if this is a multi-curreny payment
    if len({entry.currency_code for entry in details.entries}) > 1:
        return

    # Payment type of transfer or exchange is not checked
    if details.event.type in (EventType.Transfer, EventType.Exchange):
        return

    entries_total = Decimal(
        sum([entry.amount * entry.quantity for entry in details.entries])
    )
    transactions_total = Decimal(
        sum([transaction.amount for transaction in details.transactions])
    )

    if details.event.type is EventType.Expense:
        if entries_total != -transactions_total:
            raise ValueError(
                f"Entries total ({entries_total}) and "
                f"transactions total ({-transactions_total}) do not match"
            )

    if details.event.type is EventType.Income:
        if entries_total != transactions_total:
            raise ValueError(
                f"Entries total ({entries_total}) and "
                f"transactions total ({transactions_total}) do not match"
            )
