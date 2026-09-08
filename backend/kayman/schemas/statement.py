from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Self

from pydantic import model_validator
from sqlmodel import CheckConstraint, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from kayman.schemas.account import Account


class StatementBase(SQLModel):
    created_on: date = Field(default_factory=date.today)
    account_id: int = Field(foreign_key="account.id")
    period_start_on: date
    period_end_on: date
    balance: Decimal
    due_on: date

    @model_validator(mode="after")
    def _validate_dates(self) -> Self:
        if self.period_start_on > self.period_end_on:
            raise ValueError("period_start_on must not be after period_end_on")
        if self.due_on < self.period_end_on:
            raise ValueError("due_on must not be before period_end_on")
        return self


class Statement(StatementBase, table=True):
    __table_args__ = (
        CheckConstraint(
            "period_start_on <= period_end_on", name="statement_period_order_check"
        ),
        CheckConstraint("due_on >= period_end_on", name="statement_due_on_check"),
    )
    id: int | None = Field(primary_key=True, default=None)
    account: "Account" = Relationship(back_populates="statements")


class StatementCreate(StatementBase):
    pass


class StatementRead(StatementBase):
    id: int
    created_on: date
