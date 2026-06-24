"""remove transaction psp columns

Revision ID: e9fc0ffafe77
Revises: 0051bc20ef29
Create Date: 2026-06-09 21:53:30.252577

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e9fc0ffafe77"
down_revision = "0051bc20ef29"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "fk_transaction_psp_id_payment_service_providers",
        "transaction",
        type_="foreignkey",
    )
    op.drop_column("transaction", "psp_reconcile")
    op.drop_column("transaction", "psp_id")


def downgrade():
    op.add_column("transaction", sa.Column("psp_id", sa.Integer(), nullable=True))
    op.add_column(
        "transaction", sa.Column("psp_reconcile", sa.Boolean(), nullable=True)
    )
    op.create_foreign_key(
        "fk_transaction_psp_id_payment_service_providers",
        "transaction",
        "payment_service_providers",
        ["psp_id"],
        ["id"],
    )
