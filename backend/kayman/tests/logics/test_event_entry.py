from decimal import Decimal

import pytest
from sqlmodel import Session, col, select

from kayman.logics.event_entry import (
    delete_event_entries_by_ids,
    update_event_entries_by_ids,
)
from kayman.schemas.event_entry import EventEntry, EventEntryUpdate
from kayman.tests.factories import EventEntryFactory


def test_update_event_entries_by_ids(session: Session):
    entries = EventEntryFactory.create_batch(2)

    # Ids out of insertion order: rows and updates must stay aligned so each
    # entry takes its own change.
    updated = update_event_entries_by_ids(
        session,
        [
            EventEntryUpdate(id=entries[1].id, description="second"),
            EventEntryUpdate(id=entries[0].id, amount=Decimal("150.00")),
        ],
    )

    # Returned rows come back id-ordered regardless of the input order.
    assert len(updated) == 2
    assert [entry.id for entry in updated] == [entries[0].id, entries[1].id]
    assert updated[0].amount == Decimal("150.00")
    assert updated[1].description == "second"


def test_update_event_entries_by_ids_empty(session: Session):
    entry = EventEntryFactory(description="untouched")

    assert update_event_entries_by_ids(session, []) == []
    assert entry.description == "untouched"


def test_update_event_entries_by_ids_missing_id(session: Session):
    with pytest.raises(ValueError, match="not found"):
        update_event_entries_by_ids(
            session, [EventEntryUpdate(id=999999, amount=Decimal("1.00"))]
        )


def test_update_event_entries_by_ids_no_commit(session: Session, session_2: Session):
    entry = EventEntryFactory(amount=Decimal("10.00"))

    updated = update_event_entries_by_ids(
        session,
        [EventEntryUpdate(id=entry.id, amount=Decimal("40.00"))],
        commit=False,
    )
    assert len(updated) == 1
    assert updated[0].amount == Decimal("40.00")

    # Not committed: other sessions still see the old amount.
    other = session_2.get(EventEntry, entry.id)
    assert other.amount == Decimal("10.00")


def test_update_event_entries_by_ids_does_not_mutate_input(session: Session):
    entries = EventEntryFactory.create_batch(2)
    updates = [
        EventEntryUpdate(id=entries[1].id, amount=Decimal("25.00")),
        EventEntryUpdate(id=entries[0].id, amount=Decimal("15.00")),
    ]

    update_event_entries_by_ids(session, updates)

    # The caller's list keeps its original order: sorting happens on a copy.
    assert [update.id for update in updates] == [entries[1].id, entries[0].id]


def test_delete_event_entries_by_ids(session: Session):
    entries = EventEntryFactory.create_batch(3)

    # Ids out of insertion order: only the requested subset goes.
    delete_event_entries_by_ids(session, [entries[2].id, entries[0].id])

    remaining = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(remaining) == 1
    assert remaining[0].id == entries[1].id


def test_delete_event_entries_by_ids_empty(session: Session):
    entries = EventEntryFactory.create_batch(2)

    # An empty id set must not fall through to "every row".
    delete_event_entries_by_ids(session, [])

    remaining = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(remaining) == 2
    assert [entry.id for entry in remaining] == [entries[0].id, entries[1].id]


def test_delete_event_entries_by_ids_missing_id(session: Session):
    entries = EventEntryFactory.create_batch(2)

    with pytest.raises(ValueError, match="not found"):
        delete_event_entries_by_ids(session, [entries[0].id, 999999])

    # Nothing is deleted, not even the id that did resolve.
    session.rollback()
    remaining = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(remaining) == 2
    assert [entry.id for entry in remaining] == [entries[0].id, entries[1].id]


def test_delete_event_entries_by_ids_no_commit(session: Session, session_2: Session):
    entry = EventEntryFactory()
    entry_id = entry.id

    delete_event_entries_by_ids(session, [entry_id], commit=False)

    # Not committed: other sessions still see the row.
    session_2_entries = session_2.exec(select(EventEntry)).all()
    assert len(session_2_entries) == 1
    assert session_2_entries[0].id == entry_id

    session.commit()

    session_2_entries = session_2.exec(select(EventEntry)).all()
    assert len(session_2_entries) == 0
