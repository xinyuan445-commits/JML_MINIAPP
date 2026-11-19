"""Nonorder bridge on the existing daily-sheet connection; never commits independently."""
import json
import os
import re
from collections import defaultdict
from datetime import timedelta

import daily_task_snapshots as lifecycle
from flask import g
from nonorder_api import current_account  # also resolves the authoritative shared package
from nonorder_core.schema import TABLES
from nonorder_core.storage import Store, RuleError, plain
from nonorder_core.service import Service, require
from nonorder_core.planning import candidates, can_plan, can_view_plan, eligible, save_changes
from nonorder_core.snapshots import freeze
from sqlalchemy import JSON


def enabled():
    return os.getenv("NONORDER_ENABLED") == "1"


class CursorStore(Store):
    """Use the host's DB-API transaction without opening a second SQLAlchemy transaction."""
    def __init__(self, cursor):
        self.cursor, self.event_ids = cursor, []

    def now(self):
        self.cursor.execute("SELECT UTC_TIMESTAMP(6) + INTERVAL 8 HOUR AS now")
        return self.cursor.fetchone()["now"]

    def rows(self, name, **where):
        table = TABLES[name]
        for key in where:
            if key not in table.c:
                raise ValueError("未知字段")
        suffix = " AND ".join(f"`{key}` IS NULL" if value is None else f"`{key}`=%s" for key, value in where.items())
        self.cursor.execute(f"SELECT * FROM `{table.name}`" + (" WHERE " + suffix if suffix else "") + " ORDER BY id",
                            tuple(value for value in where.values() if value is not None))
        rows = self.cursor.fetchall()
        for row in rows:
            for col in table.c:
                if isinstance(col.type, JSON) and isinstance(row.get(col.name), (str, bytes)):
                    row[col.name] = json.loads(row[col.name])
        return rows

    def values(self, name, values):
        table = TABLES[name]
        for key in values:
            if key not in table.c or table.c[key].computed:
                raise ValueError("未知或只读字段")
        return tuple(json.dumps(plain(value), ensure_ascii=False) if isinstance(table.c[key].type, JSON) else value
                     for key, value in values.items())

    def insert(self, name, **values):
        table = TABLES[name]
        for col in table.c:
            if col.name not in values and col.default is not None and col.default.is_scalar:
                values[col.name] = col.default.arg
        columns = ",".join(f"`{key}`" for key in values)
        self.cursor.execute(f"INSERT INTO `{table.name}` ({columns}) VALUES ({','.join(['%s'] * len(values))})", self.values(name, values))
        identifier = self.cursor.lastrowid
        if name == "event":
            self.event_ids.append(identifier)
        return identifier

    def update(self, name, identifier, **values):
        self.cursor.execute(f"UPDATE `{TABLES[name].name}` SET " + ",".join(f"`{key}`=%s" for key in values) + " WHERE id=%s",
                            self.values(name, values) + (identifier,))

    def external(self, sql, **params):
        parameter = r":([A-Za-z_][A-Za-z_0-9]*)"
        names = re.findall(parameter, sql)
        self.cursor.execute(re.sub(parameter, "%s", sql) + " FOR SHARE", tuple(params[name] for name in names))
        return self.cursor.fetchall()

    def stamp_events(self):
        now = self.now()
        for identifier in self.event_ids:
            self.update("event", identifier, occurred_at=now)


def acquire(cursor):
    if not enabled():
        return False
    cursor.execute("SELECT GET_LOCK(CONCAT(DATABASE(), ':nonorder:v1'), 5) AS locked")
    if cursor.fetchone()["locked"] != 1:
        raise RuleError("无工单任务正在处理，请稍后重试")
    return True


def release(cursor):
    cursor.execute("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':nonorder:v1'))")
    cursor.fetchone()


