from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlmodel import Session, col, select

from kayman.logics.event import (
    CLEAR_VALIDATORS,
    delete_events_by_ids,
    event_has_transactions,
    validate_entries_present,
    validate_event_clearable,
    validate_totals_match,
    validate_transaction_timestamps,
    validate_transactions_present,
)
from kayman.schemas.event import (
    Event,
    EventClearError,
    EventClearErrorType,
    EventType,
)
from kayman.schemas.event_entry import EventEntry
from kayman.tests.factories import (
    AccountFactory,
    CurrencyFactory,
    EventEntryFactory,
    EventFactory,
    TransactionFactory,
)


def test_event_has_transactions_true(session: Session):
    event = EventFactory()
    TransactionFactory(event=event)

    assert event_has_transactions(session, event.id) is True


def test_event_has_transactions_false(session: Session):
    event = EventFactory()
    other_event = EventFactory()
    TransactionFactory(event=other_event)

    # Another event's transaction must not count for this one.
    assert event_has_transactions(session, event.id) is False


def test_event_has_transactions_unknown_event_id(session: Session):
    event = EventFactory()
    TransactionFactory(event=event)

    # An event that does not exist simply has no transactions.
    assert event_has_transactions(session, event.id + 1000) is False


def test_event_has_transactions_for_update_locks_the_event_row(session: Session):
    event = EventFactory()
    TransactionFactory(event=event)

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        assert event_has_transactions(session, event.id, for_update=True) is True

    statements = [str(call.args[0]) for call in mock_exec.call_args_list]
    locking = [statement for statement in statements if "FOR UPDATE" in statement]
    assert len(locking) == 1
    # The lock is on the event row, so a caller can hold it across a following
    # delete. Locking the transactions would not protect the event.
    assert "FROM event" in locking[0]


def test_event_has_transactions_without_for_update_takes_no_lock(session: Session):
    event = EventFactory()
    TransactionFactory(event=event)

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        assert event_has_transactions(session, event.id) is True

    statements = [str(call.args[0]) for call in mock_exec.call_args_list]
    assert len(statements) >= 1
    assert not any("FOR UPDATE" in statement for statement in statements)


def test_delete_events_by_ids(session: Session):
    events = EventFactory.create_batch(3)

    # Ids out of insertion order: only the requested subset goes.
    delete_events_by_ids(session, [events[2].id, events[0].id])

    remaining = session.exec(select(Event).order_by(col(Event.id))).all()
    assert len(remaining) == 1
    assert remaining[0].id == events[1].id


def test_delete_events_by_ids_empty(session: Session):
    events = EventFactory.create_batch(2)

    # An empty id set must not fall through to "every row".
    delete_events_by_ids(session, [])

    remaining = session.exec(select(Event).order_by(col(Event.id))).all()
    assert len(remaining) == 2
    assert [event.id for event in remaining] == [events[0].id, events[1].id]


def test_delete_events_by_ids_deduplicates(session: Session):
    events = EventFactory.create_batch(2)

    # The same id twice resolves to one row, not a missing-id error.
    delete_events_by_ids(session, [events[0].id, events[0].id])

    remaining = session.exec(select(Event)).all()
    assert len(remaining) == 1
    assert remaining[0].id == events[1].id


def test_delete_events_by_ids_missing_id(session: Session):
    events = EventFactory.create_batch(2)

    with pytest.raises(ValueError, match=r"Event id\(s\) not found"):
        delete_events_by_ids(session, [events[0].id, 999999])

    # Nothing is deleted, not even the id that did resolve.
    session.rollback()
    remaining = session.exec(select(Event).order_by(col(Event.id))).all()
    assert len(remaining) == 2
    assert [event.id for event in remaining] == [events[0].id, events[1].id]


def test_delete_events_by_ids_no_commit(session: Session, session_2: Session):
    event = EventFactory()
    event_id = event.id

    delete_events_by_ids(session, [event_id], commit=False)

    # Not committed: other sessions still see the row.
    session_2_events = session_2.exec(select(Event)).all()
    assert len(session_2_events) == 1
    assert session_2_events[0].id == event_id

    session.commit()

    session_2_events = session_2.exec(select(Event)).all()
    assert len(session_2_events) == 0


