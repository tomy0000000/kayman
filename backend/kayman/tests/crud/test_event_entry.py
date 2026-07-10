import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.crud.event_entry import create_event_entries
from kayman.schemas.event_entry import EventEntry, EventEntryBase
from kayman.tests.factories import (
    CategoryFactory,
    CurrencyFactory,
    EventEntryFactory,
    EventFactory,
)


def test_create_event_entries(session: Session):
    event = EventFactory()
    category = CategoryFactory()
    currency = CurrencyFactory()
    entries = [
        EventEntryBase.model_validate(entry)
        for entry in EventEntryFactory.build_batch(
            3,
            event_id=event.id,
            category_id=category.id,
            currency_code=currency.code,
        )
    ]

    db_entries = create_event_entries(session, entries)

    assert len(db_entries) == 3
    for db_entry, entry in zip(db_entries, entries, strict=True):
        assert db_entry.id is not None
        assert db_entry.event_id == event.id
        assert db_entry.category_id == category.id
        assert db_entry.currency_code == currency.code
        assert db_entry.amount == entry.amount
        assert db_entry.quantity == entry.quantity
        assert db_entry.description == entry.description
        assert db_entry.index == entry.index


def test_create_event_entries_empty(session: Session):
    assert create_event_entries(session, []) == []


def test_create_event_entries_no_commit(session: Session, session_2: Session):
    event = EventFactory()
    category = CategoryFactory()
    currency = CurrencyFactory()
    entry = EventEntryBase.model_validate(
        EventEntryFactory.build(
            event_id=event.id,
            category_id=category.id,
            currency_code=currency.code,
        )
    )

    # The entry should be created in the session
    session_entry = create_event_entries(session, [entry], commit=False)[0]
    assert session_entry.id is not None  # Auto int should be set
    assert session_entry.event_id == event.id

    # The entry should not be visible to other sessions (yet)
    assert session_2.get(EventEntry, session_entry.id) is None

    # Commit the entry from main session
    session.commit()

    # The entry should now be visible to other sessions
    session_2_entry = session_2.get(EventEntry, session_entry.id)
    assert session_2_entry is not None
    assert session_2_entry.id == session_entry.id
    assert session_2_entry.event_id == event.id
    assert session_2_entry.category_id == category.id
    assert session_2_entry.currency_code == currency.code


def test_create_event_entries_event_not_found(session: Session):
    category = CategoryFactory()
    currency = CurrencyFactory()
    entry = EventEntryBase.model_validate(
        EventEntryFactory.build(
            event_id=999999,
            category_id=category.id,
            currency_code=currency.code,
        )
    )

    with pytest.raises(IntegrityError):
        create_event_entries(session, [entry])
