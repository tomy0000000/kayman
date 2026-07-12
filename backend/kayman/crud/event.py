from collections.abc import Collection, Sequence
from datetime import date

from sqlmodel import Session, col, func, select

from kayman.schemas.event import (
    Event,
    EventBase,
    EventCreate,
    EventUpdate,
)
from kayman.schemas.event_entry import EventEntry


def create_events(
    session: Session, events: Sequence[EventCreate], commit: bool = True
) -> Sequence[EventBase]:
    db_events = [Event.model_validate(event) for event in events]
    session.add_all(db_events)
    if commit:
        session.commit()
        for db_event in db_events:
            session.refresh(db_event)
    else:
        session.flush()
    return db_events


def read_events(
    session: Session,
    event_ids: Collection[int] | None = None,
    event_date: date | None = None,
    category_id: int | None = None,
    for_update: bool = False,
) -> Sequence[Event]:
    scalar = select(Event)
    if event_ids:
        scalar = scalar.where(col(Event.id).in_(event_ids))
    if event_date:
        scalar = scalar.where(func.date(Event.timestamp) == event_date)
    if category_id:
        # distinct() only for the join, which can fan out an event into one row
        # per matching entry. Postgres rejects SELECT DISTINCT ... FOR UPDATE.
        scalar = (
            scalar.join(EventEntry)
            .where(EventEntry.category_id == category_id)
            .distinct()
        )
    if for_update:
        scalar = scalar.with_for_update()
    events = session.exec(scalar).all()
    return events


def update_events(
    session: Session,
    event_ids: Sequence[int],
    events: Sequence[EventUpdate],
    commit: bool = True,
) -> Sequence[Event]:
    # Verify event_ids and events have the same length
    if len(event_ids) != len(events):
        raise ValueError("event_ids and events must have the same length")

    # Verify all events are valid
    db_events = _verify_event_ids(session, event_ids)

    # Update events, pairing by id rather than by row order, which SQL does not
    # guarantee matches the order of event_ids
    id_to_db_event = {db_event.id: db_event for db_event in db_events}
    for event_id, event in zip(event_ids, events, strict=True):
        db_event = id_to_db_event[event_id]
        db_event.sqlmodel_update(event.model_dump(exclude_unset=True))

    session.add_all(db_events)
    if commit:
        session.commit()
        for db_event in db_events:
            session.refresh(db_event)
    else:
        session.flush()

    return db_events


def _verify_event_ids(session: Session, event_ids: Sequence[int]) -> Sequence[Event]:
    db_events = read_events(session, event_ids=event_ids, for_update=True)
    missing_ids = set(event_ids) - {event.id for event in db_events}
    if missing_ids:
        raise ValueError(f"Event id(s) not found: {missing_ids}")

    return db_events
