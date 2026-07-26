from collections.abc import Sequence

from sqlmodel import Session

from kayman.crud.event_entry import read_event_entries, update_event_entries
from kayman.schemas.event_entry import EventEntry, EventEntryUpdate


def update_event_entries_by_ids(
    session: Session,
    updates: Sequence[EventEntryUpdate],
    commit: bool = True,
) -> Sequence[EventEntry]:
    # Nothing to resolve, and an empty id set would read (and lock) every row
    if not updates:
        return []

    # Sort a copy: read_event_entries returns id-ordered rows, and
    # update_event_entries pairs rows with updates positionally
    updates = sorted(updates, key=lambda update: update.id)

    entry_ids = {update.id for update in updates}
    entries = read_event_entries(session, entry_ids=entry_ids, for_update=True)
    missing_ids = entry_ids - {entry.id for entry in entries}
    if missing_ids:
        raise ValueError(f"Event entry id(s) not found: {missing_ids}")

    return update_event_entries(session, entries, updates, commit=commit)
