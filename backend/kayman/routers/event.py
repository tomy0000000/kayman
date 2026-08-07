from collections.abc import Sequence
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event import (
    create_events,
    read_events,
    update_events,
)
from kayman.schemas.api_models import EventReadDetailed
from kayman.schemas.event import (
    Event,
    EventBase,
    EventClear,
    EventCreate,
    EventRead,
    EventUpdate,
)

TAG_NAME = "Event"
tag = {
    "name": TAG_NAME,
    "description": "Create and edit event records",
}

event_router = APIRouter(
    prefix="/events",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@event_router.post("", name="Create Event", response_model=EventRead)
def create(*, session: Session = Depends(get_session), event: EventCreate) -> EventBase:
    return create_events(session, [event])[0]


@event_router.get("/{event_id}", name="Read Event", response_model=EventReadDetailed)
def read(*, session: Session = Depends(get_session), event_id: int) -> EventBase:
    events = read_events(session, event_ids=[event_id])
    if not events:
        raise HTTPException(status_code=404, detail="Event not found")
    return events[0]


@event_router.get("", name="Read Events", response_model=list[EventReadDetailed])
def reads(
    *,
    session: Session = Depends(get_session),
    category_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> Sequence[EventBase]:
    return read_events(session, category_id=category_id, start=start, end=end)


@event_router.patch("/{event_id}", name="Update Event", response_model=EventRead)
def update(
    *, session: Session = Depends(get_session), event_id: int, event: EventUpdate
) -> EventBase:
    try:
        return update_events(session, [event_id], [event])[0]
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@event_router.post("/{event_id}/cleared", name="Clear Event", response_model=EventRead)
def clear(
    *, session: Session = Depends(get_session), event_id: int, data: EventClear
) -> EventBase:
    # TODO: validate event details before clearing
    update = EventUpdate(**data.model_dump(exclude_unset=True))
    try:
        return update_events(session, [event_id], [update])[0]
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@event_router.delete("/{id}", name="Delete Event")
def delete(*, session: Session = Depends(get_session), id: int) -> None:
    event = session.get(Event, id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    session.delete(event)
    session.commit()