def test_delete_events_by_ids_cascades_to_entries(session: Session):
    event = EventFactory()
    EventEntryFactory(event=event, index=0)
    EventEntryFactory(event=event, index=1)
    survivor = EventFactory()
    survivor_entry = EventEntryFactory(event=survivor, index=0)

    delete_events_by_ids(session, [event.id])

    # The deleted event's entries go with it. Assert against the table rather
    # than the in-memory objects, which say nothing about what the DB holds.
    remaining_entries = session.exec(
        select(EventEntry).order_by(col(EventEntry.id))
    ).all()
    assert len(remaining_entries) == 1
    assert remaining_entries[0].id == survivor_entry.id

    remaining_events = session.exec(select(Event)).all()
    assert len(remaining_events) == 1
    assert remaining_events[0].id == survivor.id


@pytest.mark.parametrize("entry_count", [1, 3])
@pytest.mark.parametrize("event_type", [EventType.Expense, EventType.Income])
def test_validate_entries_present_entry_driven_with_entries(
    event_type: EventType, entry_count: int
):
    """Expense and Income carrying at least one entry pass"""
    event = EventFactory.build(
        type=event_type,
        entries=EventEntryFactory.build_batch(entry_count, event_id=0),
    )

    assert len(validate_entries_present(event)) == 0


@pytest.mark.parametrize("event_type", [EventType.Expense, EventType.Income])
def test_validate_entries_present_entry_driven_without_entries(event_type: EventType):
    """Expense and Income with no entry report exactly one NO_ENTRIES error"""
    event = EventFactory.build(type=event_type)

    errors = validate_entries_present(event)

    # One error for the event as a whole, not one per missing row.
    assert len(errors) == 1
    assert errors[0].type is EventClearErrorType.NO_ENTRIES


@pytest.mark.parametrize("entry_count", [0, 2])
@pytest.mark.parametrize("event_type", [EventType.Transfer, EventType.Exchange])
def test_validate_entries_present_transaction_driven(
    event_type: EventType, entry_count: int
):
    """Transfer and Exchange are transaction-driven, so entries are optional"""
    event = EventFactory.build(
        type=event_type,
        entries=EventEntryFactory.build_batch(entry_count, event_id=0),
    )

    assert len(validate_entries_present(event)) == 0


@pytest.mark.parametrize("transaction_count", [1, 3])
@pytest.mark.parametrize("event_type", [EventType.Transfer, EventType.Exchange])
def test_validate_transactions_present_transaction_driven_with_transactions(
    event_type: EventType, transaction_count: int
):
    """Transfer and Exchange carrying at least one transaction pass"""
    event = EventFactory.build(
        type=event_type,
        transactions=TransactionFactory.build_batch(transaction_count),
    )

    assert len(validate_transactions_present(event)) == 0


@pytest.mark.parametrize("event_type", [EventType.Transfer, EventType.Exchange])
def test_validate_transactions_present_transaction_driven_without_transactions(
    event_type: EventType,
):
    """Transfer and Exchange with no transaction report one NO_TRANSACTIONS error"""
    event = EventFactory.build(type=event_type)

    errors = validate_transactions_present(event)

    # One error for the event as a whole, not one per missing row.
    assert len(errors) == 1
    assert errors[0].type is EventClearErrorType.NO_TRANSACTIONS


@pytest.mark.parametrize("transaction_count", [0, 2])
@pytest.mark.parametrize("event_type", [EventType.Expense, EventType.Income])
def test_validate_transactions_present_entry_driven(
    event_type: EventType, transaction_count: int
):
    """Expense and Income are entry-driven, so transactions are optional"""
    event = EventFactory.build(
        type=event_type,
        transactions=TransactionFactory.build_batch(transaction_count),
    )

    assert len(validate_transactions_present(event)) == 0


