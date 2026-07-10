from sqlmodel import Session

from kayman.crud.event_entry import create_event_entries
from kayman.schemas.event import EventEntry, EventEntryBase
from kayman.tests.factories import EventFactory


def test_create_event_entries(session: Session):
    entry_creates = EventFactory.build_details(entry_num=3).entries
    event_entries = []
    for entry_index, entry in enumerate(entry_creates):
        event_entries.append(
            EventEntryBase.model_validate(
                entry,
                update={
                    "payment_id": 1,
                    "index": entry_index,
                },
            )
        )
    db_entries = create_event_entries(session, event_entries)

    assert len(db_entries) == 3

    for i, db_entry in enumerate(db_entries):
        assert db_entry.amount == event_entries[i].amount
        assert db_entry.category_id == event_entries[i].category_id
        assert db_entry.currency_code == event_entries[i].currency_code
        assert db_entry.description == event_entries[i].description
        assert db_entry.index == event_entries[i].index
        assert db_entry.id is not None
        assert db_entry.payment_id == event_entries[i].payment_id
        assert db_entry.quantity == event_entries[i].quantity


def test_create_event_entries_no_commit(session: Session, session_2: Session):
    entry_create = EventFactory.build_details().entries[0]
    event_entry = EventEntryBase.model_validate(
        entry_create,
        update={
            "payment_id": 1,
            "index": 0,
        },
    )

    # The entry should be created in the session
    session_entry = create_event_entries(
        session,
        [event_entry],
        commit=False,
    )[0]
    assert session_entry.id is not None  # Auto int should be set
    assert session_entry.amount == event_entry.amount
    assert session_entry.category_id == event_entry.category_id
    assert session_entry.currency_code == event_entry.currency_code
    assert session_entry.description == event_entry.description
    assert session_entry.index == event_entry.index
    assert session_entry.payment_id == event_entry.payment_id
    assert session_entry.quantity == event_entry.quantity

    # The entry should not be visible to other sessions (yet)
    session_2_entry = session_2.get(EventEntry, session_entry.id)
    assert session_2_entry is None

    # Commit the entry from main session
    session.commit()

    # The entry should now be visible to other sessions
    session_2_entry = session_2.get(EventEntry, session_entry.id)
    assert session_2_entry is not None
    assert session_2_entry.id == session_entry.id
    assert session_2_entry.amount == session_entry.amount
    assert session_2_entry.category_id == session_entry.category_id
    assert session_2_entry.currency_code == session_entry.currency_code
    assert session_2_entry.description == session_entry.description
    assert session_2_entry.index == session_entry.index
    assert session_2_entry.payment_id == session_entry.payment_id
    assert session_2_entry.quantity == session_entry.quantity
