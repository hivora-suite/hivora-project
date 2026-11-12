"""task placements

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-13 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A project card filed in an account's own My kanban columns; its project column is unchanged.
    op.create_table(
        "task_placement",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("column_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["board_column.id"],
            name=op.f("fk_task_placement_column_id_board_column"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["task.id"],
            name=op.f("fk_task_placement_task_id_task"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name=op.f("fk_task_placement_user_id_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "task_id", name=op.f("pk_task_placement")),
    )
    with op.batch_alter_table("task_placement", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_task_placement_column_id"), ["column_id"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_task_placement_task_id"), ["task_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("task_placement", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_task_placement_task_id"))
        batch_op.drop_index(batch_op.f("ix_task_placement_column_id"))
    op.drop_table("task_placement")
