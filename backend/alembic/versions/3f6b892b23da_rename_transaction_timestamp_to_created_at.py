"""rename transaction timestamp to created_at

Revision ID: 3f6b892b23da
Revises: 209e8c0caeda
Create Date: 2026-06-09 22:16:51.224220

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "3f6b892b23da"
down_revision = "209e8c0caeda"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("transaction", "timestamp", new_column_name="created_at")


def downgrade():
    op.alter_column("transaction", "created_at", new_column_name="timestamp")
