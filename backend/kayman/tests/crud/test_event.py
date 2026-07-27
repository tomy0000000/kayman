from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from sqlalchemy import inspect
from sqlmodel import Session

from kayman.crud.event import create_events, read_events, update_events
from kayman.schemas.event import Event, EventType, EventUpdate
from kayman.tests.factories import (
    CategoryFactory,
    EventEntryFactory,
    EventFactory,
    TransactionFactory,
)


def test_create_events_1_event(session: Session, session_2: Session):
    event = EventFactory.build()
    db_event = create_events(session, [event])[0]
    db_read_events = read_events(session_2, event_ids=[db_event.id])

    assert len(db_read_events) == 1
    db_read_event = db_read_events[0]
    assert db_read_event.id is not None
    assert db_read_event.description == event.description
    assert db_read_event.timestamp == event.timestamp
    assert db_read_event.timezone == event.timezone
    assert db_read_event.type == event.type


def test_create_events_n_events(session: Session):
    events = EventFactory.build_batch(10)
    db_events = create_events(session, events)

    assert len(db_events) == 10
    for db_event, event in zip(db_events, events, strict=False):
        assert db_event.id is not None
        assert db_event.description == event.description
        assert db_event.timestamp == event.timestamp
        assert db_event.timezone == event.timezone
        assert db_event.type == event.type


def test_create_events_empty(session: Session):
    assert create_events(session, []) == []


def test_create_events_no_commit(session: Session, session_2: Session):
    event = EventFactory.build()

    # The event should be created in the session
    session_event = create_events(session, [event], commit=False)[0]
    assert session_event.id is not None  # Auto int should be set
    assert session_event.description == event.description
    assert session_event.timestamp == event.timestamp
    assert session_event.timezone == event.timezone
    assert session_event.type == event.type

    # The event should not be visible to other sessions (yet)
    session_2_events = read_events(session_2, event_ids=[session_event.id])
    assert len(session_2_events) == 0

    # Commit the event from main session
    session.commit()

    # The event should now be visible to other sessions
    session_3_events = read_events(session_2, event_ids=[session_event.id])
    assert len(session_3_events) == 1
    session_3_event = session_3_events[0]
    assert session_3_event.id == session_event.id
    assert session_3_event.description == session_event.description
    assert session_3_event.timestamp == session_event.timestamp
    assert session_3_event.timezone == session_event.timezone
    assert session_3_event.type == session_event.type


def test_read_events_by_ids(session: Session):
    event_1 = EventFactory()
    event_2 = EventFactory()
    EventFactory()

    single = read_events(session, event_ids=[event_1.id])
    assert len(single) == 1
    assert single[0].id == event_1.id

    multiple = read_events(session, event_ids=[event_1.id, event_2.id])
    assert len(multiple) == 2
    assert {event.id for event in multiple} == {event_1.id, event_2.id}


def test_read_events_details_ordered_by_index(
    session: Session,  # noqa: ARG001 (binds factory session)
    session_2: Session,
):
    event = EventFactory()
    for index in (2, 0, 1):
        EventEntryFactory(event=event, index=index)
        TransactionFactory(event=event, index=index)

    events = read_events(session_2, event_ids=[event.id])

    assert len(events) == 1
    assert len(events[0].entries) == 3
    assert [entry.index for entry in events[0].entries] == [0, 1, 2]
    assert len(events[0].transactions) == 3
    assert [transaction.index for transaction in events[0].transactions] == [0, 1, 2]

    # The assertions above cannot fail on SQLite: it answers both lazy loads
    # from the (event_id, index) unique index, so rows come back in index order
    # even without an ORDER BY. Assert the relationships are configured to sort,
    # which is what actually holds on Postgres.
    relationships = inspect(Event).relationships
    assert [str(column) for column in relationships["entries"].order_by] == [
        "event_entry.index"
    ]
    assert [str(column) for column in relationships["transactions"].order_by] == [
        "transaction.index"
    ]


