"""add account short_name

Revision ID: 0052
Revises: 0051
Create Date: 2026-10-18 00:00:00.000000

"""

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "account",
        sa.Column("short_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )


def downgrade():
    op.drop_column("account", "short_name")
