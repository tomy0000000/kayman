from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from kayman.crud.event_entry import (
    create_event_entries,
    delete_event_entries,
    read_event_entries,
    update_event_entries,
)
from kayman.schemas.category import Category
from kayman.schemas.currency import Currency
from kayman.schemas.event import Event
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


def test_read_event_entries(session: Session):
    entries = EventEntryFactory.create_batch(3)

    db_entries = read_event_entries(session)

    assert len(db_entries) == 3
    assert [db_entry.id for db_entry in db_entries] == sorted(
        entry.id for entry in entries
    )


def test_read_event_entries_by_ids(session: Session):
    entries = EventEntryFactory.create_batch(3)

    db_entries = read_event_entries(session, entry_ids=[entries[2].id, entries[0].id])

    assert len(db_entries) == 2
    assert [db_entry.id for db_entry in db_entries] == [entries[0].id, entries[2].id]


def test_read_event_entries_unknown_id(session: Session):
    EventEntryFactory()

    assert read_event_entries(session, entry_ids=[999999]) == []


def test_read_event_entries_for_update(session: Session):
    entry = EventEntryFactory()

    db_entries = read_event_entries(session, entry_ids=[entry.id], for_update=True)

    assert len(db_entries) == 1
    assert db_entries[0].id == entry.id


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


# Reorders only survive because park_moving_indexes vacates the target range
# first. shift_up_into_free_slot has a free slot at the top and still needs it:
# SQLAlchemy orders UPDATEs within a flush by primary key, so the lowest row is
# always written first, straight into an index its neighbour still holds.
@pytest.mark.parametrize(
    ("start", "target"),
    [
        ([0, 1], [1, 0]),
        ([0, 1, 2], [1, 2, 0]),
        ([0, 1, 2], [1, 2, 3]),
    ],
    ids=["swap", "rotate", "shift_up_into_free_slot"],
)
def test_update_event_entries_reorder(session: Session, start, target):
    event = EventFactory()
    entries = [
        EventEntryFactory(event=event, event_id=event.id, index=index)
        for index in start
    ]

    updated = update_event_entries(
        session,
        entries,
        [
            EventEntryUpdate(id=entry.id, index=index)
            for entry, index in zip(entries, target, strict=True)
        ],
    )

    assert len(updated) == len(target)
    assert [entry.index for entry in updated] == target


def test_update_event_entries_reorder_leaves_rows_outside_batch_alone(session: Session):
    event = EventFactory()
    entries = [
        EventEntryFactory(event=event, event_id=event.id, index=index)
        for index in range(4)
    ]

    # Swap the middle two. The outer two are not in the batch at all, so the
    # parking pass must not disturb them.
    updated = update_event_entries(
        session,
        [entries[1], entries[2]],
        [
            EventEntryUpdate(id=entries[1].id, index=2),
            EventEntryUpdate(id=entries[2].id, index=1),
        ],
    )

    assert len(updated) == 2
    assert [entry.index for entry in updated] == [2, 1]

    all_entries = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(all_entries) == 4
    assert [entry.index for entry in all_entries] == [0, 2, 1, 3]


def test_update_event_entries_reorder_across_events(session: Session):
    # Parking numbers every moving row in one global sequence, so this proves the
    # parked values stay unique when a batch spans more than one event.
    event_1 = EventFactory()
    event_2 = EventFactory()
    entries = [
        EventEntryFactory(event=event, event_id=event.id, index=index)
        for event in (event_1, event_2)
        for index in range(2)
    ]

    updated = update_event_entries(
        session,
        entries,
        [EventEntryUpdate(id=entry.id, index=1 - entry.index) for entry in entries],
    )

    assert len(updated) == 4
    assert [entry.index for entry in updated] == [1, 0, 1, 0]
    assert [entry.event_id for entry in updated] == [
        event_1.id,
        event_1.id,
        event_2.id,
        event_2.id,
    ]


def test_update_event_entries_reorder_onto_row_outside_batch(session: Session):
    event = EventFactory()
    entries = [
        EventEntryFactory(event=event, event_id=event.id, index=index)
        for index in range(3)
    ]

    # Parking only vacates indexes held by rows in the batch. Targeting an index
    # still held by a row outside it is a genuine duplicate, so it must fail.
    with pytest.raises(IntegrityError):
        update_event_entries(
            session,
            [entries[0]],
            [EventEntryUpdate(id=entries[0].id, index=1)],
        )

    # The failed write rolls back whole, leaving no parked negative indexes.
    session.rollback()
    all_entries = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(all_entries) == 3
    assert [entry.index for entry in all_entries] == [0, 1, 2]


def test_delete_event_entries(session: Session):
    entries = EventEntryFactory.create_batch(3)

    delete_event_entries(session, [entries[0], entries[2]])

    remaining = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(remaining) == 1
    assert remaining[0].id == entries[1].id


def test_delete_event_entries_empty(session: Session):
    entry = EventEntryFactory()

    delete_event_entries(session, [])

    remaining = session.exec(select(EventEntry)).all()
    assert len(remaining) == 1
    assert remaining[0].id == entry.id


def test_delete_event_entries_no_commit(session: Session, session_2: Session):
    entry = EventEntryFactory()
    entry_id = entry.id

    delete_event_entries(session, [entry], commit=False)

    # The delete should not be visible to other sessions (yet)
    session_2_entries = session_2.exec(select(EventEntry)).all()
    assert len(session_2_entries) == 1
    assert session_2_entries[0].id == entry_id

    # Commit the delete from main session
    session.commit()

    # The delete should now be visible to other sessions
    session_2_entries = session_2.exec(select(EventEntry)).all()
    assert len(session_2_entries) == 0


def test_delete_event_entries_leaves_index_gap(session: Session):
    event = EventFactory()
    entries = [
        EventEntryFactory(event=event, event_id=event.id, index=index)
        for index in range(3)
    ]

    delete_event_entries(session, [entries[1]])

    # Survivors keep their original indexes, so the deleted one leaves a hole.
    # Renumbering is deliberately not part of the delete.
    remaining = session.exec(select(EventEntry).order_by(col(EventEntry.id))).all()
    assert len(remaining) == 2
    assert [entry.index for entry in remaining] == [0, 2]


def test_delete_event_entries_keeps_related_rows(session: Session):
    entry = EventEntryFactory()
    event_id = entry.event_id
    category_id = entry.category_id
    currency_code = entry.currency_code

    delete_event_entries(session, [entry])

    # EventEntry is a leaf table, so the rows it points at all survive.
    remaining = session.exec(select(EventEntry)).all()
    assert len(remaining) == 0
    events = session.exec(select(Event)).all()
    assert len(events) == 1
    assert events[0].id == event_id
    categories = session.exec(select(Category)).all()
    assert len(categories) == 1
    assert categories[0].id == category_id
    currencies = session.exec(select(Currency)).all()
    assert len(currencies) == 1
    assert currencies[0].code == currency_code
