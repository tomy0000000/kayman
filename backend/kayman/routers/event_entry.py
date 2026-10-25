from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event_entry import create_event_entries
from kayman.logics.event import validate_events_editable
from kayman.logics.event_entry import (
    delete_event_entries_by_ids,
    update_event_entries_by_ids,
    validate_event_entries_editable,
)
from kayman.schemas.event_entry import (
    EventEntryBase,
    EventEntryCreate,
    EventEntryRead,
    EventEntryUpdate,
)

TAG_NAME = "Event Entry"
tag = {
    "name": TAG_NAME,
    "description": "Create and edit event entry records",
}

event_entry_router = APIRouter(
    prefix="/event-entries",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@event_entry_router.post(
    "",
    name="Create Event Entries",
    response_model=list[EventEntryRead],
    responses={409: {"description": "Event is cleared"}},
)
def create_entries(
    *,
    session: Session = Depends(get_session),
    entries: list[EventEntryCreate],
) -> Sequence[EventEntryBase]:
    try:
        validate_events_editable(session, {entry.event_id for entry in entries})
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    return create_event_entries(session, entries)


@event_entry_router.patch(
    "",
    name="Update Event Entries",
    response_model=list[EventEntryRead],
    responses={409: {"description": "Event is cleared"}},
)
def update_entries(
    *,
    session: Session = Depends(get_session),
    entries: list[EventEntryUpdate],
) -> Sequence[EventEntryBase]:
    try:
        validate_event_entries_editable(
            session,
            [entry.id for entry in entries],
            [entry.event_id for entry in entries if entry.event_id is not None],
        )
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        return update_event_entries_by_ids(session, entries)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@event_entry_router.delete(
    "",
    name="Delete Event Entries",
    responses={409: {"description": "Event is cleared"}},
)
def delete_entries(
    *,
    session: Session = Depends(get_session),
    ids: Annotated[list[int], Query()],
) -> None:
    try:
        validate_event_entries_editable(session, ids)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=err.args[0]) from err
    try:
        delete_event_entries_by_ids(session, ids)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
