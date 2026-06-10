from collections.abc import Sequence

from sqlmodel import Session

from kayman.schemas.payment import PaymentEntry, PaymentEntryBase


def create_payment_entries(
    session: Session,
    entries: list[PaymentEntryBase],
    commit: bool = True,
) -> Sequence[PaymentEntryBase]:
    db_entries = [PaymentEntry.model_validate(entry) for entry in entries]
    session.add_all(db_entries)
    if commit:
        session.commit()
        for db_entry in db_entries:
            session.refresh(db_entry)
    else:
        session.flush()
    return db_entries
