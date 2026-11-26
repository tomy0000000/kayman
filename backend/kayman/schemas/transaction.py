import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import computed_field
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel

from kayman.schemas.event import EventRead
from kayman.schemas.event_entry import EventEntryRead
from kayman.schemas.transaction_event_link import TransactionEventLinkEventRead
from kayman.schemas.transaction_tag import TransactionTagLink, TransactionTagRead

if TYPE_CHECKING:
    from kayman.schemas.account import Account
    from kayman.schemas.transaction_event_link import TransactionEventLink
    from kayman.schemas.transaction_tag import TransactionTag


class TransactionClearErrorType(enum.Enum):
    ALREADY_CLEARED = "ALREADY_CLEARED"
    NOT_POSTED = "NOT_POSTED"
    NO_STATEMENT = "NO_STATEMENT"
    NO_EVENT = "NO_EVENT"
    ALLOCATION_MISMATCH = "ALLOCATION_MISMATCH"


class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id")
    amount: Decimal
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    posted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    description: str | None = None
    cleared_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class Transaction(TransactionBase, table=True):
    id: int | None = Field(primary_key=True, default=None)
    statement_id: int | None = Field(
        foreign_key="statement.id", default=None
    )  # TODO: accept this on creation
    account: "Account" = Relationship(back_populates="transactions")
    event_links: list["TransactionEventLink"] = Relationship(
        back_populates="transaction",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "TransactionEventLink.id"},
    )
    tags: list["TransactionTag"] = Relationship(
        back_populates="transactions", link_model=TransactionTagLink
    )

    @property
    def currency_code(self) -> str:
        return self.account.currency_code


class TransactionCreate(TransactionBase):
    tag_ids: list[int] = []


class TransactionStatus(enum.Enum):
    PENDING = "PENDING"
    POSTED = "POSTED"
    BILLED = "BILLED"
    CLEARED = "CLEARED"


class TransactionRead(TransactionBase):
    id: int
    created_at: datetime
    currency_code: str
    statement_id: int | None = None
    event_links: list[TransactionEventLinkEventRead]
    tags: list[TransactionTagRead] = []

    @computed_field
    def status(self) -> TransactionStatus:
        if self.cleared_at is not None:
            return TransactionStatus.CLEARED
        if self.statement_id is not None:
            return TransactionStatus.BILLED
        if self.posted_at is not None:
            return TransactionStatus.POSTED
        return TransactionStatus.PENDING


class TransactionLeg(SQLModel):
    """A transaction as seen from a sibling on the same event."""

    id: int
    account_id: int
    amount: Decimal
    currency_code: str


class TransactionEventRead(EventRead):
    """An event embedded in a transaction, with its entries and every leg."""

    transactions: list[TransactionLeg]
    entries: list[EventEntryRead]


class TransactionEventLinkDetailedRead(TransactionEventLinkEventRead):
    """A link on the account view, with its event's entries and every leg."""

    event: TransactionEventRead


class TransactionReadWithBalance(TransactionRead):
    # list is invariant, but each item narrows the base field's item type
    event_links: list[TransactionEventLinkDetailedRead]  # type: ignore[assignment]
    running_balance: Decimal


class TransactionPost(SQLModel):
    transaction_id: int
    posted_at: datetime
    amount: Decimal | None = None


class TransactionBill(SQLModel):
    transaction_id: int
    statement_id: int
    amount: Decimal | None = None


class TransactionClear(SQLModel):
    transaction_id: int
    cleared_at: datetime


class TransactionClearError(SQLModel):
    type: TransactionClearErrorType
    msg: str


class TransactionClearable(SQLModel):
    """Whether a transaction can be cleared, and every reason it cannot."""

    clearable: bool
    errors: list[TransactionClearError]


class TransactionClearConflict(SQLModel):
    """The 409 body. FastAPI's HTTPException always wraps its detail."""

    detail: dict[int, list[TransactionClearError]]


class TransactionUpdate(SQLModel):
    id: int
    account_id: int | None = None
    amount: Decimal | None = None
    created_at: datetime | None = None
    description: str | None = None
    tag_ids: list[int] | None = None


# Internal only: status fields change through the post/bill/clear endpoints.
class TransactionStatusUpdate(TransactionUpdate):
    posted_at: datetime | None = None
    statement_id: int | None = None
    cleared_at: datetime | None = None
