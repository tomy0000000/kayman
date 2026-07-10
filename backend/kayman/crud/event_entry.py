from collections.abc import Sequence

from sqlmodel import Session

from kayman.schemas.event_entry import EventEntry, EventEntryBase


def create_event_entries(
    session: Session,
    entries: list[EventEntryBase],
    commit: bool = True,
) -> Sequence[EventEntryBase]:
    db_entries = [EventEntry.model_validate(entry) for entry in entries]
    session.add_all(db_entries)
    if commit:
        session.commit()
        for db_entry in db_entries:
            session.refresh(db_entry)
    else:
        session.flush()
    return db_entries
