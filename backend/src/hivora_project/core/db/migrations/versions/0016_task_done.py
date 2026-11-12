"""task done

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-13 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Validated is a status of the card; cards already in a Done column are.
    # A plain ADD COLUMN: no table copy (see 0015).
    op.add_column(
        "task", sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.execute(
        "UPDATE task SET done = TRUE WHERE column_id IN (SELECT id FROM board_column WHERE done)"
    )


def downgrade() -> None:
    op.drop_column("task", "done")
