"""comment_text_out_of_history

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-11 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The history no longer keeps comment text: erase what earlier versions stored.
    op.execute(
        "UPDATE task_event SET old_value = '', new_value = '' "
        "WHERE action IN ('comment_added', 'comment_edited', 'comment_deleted')"
    )


def downgrade() -> None:
    pass  # erased text cannot come back
