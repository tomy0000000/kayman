from collections.abc import Callable, Collection
from decimal import Decimal
from typing import cast

from sqlmodel import Session

from kayman.crud.event import delete_events, read_events
from kayman.crud.transaction import read_transactions
from kayman.schemas.event import (
    Event,
    EventClearError,
    EventClearErrorType,
    EventType,
)
from kayman.util import format_ids

EventClearValidator = Callable[[Event], list[EventClearError]]


def validate_totals_match(event: Event) -> list[EventClearError]:
    """Report an entry-driven event whose entries and transactions disagree."""
    # Transfer and Exchange carry no entries to total against
    if event.type not in (EventType.EXPENSE, EventType.INCOME):
        return []

    # A multi-currency event has no single total to compare
    currency_codes = {entry.currency_code for entry in event.entries} | {
        transaction.currency_code for transaction in event.transactions
    }
    if len(currency_codes) > 1:
        return []

    entries_total = Decimal(
        sum([entry.amount * entry.quantity for entry in event.entries])
    )
    transactions_total = Decimal(
        sum([transaction.amount for transaction in event.transactions])
    )
    # Expense drains the accounts, so its transactions mirror the entries
    if event.type is EventType.EXPENSE:
        transactions_total = -transactions_total

    if entries_total == transactions_total:
        return []

    return [
        EventClearError(
            type=EventClearErrorType.TOTALS_MISMATCH,
            msg=(
                f"Entries total ({entries_total}) and "
                f"transactions total ({transactions_total}) do not match"
            ),
        )
    ]


def validate_entries_present(event: Event) -> list[EventClearError]:
    """Report an entry-driven event that carries no entry."""
    if event.type not in (EventType.EXPENSE, EventType.INCOME) or event.entries:
        return []

    return [
        EventClearError(
            type=EventClearErrorType.NO_ENTRIES,
            msg=f"{event.type.value} event must have at least one entry",
        )
    ]


def validate_transactions_present(event: Event) -> list[EventClearError]:
    """Report a transaction-driven event that carries no transaction."""
    if event.type not in (EventType.TRANSFER, EventType.EXCHANGE) or event.transactions:
        return []

    return [
        EventClearError(
            type=EventClearErrorType.NO_TRANSACTIONS,
            msg=f"{event.type.value} event must have at least one transaction",
        )
    ]


def validate_transaction_timestamps(event: Event) -> list[EventClearError]:
    """Report every transaction that happened before its own event."""
    return [
        EventClearError(
            type=EventClearErrorType.INCONSISTENT_TIMESTAMPS,
            msg=(
                f"Transaction {transaction.id} timestamp "
                f"({transaction.created_at.isoformat()}) is before the event "
                f"timestamp ({event.timestamp.isoformat()})"
            ),
        )
        for transaction in event.transactions
        if transaction.created_at < event.timestamp
    ]


def validate_transactions_cleared(event: Event) -> list[EventClearError]:
    """Report every transaction the user has not reconciled yet."""
    return [
        EventClearError(
            type=EventClearErrorType.TRANSACTIONS_NOT_CLEARED,
            msg=f"Transaction {transaction.id} is not cleared",
        )
        for transaction in event.transactions
        if transaction.cleared_at is None
    ]


def validate_entries_description(event: Event) -> list[EventClearError]:
    """Report every entry whose category demands a description it lacks."""
    return [
        EventClearError(
            type=EventClearErrorType.EMPTY_ENTRIES_DESCRIPTION,
            msg=(
                f"Entry {entry.id} in category {entry.category.name!r} "
                "requires a description"
            ),
        )
        for entry in event.entries
        if entry.category.requires_entry_description
        and not (entry.description or "").strip()
    ]


CLEAR_VALIDATORS: tuple[EventClearValidator, ...] = (
    validate_entries_present,
    validate_entries_description,
    validate_transactions_present,
    validate_totals_match,
    validate_transaction_timestamps,
    validate_transactions_cleared,
)


def validate_event_clearable(event: Event) -> list[EventClearError]:
    """Collect every reason the event cannot be cleared, never short-circuiting.

    The caller shows all of them at once, so a validator raising instead of
    returning would hide the rest.
    """
    return [error for validator in CLEAR_VALIDATORS for error in validator(event)]


def validate_events_editable(session: Session, event_ids: Collection[int]) -> None:
    """Raise if any of the events is cleared. Unknown ids are left to the caller."""
    # Must precede the read: read_events treats an empty id list as "all"
    if not event_ids:
        return
    events = read_events(session, event_ids=set(event_ids), for_update=True)
    cleared = {cast(int, event.id) for event in events if event.cleared_at is not None}
    if cleared:
        raise ValueError(f"Event id(s) already cleared: {format_ids(cleared)}")


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