def service_for(cursor):
    if not enabled() or not {"daily-tasks.view", "nonorder.view"} <= set(getattr(g, "admin_permissions", [])):
        return None
    store = CursorStore(cursor)
    account, permissions = current_account(store)
    if not {"daily-tasks.view", "nonorder.view"} <= permissions:
        return None
    return Service(store, {"source": "admin", "account_id": account["id"], "staff_id": account.get("staff_id"),
                           "name": account.get("display_name", ""), "permissions": permissions})


def plan_rows(service, **filters):
    assignments, tasks = {}, {}
    for item in service.db.rows("daily_item", **filters):
        identifier = item["assignment_id"]
        if identifier not in assignments:
            assignments[identifier] = service.db.get("assignment", identifier)
        assignment = assignments[identifier]
        task_id = assignment["task_id"]
        if task_id not in tasks:
            task = service.db.get("task", task_id)
            tasks[task_id] = task if can_view_plan(service, task, linked_draft=True) else None
        if tasks[task_id]:
            yield item, assignment, tasks[task_id]


def sheet_data(service, sheet, *, export=False):
    if service is None:
        return None
    rows = []
    current_tasks = set()
    locked = service.now >= min(sheet["plan_cutoff"], sheet["result_cutoff"])
    for item, assignment, task in plan_rows(service, sheet_id=sheet["id"]):
        current_tasks.add(task["id"])
        snapshot = item["snapshot"]
        division = snapshot["division"] if locked else service.db.get("division", assignment["division_id"])
        linked_draft = task["status"] == "draft" and not task["published_at"]
        rows.append({**{k: v for k, v in item.items() if k not in {"snapshot", "published_assignment"}},
                     "key": f"nonorder:plan:{item['id']}", "source": "nonorder",
                     "task": snapshot["task"] if locked else task, "assignment": snapshot["assignment"] if locked else assignment,
                     "division": division, "can_plan": not locked and can_plan(service, task, linked_draft=linked_draft),
                     "can_edit_work": not locked and not item["cancelled_at"] and service.can_edit_sheet_work(task, division, assignment),
                     "can_publish": task["status"] != "cancelled" and not assignment["revoked_at"] and
                         (not linked_draft or "nonorder.publish" in service.actor["permissions"]),
                     "can_replan": not locked and eligible(task, division, assignment),
                     "station_changed": item["station_id"] != division["station_id"],
                     "group": {"type": "station" if item["station_id"] else "leader",
                               "id": item["station_id"] or task["responsible_staff_id"],
                               "name": snapshot["division"]["station_name"] if item["station_id"] else task["responsible_name"]}})
    if export:
        return plain({"items": [row for row in rows if row["status"] in {"draft", "published"} and not row["cancelled_at"]]})
    history = []
    for identifier in current_tasks:
        for event in service.db.rows("event", task_id=identifier, event_type="daily_plan"):
            for index, change in enumerate(event["result"].get("changes", [])):
                if sheet["id"] in (change["source_sheet_id"], change["target_sheet_id"]):
                    history.append({**change, "key": f"{event['id']}:{index}", "occurred_at": event["occurred_at"], "actor": event["actor_name"]})
    history.sort(key=lambda row: (row["occurred_at"], row["key"]), reverse=True)
    return plain({"items": rows, "history": history, "supports_sheet_creation": True,
                  "candidates": [] if locked else candidates(service, sheet["work_date"])})


