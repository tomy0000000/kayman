from collections.abc import Sequence
from datetime import date

from sqlmodel import Session, func, select

from kayman.schemas.payment import (
    Payment,
    PaymentBase,
    PaymentCreate,
    PaymentEntry,
)


def create_payment(
    session: Session, payment: PaymentCreate, commit: bool = True
) -> PaymentBase:
    db_payment = Payment.model_validate(payment)
    session.add(db_payment)
    if commit:
        session.commit()
        session.refresh(db_payment)
    else:
        session.flush()
    return db_payment


def read_payment(session: Session, payment_id: int) -> Payment | None:
    return session.get(Payment, payment_id)


def read_payments(
    session: Session, payment_date: date | None = None, category_id: int | None = None
) -> Sequence[Payment]:
    scalar = select(Payment).distinct()
    if payment_date:
        scalar = scalar.where(func.date(Payment.timestamp) == payment_date)
    if category_id:
        scalar = scalar.join(PaymentEntry).where(
            PaymentEntry.category_id == category_id
        )
    payments = session.exec(scalar).all()
    return payments