def _totals_event(
    event_type: EventType = EventType.Expense,
    entry_amounts: Sequence[Decimal] = (),
    transaction_amounts: Sequence[Decimal] = (),
    entry_currency_code: str = "TWD",
    transaction_currency_code: str = "TWD",
) -> Event:
    """Build an unpersisted event whose two sides share a currency by default."""
    account = AccountFactory.build(
        currency=CurrencyFactory.build(code=transaction_currency_code)
    )
    entry_currency = CurrencyFactory.build(code=entry_currency_code)

    return EventFactory.build(
        type=event_type,
        entries=[
            EventEntryFactory.build(
                amount=amount, quantity=1, currency=entry_currency, event_id=0
            )
            for amount in entry_amounts
        ],
        transactions=[
            TransactionFactory.build(amount=amount, account=account)
            for amount in transaction_amounts
        ],
    )


@pytest.mark.parametrize(
    ("event_type", "transaction_amounts"),
    [
        (EventType.Expense, [Decimal("-100.00")]),
        (EventType.Expense, [Decimal("-40.00"), Decimal("-60.00")]),
        (EventType.Income, [Decimal("100.00")]),
        (EventType.Income, [Decimal("40.00"), Decimal("60.00")]),
    ],
)
def test_validate_totals_match_matching(
    event_type: EventType, transaction_amounts: list[Decimal]
):
    """Expense mirrors its transactions, Income matches them sign for sign"""
    event = _totals_event(
        event_type=event_type,
        entry_amounts=[Decimal("30.00"), Decimal("70.00")],
        transaction_amounts=transaction_amounts,
    )

    assert len(validate_totals_match(event)) == 0


@pytest.mark.parametrize(
    ("event_type", "transaction_amounts"),
    [
        (EventType.Expense, [Decimal("-99.00")]),
        # Right magnitude, wrong sign: an Expense paid by an inbound transaction
        (EventType.Expense, [Decimal("100.00")]),
        (EventType.Income, [Decimal("99.00")]),
        (EventType.Income, [Decimal("-100.00")]),
    ],
)
def test_validate_totals_match_mismatch(
    event_type: EventType, transaction_amounts: list[Decimal]
):
    """Totals that disagree report exactly one TOTALS_MISMATCH error"""
    event = _totals_event(
        event_type=event_type,
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=transaction_amounts,
    )

    errors = validate_totals_match(event)

    # One error for the event as a whole, not one per row.
    assert len(errors) == 1
    assert errors[0].type is EventClearErrorType.TOTALS_MISMATCH


def test_validate_totals_match_counts_quantity():
    """An entry totals amount times quantity, not amount alone"""
    event = _totals_event(
        entry_amounts=[Decimal("25.00")],
        transaction_amounts=[Decimal("-100.00")],
    )
    event.entries[0].quantity = 4

    assert len(validate_totals_match(event)) == 0


@pytest.mark.parametrize("event_type", [EventType.Expense, EventType.Income])
def test_validate_totals_match_without_transactions(event_type: EventType):
    """No transaction means a zero total, which entries have to match"""
    event = _totals_event(event_type=event_type, entry_amounts=[Decimal("100.00")])

    errors = validate_totals_match(event)

    assert len(errors) == 1
    assert errors[0].type is EventClearErrorType.TOTALS_MISMATCH


@pytest.mark.parametrize("event_type", [EventType.Expense, EventType.Income])
def test_validate_totals_match_without_entries_or_transactions(event_type: EventType):
    """Two empty sides both total zero, so there is nothing to report"""
    event = _totals_event(event_type=event_type)

    assert len(validate_totals_match(event)) == 0


def test_validate_totals_match_multi_currency_entries():
    """Entries spanning currencies have no single total, so the check is skipped"""
    event = _totals_event(
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=[Decimal("-1.00")],
    )
    event.entries.append(
        EventEntryFactory.build(
            amount=Decimal("50.00"),
            quantity=1,
            currency=CurrencyFactory.build(code="USD"),
            event_id=0,
        )
    )

    assert len(validate_totals_match(event)) == 0