def test_read_events_all(session: Session):
    for _ in range(10):
        EventFactory()

    assert len(read_events(session)) == 10


def test_read_events_by_date(session: Session):
    EventFactory(timestamp=datetime(2025, 1, 1))
    EventFactory(timestamp=datetime(2025, 1, 2))

    assert len(read_events(session, event_date="2025-01-01")) == 1
    assert len(read_events(session, event_date="2025-01-02")) == 1


def test_read_events_by_category(session: Session):
    category_1 = CategoryFactory()
    category_2 = CategoryFactory()
    category_3 = CategoryFactory()
    event_1 = EventFactory(
        entries=[
            EventEntryFactory(category=category_1),
            EventEntryFactory(category=category_2),
        ]
    )
    event_2 = EventFactory(
        entries=[
            EventEntryFactory(category=category_1),
            EventEntryFactory(category=category_3),
        ]
    )

    events = read_events(session, category_id=category_1.id)
    event_ids = {event.id for event in events}
    assert len(events) == 2
    assert event_1.id in event_ids
    assert event_2.id in event_ids

    events = read_events(session, category_id=category_2.id)
    assert len(events) == 1
    assert events[0].id == event_1.id

    events = read_events(session, category_id=category_3.id)
    assert len(events) == 1
    assert events[0].id == event_2.id


def test_read_events_by_category_deduplicates(session: Session):
    # Two entries of the same event in the same category. The join fans the
    # event out into one row per matching entry, so distinct() must collapse it
    # back to a single event.
    category = CategoryFactory()
    event = EventFactory(
        entries=[
            EventEntryFactory(category=category),
            EventEntryFactory(category=category),
        ]
    )

    events = read_events(session, category_id=category.id)

    assert len(events) == 1
    assert events[0].id == event.id


def test_read_events_for_update(session: Session):
    EventFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        read_events(session, for_update=True)
        args = mock_exec.call_args[0]
        statement = str(args[0])
        assert "FOR UPDATE" in statement


@pytest.mark.parametrize(
    ("field", "make_value", "commit"),
    [
        ("type", lambda: EventType.Income, True),
        ("timezone", lambda: "America/New_York", True),
        ("description", lambda: "new description", True),
        # Datetime fields use commit=False: SQLite drops tzinfo on the
        # post-commit refresh, so keep the in-memory tz-aware value to compare.
        ("timestamp", lambda: datetime(2026, 6, 1, tzinfo=UTC), False),
        ("cleared_at", lambda: datetime(2026, 6, 1, tzinfo=UTC), False),
    ],
    ids=[
        "type",
        "timezone",
        "description",
        "timestamp",
        "cleared_at",
    ],
)
def test_update_event_field(session: Session, field, make_value, commit):
    event = EventFactory(
        type=EventType.Expense,
        timestamp=datetime(2025, 1, 1, 12, 0),
        timezone="UTC",
        description="original description",
        cleared_at=datetime(2025, 1, 1, 12, 0),
    )
    originals = {
        "type": event.type,
        "timestamp": event.timestamp,
        "timezone": event.timezone,
        "description": event.description,
        "cleared_at": event.cleared_at,
    }
    new_value = make_value()

    updated = update_events(
        session,
        [event.id],
        [EventUpdate(**{field: new_value})],
        commit=commit,
    )

    assert len(updated) == 1
    assert getattr(updated[0], field) == new_value
    # Every field the caller did not set must be left untouched.
    for other_field, original_value in originals.items():
        if other_field == field:
            continue
        assert getattr(updated[0], other_field) == original_value


def test_update_events_explicit_none_clears_description(session: Session):
    event = EventFactory(description="original description")

    # description=None is explicitly set, so exclude_unset keeps it and the
    # column is nulled.
    updated = update_events(session, [event.id], [EventUpdate(description=None)])

    assert len(updated) == 1
    assert updated[0].description is None

    db_events = read_events(session, event_ids=[event.id])
    assert len(db_events) == 1
    assert db_events[0].description is None


