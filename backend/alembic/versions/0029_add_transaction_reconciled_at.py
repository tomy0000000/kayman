"""add transaction reconciled_at

Revision ID: 66435e4f2cb4
Revises: f4f177b1ada3
Create Date: 2026-06-14 05:41:03.952732

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "66435e4f2cb4"
down_revision = "f4f177b1ada3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "transaction",
        sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE transaction SET reconciled_at = created_at WHERE reconcile = TRUE"
    )


def downgrade():
    op.drop_column("transaction", "reconciled_at")
