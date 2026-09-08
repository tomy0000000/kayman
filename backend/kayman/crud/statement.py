from collections.abc import Collection, Sequence
from datetime import date
from typing import Literal

from sqlmodel import Session, col, select

from kayman.schemas.statement import Statement, StatementBase, StatementCreate

StatementOrderBy = Literal[
    "period_start_on", "period_end_on", "due_on", "created_on", "balance", "id"
]


def create_statements(
    session: Session, statements: Sequence[StatementCreate], commit: bool = True
) -> Sequence[StatementBase]:
    db_statements = [Statement.model_validate(statement) for statement in statements]
    session.add_all(db_statements)
    if commit:
        session.commit()
        for db_statement in db_statements:
            session.refresh(db_statement)
    else:
        session.flush()
    return db_statements


def read_statements(
    session: Session,
    statement_ids: Collection[int] | None = None,
    account_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
    order_by: StatementOrderBy | None = None,
    descending: bool = False,
    for_update: bool = False,
) -> Sequence[Statement]:
    scalar = select(Statement)
    if statement_ids:
        scalar = scalar.where(col(Statement.id).in_(statement_ids))
    if account_id:
        scalar = scalar.where(Statement.account_id == account_id)
    if start is not None:
        scalar = scalar.where(Statement.created_on >= start)
    if end is not None:
        scalar = scalar.where(Statement.created_on < end)
    column = (
        getattr(Statement, order_by)
        if order_by is not None
        else col(Statement.period_end_on)
    )
    scalar = scalar.order_by(column.desc() if descending else column.asc())
    if for_update:
        scalar = scalar.with_for_update()
    statements = session.exec(scalar).all()
    return statements
