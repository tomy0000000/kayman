from typing import Any

from kayman.routers import (
    account,
    auth,
    category,
    currency,
    event,
    transaction,
    tw_invoice,
)

routers = [
    auth.auth_router,
    account.account_router,
    currency.currency_router,
    category.category_router,
    event.event_router,
    transaction.txn_router,
    tw_invoice.invoice_router,
]

tags: list[dict[str, Any]] = [
    auth.tag,
    account.tag,
    currency.tag,
    category.tag,
    event.tag,
    transaction.tag,
    tw_invoice.tag,
]
