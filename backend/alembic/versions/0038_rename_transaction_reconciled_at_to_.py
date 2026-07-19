"""rename transaction reconciled_at to cleared_at

Revision ID: 0038
Revises: 0037
Create Date: 2026-07-19 00:57:06.252265

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("transaction", "reconciled_at", new_column_name="cleared_at")


def downgrade():
    op.alter_column("transaction", "cleared_at", new_column_name="reconciled_at")
