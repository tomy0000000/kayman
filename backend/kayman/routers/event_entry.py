from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event_entry import create_event_entries
from kayman.logics.event_entry import (
    delete_event_entries_by_ids,
    update_event_entries_by_ids,
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
    "", name="Create Event Entries", response_model=list[EventEntryRead]
)
def create_entries(
    *,
    session: Session = Depends(get_session),
    entries: list[EventEntryCreate],
) -> Sequence[EventEntryBase]:
    return create_event_entries(session, entries)


@event_entry_router.patch(
    "", name="Update Event Entries", response_model=list[EventEntryRead]
)
def update_entries(
    *,
    session: Session = Depends(get_session),
    entries: list[EventEntryUpdate],
) -> Sequence[EventEntryBase]:
    try:
        return update_event_entries_by_ids(session, entries)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err


@event_entry_router.delete("", name="Delete Event Entries")
def delete_entries(
    *,
    session: Session = Depends(get_session),
    ids: Annotated[list[int], Query()],
) -> None:
    try:
        delete_event_entries_by_ids(session, ids)
    except ValueError as err:
        raise HTTPException(status_code=404, detail=err.args[0]) from err
