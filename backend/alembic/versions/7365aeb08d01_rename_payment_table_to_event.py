"""rename payment table to event

Revision ID: 7365aeb08d01
Revises: 9ef5b1dd411f
Create Date: 2026-06-23 22:59:21.548939

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7365aeb08d01"
down_revision = "9ef5b1dd411f"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("payment", "event")


def downgrade():
    op.rename_table("event", "payment")
