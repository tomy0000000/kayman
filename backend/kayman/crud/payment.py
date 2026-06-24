from collections.abc import Sequence
from datetime import date

from sqlmodel import Session, func, select

from kayman.schemas.event import (
    Event,
    EventBase,
    EventCreate,
    PaymentEntry,
)


def create_payment(
    session: Session, payment: EventCreate, commit: bool = True
) -> EventBase:
    db_payment = Event.model_validate(payment)
    session.add(db_payment)
    if commit:
        session.commit()
        session.refresh(db_payment)
    else:
        session.flush()
    return db_payment


def read_payment(session: Session, payment_id: int) -> Event | None:
    return session.get(Event, payment_id)


def read_payments(
    session: Session, payment_date: date | None = None, category_id: int | None = None
) -> Sequence[Event]:
    scalar = select(Event).distinct()
    if payment_date:
        scalar = scalar.where(func.date(Event.timestamp) == payment_date)
    if category_id:
        scalar = scalar.join(PaymentEntry).where(
            PaymentEntry.category_id == category_id
        )
    payments = session.exec(scalar).all()
    return payments
