"""profile library tables

Revision ID: 0002_profile_library
Revises: 0001_initial
Create Date: 2026-09-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_profile_library"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "avatar_url",
            existing_type=sa.String(length=512),
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch.add_column(sa.Column("cover_url", sa.Text(), nullable=True))

    op.create_table(
        "watchlist",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("movie_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "movie_id", name="uq_watchlist_user_movie"),
    )
    op.create_index("ix_watchlist_user_id", "watchlist", ["user_id"])
    op.create_index("ix_watchlist_movie_id", "watchlist", ["movie_id"])

    op.create_table(
        "diary_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("movie_id", sa.Uuid(), nullable=False),
        sa.Column("watched_at", sa.Date(), nullable=False),
        sa.Column("score", sa.Numeric(precision=2, scale=1), nullable=True),
        sa.Column("review", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "score IS NULL OR (score >= 0.5 AND score <= 5.0)",
            name="ck_diary_score_range",
        ),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diary_entries_user_id", "diary_entries", ["user_id"])
    op.create_index("ix_diary_entries_movie_id", "diary_entries", ["movie_id"])
    op.create_index("ix_diary_entries_watched_at", "diary_entries", ["watched_at"])
    op.create_index("ix_diary_entries_user_watched", "diary_entries", ["user_id", "watched_at"])

    op.create_table(
        "movie_likes",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("movie_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "movie_id"),
    )
    op.create_index("ix_movie_likes_movie_id", "movie_likes", ["movie_id"])

    op.create_table(
        "diary_likes",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("diary_entry_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["diary_entry_id"], ["diary_entries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "diary_entry_id"),
    )
    op.create_index("ix_diary_likes_diary_entry_id", "diary_likes", ["diary_entry_id"])


def downgrade() -> None:
    op.drop_table("diary_likes")
    op.drop_table("movie_likes")
    op.drop_table("diary_entries")
    op.drop_table("watchlist")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("cover_url")
        batch.alter_column(
            "avatar_url",
            existing_type=sa.Text(),
            type_=sa.String(length=512),
            existing_nullable=True,
        )
