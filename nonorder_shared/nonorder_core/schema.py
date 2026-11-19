"""The only authoritative schema for the nine nonorder tables."""
from sqlalchemy import (MetaData, Table, Column as C, Integer, BigInteger, String,
                        Text, JSON, DateTime, Date, ForeignKey, UniqueConstraint,
                        Computed, Index)
from sqlalchemy.dialects.mysql import DATETIME

# Preserve event ordering near midnight on MySQL as well as in isolated tests.
DateTime = DateTime().with_variant(DATETIME(fsp=6), "mysql")

metadata = MetaData()
ID = BigInteger().with_variant(Integer, "sqlite")
STAFF = String(64, collation="utf8mb4_bin").with_variant(String(64), "sqlite")


def table(name, *columns):
    return Table("mo_nonorder_" + name + "_yx", metadata,
                 C("id", ID, primary_key=True, autoincrement=True), *columns,
                 mysql_engine="InnoDB", mysql_charset="utf8mb4")


def ref(name):
    return ForeignKey("mo_nonorder_" + name + "_yx.id", ondelete="RESTRICT")


def fields():
    return [C("content", Text, nullable=False), C("category_code", String(24), nullable=False),
            C("acceptance_standard", Text, nullable=False), C("planned_date", Date, nullable=False),
            C("due_at", DateTime), C("remark", Text, nullable=False),
            C("attachments", JSON, nullable=False), C("revision", Integer, nullable=False, default=1)]


task = table("task", C("task_no", String(64), nullable=False, unique=True), *fields(),
    C("creator_staff_id", STAFF, nullable=False), C("publisher_staff_id", STAFF),
    C("responsible_staff_id", STAFF, nullable=False), C("creator_name", String(200), nullable=False),
    C("publisher_name", String(200)), C("responsible_name", String(200), nullable=False), C("created_at", DateTime, nullable=False),
    C("published_at", DateTime), C("status", String(24), nullable=False),
    C("cancel_reason", Text), C("cancelled_at", DateTime), C("source_task_id", ID, ref("task")))

division = table("division", C("task_id", ID, ref("task"), nullable=False, index=True), *fields(),
    C("station_id", ID), C("station_name", String(200)), C("sort_order", Integer, nullable=False),
    C("status", String(24), nullable=False), C("confirmed_by", STAFF), C("confirmed_at", DateTime))

assignment = table("assignment", C("division_id", ID, ref("division"), nullable=False, index=True),
    C("task_id", ID, ref("task"), nullable=False, index=True), C("staff_id", STAFF, nullable=False, index=True),
    C("staff_name", String(200), nullable=False), C("responsibility", Text, nullable=False),
    C("requirement_revision", Integer, nullable=False), C("requirement_snapshot", JSON, nullable=False),
    C("accepted_revision", Integer), C("accepted_at", DateTime), C("first_accepted_at", DateTime),
    C("status", String(24), nullable=False), C("revision", Integer, nullable=False, default=1),
    C("revoked_at", DateTime), C("revoke_reason", Text),
    C("replaces_assignment_id", ID, ref("assignment")), C("assignment_source", JSON, nullable=False),
    C("active_staff", STAFF, Computed("CASE WHEN revoked_at IS NULL THEN staff_id ELSE NULL END")),
    UniqueConstraint("division_id", "active_staff", name="uq_nonorder_division_person"))

work_record = table("work_record", C("record_type", String(24), nullable=False),
    C("task_id", ID, ref("task"), nullable=False, index=True),
    C("assignment_id", ID, ref("assignment"), nullable=False, index=True),
    C("staff_id", STAFF, nullable=False, index=True), C("requirement_revision", Integer, nullable=False),
    C("requirement_snapshot", JSON, nullable=False), C("content", Text, nullable=False),
    C("attachments", JSON, nullable=False), C("submitted_at", DateTime, nullable=False),
    C("status", String(24), nullable=False), C("reviewer_staff_id", STAFF), C("reviewer_account_id", ID),
    C("reviewed_at", DateTime), C("review_note", Text), C("return_kind", String(24)),
    C("previous_record_id", ID, ref("work_record")), C("revision", Integer, nullable=False, default=1),
    C("payload", JSON, nullable=False), C("confirmed_at", DateTime),
    C("pending_completion", ID, Computed("CASE WHEN record_type='completion' AND status='pending' THEN assignment_id ELSE NULL END")),
    UniqueConstraint("pending_completion", name="uq_nonorder_pending_completion"))
