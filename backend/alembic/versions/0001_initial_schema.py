"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE sourceenum AS ENUM ('apple_health', 'hevy', 'strava', 'manual')")
    op.execute("CREATE TYPE workouttypeenum AS ENUM ('strength', 'running', 'cycling', 'walking', 'other')")
    op.execute("CREATE TYPE weightunitenum AS ENUM ('kg', 'lb')")
    op.execute("CREATE TYPE comparisonenum AS ENUM ('gte', 'lte')")
    op.execute("CREATE TYPE windowenum AS ENUM ('daily', 'weekly', 'monthly', 'all_time')")
    op.execute("CREATE TYPE metricscopeenum AS ENUM ('workout', 'strength', 'health_metric')")

    op.create_table(
        "workouts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("source", postgresql.ENUM("apple_health", "hevy", "strava", "manual", name="sourceenum", create_type=False), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=True),
        sa.Column("workout_type", postgresql.ENUM("strength", "running", "cycling", "walking", "other", name="workouttypeenum", create_type=False), nullable=False),
        sa.Column("raw_type", sa.Text(), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_mins", sa.Float(), nullable=False),
        sa.Column("active_calories", sa.Float(), nullable=True),
        sa.Column("avg_heart_rate", sa.Float(), nullable=True),
        sa.Column("max_heart_rate", sa.Float(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("has_strength_detail", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_workouts_source_external_id",
        "workouts", ["source", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    op.create_index("ix_workouts_start_at", "workouts", ["start_at"])

    op.create_table(
        "strength_sets",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("workout_id", sa.BigInteger(), nullable=False),
        sa.Column("exercise_name", sa.Text(), nullable=False),
        sa.Column("exercise_order", sa.Integer(), nullable=False),
        sa.Column("set_number", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("weight_unit", postgresql.ENUM("kg", "lb", name="weightunitenum", create_type=False), nullable=False, server_default="kg"),
        sa.Column("rpe", sa.Float(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("is_warmup", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_strength_sets_workout_id", "strength_sets", ["workout_id"])

    op.create_table(
        "health_metrics",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("metric_type", sa.Text(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("source", postgresql.ENUM("apple_health", "hevy", "strava", "manual", name="sourceenum", create_type=False), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("metric_type", "recorded_at", "source", name="uq_health_metrics_type_time_source"),
    )
    op.create_index("ix_health_metrics_date", "health_metrics", ["date"])
    op.create_index("ix_health_metrics_type", "health_metrics", ["metric_type"])

    op.create_table(
        "goals",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("goal_type", sa.Text(), nullable=False),
        sa.Column("metric_scope", postgresql.ENUM("workout", "strength", "health_metric", name="metricscopeenum", create_type=False), nullable=False),
        sa.Column("target_value", sa.Float(), nullable=False),
        sa.Column("target_unit", sa.Text(), nullable=False),
        sa.Column("comparison", postgresql.ENUM("gte", "lte", name="comparisonenum", create_type=False), nullable=False, server_default="gte"),
        sa.Column("window", postgresql.ENUM("daily", "weekly", "monthly", "all_time", name="windowenum", create_type=False), nullable=False, server_default="weekly"),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "coaching_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_message", sa.Text(), nullable=False),
        sa.Column("ai_response", sa.Text(), nullable=False),
        sa.Column("context_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("coaching_sessions")
    op.drop_table("goals")
    op.drop_table("health_metrics")
    op.drop_table("strength_sets")
    op.drop_table("workouts")

    op.execute("DROP TYPE IF EXISTS metricscopeenum")
    op.execute("DROP TYPE IF EXISTS windowenum")
    op.execute("DROP TYPE IF EXISTS comparisonenum")
    op.execute("DROP TYPE IF EXISTS weightunitenum")
    op.execute("DROP TYPE IF EXISTS workouttypeenum")
    op.execute("DROP TYPE IF EXISTS sourceenum")
