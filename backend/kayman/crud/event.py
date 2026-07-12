from collections.abc import Collection, Sequence
from datetime import date

from sqlmodel import Session, col, func, select

from kayman.schemas.event import (
    Event,
    EventBase,
    EventCreate,
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


def read_event(session: Session, event_id: int) -> Event | None:
    return session.get(Event, event_id)


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
