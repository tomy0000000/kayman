from collections import Counter
from collections.abc import Collection, Mapping, Sequence
from typing import cast

from sqlmodel import Session

from kayman.crud.event import read_events
from kayman.crud.transaction import read_transactions, update_transactions
from kayman.crud.transaction_event_link import (
    delete_transaction_event_links,
    read_transaction_event_links,
    update_transaction_event_links,
)
from kayman.logics.event import validate_events_editable
from kayman.schemas.transaction import TransactionUpdate
from kayman.schemas.transaction_event_link import (
    TransactionEventLink,
    TransactionEventLinkCreate,
    TransactionEventLinkUpdate,
)
from kayman.util import format_ids


def require_link_targets(
    session: Session, links: Sequence[TransactionEventLinkCreate]
) -> None:
    """Raise if a link names a transaction or an event that doesn't exist."""
    # Must precede the reads: both treat an empty id list as "all"
    if not links:
        return
    transaction_ids = {link.transaction_id for link in links}
    event_ids = {link.event_id for link in links}
    # Locked, transactions then events, so a concurrent delete can't slip in after
    found_txns = {
        txn.id
        for txn in read_transactions(
            session, transaction_ids=transaction_ids, for_update=True
        )
    }
    found_events = {
        event.id
        for event in read_events(
            session, event_ids=event_ids, order_by="id", for_update=True
        )
    }
    if missing := transaction_ids - found_txns:
        raise ValueError(f"Transaction id(s) not found: {format_ids(missing)}")
    if missing := event_ids - found_events:
        raise ValueError(f"Event id(s) not found: {format_ids(missing)}")


def validate_transaction_event_links_creatable(
    session: Session, links: Sequence[TransactionEventLinkCreate]
) -> None:
    """Raise if a link repeats a pair, touches a cleared row, or takes a position."""
    if not links:
        return
    pairs = Counter((link.transaction_id, link.event_id) for link in links)
    existing = {
        (link.transaction_id, link.event_id)
        for link in read_transaction_event_links(
            session, event_ids={event_id for _, event_id in pairs}
        )
    }
    repeated = {pair for pair, count in pairs.items() if count > 1} | (
        pairs.keys() & existing
    )
    if repeated:
        listed = ", ".join(f"{t} on event {e}" for t, e in sorted(repeated))
        raise ValueError(f"Transaction(s) already linked: {listed}")

    _validate_rows_editable(
        session,
        {link.transaction_id for link in links},
        {link.event_id for link in links},
    )
    validate_event_slots_free(
        session, [(link.transaction_id, link.event_id, link.index) for link in links]
    )


def validate_transaction_event_links_editable(
    session: Session,
    link_ids: Collection[int],
    new_indexes: Mapping[int, int] | None = None,
) -> None:
    """Raise if a link's transaction or event is cleared, or a new index is taken."""
    # Must precede the read: read_transaction_event_links treats an empty list as "all"
    if not link_ids:
        return
    repeated = {i for i, count in Counter(link_ids).items() if count > 1}
    if repeated:
        raise ValueError(f"Repeated link id(s): {format_ids(repeated)}")
    links = read_transaction_event_links(session, link_ids=link_ids)
    _validate_rows_editable(
        session,
        {link.transaction_id for link in links},
        {link.event_id for link in links},
    )

    new_indexes = new_indexes or {}
    moving = [link for link in links if link.id in new_indexes]
    validate_event_slots_free(
        session,
        [
            (link.transaction_id, link.event_id, new_indexes[cast(int, link.id)])
            for link in moving
        ],
        {(link.transaction_id, link.event_id) for link in moving},
    )


def update_transaction_event_links_by_ids(
    session: Session,
    updates: Sequence[TransactionEventLinkUpdate],
    commit: bool = True,
) -> Sequence[TransactionEventLink]:
    if not updates:
        return []

    # Sort a copy: rows come back id-ordered and pair with updates positionally
    updates = sorted(updates, key=lambda update: update.id)
    links = _require_links(session, {update.id for update in updates})

    # The transaction row mirrors its FK link, so a moved FK link moves the row too
    mirrored = {
        link.transaction_id: update.index
        for link, update in zip(links, updates, strict=True)
        if update.index is not None
        and update.index != link.index
        and link.event_id == link.transaction.event_id
    }
    update_transaction_event_links(session, links, updates, commit=False)
    _update_transaction_rows(
        session,
        {
            txn_id: TransactionUpdate(id=txn_id, index=index)
            for txn_id, index in mirrored.items()
        },
    )

    if commit:
        session.commit()
        for link in links:
            session.refresh(link)
    else:
        session.flush()
    return links


def delete_transaction_event_links_by_ids(
    session: Session,
    link_ids: Collection[int],
    commit: bool = True,
) -> None:
    if not link_ids:
        return

    links = _require_links(session, set(link_ids))
    # Deleting a transaction's FK link unlinks the row, and the shim drops the link
    fk_links = [link for link in links if link.event_id == link.transaction.event_id]
    delete_transaction_event_links(
        session, [link for link in links if link not in fk_links], commit=False
    )
    _update_transaction_rows(
        session,
        {
            link.transaction_id: TransactionUpdate(
                id=link.transaction_id, event_id=None
            )
            for link in fk_links
        },
    )

    if commit:
        session.commit()
    else:
        session.flush()


def validate_event_slots_free(
    session: Session,
    slots: Sequence[tuple[int | None, int, int]],
    vacating: Collection[tuple[int, int]] = (),
) -> None:
    """Raise if slots collide, or one lands on a link the write doesn't vacate."""
    if not slots:
        return
    counts = Counter((event_id, index) for _, event_id, index in slots)
    # Lock the events, in id order, so a concurrent write can't claim a slot found free
    read_events(
        session,
        event_ids={event_id for event_id, _ in counts},
        order_by="id",
        for_update=True,
    )
    taken = {slot for slot, count in counts.items() if count > 1}
    links = read_transaction_event_links(
        session, event_ids={event_id for event_id, _ in counts}
    )
    taken |= {
        (link.event_id, link.index)
        for link in links
        if (link.event_id, link.index) in counts
        and (link.transaction_id, link.event_id) not in vacating
    }
    if taken:
        positions = ", ".join(
            f"{index} on event {event}" for event, index in sorted(taken)
        )
        raise ValueError(f"Event position(s) already taken: {positions}")


def _require_links(
    session: Session, link_ids: Collection[int]
) -> Sequence[TransactionEventLink]:
    links = read_transaction_event_links(session, link_ids=link_ids, for_update=True)
    if missing := set(link_ids) - {link.id for link in links}:
        raise ValueError(
            f"Transaction event link id(s) not found: {format_ids(missing)}"
        )
    return links


def _validate_rows_editable(
    session: Session, transaction_ids: Collection[int], event_ids: Collection[int]
) -> None:
    """Raise if any of the transactions or events is cleared, locking them in order."""
    txns = (
        read_transactions(session, transaction_ids=transaction_ids, for_update=True)
        if transaction_ids
        else []
    )
    cleared = {cast(int, txn.id) for txn in txns if txn.cleared_at is not None}
    if cleared:
        raise ValueError(f"Transaction id(s) already cleared: {format_ids(cleared)}")
    validate_events_editable(session, event_ids)


def _update_transaction_rows(
    session: Session, updates: Mapping[int, TransactionUpdate]
) -> None:
    if not updates:
        return
    txns = read_transactions(
        session, transaction_ids=updates.keys(), order_by="id", for_update=True
    )
    update_transactions(
        session, txns, [updates[cast(int, txn.id)] for txn in txns], commit=False
    )
