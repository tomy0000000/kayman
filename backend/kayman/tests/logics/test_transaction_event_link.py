import re
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlmodel import Session, col, select

from kayman.logics.transaction_event_link import (
    delete_transaction_event_links_by_ids,
    require_link_targets,
    update_transaction_event_links_by_ids,
    validate_event_slots_free,
    validate_transaction_event_links_creatable,
    validate_transaction_event_links_editable,
)
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


def test_require_link_targets_passes(session: Session):
    txn = TransactionFactory(event=None, event_id=None, index=None)
    event = EventFactory()

    assert (
        require_link_targets(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("10.00"),
                    index=0,
                )
            ],
        )
        is None
    )


def test_require_link_targets_empty(session: Session):
    assert require_link_targets(session, []) is None


@pytest.mark.parametrize("missing", ["transaction_id", "event_id"])
def test_require_link_targets_missing(session: Session, missing: str):
    txn = TransactionFactory(event=None, event_id=None, index=None)
    event = EventFactory()
    ids = {"transaction_id": txn.id, "event_id": event.id, missing: 999999}

    with pytest.raises(ValueError, match="not found"):
        require_link_targets(
            session,
            [TransactionEventLinkCreate(**ids, amount=Decimal("10.00"), index=0)],
        )


def test_validate_transaction_event_links_creatable_passes(session: Session):
    event = EventFactory(cleared_at=None)
    other_event = EventFactory(cleared_at=None)
    TransactionEventLinkFactory(event=event, index=0)
    txn = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)

    # One transaction across two events, next to an existing leg
    assert (
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("60.00"),
                    index=1,
                ),
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=other_event.id,
                    amount=Decimal("40.00"),
                    index=0,
                ),
            ],
        )
        is None
    )


def test_validate_transaction_event_links_creatable_empty(session: Session):
    # A cleared link elsewhere must not leak into an empty batch
    TransactionEventLinkFactory()

    assert validate_transaction_event_links_creatable(session, []) is None


def test_validate_transaction_event_links_creatable_duplicate_in_batch(
    session: Session,
):
    event = EventFactory(cleared_at=None)
    txn = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)

    # Distinct indexes: only the repeated pair can trip the check
    with pytest.raises(ValueError):
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("10.00"),
                    index=0,
                ),
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("20.00"),
                    index=1,
                ),
            ],
        )


def test_validate_transaction_event_links_creatable_duplicate_of_existing(
    session: Session,
):
    link = TransactionEventLinkFactory(
        transaction__cleared_at=None, event__cleared_at=None, index=0
    )

    with pytest.raises(ValueError):
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=link.transaction_id,
                    event_id=link.event_id,
                    amount=Decimal("10.00"),
                    index=1,
                )
            ],
        )


@pytest.mark.parametrize("cleared", ["transaction", "event"])
def test_validate_transaction_event_links_creatable_cleared(
    session: Session, cleared: str
):
    txn = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)
    event = EventFactory(cleared_at=None)
    row = txn if cleared == "transaction" else event
    row.cleared_at = datetime(2024, 1, 1, tzinfo=UTC)
    session.add(row)
    session.commit()

    with pytest.raises(ValueError, match="already cleared"):
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("10.00"),
                    index=0,
                )
            ],
        )


def test_validate_transaction_event_links_creatable_position_taken(session: Session):
    event = EventFactory(cleared_at=None)
    TransactionEventLinkFactory(event=event, index=2)
    txn = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Event position(s) already taken: 2 on event {event.id}"),
    ):
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("10.00"),
                    index=2,
                )
            ],
        )


def test_validate_transaction_event_links_creatable_position_taken_in_batch(
    session: Session,
):
    event = EventFactory(cleared_at=None)
    txn_a = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)
    txn_b = TransactionFactory(cleared_at=None, event=None, event_id=None, index=None)

    with pytest.raises(
        ValueError,
        match=re.escape(f"Event position(s) already taken: 0 on event {event.id}"),
    ):
        validate_transaction_event_links_creatable(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("10.00"),
                    index=0,
                )
                for txn in (txn_a, txn_b)
            ],
        )


