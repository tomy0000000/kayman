from collections.abc import Collection, Sequence

from sqlmodel import Session, col, select

from kayman.schemas.transaction_tag import (
    TransactionTag,
    TransactionTagBase,
    TransactionTagCreate,
    TransactionTagUpdate,
)


def create_transaction_tags(
    session: Session,
    tags: Sequence[TransactionTagCreate],
    commit: bool = True,
) -> Sequence[TransactionTagBase]:
    db_tags = [TransactionTag.model_validate(tag) for tag in tags]
    session.add_all(db_tags)
    if commit:
        session.commit()
        for db_tag in db_tags:
            session.refresh(db_tag)
    else:
        session.flush()
    return db_tags


def read_transaction_tags(
    session: Session,
    transaction_tag_ids: Collection[int] | None = None,
    archived: bool | None = None,
    for_update: bool = False,
) -> Sequence[TransactionTag]:
    scalar = select(TransactionTag)
    if transaction_tag_ids:
        scalar = scalar.where(col(TransactionTag.id).in_(transaction_tag_ids))
    if archived is not None:
        scalar = scalar.where(TransactionTag.archived == archived)
    if for_update:
        scalar = scalar.with_for_update()
    tags = session.exec(scalar).all()
    return tags


def update_transaction_tags(
    session: Session,
    transaction_tag_ids: Sequence[int],
    tags: Sequence[TransactionTagUpdate],
    commit: bool = True,
) -> Sequence[TransactionTag]:
    # Verify transaction_tag_ids and tags have the same length
    if len(transaction_tag_ids) != len(tags):
        raise ValueError("transaction_tag_ids and tags must have the same length")

    # Verify all tags are valid
    db_tags = _verify_transaction_tag_ids(session, transaction_tag_ids)

    # Update tags, pairing by id rather than by row order, which SQL does not
    # guarantee matches the order of transaction_tag_ids
    id_to_db_tag = {db_tag.id: db_tag for db_tag in db_tags}
    for transaction_tag_id, tag in zip(transaction_tag_ids, tags, strict=True):
        db_tag = id_to_db_tag[transaction_tag_id]
        db_tag.sqlmodel_update(tag.model_dump(exclude_unset=True))

    session.add_all(db_tags)
    if commit:
        session.commit()
        for db_tag in db_tags:
            session.refresh(db_tag)
    else:
        session.flush()

    return db_tags


def _verify_transaction_tag_ids(
    session: Session, transaction_tag_ids: Sequence[int]
) -> Sequence[TransactionTag]:
    db_tags = read_transaction_tags(
        session, transaction_tag_ids=transaction_tag_ids, for_update=True
    )
    missing_ids = set(transaction_tag_ids) - {tag.id for tag in db_tags}
    if missing_ids:
        raise ValueError(f"Transaction tag id(s) not found: {missing_ids}")

    return db_tags
