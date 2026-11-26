from decimal import Decimal
from unittest.mock import patch

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from kayman.crud.transaction_event_link import (
    create_transaction_event_links,
    delete_transaction_event_links,
    read_transaction_event_links,
    update_transaction_event_links,
)
from kayman.schemas.event import Event
from kayman.schemas.transaction import Transaction
from kayman.schemas.transaction_event_link import (
    TransactionEventLink,
    TransactionEventLinkCreate,
    TransactionEventLinkUpdate,
)
from kayman.tests.factories import (
    EventFactory,
    TransactionEventLinkFactory,
    TransactionFactory,
)


def test_create_transaction_event_links(session: Session):
    event = EventFactory()
    transactions = TransactionFactory.create_batch(
        3, event=None, event_id=None, index=None
    )
    links = [
        TransactionEventLinkCreate(
            transaction_id=transaction.id,
            event_id=event.id,
            amount=transaction.amount,
            index=index,
        )
        for index, transaction in enumerate(transactions)
    ]

    db_links = create_transaction_event_links(session, links)

    assert len(db_links) == 3
    for db_link, link in zip(db_links, links, strict=True):
        assert db_link.id is not None
        assert db_link.transaction_id == link.transaction_id
        assert db_link.event_id == event.id
        assert db_link.amount == link.amount
        assert db_link.index == link.index


def test_create_transaction_event_links_empty(session: Session):
    assert create_transaction_event_links(session, []) == []


def test_create_transaction_event_links_no_commit(session: Session, session_2: Session):
    event = EventFactory()
    transaction = TransactionFactory(event=None)
    link = TransactionEventLinkCreate(
        transaction_id=transaction.id,
        event_id=event.id,
        amount=Decimal("-300.00"),
        index=0,
    )

    # The link should be created in the session
    session_link = create_transaction_event_links(session, [link], commit=False)[0]
    assert session_link.id is not None  # Auto int should be set
    assert session_link.transaction_id == transaction.id

    # The link should not be visible to other sessions (yet)
    assert session_2.get(TransactionEventLink, session_link.id) is None

    # Commit the link from main session
    session.commit()

    # The link should now be visible to other sessions
    session_2_link = session_2.get(TransactionEventLink, session_link.id)
    assert session_2_link is not None
    assert session_2_link.id == session_link.id
    assert session_2_link.transaction_id == transaction.id
    assert session_2_link.event_id == event.id
    assert session_2_link.amount == Decimal("-300.00")
    assert session_2_link.index == 0


@pytest.mark.parametrize(
    ("other_transaction", "other_index"),
    [(False, 1), (True, 0)],
    ids=["duplicate_transaction_event", "duplicate_event_index"],
)
def test_create_transaction_event_links_duplicate(
    session: Session, other_transaction, other_index
):
    existing = TransactionEventLinkFactory(index=0)
    transaction = (
        TransactionFactory(event=None) if other_transaction else existing.transaction
    )
    link = TransactionEventLinkCreate(
        transaction_id=transaction.id,
        event_id=existing.event_id,
        amount=Decimal("1.00"),
        index=other_index,
    )

    with pytest.raises(IntegrityError):
        create_transaction_event_links(session, [link])


@pytest.mark.parametrize(
    "missing_field",
    ["transaction_id", "event_id"],
    ids=["transaction_not_found", "event_not_found"],
)
def test_create_transaction_event_links_fk_not_found(session: Session, missing_field):
    event = EventFactory()
    transaction = TransactionFactory(event=None)
    data = {
        "transaction_id": transaction.id,
        "event_id": event.id,
        "amount": Decimal("1.00"),
        "index": 0,
    }
    data[missing_field] = 999999

    with pytest.raises(IntegrityError):
        create_transaction_event_links(
            session, [TransactionEventLinkCreate.model_validate(data)]
        )


@pytest.mark.parametrize("link_ids", [None, []], ids=["none", "empty"])
def test_read_transaction_event_links(session: Session, link_ids):
    links = TransactionEventLinkFactory.create_batch(3)

    db_links = read_transaction_event_links(session, link_ids=link_ids)

    assert len(db_links) == 3
    assert [db_link.id for db_link in db_links] == sorted(link.id for link in links)


def test_read_transaction_event_links_by_ids(session: Session):
    links = TransactionEventLinkFactory.create_batch(3)

    db_links = read_transaction_event_links(
        session, link_ids=[links[2].id, links[0].id]
    )

    assert len(db_links) == 2
    assert [db_link.id for db_link in db_links] == [links[0].id, links[2].id]


def test_read_transaction_event_links_by_event_ids(session: Session):
    links = TransactionEventLinkFactory.create_batch(3)

    db_links = read_transaction_event_links(
        session, event_ids=[links[1].event_id, links[2].event_id]
    )

    assert len(db_links) == 2
    assert [db_link.id for db_link in db_links] == [links[1].id, links[2].id]