def test_validate_transaction_event_links_editable_passes(session: Session):
    link = TransactionEventLinkFactory(
        transaction__cleared_at=None, event__cleared_at=None
    )

    assert validate_transaction_event_links_editable(session, [link.id]) is None


def test_validate_transaction_event_links_editable_empty(session: Session):
    # An empty id list must not fall through to reading every (cleared) link
    TransactionEventLinkFactory()

    assert validate_transaction_event_links_editable(session, []) is None


def test_validate_transaction_event_links_editable_ignores_unknown_ids(
    session: Session,
):
    assert validate_transaction_event_links_editable(session, [999999]) is None


@pytest.mark.parametrize("cleared", ["transaction", "event"])
def test_validate_transaction_event_links_editable_cleared(
    session: Session, cleared: str
):
    link = TransactionEventLinkFactory(
        transaction__cleared_at=None, event__cleared_at=None
    )
    row = link.transaction if cleared == "transaction" else link.event
    row.cleared_at = datetime(2024, 1, 1, tzinfo=UTC)
    session.add(row)
    session.commit()

    with pytest.raises(ValueError, match="already cleared"):
        validate_transaction_event_links_editable(session, [link.id])


def test_validate_transaction_event_links_editable_resend_own_index(
    session: Session,
):
    link = TransactionEventLinkFactory(
        transaction__cleared_at=None, event__cleared_at=None, index=4
    )

    assert (
        validate_transaction_event_links_editable(session, [link.id], {link.id: 4})
        is None
    )


def test_validate_transaction_event_links_editable_allows_swap(session: Session):
    event = EventFactory(cleared_at=None)
    link_a = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=0
    )
    link_b = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=1
    )

    assert (
        validate_transaction_event_links_editable(
            session, [link_a.id, link_b.id], {link_a.id: 1, link_b.id: 0}
        )
        is None
    )


def test_validate_transaction_event_links_editable_rejects_taken_index(
    session: Session,
):
    event = EventFactory(cleared_at=None)
    link_a = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=0
    )
    link_b = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=1
    )

    # link_b is in the call but keeps its index, so it still holds 1
    with pytest.raises(ValueError, match="already taken"):
        validate_transaction_event_links_editable(
            session, [link_a.id, link_b.id], {link_a.id: 1}
        )


def test_validate_transaction_event_links_editable_rejects_duplicate_targets(
    session: Session,
):
    event = EventFactory(cleared_at=None)
    link_a = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=0
    )
    link_b = TransactionEventLinkFactory(
        transaction__cleared_at=None, event=event, index=1
    )

    with pytest.raises(ValueError, match="already taken"):
        validate_transaction_event_links_editable(
            session, [link_a.id, link_b.id], {link_a.id: 5, link_b.id: 5}
        )


def test_update_transaction_event_links_by_ids(session: Session):
    links = TransactionEventLinkFactory.create_batch(2, amount=Decimal("10.00"))

    # Ids out of insertion order: each link takes its own change
    updated = update_transaction_event_links_by_ids(
        session,
        [
            TransactionEventLinkUpdate(id=links[1].id, index=99),
            TransactionEventLinkUpdate(id=links[0].id, amount=Decimal("25.00")),
        ],
    )

    assert len(updated) == 2
    by_id = {link.id: (link.amount, link.index) for link in updated}
    assert by_id == {
        links[0].id: (Decimal("25.00"), links[0].index),
        links[1].id: (Decimal("10.00"), 99),
    }


def test_update_transaction_event_links_by_ids_empty(session: Session):
    link = TransactionEventLinkFactory(amount=Decimal("10.00"))

    assert update_transaction_event_links_by_ids(session, []) == []
    assert link.amount == Decimal("10.00")


