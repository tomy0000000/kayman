from collections.abc import Callable, Collection
from decimal import Decimal

from sqlmodel import Session

from kayman.crud.event import delete_events, read_events
from kayman.crud.transaction import read_transactions
from kayman.schemas.api_models import EventCreateDetailed
from kayman.schemas.event import (
    Event,
    EventClearError,
    EventClearErrorType,
    EventType,
)

EventClearValidator = Callable[[Event], list[EventClearError]]


# TODO: unused after legacy_create removal, remove once confirmed obsolete
def validate_total(details: EventCreateDetailed) -> None:
    # Skip check if this is a multi-curreny event
    if len({entry.currency_code for entry in details.entries}) > 1:
        return

    # Event type of transfer or exchange is not checked
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


def validate_entries_present(event: Event) -> list[EventClearError]:
    """Report an entry-driven event that carries no entry."""
    if event.type not in (EventType.Expense, EventType.Income) or event.entries:
        return []

    return [
        EventClearError(
            type=EventClearErrorType.NO_ENTRIES,
            msg=f"{event.type.value} event must have at least one entry",
        )
    ]


CLEAR_VALIDATORS: tuple[EventClearValidator, ...] = (validate_entries_present,)


def validate_event_clearable(event: Event) -> list[EventClearError]:
    """Collect every reason the event cannot be cleared, never short-circuiting.

    The caller shows all of them at once, so a validator raising instead of
    returning would hide the rest.
    """
    return [error for validator in CLEAR_VALIDATORS for error in validator(event)]


def event_has_transactions(
    session: Session,
    event_id: int,
    for_update: bool = False,
) -> bool:
    if for_update:
        read_events(session, event_ids=[event_id], for_update=True)

    return bool(read_transactions(session, event_id=event_id))


def delete_events_by_ids(
    session: Session,
    event_ids: Collection[int],
    commit: bool = True,
) -> None:
    # Nothing to resolve, and an empty id set would read (and delete) every row
    if not event_ids:
        return

    unique_ids = set(event_ids)
    events = read_events(session, event_ids=unique_ids, for_update=True)
    missing_ids = unique_ids - {event.id for event in events}
    if missing_ids:
        raise ValueError(f"Event id(s) not found: {missing_ids}")

    delete_events(session, events, commit=commit)
