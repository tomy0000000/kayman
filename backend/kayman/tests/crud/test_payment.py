from datetime import datetime

from sqlmodel import Session

from kayman.crud.payment import create_payment, read_payment, read_payments
from kayman.tests.factories import (
    CategoryFactory,
    PaymentEntryFactory,
    PaymentFactory,
)


def test_create_payment(session: Session, session_2: Session):
    payment = PaymentFactory.build()
    db_payment = create_payment(session, payment)
    db_read_payment = read_payment(session_2, db_payment.id)

    assert db_read_payment.id is not None
    assert db_read_payment.description == payment.description
    assert db_read_payment.timestamp == payment.timestamp
    assert db_read_payment.timezone == payment.timezone
    assert db_read_payment.type == payment.type


def test_create_payment_no_commit(session: Session, session_2: Session):
    payment = PaymentFactory.build()

    # The payment should be created in the session
    session_payment = create_payment(session, payment, commit=False)
    assert session_payment.id is not None  # Auto int should be set
    assert session_payment.description == payment.description
    assert session_payment.timestamp == payment.timestamp
    assert session_payment.timezone == payment.timezone
    assert session_payment.type == payment.type

    # The payment should not be visible to other sessions (yet)
    session_2_payment = read_payment(session_2, session_payment.id)
    assert session_2_payment is None

    # Commit the payment from main session
    session.commit()

    # The payment should now be visible to other sessions
    session_3_payment = read_payment(session_2, session_payment.id)
    assert session_3_payment is not None
    assert session_3_payment.id == session_payment.id
    assert session_3_payment.description == session_payment.description
    assert session_3_payment.timestamp == session_payment.timestamp
    assert session_3_payment.timezone == session_payment.timezone
    assert session_3_payment.type == session_payment.type


def test_read_payment(session: Session):
    payment = PaymentFactory()
    assert read_payment(session, payment.id) == payment


def test_read_payments_all(session: Session):
    for _ in range(10):
        PaymentFactory()

    assert len(read_payments(session)) == 10


def test_read_payments_by_date(session: Session):
    PaymentFactory(timestamp=datetime(2025, 1, 1))
    PaymentFactory(timestamp=datetime(2025, 1, 2))

    assert len(read_payments(session, payment_date="2025-01-01")) == 1
    assert len(read_payments(session, payment_date="2025-01-02")) == 1


def test_read_payments_by_category(session: Session):
    category_1 = CategoryFactory()
    category_2 = CategoryFactory()
    category_3 = CategoryFactory()
    payment_1 = PaymentFactory(
        entries=[
            PaymentEntryFactory(category=category_1),
            PaymentEntryFactory(category=category_2),
        ]
    )
    payment_2 = PaymentFactory(
        entries=[
            PaymentEntryFactory(category=category_1),
            PaymentEntryFactory(category=category_3),
        ]
    )

    payments = read_payments(session, category_id=category_1.id)
    payment_ids = {payment.id for payment in payments}
    assert len(payments) == 2
    assert payment_1.id in payment_ids
    assert payment_2.id in payment_ids

    payments = read_payments(session, category_id=category_2.id)
    assert len(payments) == 1
    assert payments[0].id == payment_1.id

    payments = read_payments(session, category_id=category_3.id)
    assert len(payments) == 1
    assert payments[0].id == payment_2.id
