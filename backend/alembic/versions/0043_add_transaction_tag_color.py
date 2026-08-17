"""add transaction tag color

Revision ID: 0043
Revises: 0042
Create Date: 2026-08-18 00:15:19.099468

"""

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "transaction_tag",
        sa.Column("color", sqlmodel.sql.sqltypes.AutoString(length=7), nullable=True),
    )
    # Declared here rather than in __table_args__: SQLite has no regex operator,
    # and the tests build their schema from SQLModel metadata, so a model-level
    # CheckConstraint would fail at CREATE TABLE. Alembic's autogenerate does not
    # compare check constraints, so this will not be dropped by a later revision.
    op.create_check_constraint(
        "transaction_tag_color_check",
        "transaction_tag",
        "color ~ '^#[0-9A-Fa-f]{6}$'",
    )


def downgrade():
    op.drop_constraint("transaction_tag_color_check", "transaction_tag", type_="check")
    op.drop_column("transaction_tag", "color")