def test_update_transaction_event_links_by_ids_missing_id(session: Session):
    with pytest.raises(ValueError, match="not found"):
        update_transaction_event_links_by_ids(
            session, [TransactionEventLinkUpdate(id=999999, amount=Decimal("1.00"))]
        )


def test_update_transaction_event_links_by_ids_no_commit(
    session: Session, session_2: Session
):
    link = TransactionEventLinkFactory(amount=Decimal("10.00"))

    updated = update_transaction_event_links_by_ids(
        session,
        [TransactionEventLinkUpdate(id=link.id, amount=Decimal("40.00"))],
        commit=False,
    )
    assert len(updated) == 1
    assert updated[0].amount == Decimal("40.00")

    # Not committed: other sessions still see the old amount
    assert session_2.get(TransactionEventLink, link.id).amount == Decimal("10.00")

    session.commit()
    session_2.expire_all()
    assert session_2.get(TransactionEventLink, link.id).amount == Decimal("40.00")


def test_update_transaction_event_links_by_ids_mirrors_fk_index(session: Session):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=0)
    link = txn.event_links[0]

    update_transaction_event_links_by_ids(
        session, [TransactionEventLinkUpdate(id=link.id, index=5)]
    )

    session.refresh(txn)
    assert txn.index == 5


def test_update_transaction_event_links_by_ids_amount_skips_transaction(
    session: Session,
):
    event = EventFactory()
    txn = TransactionFactory(
        event=event, event_id=event.id, index=0, amount=Decimal("100.00")
    )
    link = txn.event_links[0]

    update_transaction_event_links_by_ids(
        session, [TransactionEventLinkUpdate(id=link.id, amount=Decimal("60.00"))]
    )

    session.refresh(txn)
    session.refresh(link)
    assert link.amount == Decimal("60.00")
    assert txn.amount == Decimal("100.00")
    assert txn.index == 0


def test_update_transaction_event_links_by_ids_non_fk_index_skips_transaction(
    session: Session,
):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=0)
    other = TransactionEventLinkFactory(transaction=txn, event=EventFactory(), index=3)

    update_transaction_event_links_by_ids(
        session, [TransactionEventLinkUpdate(id=other.id, index=7)]
    )

    session.refresh(txn)
    session.refresh(other)
    assert other.index == 7
    assert txn.index == 0


@pytest.mark.parametrize("targets", [[1, 0], [1, 2, 0]], ids=["swap", "rotate"])
def test_update_transaction_event_links_by_ids_reorders_fk_links(
    session: Session, targets: list[int]
):
    event = EventFactory()
    txns = [
        TransactionFactory(event=event, event_id=event.id, index=i)
        for i in range(len(targets))
    ]
    links = [txn.event_links[0] for txn in txns]

    update_transaction_event_links_by_ids(
        session,
        [
            TransactionEventLinkUpdate(id=link.id, index=target)
            for link, target in zip(links, targets, strict=True)
        ],
    )

    for txn, link in zip(txns, links, strict=True):
        session.refresh(txn)
        session.refresh(link)
    assert len(txns) == len(targets)
    assert [link.index for link in links] == targets
    assert [txn.index for txn in txns] == targets


def test_delete_transaction_event_links_by_ids_non_fk(session: Session):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=0)
    fk_link = txn.event_links[0]
    other = TransactionEventLinkFactory(transaction=txn, event=EventFactory())

    delete_transaction_event_links_by_ids(session, [other.id])

    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 1
    assert remaining[0].id == fk_link.id
    session.refresh(txn)
    assert txn.event_id == event.id
    assert txn.index == 0


def test_delete_transaction_event_links_by_ids_fk_unlinks_transaction(
    session: Session,
):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=2)
    fk_link = txn.event_links[0]
    other = TransactionEventLinkFactory(transaction=txn, event=EventFactory())

    delete_transaction_event_links_by_ids(session, [fk_link.id])

    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 1
    assert remaining[0].id == other.id
    session.refresh(txn)
    assert txn.event_id is None
    assert txn.index == 2


