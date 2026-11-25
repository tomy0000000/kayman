from collections.abc import Collection, Sequence

from sqlmodel import Session, col, select

from kayman.crud.util import park_moving_indexes
from kayman.schemas.transaction_event_link import (
    TransactionEventLink,
    TransactionEventLinkCreate,
    TransactionEventLinkUpdate,
)


def create_transaction_event_links(
    session: Session,
    links: Sequence[TransactionEventLinkCreate],
    commit: bool = True,
) -> Sequence[TransactionEventLink]:
    db_links = [TransactionEventLink.model_validate(link) for link in links]
    session.add_all(db_links)
    if commit:
        session.commit()
        for db_link in db_links:
            session.refresh(db_link)
    else:
        session.flush()
    return db_links


def read_transaction_event_links(
    session: Session,
    link_ids: Collection[int] | None = None,
    for_update: bool = False,
) -> Sequence[TransactionEventLink]:
    scalar = select(TransactionEventLink)
    if link_ids:
        scalar = scalar.where(col(TransactionEventLink.id).in_(link_ids))
    # Always id-ordered: callers pair the rows with id-sorted updates positionally
    scalar = scalar.order_by(col(TransactionEventLink.id))
    if for_update:
        scalar = scalar.with_for_update()
    return session.exec(scalar).all()


def update_transaction_event_links(
    session: Session,
    previous_links: Sequence[TransactionEventLink],
    updates: Sequence[TransactionEventLinkUpdate],
    commit: bool = True,
) -> Sequence[TransactionEventLink]:
    if len(previous_links) != len(updates):
        raise ValueError("previous_links and updates must have the same length")

    # exclude_none: every link column is NOT NULL, so None means "leave as is"
    link_data = [
        link.model_dump(exclude_unset=True, exclude_none=True, exclude={"id"})
        for link in updates
    ]
    park_moving_indexes(session, previous_links, link_data)

    for db_link, data in zip(previous_links, link_data, strict=True):
        db_link.sqlmodel_update(data)

    session.add_all(previous_links)
    if commit:
        session.commit()
        for db_link in previous_links:
            session.refresh(db_link)
    else:
        session.flush()

    return previous_links


def delete_transaction_event_links(
    session: Session,
    links: Sequence[TransactionEventLink],
    commit: bool = True,
) -> None:
    for link in links:
        session.delete(link)

    if commit:
        session.commit()
    else:
        session.flush()