def test_validate_totals_match_multi_currency_transactions():
    """Transactions spanning currencies skip the check just as entries do"""
    event = _totals_event(
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=[Decimal("-1.00")],
    )
    event.transactions.append(
        TransactionFactory.build(
            amount=Decimal("-50.00"),
            account=AccountFactory.build(currency=CurrencyFactory.build(code="USD")),
        )
    )

    assert len(validate_totals_match(event)) == 0


def test_validate_totals_match_currency_differs_across_sides():
    """Each side is single-currency, but they disagree, so the check is skipped"""
    event = _totals_event(
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=[Decimal("-1.00")],
        entry_currency_code="TWD",
        transaction_currency_code="USD",
    )

    assert len(validate_totals_match(event)) == 0


@pytest.mark.parametrize("event_type", [EventType.Transfer, EventType.Exchange])
def test_validate_totals_match_transaction_driven(event_type: EventType):
    """Transfer and Exchange move money between accounts, totals never apply"""
    event = _totals_event(
        event_type=event_type,
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=[Decimal("-1.00")],
    )

    assert len(validate_totals_match(event)) == 0


def _clear_error(error_type: EventClearErrorType, msg: str) -> EventClearError:
    return EventClearError(type=error_type, msg=msg)


EVENT_TIME = datetime(2026, 8, 9, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize("event_type", list(EventType))
def test_validate_transaction_timestamps_at_or_after_event(event_type: EventType):
    """Transactions on or after the event timestamp pass"""
    event = EventFactory.build(
        type=event_type,
        timestamp=EVENT_TIME,
        transactions=[
            TransactionFactory.build(created_at=EVENT_TIME),
            TransactionFactory.build(created_at=EVENT_TIME + timedelta(seconds=1)),
        ],
    )

    assert len(validate_transaction_timestamps(event)) == 0


def test_validate_transaction_timestamps_before_event():
    """A transaction predating the event reports one INCONSISTENT_TIMESTAMPS"""
    event = EventFactory.build(
        timestamp=EVENT_TIME,
        transactions=[
            TransactionFactory.build(created_at=EVENT_TIME - timedelta(seconds=1))
        ],
    )

    errors = validate_transaction_timestamps(event)

    assert len(errors) == 1
    assert errors[0].type is EventClearErrorType.INCONSISTENT_TIMESTAMPS


def test_validate_transaction_timestamps_reports_every_offender():
    """Each offending transaction gets its own error, compliant ones none"""
    event = EventFactory.build(
        timestamp=EVENT_TIME,
        transactions=[
            TransactionFactory.build(created_at=EVENT_TIME - timedelta(days=1), id=1),
            TransactionFactory.build(created_at=EVENT_TIME, id=2),
            TransactionFactory.build(created_at=EVENT_TIME - timedelta(hours=1), id=3),
        ],
    )

    errors = validate_transaction_timestamps(event)

    # One per offending row, in the event's transaction order.
    assert len(errors) == 2
    assert all(
        error.type is EventClearErrorType.INCONSISTENT_TIMESTAMPS for error in errors
    )
    assert "Transaction 1 " in errors[0].msg
    assert "Transaction 3 " in errors[1].msg


def test_validate_transaction_timestamps_without_transactions():
    """An event carrying no transaction has nothing to compare"""
    event = EventFactory.build(timestamp=EVENT_TIME)

    assert len(validate_transaction_timestamps(event)) == 0


def test_validate_event_clearable_real_registry():
    """The shipped registry holds the presence, totals, and timestamp validators"""
    # Expense with a matching entry and an on-time transaction satisfies all four.
    event = _totals_event(
        entry_amounts=[Decimal("100.00")],
        transaction_amounts=[Decimal("-100.00")],
    )
    event.timestamp = EVENT_TIME
    event.transactions[0].created_at = EVENT_TIME

    # Guard the premise: if another validator lands, this test is the reminder
    # to cover it here rather than a silent pass.
    assert len(CLEAR_VALIDATORS) == 4
    assert CLEAR_VALIDATORS == (
        validate_entries_present,
        validate_transactions_present,
        validate_totals_match,
        validate_transaction_timestamps,
    )
    assert len(validate_event_clearable(event)) == 0


def test_validate_event_clearable_passing_validator():
    """A validator returning no error contributes nothing"""
    event = EventFactory.build()
    seen = []

    def passes(candidate: Event) -> list[EventClearError]:
        seen.append(candidate)
        return []

    with patch("kayman.logics.event.CLEAR_VALIDATORS", (passes,)):
        errors = validate_event_clearable(event)

    assert len(errors) == 0
    # The validator is handed the very event under test, not a copy.
    assert len(seen) == 1
    assert seen[0] is event


def test_validate_event_clearable_single_error():
    """A failing validator's single error is returned as-is"""
    event = EventFactory.build()
    error = _clear_error(EventClearErrorType.NO_ENTRIES, "no entries")

    def fails(_event: Event) -> list[EventClearError]:
        return [error]

    with patch("kayman.logics.event.CLEAR_VALIDATORS", (fails,)):
        errors = validate_event_clearable(event)

    assert len(errors) == 1
    assert errors[0] is error


def test_validate_event_clearable_multiple_errors_from_one_validator():
    """One validator reports every offending row, all of them survive"""
    event = EventFactory.build()
    first = _clear_error(EventClearErrorType.TRANSACTIONS_NOT_POSTED, "txn 1 pending")
    second = _clear_error(EventClearErrorType.TRANSACTIONS_NOT_POSTED, "txn 2 pending")
    third = _clear_error(EventClearErrorType.TRANSACTIONS_NOT_POSTED, "txn 3 pending")

    def fails(_event: Event) -> list[EventClearError]:
        return [first, second, third]

    with patch("kayman.logics.event.CLEAR_VALIDATORS", (fails,)):
        errors = validate_event_clearable(event)

    # Within a validator, the order it reported is preserved.
    assert len(errors) == 3
    assert errors == [first, second, third]


def test_validate_event_clearable_collects_across_validators():
    """Errors from several validators concatenate in registry order"""
    event = EventFactory.build()
    already_cleared = _clear_error(
        EventClearErrorType.ALREADY_CLEARED, "already cleared"
    )
    mismatch = _clear_error(EventClearErrorType.TOTALS_MISMATCH, "totals mismatch")
    empty_description = _clear_error(
        EventClearErrorType.EMPTY_ENTRIES_DESCRIPTION, "entry 0 has no description"
    )

    def first_fails(_event: Event) -> list[EventClearError]:
        return [already_cleared]

    def passes(_event: Event) -> list[EventClearError]:
        return []

    def last_fails(_event: Event) -> list[EventClearError]:
        return [mismatch, empty_description]

    with patch(
        "kayman.logics.event.CLEAR_VALIDATORS", (first_fails, passes, last_fails)
    ):
        errors = validate_event_clearable(event)

    # Registry order between validators, reported order within one.
    assert len(errors) == 3
    assert errors == [already_cleared, mismatch, empty_description]


def test_validate_event_clearable_runs_every_validator_after_a_failure():
    """An early failure never short-circuits the validators behind it"""
    event = EventFactory.build()
    calls = []

    def first_fails(candidate: Event) -> list[EventClearError]:
        calls.append(("first", candidate))
        return [_clear_error(EventClearErrorType.NO_TRANSACTIONS, "no transactions")]

    def second_fails(candidate: Event) -> list[EventClearError]:
        calls.append(("second", candidate))
        return [_clear_error(EventClearErrorType.INCONSISTENT_TIMESTAMPS, "timestamps")]

    with patch("kayman.logics.event.CLEAR_VALIDATORS", (first_fails, second_fails)):
        errors = validate_event_clearable(event)

    assert len(calls) == 2
    assert [name for name, _ in calls] == ["first", "second"]
    assert all(seen is event for _, seen in calls)

    assert len(errors) == 2
    assert [error.type for error in errors] == [
        EventClearErrorType.NO_TRANSACTIONS,
        EventClearErrorType.INCONSISTENT_TIMESTAMPS,
    ]