def save(service, sheet, changes, *, creations=(), publish=False):
    if not changes and not creations:
        return []
    if service is None:
        raise RuleError("无工单任务未启用或没有权限，草稿已保留", 403)
    targets = {}

    def target_for(day):
        if day in targets:
            return targets[day]
        cursor = service.db.cursor
        now = service.db.now()
        cursor.execute("SELECT * FROM mo_daily_task_sheet_yx WHERE work_date=%s ORDER BY id", (day,))
        sheets = cursor.fetchall()
        target = next((row for row in sheets if now < min(row['plan_cutoff'], row['result_cutoff'])), None)
        if not target:
            parent = next((row['id'] for row in sheets if row['sheet_kind'] == 'main'), None)
            target, _ = lifecycle.create_sheet(cursor, day, g.audit_username, now, parent)
        lifecycle.assert_editable(target, now)
        targets[day] = target
        return target

    new_tasks, new_changes = set(), []
    if creations:
        service.require_admin_publish()
        require(len(creations) <= 50 and all(isinstance(row, dict) and isinstance(row.get("task"), dict) for row in creations),
                "新增无工单任务内容无效", 400)
        saved_plans = service.db.rows("daily_item", sheet_id=sheet["id"])
        already_saved = {item["assignment_id"]: item for item in saved_plans}
        changed_plans = {row.get("id") for row in changes if isinstance(row, dict)}
        next_order = max((row["sort_order"] for row in saved_plans), default=0)
        for row in creations:
            body = {**row["task"], "action": "create_sheet_draft", "request_id": row.get("request_id"),
                    "linked_sheet_id": sheet["id"]}
            result = service.command(body, daily_sheet=True)
            identifier = result["task_id"]
            if identifier in new_tasks:
                continue
            new_tasks.add(identifier)
            task = service.db.get("task", identifier)
            for assignment in service.db.rows("assignment", task_id=identifier):
                prior = already_saved.get(assignment["id"])
                versions = {"task_revision": task["revision"], "assignment_revision": assignment["revision"]}
                if prior:
                    if publish and prior["status"] == "draft" and not prior["cancelled_at"] and prior["id"] not in changed_plans:
                        new_changes.append({"action": "update", "id": prior["id"], "revision": prior["revision"],
                                            "publish": True, **versions})
                    continue
                next_order += 1
                new_changes.append({"action": "add", "assignment_id": assignment["id"],
                    "sort_order": next_order, "publish": publish, **versions})
    save_changes(service, sheet, [*changes, *new_changes], target_for, draft_task_ids=new_tasks)
    return list(targets.values())


def capture_due(cursor, now):
    """The nonorder lock protects cutoff replay even when no daily sheet exists."""
    store = CursorStore(cursor)
    cutoff = now.date()
    cursor.execute("""SELECT DISTINCT work_date AS day FROM mo_nonorder_daily_item_yx
            WHERE work_date < %s AND status='published'
        UNION SELECT DISTINCT DATE(occurred_at) FROM mo_nonorder_event_yx
            WHERE occurred_at < %s AND event_type IN ('submit','review','correct_time')""", (cutoff, cutoff))
    days = {row["day"] for row in cursor.fetchall()}
    cursor.execute("""SELECT DISTINCT DATE(started_at) AS first_day,
            DATE(COALESCE(ended_at - INTERVAL 1 MICROSECOND, %s)) AS last_day
        FROM mo_nonorder_time_segment_yx WHERE started_at < %s""", (now, cutoff))
    for segment in cursor.fetchall():
        day, end = segment["first_day"], min(segment["last_day"], cutoff - timedelta(days=1))
        while day <= end:
            days.add(day)
            day += timedelta(days=1)
    if not days:
        return
    cursor.execute("SELECT work_date FROM mo_nonorder_daily_result_yx")
    frozen = {r["work_date"] for r in cursor.fetchall()}
    for day in sorted(days - frozen):
        freeze(store, day)


def annotate_sheets(cursor, sheets):
    service = service_for(cursor)
    if service is None:
        return sheets
    counts = defaultdict(list)
    for item, _, _ in plan_rows(service):
        if not item["cancelled_at"]:
            counts[item["sheet_id"]].append(item["status"])
    results = []
    for sheet in sheets:
        statuses = set(counts[sheet["id"]])
        if sheet["task_count"]:
            statuses.update(("draft", "published") if sheet["status"] == "partial" else (sheet["status"],))
        status = "partial" if len(statuses) > 1 else next(iter(statuses), sheet["status"])
        results.append(dict(sheet, nonorder_count=len(counts[sheet["id"]]), status=status))
    return results
