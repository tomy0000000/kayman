from datetime import datetime

from sqlmodel import Field, Relationship, SQLModel
from sqlmodel._compat import SQLModelConfig


class InvoiceBase(SQLModel):
    model_config = SQLModelConfig(
        json_schema_extra={
            "example": {
                "number": "AB12345678",
                "card_type": "3J0002",
                "card_number": "/AB12+-.",
                "seller_name": "悠旅生活事業股份有限公司台中巿第三十七分公司",
                "status": "已確認",
                "donatable": False,
                "amount": "200",
                "period": "11104",
                "donate_mark": 0,
                "seller_tax_id": "50868202",
                "seller_address": "",
                "buyer_tax_id": "",
                "currency": "",
                "timestamp": "2022-04-24T16:30:44",
            }
        }
    )

    number: str | None = None
    card_type: str | None = None
    card_number: str | None = None
    seller_name: str | None = None
    status: str | None = None
    donatable: bool | None = None
    amount: str | None = None
    period: str | None = None
    donate_mark: int | None = None
    seller_tax_id: str | None = None
    seller_address: str | None = None
    buyer_tax_id: str | None = None
    currency: str | None = None
    timestamp: datetime | None = None


class InvoiceBaseWithId(InvoiceBase):
    number: str = Field(primary_key=True)


class InvoiceBaseStrict(InvoiceBaseWithId):
    card_type: str
    card_number: str
    seller_name: str
    status: str
    donatable: bool
    amount: str
    period: str
    donate_mark: int
    seller_tax_id: str
    seller_address: str | None = None
    buyer_tax_id: str | None = None
    currency: str | None = None
    timestamp: datetime


class Invoice(InvoiceBaseStrict, table=True):
    __tablename__ = "invoice"
    details: list["InvoiceDetail"] = Relationship(back_populates="invoice")


class InvoiceWrite(InvoiceBase):
    """
    Schema for creating or updating invoices, if invoice is not existed yet, it should
    be fitted with Invoice Schema to create a new invoice.
    """

    pass


class InvoiceRead(InvoiceBaseStrict):
    pass


class InvoiceUpdated(InvoiceBaseWithId):
    pass


class InvoiceWriteResponse(SQLModel):
    created: list[Invoice]
    updated: list[InvoiceUpdated]


#
# InvoiceDetail
#


class InvoiceDetailBase(SQLModel):
    model_config = SQLModelConfig(
        json_schema_extra={
            "example": {
                "row_number": "1",
                "description": "冰茶密斯朵V",
                "quantity": "2",
                "unit_price": "95.0000",
                "amount": "190",
            }
        }
    )

    invoice_number: str | None = None
    row_number: int | None = None
    description: str | None = None
    quantity: str | None = None
    unit_price: str | None = None
    amount: str | None = None


class InvoiceDetailBaseWithId(InvoiceDetailBase):
    invoice_number: str = Field(primary_key=True, foreign_key="invoice.number")
    row_number: int = Field(primary_key=True)


class InvoiceDetailBaseStrict(InvoiceDetailBaseWithId):
    description: str
    quantity: str
    unit_price: str
    amount: str


class InvoiceDetail(InvoiceDetailBaseStrict, table=True):
    __tablename__ = "invoice_detail"
    invoice: "Invoice" = Relationship(back_populates="details")


class InvoiceDetailWrite(InvoiceDetailBase):
    """
    Schema for creating or updating invoice details, if invoice is not existed yet, it
    should be fitted with InvoiceDetail Schema to create a new invoice detail.
    """

    pass


class InvoiceDetailRead(InvoiceDetailBaseStrict):
    pass


class InvoiceDetailUpdated(InvoiceDetailBaseWithId):
    pass


class InvoiceDetailWriteResponse(SQLModel):
    created: list[InvoiceDetailRead]
    updated: list[InvoiceDetailUpdated]


#
# InvoiceCarrier
#


class InvoiceCarrier(SQLModel, table=True):
    __tablename__ = "invoice_carrier"
    id: int | None = Field(primary_key=True, default=None)
    type: str
    card_id: str
    name: str
