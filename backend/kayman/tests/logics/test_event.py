from unittest.mock import patch

import pytest
from sqlmodel import Session, col, select

from kayman.logics.event import (
    delete_events_by_ids,
    event_has_transactions,
    validate_total,
)
from kayman.schemas.event import Event, EventType
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
