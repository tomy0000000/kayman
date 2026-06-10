from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlmodel import Session, select

from kayman.auth import get_client
from kayman.core.db import get_session
from kayman.schemas.tw_invoice import (
    Invoice,
    InvoiceBase,
    InvoiceDetail,
    InvoiceDetailBase,
    InvoiceDetailRead,
    InvoiceDetailUpdated,
    InvoiceDetailWrite,
    InvoiceDetailWriteResponse,
    InvoiceRead,
    InvoiceUpdated,
    InvoiceWrite,
    InvoiceWriteResponse,
)

TAG_NAME = "Taiwan E-Invoice"
tag = {
    "name": TAG_NAME,
    "description": "Store replica from MOF E-Invoice platform",
    "externalDocs": {
        "description": "電子發票應用API規格",
        "url": "https://www.einvoice.nat.gov.tw/home/DownLoad"
        "?fileName=1510206773173_0.pdf",
    },
}

invoice_router = APIRouter(
    prefix="/tw-invoice",
    tags=[TAG_NAME],
    dependencies=[Depends(get_client)],
    responses={404: {"description": "Not found"}},
)


@invoice_router.post("", name="Create or Update Invoices")
def create_or_update(
    *, session: Session = Depends(get_session), invoices: list[InvoiceWrite]
) -> InvoiceWriteResponse:
    """
    Create or update invoices

    New invoices will be returned with all fields, while existing invoices will be
    returned with only updated fields.
    """
    created = []
    updated = []
    for invoice in invoices:
        db_invoice = session.get(Invoice, invoice.number)
        if not db_invoice:
            # Create new invoice
            db_invoice = Invoice.model_validate(invoice)
            session.add(db_invoice)
            session.commit()
            session.refresh(db_invoice)
            created.append(db_invoice)
            session.expunge(db_invoice)
        else:
            # Update existing invoice
            new_invoice_data = invoice.dict(exclude_unset=True)
            modified = {}
            for key in new_invoice_data:
                if getattr(db_invoice, key, None) != new_invoice_data[key]:
                    setattr(db_invoice, key, new_invoice_data[key])
                    modified[key] = new_invoice_data[key]
            if not modified:
                continue
            session.add(db_invoice)
            session.commit()
            modified["number"] = invoice.number
            updated.append(InvoiceUpdated.parse_obj(modified))
    response = InvoiceWriteResponse(created=created, updated=updated)
    return response


@invoice_router.get("", name="Read Invoices", response_model=list[InvoiceRead])
def reads(*, session: Session = Depends(get_session)) -> Sequence[InvoiceBase]:
    invoices = session.exec(select(Invoice)).all()
    return invoices


@invoice_router.patch("", name="Update Invoice", response_model=InvoiceUpdated)
def update(*, session: Session = Depends(get_session), invoice: Invoice) -> InvoiceBase:
    session.merge(invoice)
    session.commit()
    session.refresh(invoice)
    return invoice


@invoice_router.post("/{number}", name="Create or Update Invoice Details")
def create_or_update_details(
    *,
    session: Session = Depends(get_session),
    number: str = Path(
        openapi_examples={
            "normal": {
                "summary": "A normal envoice number",
                "value": "AB12345678",
            },
        },
    ),
    invoice_details: list[InvoiceDetailWrite],
) -> InvoiceDetailWriteResponse:
    """
    Create or update invoice details

    New details will be returned with all fields, while existing details will be
    returned with only updated fields.
    """
    db_invoice = session.get(Invoice, number)
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    created = []
    updated = []
    for detail in invoice_details:
        db_detail = session.get(
            InvoiceDetail, {"invoice_number": number, "row_number": detail.row_number}
        )
        if not db_detail:
            # Create new detail
            detail.invoice_number = number
            db_detail = InvoiceDetail.model_validate(detail)
            session.add(db_detail)
            session.commit()
            session.refresh(db_detail)
            created.append(db_detail)
            session.expunge(db_detail)
        else:
            # Update existing detail
            new_detail_data = detail.dict(exclude_unset=True)
            modified = {}
            for key in new_detail_data:
                if getattr(db_detail, key, None) != new_detail_data[key]:
                    setattr(db_detail, key, new_detail_data[key])
                    modified[key] = new_detail_data[key]
            if not modified:
                continue
            session.add(db_detail)
            session.commit()
            modified["invoice_number"] = number
            modified["row_number"] = detail.row_number
            updated.append(InvoiceDetailUpdated.parse_obj(modified))
    response = InvoiceDetailWriteResponse(created=created, updated=updated)
    return response


@invoice_router.get(
    "/{number}", name="Read Invoice Details", response_model=list[InvoiceDetailRead]
)
def read_details(
    *, session: Session = Depends(get_session), number: str
) -> Sequence[InvoiceDetailBase]:
    details = session.exec(
        select(InvoiceDetail).where(InvoiceDetail.invoice_number == number)
    ).all()
    return details
