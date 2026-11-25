from collections.abc import Collection, Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, cast

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, select

from kayman.crud.transaction_event_link import (
    create_transaction_event_links,
    delete_transaction_event_links,
    update_transaction_event_links,
)
from kayman.crud.util import park_moving_indexes
from kayman.schemas.event import Event
from kayman.schemas.transaction import (
    Transaction,
    TransactionBase,
    TransactionCreate,
    TransactionUpdate,
)
from kayman.schemas.transaction_event_link import (
    TransactionEventLink,
    TransactionEventLinkCreate,
    TransactionEventLinkUpdate,
)
from kayman.schemas.transaction_tag import TransactionTag

TransactionOrderBy = Literal["created_at", "posted_at", "amount", "id"]


def create_transactions(
    session: Session,
    txns: Sequence[TransactionCreate],
    commit: bool = True,
) -> Sequence[TransactionBase]:
    db_txns = [Transaction.model_validate(txn) for txn in txns]
    filled = _fill_missing_indexes(
        session, [(db_txn.event_id, db_txn.index) for db_txn in db_txns]
    )
    for db_txn, index in zip(db_txns, filled, strict=True):
        db_txn.index = index
    for db_txn, txn in zip(db_txns, txns, strict=True):
        # getattr: callers may pass a plain TransactionBase, which lacks tag_ids
        tag_ids = getattr(txn, "tag_ids", None)
        if tag_ids:
            db_txn.tags = _resolve_tags(session, tag_ids)
    session.add_all(db_txns)
    session.flush()
    _sync_event_links(
        session,
        db_txns,
        [{"event_id": db_txn.event_id, "index": db_txn.index} for db_txn in db_txns],
        [(None, db_txn.amount) for db_txn in db_txns],
    )
    if commit:
        session.commit()
        for db_txn in db_txns:
            session.refresh(db_txn)
    else:
        session.flush()
    return db_txns


def read_transactions(
    session: Session,
    transaction_ids: Collection[int] | None = None,
    account_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    posted_start: datetime | None = None,
    posted_end: datetime | None = None,
    event_id: int | Literal["empty"] | None = None,
    order_by: TransactionOrderBy | None = None,
    descending: bool = False,
    for_update: bool = False,
    with_event_details: bool = False,
) -> Sequence[Transaction]:
    options = [
        selectinload(Transaction.account),  # type: ignore[arg-type]
        selectinload(Transaction.event),  # type: ignore[arg-type]
        selectinload(Transaction.event_links),  # type: ignore[arg-type]
        selectinload(Transaction.tags),  # type: ignore[arg-type]
    ]
    if with_event_details:
        event = selectinload(Transaction.event)  # type: ignore[arg-type]
        options += [
            event.selectinload(Event.entries),  # type: ignore[arg-type]
            event.selectinload(Event.transactions).selectinload(  # type: ignore[arg-type]
                Transaction.account  # type: ignore[arg-type]
            ),
        ]
    scalar = select(Transaction).options(*options)
    if transaction_ids:
        scalar = scalar.where(col(Transaction.id).in_(transaction_ids))
    if account_id:
        scalar = scalar.where(Transaction.account_id == account_id)
    linked = select(TransactionEventLink.transaction_id)
    if event_id == "empty":
        scalar = scalar.where(col(Transaction.id).not_in(linked))
    elif event_id is not None:
        scalar = scalar.where(
            col(Transaction.id).in_(
                linked.where(TransactionEventLink.event_id == event_id)
            )
        )
    if start is not None:
        scalar = scalar.where(Transaction.created_at >= start)
    if end is not None:
        scalar = scalar.where(Transaction.created_at < end)
    if posted_start is not None:
        scalar = scalar.where(col(Transaction.posted_at) >= posted_start)
    if posted_end is not None:
        scalar = scalar.where(col(Transaction.posted_at) < posted_end)
    column = (
        getattr(Transaction, order_by) if order_by is not None else col(Transaction.id)
    )
    scalar = scalar.order_by(column.desc() if descending else column.asc())
    if for_update:
        scalar = scalar.with_for_update()
    txns = session.exec(scalar).all()
    return txns


