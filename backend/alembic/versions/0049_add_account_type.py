"""add account type

Revision ID: 0049
Revises: 0048
Create Date: 2026-09-12 17:00:53.515137

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None

account_type = sa.Enum(
    "CASH", "CREDIT_CARD", "INVESTMENT", "REWARD", name="account_type"
)


def upgrade():
    # add_column does not emit CREATE TYPE on its own
    account_type.create(op.get_bind(), checkfirst=False)
    op.add_column("account", sa.Column("type", account_type, nullable=True))
    # Every existing account predates the field, so it has no recorded type
    op.execute("UPDATE account SET type = 'CASH'")


def downgrade():
    op.drop_column("account", "type")
    account_type.drop(op.get_bind(), checkfirst=False)
