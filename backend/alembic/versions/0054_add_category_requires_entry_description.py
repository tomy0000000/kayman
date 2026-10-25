"""add category requires_entry_description

Revision ID: 0054
Revises: 0053
Create Date: 2026-10-24 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "category",
        sa.Column(
            "requires_entry_description",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("category", "requires_entry_description")
