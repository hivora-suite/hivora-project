"""event times

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-12 14:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing events have no times: they stay whole-day events.
    with op.batch_alter_table("calendar_event", schema=None) as batch_op:
        batch_op.add_column(sa.Column("start_time", sa.String(length=5), nullable=True))
        batch_op.add_column(sa.Column("end_time", sa.String(length=5), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("calendar_event", schema=None) as batch_op:
        batch_op.drop_column("end_time")
        batch_op.drop_column("start_time")
