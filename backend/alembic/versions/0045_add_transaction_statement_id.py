"""add transaction statement_id

Revision ID: 0045
Revises: 0044
Create Date: 2026-09-06 13:36:49.704887

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transaction", sa.Column("statement_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "transaction_statement_id_fkey",
        "transaction",
        "statement",
        ["statement_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint(
        "transaction_statement_id_fkey", "transaction", type_="foreignkey"
    )
    op.drop_column("transaction", "statement_id")