def test_read_transaction_event_links_unknown_id(session: Session):
    TransactionEventLinkFactory()

    assert read_transaction_event_links(session, link_ids=[999999]) == []


def test_read_transaction_event_links_for_update(session: Session):
    link = TransactionEventLinkFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        db_links = read_transaction_event_links(
            session, link_ids=[link.id], for_update=True
        )
        statement = str(mock_exec.call_args[0][0])
        assert "FOR UPDATE" in statement

    assert len(db_links) == 1
    assert db_links[0].id == link.id


def test_update_transaction_event_links(session: Session):
    links = TransactionEventLinkFactory.create_batch(2)

    updated = update_transaction_event_links(
        session,
        links,
        [
            TransactionEventLinkUpdate(id=links[0].id, amount=Decimal("150.00")),
            TransactionEventLinkUpdate(id=links[1].id, index=9999),
        ],
    )

    assert len(updated) == 2
    assert updated[0].id == links[0].id
    assert updated[0].amount == Decimal("150.00")
    assert updated[1].id == links[1].id
    assert updated[1].index == 9999


@pytest.mark.parametrize("field", ["amount", "index"])
def test_update_transaction_event_links_ignores_explicit_none(session: Session, field):
    link = TransactionEventLinkFactory()
    original = getattr(link, field)

    updated = update_transaction_event_links(
        session, [link], [TransactionEventLinkUpdate(id=link.id, **{field: None})]
    )

    assert len(updated) == 1
    assert getattr(updated[0], field) == original


def test_update_transaction_event_links_empty(session: Session):
    assert update_transaction_event_links(session, [], []) == []


@pytest.mark.parametrize(
    ("field", "new_value", "untouched_field"),
    [
        ("amount", Decimal("123.45"), "index"),
        ("index", 9999, "amount"),
    ],
    ids=["amount", "index"],
)
def test_update_transaction_event_link_field(
    session: Session, field, new_value, untouched_field
):
    link = TransactionEventLinkFactory()
    original_untouched = getattr(link, untouched_field)
    transaction_id = link.transaction_id
    event_id = link.event_id

    updated = update_transaction_event_links(
        session,
        [link],
        [TransactionEventLinkUpdate(id=link.id, **{field: new_value})],
    )

    # Unset fields and the link's endpoints stay as they were.
    assert len(updated) == 1
    assert getattr(updated[0], field) == new_value
    assert getattr(updated[0], untouched_field) == original_untouched
    assert updated[0].transaction_id == transaction_id
    assert updated[0].event_id == event_id


def test_update_transaction_event_links_no_commit(session: Session, session_2: Session):
    link = TransactionEventLinkFactory(amount=Decimal("100.00"))

    updated = update_transaction_event_links(
        session,
        [link],
        [TransactionEventLinkUpdate(id=link.id, amount=Decimal("200.00"))],
        commit=False,
    )
    assert len(updated) == 1
    assert updated[0].amount == Decimal("200.00")

    # Not yet visible to other sessions until commit.
    other = session_2.get(TransactionEventLink, link.id)
    assert other is not None
    assert other.amount == Decimal("100.00")

    session.commit()
    session_2.expire_all()

    other = session_2.get(TransactionEventLink, link.id)
    assert other is not None
    assert other.amount == Decimal("200.00")


def test_update_transaction_event_links_length_mismatch(session: Session):
    link = TransactionEventLinkFactory()

    with pytest.raises(ValueError, match="same length"):
        update_transaction_event_links(session, [link], [])


def test_transaction_event_link_create_rejects_negative_index():
    with pytest.raises(ValidationError):
        TransactionEventLinkCreate(
            transaction_id=1,
            event_id=1,
            amount=Decimal("1.00"),
            index=-1,
        )


def test_transaction_event_link_update_rejects_negative_index():
    with pytest.raises(ValidationError):
        TransactionEventLinkUpdate(id=1, index=-1)


# Reorders pass only because park_moving_indexes vacates the target range first
@pytest.mark.parametrize(
    ("start", "target"),
    [
        ([0, 1], [1, 0]),
        ([0, 1, 2], [1, 2, 0]),
        ([0, 1, 2], [1, 2, 3]),
    ],
    ids=["swap", "rotate", "shift_up_into_free_slot"],
)
def test_update_transaction_event_links_reorder(session: Session, start, target):
    event = EventFactory()
    links = [TransactionEventLinkFactory(event=event, index=index) for index in start]

    updated = update_transaction_event_links(
        session,
        links,
        [
            TransactionEventLinkUpdate(id=link.id, index=index)
            for link, index in zip(links, target, strict=True)
        ],
    )

    assert len(updated) == len(target)
    assert [link.index for link in updated] == target


