from unittest.mock import patch

import pytest
from sqlmodel import Session, col, select

from kayman.logics.event import (
    CLEAR_VALIDATORS,
    delete_events_by_ids,
    event_has_transactions,
    validate_event_clearable,
    validate_total,
)
from kayman.schemas.event import (
    Event,
    EventClearError,
    EventClearErrorType,
    EventType,
)
from kayman.schemas.event_entry import EventEntry
from kayman.tests.factories import (
    EventEntryFactory,
    EventFactory,
    TransactionFactory,
)


def test_validate_total_expense():
    """Expense: Entries total is matched with transactions total"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_expense_multi_currencies():
    """Expense: Multiple currencies are used, validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_expense_mismatch():
    """Expense: Entries and transactions totals do not match"""
    details = EventFactory.build_details(
        type=EventType.Expense, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_income():
    """Income: Entries total is matched with transactions total"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_income_multi_currencies():
    """Income: Multiple currencies are used, validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    details.entries[-1].currency_code += "_INVALID"  # explicitly change currency
    validate_total(details)


def test_validate_total_income_mismatch():
    """Income: Entries and transactions totals do not match"""
    details = EventFactory.build_details(
        type=EventType.Income, entry_num=3, transaction_num=5
    )
    details.transactions[-1].amount += 1
    with pytest.raises(ValueError, match="transactions (.*) not match"):
        validate_total(details)


def test_validate_total_transfer():
    """Transfer: Validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Transfer, entry_num=3, transaction_num=5
    )
    validate_total(details)


def test_validate_total_exchange():
    """Exchange: Validation should be skipped"""
    details = EventFactory.build_details(
        type=EventType.Exchange, entry_num=3, transaction_num=5
    )
    validate_total(details)


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


def _clear_error(error_type: EventClearErrorType, msg: str) -> EventClearError:
    return EventClearError(type=error_type, msg=msg)


def test_validate_event_clearable_real_registry_is_empty():
    """The shipped registry holds no validator yet, so nothing can fail"""
    event = EventFactory.build()

    # Guard the premise: if a validator lands, this test is the reminder to
    # cover it here rather than a silent pass.
    assert len(CLEAR_VALIDATORS) == 0
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
