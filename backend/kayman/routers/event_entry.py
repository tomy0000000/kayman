from collections.abc import Sequence

from fastapi import APIRouter, Depends
from sqlmodel import Session

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.crud.event_entry import create_event_entries
from kayman.schemas.event_entry import EventEntryBase, EventEntryCreate, EventEntryRead

TAG_NAME = "Event Entry"
tag = {
    "name": TAG_NAME,
    "description": "Create and edit event entry records",
}

event_entry_router = APIRouter(
    prefix="/events/entries",
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
