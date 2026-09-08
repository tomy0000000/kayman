"""add statement date checks

Revision ID: 0048
Revises: 0047
Create Date: 2026-09-07 23:40:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        "statement_period_order_check", "statement", "period_start_on <= period_end_on"
    )
    op.create_check_constraint(
        "statement_due_on_check", "statement", "due_on >= period_end_on"
    )


def downgrade():
    op.drop_constraint("statement_due_on_check", "statement", type_="check")
    op.drop_constraint("statement_period_order_check", "statement", type_="check")
