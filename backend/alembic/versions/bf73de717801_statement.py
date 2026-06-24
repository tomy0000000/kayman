"""statement

Revision ID: bf73de717801
Revises: 52d7da73b2b4
Create Date: 2026-06-24 00:28:10.476309

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "bf73de717801"
down_revision = "52d7da73b2b4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "statement",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_on", sa.Date(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["account.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("statement")
