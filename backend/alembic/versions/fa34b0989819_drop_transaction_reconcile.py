"""drop transaction reconcile

Revision ID: fa34b0989819
Revises: 66435e4f2cb4
Create Date: 2026-06-14 05:55:02.551209

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "fa34b0989819"
down_revision = "66435e4f2cb4"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("transaction", "reconcile")


def downgrade():
    op.add_column(
        "transaction", sa.Column("reconcile", sa.Boolean(), nullable=True)
    )
    op.execute(
        "UPDATE transaction SET reconcile = (reconciled_at IS NOT NULL)"
    )
    op.alter_column("transaction", "reconcile", nullable=False)