def test_update_events_omitted_description_is_untouched(session: Session):
    event = EventFactory(type=EventType.Expense, description="original description")

    # description is omitted, so exclude_unset drops it and the column survives.
    updated = update_events(session, [event.id], [EventUpdate(type=EventType.Income)])

    assert len(updated) == 1
    assert updated[0].type == EventType.Income
    assert updated[0].description == "original description"

    db_events = read_events(session, event_ids=[event.id])
    assert len(db_events) == 1
    assert db_events[0].description == "original description"


def test_update_events_n_events(session: Session):
    event_1 = EventFactory(description="one")
    event_2 = EventFactory(description="two")
    event_3 = EventFactory(description="three")

    updated = update_events(
        session,
        [event_1.id, event_2.id, event_3.id],
        [
            EventUpdate(description="one updated"),
            EventUpdate(description="two updated"),
            EventUpdate(description="three updated"),
        ],
    )

    assert len(updated) == 3
    descriptions = {event.id: event.description for event in updated}
    assert descriptions == {
        event_1.id: "one updated",
        event_2.id: "two updated",
        event_3.id: "three updated",
    }


def test_update_events_pairs_by_id_not_position(session: Session):
    event_1 = EventFactory(description="one")
    event_2 = EventFactory(description="two")
    event_3 = EventFactory(description="three")

    # ids are passed in reverse of the order the DB naturally returns rows in,
    # so an implementation that zips the updates against the fetched rows by
    # position will apply each update to the wrong event.
    updated = update_events(
        session,
        [event_3.id, event_1.id],
        [
            EventUpdate(description="three updated"),
            EventUpdate(description="one updated"),
        ],
    )

    assert len(updated) == 2
    descriptions = {event.id: event.description for event in updated}
    assert descriptions == {
        event_3.id: "three updated",
        event_1.id: "one updated",
    }

    db_events = read_events(session, event_ids=[event_1.id, event_2.id, event_3.id])
    assert len(db_events) == 3
    db_descriptions = {event.id: event.description for event in db_events}
    assert db_descriptions == {
        event_1.id: "one updated",
        event_2.id: "two",  # untouched
        event_3.id: "three updated",
    }


def test_update_events_empty(session: Session):
    updated = update_events(session, [], [])

    assert len(updated) == 0


def test_update_events_no_commit(session: Session, session_2: Session):
    event = EventFactory(description="original description")

    # The update should be applied in the session
    session_events = update_events(
        session,
        [event.id],
        [EventUpdate(description="new description")],
        commit=False,
    )
    assert len(session_events) == 1
    assert session_events[0].description == "new description"

    # The update should not be visible to other sessions (yet)
    session_2_events = read_events(session_2, event_ids=[event.id])
    assert len(session_2_events) == 1
    assert session_2_events[0].description == "original description"

    # Commit the update from main session
    session.commit()

    # The update should now be visible to other sessions
    session_2.expire_all()  # drop session_2's identity-map snapshot
    session_3_events = read_events(session_2, event_ids=[event.id])
    assert len(session_3_events) == 1
    assert session_3_events[0].description == "new description"


def test_update_events_missing_id(session: Session):
    event = EventFactory(description="original description")
    missing_id = event.id + 1000

    with pytest.raises(ValueError, match=r"Event id\(s\) not found"):
        update_events(
            session,
            [event.id, missing_id],
            [
                EventUpdate(description="new description"),
                EventUpdate(description="never applied"),
            ],
        )

    # Nothing should have been mutated
    session.rollback()
    db_events = read_events(session, event_ids=[event.id])
    assert len(db_events) == 1
    assert db_events[0].description == "original description"


def test_update_events_length_mismatch(session: Session):
    event = EventFactory()

    with pytest.raises(ValueError, match="same length"):
        update_events(session, [event.id], [])
