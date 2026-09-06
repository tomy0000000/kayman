from collections.abc import Sequence
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event import (
    create_events,
    read_events,
    update_events,
)
from kayman.logics.event import (
    delete_events_by_ids,
    event_has_transactions,
    validate_event_clearable,
)
from kayman.schemas.api_models import EventReadDetailed
from kayman.schemas.event import (
    EventBase,
    EventClear,
    EventClearConflict,
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
    cleared_at: Literal["empty"] | None = None,
) -> Sequence[EventBase]:
    return read_events(
        session, category_id=category_id, start=start, end=end, cleared_at=cleared_at
    )


@event_router.patch("/{event_id}", name="Update Event", response_model=EventRead)
def update(
    *, session: Session = Depends(get_session), event_id: int, event: EventUpdate
) -> EventBase:
    try:
        return update_events(session, [event_id], [event])[0]
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@event_router.post(
    "/{event_id}/cleared",
    name="Clear Event",
    response_model=EventRead,
    responses={
        409: {"model": EventClearConflict, "description": "Event is not clearable"}
    },
)
def clear(
    *, session: Session = Depends(get_session), event_id: int, data: EventClear
) -> EventBase:
    # Lock the row here rather than letting update_events do it, so validation
    # and the write see the same state.
    events = read_events(session, event_ids=[event_id], for_update=True)
    if not events:
        raise HTTPException(status_code=404, detail="Event not found")

    errors = validate_event_clearable(events[0])
    if errors:
        raise HTTPException(
            status_code=409,
            detail=[error.model_dump(mode="json") for error in errors],
        )

    update = EventUpdate(**data.model_dump(exclude_unset=True))
    return update_events(session, [event_id], [update])[0]


@event_router.delete(
    "/{id}",
    name="Delete Event",
    responses={409: {"description": "Event has transactions"}},
)
def delete(*, session: Session = Depends(get_session), id: int) -> None:
    # Event must not have transactions attached in between, so they cannot be orphaned.
    if event_has_transactions(session, id, for_update=True):
        raise HTTPException(status_code=409, detail="Event has transactions")

    try:
        delete_events_by_ids(session, [id])
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
