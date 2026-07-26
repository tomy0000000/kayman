from collections.abc import Sequence

from sqlmodel import Session

from kayman.schemas.event_entry import (
    EventEntry,
    EventEntryBase,
    EventEntryCreate,
    EventEntryUpdate,
)


def create_event_entries(
    session: Session,
    entries: Sequence[EventEntryCreate],
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


def update_event_entries(
    session: Session,
    previous_entries: Sequence[EventEntry],
    updates: Sequence[EventEntryUpdate],
    commit: bool = True,
) -> Sequence[EventEntry]:
    if len(previous_entries) != len(updates):
        raise ValueError("previous_entries and updates must have the same length")

    for db_entry, entry in zip(previous_entries, updates, strict=True):
        db_entry.sqlmodel_update(entry.model_dump(exclude_unset=True, exclude={"id"}))

    session.add_all(previous_entries)
    if commit:
        session.commit()
        for db_entry in previous_entries:
            session.refresh(db_entry)
    else:
        session.flush()

    return previous_entries
