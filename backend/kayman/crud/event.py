from collections.abc import Sequence
from datetime import date

from sqlmodel import Session, func, select

from kayman.schemas.event import (
    Event,
    EventBase,
    EventCreate,
    PaymentEntry,
)


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
    session: Session, event_date: date | None = None, category_id: int | None = None
) -> Sequence[Event]:
    scalar = select(Event).distinct()
    if event_date:
        scalar = scalar.where(func.date(Event.timestamp) == event_date)
    if category_id:
        scalar = scalar.join(PaymentEntry).where(
            PaymentEntry.category_id == category_id
        )
    events = session.exec(scalar).all()
    return events
