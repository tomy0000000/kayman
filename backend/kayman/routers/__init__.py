from typing import Any

from kayman.routers import (
    account,
    auth,
    category,
    currency,
    event,
    event_entry,
    root,
    statement,
    transaction,
    transaction_tag,
    tw_invoice,
)

# Served at the root, not under /api
root_router = root.root_router

routers = [
    auth.auth_router,
    account.account_router,
    currency.currency_router,
    category.category_router,
    event.event_router,
    event_entry.event_entry_router,
    statement.statement_router,
    transaction.txn_router,
    transaction_tag.transaction_tag_router,
    tw_invoice.invoice_router,
]

tags: list[dict[str, Any]] = [
    root.tag,
    auth.tag,
    account.tag,
    currency.tag,
    category.tag,
    event.tag,
    event_entry.tag,
    statement.tag,
    transaction.tag,
    transaction_tag.tag,
    tw_invoice.tag,
]
