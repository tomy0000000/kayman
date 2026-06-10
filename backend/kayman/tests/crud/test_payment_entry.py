from sqlmodel import Session

from kayman.crud.payment_entry import create_payment_entries
from kayman.schemas.payment import PaymentEntry, PaymentEntryBase
from kayman.tests.factories import PaymentFactory


def test_create_payment_entries(session: Session):
    entry_creates = PaymentFactory.build_details(entry_num=3).entries
    payment_entries = []
    for entry_index, entry in enumerate(entry_creates):
        payment_entries.append(
            PaymentEntryBase.model_validate(
                entry,
                update={
                    "payment_id": 1,
                    "index": entry_index,
                },
            )
        )
    db_entries = create_payment_entries(session, payment_entries)

    assert len(db_entries) == 3

    for i, db_entry in enumerate(db_entries):
        assert db_entry.amount == payment_entries[i].amount
        assert db_entry.category_id == payment_entries[i].category_id
        assert db_entry.currency_code == payment_entries[i].currency_code
        assert db_entry.description == payment_entries[i].description
        assert db_entry.index == payment_entries[i].index
        assert db_entry.id is not None
        assert db_entry.payment_id == payment_entries[i].payment_id
        assert db_entry.quantity == payment_entries[i].quantity


def test_create_payment_entries_no_commit(session: Session, session_2: Session):
    entry_create = PaymentFactory.build_details().entries[0]
    payment_entry = PaymentEntryBase.model_validate(
        entry_create,
        update={
            "payment_id": 1,
            "index": 0,
        },
    )

    # The entry should be created in the session
    session_entry = create_payment_entries(
        session,
        [payment_entry],
        commit=False,
    )[0]
    assert session_entry.id is not None  # Auto int should be set
    assert session_entry.amount == payment_entry.amount
    assert session_entry.category_id == payment_entry.category_id
    assert session_entry.currency_code == payment_entry.currency_code
    assert session_entry.description == payment_entry.description
    assert session_entry.index == payment_entry.index
    assert session_entry.payment_id == payment_entry.payment_id
    assert session_entry.quantity == payment_entry.quantity

    # The entry should not be visible to other sessions (yet)
    session_2_entry = session_2.get(PaymentEntry, session_entry.id)
    assert session_2_entry is None

    # Commit the entry from main session
    session.commit()

    # The entry should now be visible to other sessions
    session_2_entry = session_2.get(PaymentEntry, session_entry.id)
    assert session_2_entry is not None
    assert session_2_entry.id == session_entry.id
    assert session_2_entry.amount == session_entry.amount
    assert session_2_entry.category_id == session_entry.category_id
    assert session_2_entry.currency_code == session_entry.currency_code
    assert session_2_entry.description == session_entry.description
    assert session_2_entry.index == session_entry.index
    assert session_2_entry.payment_id == session_entry.payment_id
    assert session_2_entry.quantity == session_entry.quantity