def update_transactions(
    session: Session,
    previous_txns: Sequence[Transaction],
    updates: Sequence[TransactionUpdate],
    commit: bool = True,
) -> Sequence[Transaction]:
    if len(previous_txns) != len(updates):
        raise ValueError("previous_txns and updates must have the same length")

    # tag_ids is not a column: strip it from the row update and apply it to the
    # relationship instead. None means "leave tags untouched".
    resolved_tags = [
        None if txn.tag_ids is None else _resolve_tags(session, txn.tag_ids)
        for txn in updates
    ]
    txn_data = [
        txn.model_dump(exclude_unset=True, exclude={"id", "tag_ids"}) for txn in updates
    ]
    slots = [
        (data.get("event_id", db_txn.event_id), data.get("index", db_txn.index))
        for db_txn, data in zip(previous_txns, txn_data, strict=True)
    ]
    for data, (_, index), filled in zip(
        txn_data, slots, _fill_missing_indexes(session, slots), strict=True
    ):
        if filled != index:
            data["index"] = filled

    previous = [(db_txn.event_id, db_txn.amount) for db_txn in previous_txns]

    park_moving_indexes(session, previous_txns, txn_data)

    for db_txn, data, tags in zip(previous_txns, txn_data, resolved_tags, strict=True):
        db_txn.sqlmodel_update(data)
        if tags is not None:
            db_txn.tags = tags

    session.add_all(previous_txns)
    session.flush()
    _sync_event_links(session, previous_txns, txn_data, previous)
    if commit:
        session.commit()
        for db_txn in previous_txns:
            session.refresh(db_txn)
    else:
        session.flush()

    return previous_txns


def _resolve_tags(session: Session, tag_ids: Collection[int]) -> list[TransactionTag]:
    # Dedupe: the composite link-table primary key rejects duplicates
    unique_ids = set(tag_ids)
    tags = session.exec(
        select(TransactionTag).where(col(TransactionTag.id).in_(unique_ids))
    ).all()
    missing_ids = unique_ids - {tag.id for tag in tags}
    if missing_ids:
        raise ValueError(f"Transaction tag id(s) not found: {missing_ids}")
    return list(tags)


def _fill_missing_indexes(
    session: Session, slots: Sequence[tuple[int | None, int | None]]
) -> list[int | None]:
    """Give each slot on an event without an index the event's next free one."""
    pending = {event_id for event_id, index in slots if event_id and index is None}
    if not pending:
        return [index for _, index in slots]

    # Links made through the link endpoints hold positions no transaction mirrors
    taken = [
        *session.exec(
            select(Transaction.event_id, func.max(Transaction.index))
            .where(col(Transaction.event_id).in_(pending))
            .group_by(col(Transaction.event_id))
        ).all(),
        *session.exec(
            select(TransactionEventLink.event_id, func.max(TransactionEventLink.index))
            .where(col(TransactionEventLink.event_id).in_(pending))
            .group_by(col(TransactionEventLink.event_id))
        ).all(),
    ]
    next_free = dict.fromkeys(pending, 0)
    for event_id, max_index in taken:
        if event_id is not None and max_index is not None:
            next_free[event_id] = max(next_free[event_id], max_index + 1)
    for event_id, index in slots:
        if event_id in pending and index is not None:
            next_free[event_id] = max(next_free[event_id], index + 1)

    filled: list[int | None] = []
    for event_id, index in slots:
        if event_id in pending and index is None:
            index = next_free[event_id]
            next_free[event_id] += 1
        filled.append(index)
    return filled


def _sync_event_links(
    session: Session,
    txns: Sequence[Transaction],
    written: Sequence[dict[str, Any]],
    previous: Sequence[tuple[int | None, Decimal]],
) -> None:
    """Shim: carry event_id/index writes onto the link for transaction.event_id."""
    stale: list[TransactionEventLink] = []
    moving: list[TransactionEventLink] = []
    updates: list[TransactionEventLinkUpdate] = []
    new: list[TransactionEventLinkCreate] = []
    for txn, data, (old_event_id, old_amount) in zip(
        txns, written, previous, strict=True
    ):
        links = {link.event_id: link for link in txn.event_links}
        moved_amount = txn.amount
        if old_event_id != txn.event_id and old_event_id in links:
            stale.append(links.pop(old_event_id))
            # A moved share keeps its amount, unless it was the whole transaction
            if links or stale[-1].amount != old_amount:
                moved_amount = stale[-1].amount
        if txn.event_id is None:
            continue

        index = cast(int, txn.index)
        touched = "event_id" in data or "index" in data
        link = links.get(txn.event_id)
        if link is None:
            if touched:
                new.append(
                    TransactionEventLinkCreate(
                        transaction_id=cast(int, txn.id),
                        event_id=txn.event_id,
                        amount=moved_amount,
                        index=index,
                    )
                )
            continue

        # The amount follows only an unsplit link that held the whole amount
        follows = len(links) == 1 and link.amount == old_amount
        amount = txn.amount if follows else link.amount
        target = index if touched else link.index
        if (link.index, link.amount) != (target, amount):
            moving.append(link)
            updates.append(
                TransactionEventLinkUpdate(
                    id=cast(int, link.id), amount=amount, index=target
                )
            )

    # Delete, update, then create: each step frees the slots the next one claims
    delete_transaction_event_links(session, stale, commit=False)
    update_transaction_event_links(session, moving, updates, commit=False)
    create_transaction_event_links(session, new, commit=False)
    # Reload on next access: the collection still holds deleted links, not new ones
    for txn in txns:
        session.expire(txn, ["event_links"])