def test_update_transaction_event_links_reorder_leaves_rows_outside_batch_alone(
    session: Session,
):
    event = EventFactory()
    links = [
        TransactionEventLinkFactory(event=event, index=index) for index in range(4)
    ]

    # Swap the middle two. The outer two are not in the batch at all.
    updated = update_transaction_event_links(
        session,
        [links[1], links[2]],
        [
            TransactionEventLinkUpdate(id=links[1].id, index=2),
            TransactionEventLinkUpdate(id=links[2].id, index=1),
        ],
    )

    assert len(updated) == 2
    assert [link.index for link in updated] == [2, 1]

    all_links = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(all_links) == 4
    assert [link.index for link in all_links] == [0, 2, 1, 3]


def test_update_transaction_event_links_reorder_across_events(session: Session):
    event_1 = EventFactory()
    event_2 = EventFactory()
    links = [
        TransactionEventLinkFactory(event=event, index=index)
        for event in (event_1, event_2)
        for index in range(2)
    ]

    updated = update_transaction_event_links(
        session,
        links,
        [
            TransactionEventLinkUpdate(id=link.id, index=1 - link.index)
            for link in links
        ],
    )

    assert len(updated) == 4
    assert [link.index for link in updated] == [1, 0, 1, 0]
    assert [link.event_id for link in updated] == [
        event_1.id,
        event_1.id,
        event_2.id,
        event_2.id,
    ]


def test_update_transaction_event_links_reorder_onto_row_outside_batch(
    session: Session,
):
    event = EventFactory()
    links = [
        TransactionEventLinkFactory(event=event, index=index) for index in range(3)
    ]

    # Targeting an index still held by a row outside the batch is a real duplicate.
    with pytest.raises(IntegrityError):
        update_transaction_event_links(
            session,
            [links[0]],
            [TransactionEventLinkUpdate(id=links[0].id, index=1)],
        )

    # The failed write rolls back whole, leaving no parked negative indexes.
    session.rollback()
    all_links = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(all_links) == 3
    assert [link.index for link in all_links] == [0, 1, 2]


def test_delete_transaction_event_links(session: Session):
    links = TransactionEventLinkFactory.create_batch(3)

    delete_transaction_event_links(session, [links[0], links[2]])

    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 1
    assert remaining[0].id == links[1].id


def test_delete_transaction_event_links_empty(session: Session):
    link = TransactionEventLinkFactory()

    delete_transaction_event_links(session, [])

    remaining = session.exec(select(TransactionEventLink)).all()
    assert len(remaining) == 1
    assert remaining[0].id == link.id


def test_delete_transaction_event_links_no_commit(session: Session, session_2: Session):
    link = TransactionEventLinkFactory()
    link_id = link.id

    delete_transaction_event_links(session, [link], commit=False)

    # The delete should not be visible to other sessions (yet)
    session_2_links = session_2.exec(select(TransactionEventLink)).all()
    assert len(session_2_links) == 1
    assert session_2_links[0].id == link_id

    # Commit the delete from main session
    session.commit()

    # The delete should now be visible to other sessions
    session_2_links = session_2.exec(select(TransactionEventLink)).all()
    assert len(session_2_links) == 0


def test_delete_transaction_event_links_keeps_related_rows(session: Session):
    link = TransactionEventLinkFactory()
    transaction_id = link.transaction_id
    event_id = link.event_id

    delete_transaction_event_links(session, [link])

    remaining = session.exec(select(TransactionEventLink)).all()
    assert len(remaining) == 0
    transactions = session.exec(select(Transaction)).all()
    assert len(transactions) == 1
    assert transactions[0].id == transaction_id
    events = session.exec(select(Event)).all()
    assert len(events) == 1
    assert events[0].id == event_id


# The cascade tests cover the ORM cascade, not the FK's ON DELETE CASCADE
def test_delete_transaction_cascades_to_links(session: Session):
    event = EventFactory()
    links = [
        TransactionEventLinkFactory(event=event, index=index) for index in range(2)
    ]

    session.delete(links[0].transaction)
    session.commit()

    # Only the deleted transaction's link goes, the event and its other link stay.
    remaining = session.exec(select(TransactionEventLink)).all()
    assert len(remaining) == 1
    assert remaining[0].id == links[1].id
    events = session.exec(select(Event)).all()
    assert len(events) == 1
    assert events[0].id == event.id


def test_delete_event_cascades_to_links(session: Session):
    event = EventFactory()
    links = [
        TransactionEventLinkFactory(event=event, index=index) for index in range(2)
    ]
    other_link = TransactionEventLinkFactory()
    transaction_ids = sorted(link.transaction_id for link in links)

    session.delete(event)
    session.commit()

    # Links to other events survive, and the transactions themselves survive.
    remaining = session.exec(select(TransactionEventLink)).all()
    assert len(remaining) == 1
    assert remaining[0].id == other_link.id
    transactions = session.exec(
        select(Transaction).where(col(Transaction.id).in_(transaction_ids))
    ).all()
    assert len(transactions) == 2
    assert sorted(transaction.id for transaction in transactions) == transaction_ids