def test_delete_transaction_event_links_by_ids_mixed(session: Session):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=0)
    fk_link = txn.event_links[0]
    other = TransactionEventLinkFactory(transaction=txn, event=EventFactory())
    kept = TransactionEventLinkFactory()

    # Ids out of insertion order
    delete_transaction_event_links_by_ids(session, [other.id, fk_link.id])

    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 1
    assert remaining[0].id == kept.id
    session.refresh(txn)
    assert txn.event_id is None
    assert txn.index == 0


def test_delete_transaction_event_links_by_ids_empty(session: Session):
    links = TransactionEventLinkFactory.create_batch(2)

    # An empty id set must not fall through to "every row"
    delete_transaction_event_links_by_ids(session, [])

    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 2
    assert [link.id for link in remaining] == [links[0].id, links[1].id]


def test_delete_transaction_event_links_by_ids_missing_id(session: Session):
    links = TransactionEventLinkFactory.create_batch(2)

    with pytest.raises(ValueError, match="not found"):
        delete_transaction_event_links_by_ids(session, [links[0].id, 999999])

    # Nothing is deleted, not even the id that did resolve
    session.rollback()
    remaining = session.exec(
        select(TransactionEventLink).order_by(col(TransactionEventLink.id))
    ).all()
    assert len(remaining) == 2
    assert [link.id for link in remaining] == [links[0].id, links[1].id]


def test_delete_transaction_event_links_by_ids_no_commit(
    session: Session, session_2: Session
):
    event = EventFactory()
    txn = TransactionFactory(event=event, event_id=event.id, index=0)
    link_id = txn.event_links[0].id

    delete_transaction_event_links_by_ids(session, [link_id], commit=False)

    # Not committed: other sessions still see the link and the FK event
    session_2_links = session_2.exec(select(TransactionEventLink)).all()
    assert len(session_2_links) == 1
    assert session_2_links[0].id == link_id
    assert session_2.get(Transaction, txn.id).event_id == event.id

    session.commit()
    session_2.expire_all()

    assert len(session_2.exec(select(TransactionEventLink)).all()) == 0
    assert session_2.get(Transaction, txn.id).event_id is None


def test_validate_event_slots_free_empty(session: Session):
    TransactionEventLinkFactory(index=0)

    assert validate_event_slots_free(session, []) is None


def test_validate_event_slots_free_locks_target_events(session: Session):
    event = EventFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        validate_event_slots_free(session, [(None, event.id, 0)])
        statements = [str(call.args[0]) for call in mock_exec.call_args_list]

    locking = [s for s in statements if "FROM event" in s and "FOR UPDATE" in s]
    assert len(locking) == 1
    assert "ORDER BY event.id" in locking[0]


def test_validate_transaction_event_links_editable_rejects_repeated_ids(
    session: Session,
):
    link = TransactionEventLinkFactory(
        transaction__cleared_at=None, event__cleared_at=None
    )

    with pytest.raises(
        ValueError, match=re.escape(f"Repeated link id(s): {{{link.id}}}")
    ):
        validate_transaction_event_links_editable(
            session, [link.id, link.id], {link.id: 3}
        )


def test_require_link_targets_locks_transactions_then_events(session: Session):
    txn = TransactionFactory(event=None, event_id=None, index=None)
    event = EventFactory()

    with patch.object(session, "exec", wraps=session.exec) as mock_exec:
        require_link_targets(
            session,
            [
                TransactionEventLinkCreate(
                    transaction_id=txn.id,
                    event_id=event.id,
                    amount=Decimal("1.00"),
                    index=0,
                )
            ],
        )
        statements = [str(call.args[0]) for call in mock_exec.call_args_list]

    locking = [s for s in statements if "FOR UPDATE" in s]
    assert len(locking) == 2
    assert 'FROM "transaction"' in locking[0] or "FROM transaction" in locking[0]
    assert "FROM event" in locking[1]
    assert "ORDER BY event.id" in locking[1]
