from collections.abc import Sequence

from sqlmodel import Session

from kayman.schemas.statement import Statement, StatementBase, StatementCreate


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