Index("ix_nonorder_work_pending", work_record.c.record_type, work_record.c.status)

time_segment = table("time_segment", C("assignment_id", ID, ref("assignment"), nullable=False, index=True),
    C("task_id", ID, ref("task"), nullable=False, index=True), C("staff_id", STAFF, nullable=False, index=True),
    C("requirement_revision", Integer, nullable=False), C("started_at", DateTime, nullable=False),
    C("ended_at", DateTime), C("end_reason", Text), C("operator_staff_id", STAFF, nullable=False),
    C("source_type", String(24), nullable=False), C("correction_id", ID, ref("work_record")),
    C("superseded_by_correction_id", ID, ref("work_record")),
    C("running_staff", STAFF, Computed("CASE WHEN ended_at IS NULL THEN staff_id ELSE NULL END")),
    UniqueConstraint("running_staff", name="uq_nonorder_one_running"))

manager_grant = table("manager_grant", C("task_id", ID, ref("task"), nullable=False, index=True),
    C("staff_id", STAFF, nullable=False, index=True), C("staff_name", String(200), nullable=False),
    C("grant_type", String(24), nullable=False), C("permissions", JSON, nullable=False),
    C("qualification_station_ids", JSON, nullable=False), C("starts_at", DateTime, nullable=False),
    C("qualification_source", String(16), nullable=False, default="station", server_default="station"),
    C("review_staff_ids", JSON),
    C("ends_at", DateTime), C("revoked_at", DateTime), C("operator_staff_id", STAFF),
    C("operator_account_id", ID), C("reason", Text, nullable=False),
    C("owner_task", ID, Computed("CASE WHEN grant_type='owner' AND revoked_at IS NULL THEN task_id ELSE NULL END")),
    UniqueConstraint("owner_task", name="uq_nonorder_owner"),
    C("reviewer_task", ID, Computed("CASE WHEN grant_type='self_review' AND revoked_at IS NULL THEN task_id ELSE NULL END")),
    UniqueConstraint("reviewer_task", name="uq_nonorder_reviewer"))

event = table("event", C("task_id", ID, ref("task"), nullable=False, index=True),
    C("event_type", String(40), nullable=False), C("staff_id", STAFF), C("account_id", ID),
    C("actor_name", String(200), nullable=False), C("actor_source", String(16), nullable=False),
    C("occurred_at", DateTime, nullable=False, index=True), C("request_key", String(64), unique=True),
    C("request_hash", String(64)), C("reason", Text, nullable=False),
    C("data", JSON, nullable=False), C("result", JSON, nullable=False))

daily_item = table("daily_item", C("sheet_id", ID, nullable=False, index=True),
    C("assignment_id", ID, ref("assignment"), nullable=False, index=True), C("work_date", Date, nullable=False, index=True),
    C("station_id", ID), C("responsible_staff_id", STAFF, nullable=False), C("sort_order", Integer, nullable=False),
    C("remark", Text, nullable=False), C("status", String(24), nullable=False), C("revision", Integer, nullable=False),
    C("created_at", DateTime, nullable=False), C("plan_cutoff", DateTime, nullable=False),
    C("published_at", DateTime), C("cancelled_at", DateTime), C("operator_account_id", ID, nullable=False),
    C("snapshot", JSON, nullable=False),
    C("published_assignment", ID, Computed("CASE WHEN status='published' AND cancelled_at IS NULL THEN assignment_id ELSE NULL END")),
    UniqueConstraint("published_assignment", "work_date", name="uq_nonorder_daily_published"))

daily_result = table("daily_result", C("work_date", Date, nullable=False, unique=True),
    C("cutoff_at", DateTime, nullable=False), C("frozen_at", DateTime, nullable=False),
    C("schema_version", Integer, nullable=False), C("result_data", JSON, nullable=False))

TABLES = {t.name.removeprefix("mo_nonorder_").removesuffix("_yx"): t for t in metadata.tables.values()}
