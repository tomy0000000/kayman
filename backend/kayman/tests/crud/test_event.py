from datetime import datetime

from sqlmodel import Session

from kayman.crud.event import create_events, read_event, read_events
from kayman.tests.factories import (
    CategoryFactory,
    EventFactory,
    PaymentEntryFactory,
)


def test_create_events_1_event(session: Session, session_2: Session):
    event = EventFactory.build()
    db_event = create_events(session, [event])[0]
    db_read_event = read_event(session_2, db_event.id)

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
    session_2_event = read_event(session_2, session_event.id)
    assert session_2_event is None

    # Commit the event from main session
    session.commit()

    # The event should now be visible to other sessions
    session_3_event = read_event(session_2, session_event.id)
    assert session_3_event is not None
    assert session_3_event.id == session_event.id
    assert session_3_event.description == session_event.description
    assert session_3_event.timestamp == session_event.timestamp
    assert session_3_event.timezone == session_event.timezone
    assert session_3_event.type == session_event.type


def test_read_event(session: Session):
    event = EventFactory()
    assert read_event(session, event.id) == event


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
            PaymentEntryFactory(category=category_1),
            PaymentEntryFactory(category=category_2),
        ]
    )
    event_2 = EventFactory(
        entries=[
            PaymentEntryFactory(category=category_1),
            PaymentEntryFactory(category=category_3),
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
