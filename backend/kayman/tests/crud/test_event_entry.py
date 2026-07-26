from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from kayman.crud.event_entry import create_event_entries, update_event_entries
from kayman.schemas.event_entry import EventEntry, EventEntryCreate, EventEntryUpdate
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
        EventEntryCreate.model_validate(entry)
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
    entry = EventEntryCreate.model_validate(
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
    entry = EventEntryCreate.model_validate(
        EventEntryFactory.build(
            event_id=999999,
            category_id=category.id,
            currency_code=currency.code,
        )
    )

    with pytest.raises(IntegrityError):
        create_event_entries(session, [entry])


def test_update_event_entries(session: Session):
    entries = EventEntryFactory.create_batch(2)

    updated = update_event_entries(
        session,
        entries,
        [
            EventEntryUpdate(id=entries[0].id, amount=Decimal("150.00")),
            EventEntryUpdate(id=entries[1].id, description="new"),
        ],
    )

    assert len(updated) == 2
    assert updated[0].id == entries[0].id
    assert updated[0].amount == Decimal("150.00")
    assert updated[1].id == entries[1].id
    assert updated[1].description == "new"


def test_update_event_entries_empty(session: Session):
    assert update_event_entries(session, [], []) == []


@pytest.mark.parametrize(
    ("field", "make_value"),
    [
        # FK fields need a fresh row created at test time, hence a callable.
        ("event_id", lambda: EventFactory().id),
        ("category_id", lambda: CategoryFactory().id),
        ("currency_code", lambda: CurrencyFactory().code),
        ("amount", lambda: Decimal("123.45")),
        ("quantity", lambda: 7),
        ("description", lambda: "new description"),
        ("index", lambda: 9999),
    ],
    ids=[
        "event_id",
        "category_id",
        "currency_code",
        "amount",
        "quantity",
        "description",
        "index",
    ],
)
def test_update_event_entry_field(session: Session, field, make_value):
    entry = EventEntryFactory()
    new_value = make_value()

    updated = update_event_entries(
        session,
        [entry],
        [EventEntryUpdate(id=entry.id, **{field: new_value})],
    )

    assert len(updated) == 1
    assert getattr(updated[0], field) == new_value


def test_update_event_entries_explicit_none_clears_field(session: Session):
    # The factory sets description to a non-null value.
    entry = EventEntryFactory(amount=Decimal("100.00"))
    assert entry.description is not None
    original_amount = entry.amount

    # Passing description=None explicitly marks it "set", so exclude_unset keeps
    # it and the column is cleared. amount is omitted, so it stays untouched.
    updated = update_event_entries(
        session,
        [entry],
        [EventEntryUpdate(id=entry.id, description=None)],
    )

    assert len(updated) == 1
    assert updated[0].description is None
    assert updated[0].amount == original_amount


def test_update_event_entries_no_commit(session: Session, session_2: Session):
    entry = EventEntryFactory(amount=Decimal("100.00"))

    updated = update_event_entries(
        session,
        [entry],
        [EventEntryUpdate(id=entry.id, amount=Decimal("200.00"))],
        commit=False,
    )
    assert len(updated) == 1
    assert updated[0].amount == Decimal("200.00")

    # Not yet visible to other sessions until commit.
    other = session_2.get(EventEntry, entry.id)
    assert other is not None
    assert other.amount == Decimal("100.00")


def test_update_event_entries_length_mismatch(session: Session):
    entry = EventEntryFactory()

    with pytest.raises(ValueError, match="same length"):
        update_event_entries(session, [entry], [])


def test_event_entry_create_rejects_negative_index():
    with pytest.raises(ValidationError):
        EventEntryCreate(
            event_id=1,
            category_id=1,
            amount=Decimal("1.00"),
            quantity=1,
            currency_code="USD",
            index=-1,
        )


def test_event_entry_update_rejects_negative_index():
    with pytest.raises(ValidationError):
        EventEntryUpdate(id=1, index=-1)
