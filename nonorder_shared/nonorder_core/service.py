"""Task commands used by both HTTP adapters. All commands run in one transaction."""
import hashlib
import json
import uuid
from datetime import date, datetime
from functools import cached_property
from sqlalchemy import select

from .storage import RuleError, plain
from .schema import TABLES
from .review_permissions import ReviewPermissions, require

CATEGORIES = {"5s": "5S工作", "inventory": "盘点", "maintenance": "设备保养", "rectification": "问题整改", "training": "培训", "other": "其他工作"}
MANAGER_RIGHTS = {"adjust", "review", "time_review"}
EXECUTABLE = {"ready", "paused", "rework", "running"}
PERSONAL_ACTIONS = {"receive", "start", "pause", "submit", "feedback", "confirm_feedback", "correct_time"}


def words(value, label, required=True, limit=5000):
    require(isinstance(value, str) and len(value) <= limit and (value.strip() or not required), "请填写" + label, 400)
    return value.strip()


def moment(value):
    try:
        parsed = datetime.fromisoformat(value)
        require(parsed.tzinfo is None, "时间请使用北京时间", 400)
        return parsed
    except (TypeError, ValueError):
        raise RuleError("时间格式无效", 400) from None


class Service(ReviewPermissions):
    def __init__(self, store, actor):
        self.db, self.actor = store, actor
        self.staff = actor.get("staff_id")
        self.admin = actor.get("source") == "admin"
        if self.staff:
            try:
                self.name = store.person(self.staff)["name"]
            except RuleError:
                if not self.admin:
                    raise
                # Account-level all-range planning/transfer is independent of an active
                # employee binding. Inactive bindings grant no employee-level rights.
                self.staff = None
                self.name = actor.get("name", "后台人员")
        else:
            require(self.admin, "请先登录", 401)
            self.name = actor.get("name", "后台人员")
        self.now = store.now()

    def right(self, task, capability):
        if not self.staff:
            return False
        if self.can_operate_all(task):
            return capability in MANAGER_RIGHTS
        for grant in self.db.rows("manager_grant", task_id=task["id"], staff_id=self.staff):
            if grant["grant_type"] != "self_review" and self.grant_valid(grant) and capability in grant["permissions"]:
                return True
        return False

    def managing(self, task):
        return any(self.right(task, r) for r in MANAGER_RIGHTS)

    def managed(self, task, capability):
        require(self.right(task, capability), "无此任务操作权限，请联系负责线长", 403)
        if self.admin:
            permission = "nonorder.review" if capability in {"review", "time_review"} else "nonorder.manage"
            require(permission in self.actor["permissions"], "没有后台操作权限", 403)

    def owner(self, task):
        self.managed(task, "adjust")
        require(task["responsible_staff_id"] == self.staff or self.can_operate_all(task),
                "仅当前负责线长可授权或交接", 403)

    @cached_property
    def exempt_operator(self):
        return not self.admin and bool(self.staff) and self.db.exempt(self.staff)

    def can_operate_all(self, task):
        return bool(task["published_at"] and self.exempt_operator)

    def visible(self, task):
        if not task["published_at"]:
            return self.staff == task["creator_staff_id"] and self.right(task, "adjust")
        if self.admin:
            return "nonorder.view-all" in self.actor["permissions"] or self.managing(task) or self.reviewing(task)
        return self.managing(task) or self.reviewing(task) or bool(self.db.rows("assignment", task_id=task["id"], staff_id=self.staff))

    def context(self):
        # A ready entry requires all nine schemas, including their columns, to be present.
        for table in TABLES.values():
            self.db.conn.execute(select(table).limit(0))
        stations, scanners = self.db.scope(self.staff) if self.staff else ({}, {})
        leader_stations = self.db.leader_stations(self.staff) if self.staff else {}
        can_publish = not self.admin and bool(leader_stations or self.exempt_operator)
        can_manage = can_publish or any(self.managing(t) or self.reviewing(t) for t in self.db.rows("task"))
        return {"enabled": True, "staff_id": self.staff, "can_publish": can_publish, "permission_version": 2,
                "default_station_id": next(iter(leader_stations)) if len(leader_stations) == 1 else None,
                "reviewers": self.reviewer_candidates() if can_publish else [],
                "can_manage": can_manage, "can_operate_all": self.exempt_operator, "categories": CATEGORIES,
                "stations": [{"id": k, "name": v} for k, v in stations.items()],
                "scanners": list(scanners.values())}

    def list_tasks(self, tab="mine", assignment_id=None):
        require(tab in {"mine", "managed", "pending", "transfer"}, "列表类型无效", 400)
        staff = self.staff
        if assignment_id is not None:
            require(tab == "mine", "列表类型无效", 400)
            assignment = self.db.get("assignment", assignment_id)
            task = self.db.get("task", assignment["task_id"])
            staff = self.employee(task, {"assignment_id": assignment["id"]}, allow_closed=True)["staff_id"]
        result = []
        for task in reversed(self.db.rows("task")):
            if tab == "transfer":
                require(self.admin and "nonorder.transfer" in self.actor["permissions"], "没有交接权限", 403)
                if task["published_at"]:
                    grants = self.db.rows("manager_grant", task_id=task["id"])
                    owner_valid = any(g["grant_type"] == "owner" and self.grant_valid(g) for g in grants)
                    needs_reviewer = bool(self.reviewer_required_staff(task))
                    reviewer = self.reviewer(task)
                    result.append({
                        **{k: task[k] for k in ("id", "task_no", "content", "responsible_staff_id", "responsible_name", "revision", "status")},
                        "needs_transfer": task["status"] == "active" and (not owner_valid or needs_reviewer and not reviewer),
                        "needs_reviewer": needs_reviewer,
                        "reviewer": {"staff_id": reviewer["staff_id"], "name": reviewer["staff_name"]} if reviewer else None,
                        "delegates": [{k: g[k] for k in ("id", "staff_name", "ends_at", "permissions")}
                                      for g in grants if g["grant_type"] == "delegate" and self.grant_valid(g)],
                    })
                continue
            if tab == "managed" and self.can_operate_all(task):
                result.append(task)
                continue
            if not self.visible(task):
                continue
            if tab == "mine":
                if not task["published_at"]:
                    continue
                for a in self.db.rows("assignment", task_id=task["id"], staff_id=staff):
                    result.append({"task_id": task["id"], "content": task["content"], **a})
            elif tab == "managed" and (self.managing(task) or self.reviewing(task) or self.admin and "nonorder.view-all" in self.actor["permissions"]):
                result.append(task)
            elif tab == "pending":
                for r in self.db.rows("work_record", task_id=task["id"]):
                    if (r["status"] == "pending" or self.history_close(r)) and self.can_review_record(r):
                        a = self.db.get("assignment", r["assignment_id"])
                        result.append({**self.public_record(r), "task_content": task["content"], "staff_name": a["staff_name"]})
        return plain(result)

    def snapshot(self, task_id):
        assignments = self.db.rows("assignment", task_id=task_id)
        return plain({"task": self.db.get("task", task_id), "daily_item": [r for r in self.db.rows("daily_item") if r["assignment_id"] in {a["id"] for a in assignments}], **{
            name: self.db.rows(name, task_id=task_id)
            for name in ("division", "assignment", "time_segment", "work_record", "manager_grant")}})

    def can_review_record(self, record):
        if self.admin and "nonorder.review" not in self.actor["permissions"]:
            return False
        if record["record_type"] != "time_correction":
            return self.review_right(self.db.get("task", record["task_id"]), record["staff_id"], "review")
        return all(self.review_right(self.db.get("task", identifier), record["staff_id"], "time_review") for identifier in record["payload"]["task_ids"])

    def public_record(self, record):
        record = {**record, "can_review": self.can_review_record(record),
                  "history_close": self.history_close(record)}
        if record["record_type"] == "time_correction" and record["staff_id"] != self.staff:
            permitted = {identifier for identifier in record["payload"]["task_ids"] if self.visible(self.db.get("task", identifier)) and (self.managing(self.db.get("task", identifier)) or self.review_right(self.db.get("task", identifier), record["staff_id"], "time_review") or self.admin and "nonorder.view-all" in self.actor["permissions"])}
            payload = record["payload"]
            record["payload"] = {**payload, "task_ids": sorted(permitted),
                "before_segments": [s for s in payload["before_segments"] if s["task_id"] in permitted],
                "proposed_segments": [s for s in payload["proposed_segments"] if s["task_id"] in permitted],
                "needs_joint_reviewer": not self.can_review_record(record)}
        return record

    def history_close(self, record):
        return (record["record_type"] == "completion" and record["status"] == "returned" and
                (self.db.get("assignment", record["assignment_id"])["revoked_at"] or self.db.get("task", record["task_id"])["status"] == "cancelled") and
                not self.db.rows("work_record", previous_record_id=record["id"])) or False

    def detail(self, identifier):
        task = self.db.get("task", identifier)
        require(self.visible(task), "无此任务查看权限", 403)
        full = self.managing(task) or self.admin and "nonorder.view-all" in self.actor["permissions"]
        operate_all = self.can_operate_all(task)
        data = self.snapshot(task["id"])
        reviewed = self.protected_staff(task) if self.reviewing(task) else set()
        allowed_staff = reviewed | {self.staff}
        all_assignments = data["assignment"]
        if not full:
            data["assignment"] = [a for a in data["assignment"] if a["staff_id"] in allowed_staff]
            ids = {a["id"] for a in data["assignment"]}
            divisions = {a["division_id"] for a in data["assignment"]}
            data["division"] = [d for d in data["division"] if d["id"] in divisions]
            data["daily_item"] = [r for r in data["daily_item"] if r["assignment_id"] in ids]
            data["time_segment"] = [s for s in data["time_segment"] if s["assignment_id"] in ids]
            data["work_record"] = [r for r in data["work_record"] if r["assignment_id"] in ids]
            data["manager_grant"] = []
        data["rights"] = {r: self.right(task, r) and (not self.admin or
            ("nonorder.manage" if r == "adjust" else "nonorder.review") in self.actor["permissions"]) for r in MANAGER_RIGHTS}
        if reviewed:
            data["rights"].update(review=True, time_review=True)
        grant = self.reviewer(task, valid_only=False)
        data["reviewer"] = {"staff_id": grant["staff_id"], "name": grant["staff_name"], "valid": self.grant_valid(grant)} if grant else None
        data["needs_reviewer"] = bool(self.reviewer_required_staff(task))
        data["responsible_requires_reviewer"] = not self.active_exemption(task["responsible_staff_id"])
        for division in data["division"]:
            members = [a for a in all_assignments if a["division_id"] == division["id"] and not a["revoked_at"]]
            division["can_confirm"] = bool(task["status"] == "active" and division["status"] == "active" and members and all(a["status"] == "done" for a in members) and self.division_review_right(task, division))
            if reviewed and not full:
                division["member_summary"] = [{"staff_name": a["staff_name"], "status": a["status"]} for a in members]
        data["rights"]["owner"] = data["rights"]["adjust"] and (task["responsible_staff_id"] == self.staff or operate_all)
        data["rights"]["operate_people"] = operate_all
        data["staff_id"] = self.staff
        data["events"] = []
        for e in self.db.rows("event", task_id=task["id"]):
            # Full change snapshots are management-only; personal records include their own requirement snapshots.
            if full or e["staff_id"] == self.staff or e["data"].get("assignment_id") in ids or e["event_type"] in {"publish", "edit_task", "edit_division", "cancel", "transfer"}:
                historical = e["data"]["snapshot"]
                data["events"].append({**{k: e[k] for k in ("id", "event_type", "occurred_at", "actor_name", "reason")},
                    "proxy_staff_name": e["data"].get("proxy_staff_name"),
                    "requirements": {"content": historical["task"]["content"], "acceptance_standard": historical["task"]["acceptance_standard"],
                    "people": [{k: a[k] for k in ("staff_name", "responsibility", "requirement_revision", "requirement_snapshot", "status")} for a in historical["assignment"] if full or a["staff_id"] in allowed_staff]}})
        data["daily_items"] = [r for r in self.db.rows("daily_item") if r["assignment_id"] in {a["id"] for a in data["assignment"]}
                               and r["published_at"] and r["status"] == "published"]
        data["work_record"] = [self.public_record(r) for r in data["work_record"]]
        # Effective time is recalculated; raw submissions and source intervals are never rewritten.
        for a in data["assignment"]:
            segments = [s for s in data["time_segment"] if s["assignment_id"] == a["id"] and not s["superseded_by_correction_id"]]
            a["seconds"] = sum(max(0, ((moment(s["ended_at"]) if s["ended_at"] else self.now) - moment(s["started_at"])).total_seconds()) for s in segments)
            a["timer_anomaly"] = any(not s["ended_at"] for s in segments) and not self.active_person(a["staff_id"])
            a["time_needs_check"] = a["status"] == "done" and not segments
            a["blocked"] = self.blocked(a["id"])
        if full:
            clicked = [s for s in data["time_segment"] if s["source_type"] == "click"]
            first = min((s["started_at"] for s in clicked), default=None)
            latest = max((r["payload"].get("work_submitted_at", r["submitted_at"]) for r in data["work_record"] if r["record_type"] == "completion"), default=None)
            confirmed = max((d["confirmed_at"] for d in data["division"] if d["confirmed_at"]), default=None) if task["status"] == "done" else None
            data["timing"] = {"first_started_at": first, "last_work_submitted_at": latest, "finally_confirmed_at": confirmed,
                "execution_seconds": max(0, (moment(latest) - moment(first)).total_seconds()) if first and latest else None,
                "person_seconds": sum(a["seconds"] for a in data["assignment"])}
        return plain(data)

    def active_person(self, staff):
        try:
            self.db.person(staff)
            return True
        except RuleError:
            return False

    def attachments(self, values, task_id=None):
        require(isinstance(values, list) and len(values) <= 9, "附件最多9个", 400)
        result = []
        for item in values:
            require(isinstance(item, dict), "附件无效", 400)
            key = item.get("key", "")
            # Files are saved privately, scoped to a task and uploading identity.
            require(len(key) == 32 and all(c in "0123456789abcdef" for c in key), "附件无效", 400)
            checker = self.actor.get("file_check")
            require(checker and checker(key, task_id, self.staff), "附件不可用", 403)
            result.append({"key": key, "name": words(item.get("name"), "附件名称", limit=200), "type": item.get("type", "file")})
        return result

    def fields(self, body, defaults=None, task_id=None):
        value = {**(defaults or {}), **body}
        try:
            planned = date.fromisoformat(str(value.get("planned_date")))
        except ValueError:
            raise RuleError("请选择计划日期", 400) from None
        category = value.get("category_code")
        require(category in CATEGORIES, "请选择工作类别", 400)
        return {"content": words(value.get("content"), "工作内容"), "category_code": category,
                "acceptance_standard": words(value.get("acceptance_standard"), "完成标准"),
                "planned_date": planned, "due_at": moment(value["due_at"]) if value.get("due_at") else None,
                "remark": words(value.get("remark", ""), "备注", False),
                "attachments": self.attachments(value.get("attachments", []), task_id)}

    def requirement(self, division, responsibility):
        return plain({k: division[k] for k in ("content", "category_code", "acceptance_standard", "station_id", "station_name", "attachments")} | {"responsibility": responsibility})

    def assign(self, task_id, division, person_body, multiple, replaces=None, responsible=None):
        responsible = responsible or self.staff
        stations, scanners = self.db.scope(responsible)
        staff = str(person_body.get("staff_id", ""))
        require(staff in scanners, "人员不在当前可指派范围内", 403)
        reviewer = self.reviewer(self.db.get("task", task_id), valid_only=False)
        require(not reviewer or reviewer["staff_id"] != staff, "请先更换本人执行核对人，再安排其执行")
        responsibility = words(person_body.get("responsibility") or (division["content"] if not multiple else None), "本人负责内容")
        source = division["station_id"] if division["station_id"] in scanners[staff]["station_ids"] else sorted(scanners[staff]["station_ids"])[0]
        sources = {source}
        if division["station_id"]:
            require(division["station_id"] in stations, "无关联工站权限", 403)
            sources.add(division["station_id"])
        identifier = self.db.insert("assignment", task_id=task_id, division_id=division["id"], staff_id=staff,
            staff_name=scanners[staff]["name"], responsibility=responsibility, requirement_revision=1,
            requirement_snapshot=self.requirement(division, responsibility), status="unreceived",
            replaces_assignment_id=replaces, assignment_source={"leader_staff_id": responsible, "station_ids": sorted(sources), "qualification_source": "exempt" if self.db.exempt(responsible) else "station"})
        return identifier, sources

    def add_division(self, task, body, responsible=None):
        require(isinstance(body, dict), "分工内容无效", 400)
        stations, _ = self.db.scope(responsible or self.staff)
        station = body.get("station_id") or None
        require(station is None or station in stations, "无关联工站权限", 403)
        members = body.get("members")
        require(isinstance(members, list) and 1 <= len(members) <= 100, "请选择指派人员", 400)
        require(all(isinstance(person, dict) for person in members), "指派人员无效", 400)
        require(len({str(p.get('staff_id')) for p in members}) == len(members), "同一分工人员不可重复", 400)
        identifier = self.db.insert("division", task_id=task["id"], **self.fields(body, task, task["id"]),
            station_id=station, station_name=stations.get(station), sort_order=len(self.db.rows("division", task_id=task["id"])) + 1, status="active")
        division = self.db.get("division", identifier)
        sources = set()
        for person in members:
            _, scope = self.assign(task["id"], division, person, len(members) > 1, responsible=responsible)
            sources.update(scope)
        return sources

    def extend_sources(self, task, sources):
        for grant in self.db.rows("manager_grant", task_id=task["id"]):
            if grant["grant_type"] == "owner" and not grant["revoked_at"]:
                # An explicit delegate cannot silently broaden the owner's qualification basis.
                if grant["staff_id"] == self.staff and grant["qualification_source"] == "station":
                    stations = set(self.db.leader_stations(self.staff))
                    require(self.exempt_operator or sources <= stations, "本任务线长资格范围不足，请明确重新授权或交接", 403)
                    self.db.update("manager_grant", grant["id"], qualification_station_ids=sorted(set(grant["qualification_station_ids"]) | (sources & stations)))

    def command(self, body, *, daily_sheet=False):
        require(isinstance(body, dict), "请求内容无效", 400)
        action = body.get("action")
        handlers = {"create": self.create, "publish": self.publish, "edit_task": self.edit_task,
            "add_division": self.add_division_command, "edit_division": self.edit_division,
            "receive": self.receive, "start": self.start, "pause": self.pause, "submit": self.submit,
            "feedback": self.feedback, "confirm_feedback": self.confirm_feedback, "review": self.review,
            "correct_time": self.correct_time, "replace": self.replace, "assign": self.assign_command, "cancel": self.cancel,
            "confirm_division": self.confirm_division, "grant": self.grant, "revoke_grant": self.revoke_grant,
            "transfer": self.transfer, "stop_anomaly": self.stop_anomaly, "set_reviewer": self.set_reviewer,
            "create_and_publish": self.create_and_publish}
        if daily_sheet:
            handlers.update(create_sheet_draft=self.create_sheet_draft, publish_sheet_draft=self.publish_sheet_draft,
                            edit_sheet_work=self.edit_sheet_work)
        require(action in handlers, "操作无效", 400)
        if action in {"create_and_publish", "create_sheet_draft", "publish_sheet_draft"}:
            self.require_admin_publish()
        request_id = words(body.get("request_id"), "请求标识", limit=100)
        key = hashlib.sha256(f"{self.actor.get('source')}:{self.actor.get('account_id')}:{self.staff}:{request_id}".encode()).hexdigest()
        digest = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        existing = self.db.rows("event", request_key=key)
        if existing:
            require(existing[0]["request_hash"] == digest, "请求标识已用于其他内容")
            task = self.db.get("task", existing[0]["task_id"])
            require(self.visible(task) or action in {"create_and_publish", "create_sheet_draft", "publish_sheet_draft"} or
                    action == "transfer" and self.admin and "nonorder.transfer" in self.actor["permissions"], "权限已变化", 403)
            return existing[0]["result"]
        task = None if action in {"create", "create_and_publish", "create_sheet_draft"} else self.db.get("task", body.get("task_id"))
        if task:
            require(body.get("revision") == task["revision"], "任务已变化，请刷新后重试")
        self.touched = set()
        self.event_assignment = None
        self.event_record = None
        task_id = handlers[action](task, body)
        self.touched.add(task_id)
        current_task = self.db.get("task", task_id)
        if action in {"assign", "replace", "add_division", "publish"}:
            if "reviewer_staff_id" in body:
                self.owner(current_task)
                self.replace_reviewer(current_task, body["reviewer_staff_id"], body.get("reason") or "安排本人执行核对")
            if current_task["published_at"]:
                self.ensure_reviewer(current_task)
        # Stamp the business event only after all validations/writes. The shared transaction
        # lock also serializes date freezing. No client time determines the effective event.
        for identifier in self.touched:
            current = self.db.get("task", identifier)
            self.db.update("task", identifier, revision=current["revision"] + 1)
        result = {"task_id": task_id, "revision": self.db.get("task", task_id)["revision"]}
        snapshots = {identifier: self.snapshot(identifier) for identifier in sorted(self.touched)}
        recorded = plain(self.db.get("work_record", self.event_record)) if self.event_record else None
        proxy_staff_name = None
        if action in PERSONAL_ACTIONS:
            employee = self.db.get("assignment", self.event_assignment)
            if employee["staff_id"] != self.staff:
                proxy_staff_name = employee["staff_name"]
        occurred = self.db.now()
        for identifier in sorted(self.touched):
            event_type = {"create_and_publish": "publish", "create_sheet_draft": "create", "publish_sheet_draft": "publish",
                          "edit_sheet_work": "edit_division"}.get(action, action)
            self.db.insert("event", task_id=identifier, event_type=event_type, staff_id=self.staff,
                account_id=self.actor.get("account_id"), actor_source=self.actor.get("source", "mini"),
                actor_name=(self.actor.get("name") or self.name) if daily_sheet or action == "create_and_publish" else self.name,
                occurred_at=occurred, request_key=key if identifier == task_id else None,
                request_hash=digest, reason=str(body.get("reason", ""))[:5000],
                data={"snapshot": snapshots[identifier], "assignment_id": self.event_assignment,
                      "record": recorded, "proxy_staff_name": proxy_staff_name}, result=result)
        return result

    def create(self, _, body):
        require(not self.admin, "请由线长或豁免人员在小程序建立任务", 403)
        return self.create_for(body, self.staff, self.name)

    def require_admin_publish(self):
        require(self.admin and {"daily-tasks.view", "nonorder.view", "nonorder.publish"} <= self.actor["permissions"],
                "没有后台任务发布权限", 403)

    def admin_publish_options(self, responsible=None):
        self.require_admin_publish()
        if not responsible:
            exempt_ids = self.db.exemption_ids()
            return {"responsibles": [person for person in self.reviewer_candidates() if person["id"] not in exempt_ids],
                    "categories": CATEGORIES}
        person, owned = self.admin_responsible(responsible)
        stations, scanners = self.db.scope(responsible)
        return {"responsible": {"id": str(person["id"]), "name": person["name"]},
                "stations": [{"id": key, "name": value} for key, value in stations.items()],
                "default_station_id": next(iter(owned)) if len(owned) == 1 else None,
                "scanners": [{"id": key, "name": value["name"]} for key, value in scanners.items()],
                "reviewers": self.reviewer_candidates()}

    def admin_responsible(self, staff):
        person = self.db.person(staff)
        owned = self.db.leader_stations(staff)
        require(owned and not self.db.exempt(staff), "请选择未列入豁免名单的有效线长", 403)
        return person, owned

    def can_edit_sheet_work(self, task, division, assignment):
        permissions = self.actor.get("permissions", set())
        return (self.admin and {"daily-tasks.manage", "nonorder.manage"} <= permissions
                and (self.right(task, "adjust") or {"nonorder.manage-all", "nonorder.publish"} <= permissions)
                and task["status"] in {"draft", "active"} and division["status"] == "active"
                and not assignment["revoked_at"] and assignment["status"] in EXECUTABLE | {"unreceived"})

    def sheet_work_people(self, assignment_id):
        assignment = self.db.get("assignment", assignment_id)
        task = self.db.get("task", assignment["task_id"])
        division = self.db.get("division", assignment["division_id"])
        require(self.can_edit_sheet_work(task, division, assignment), "无此分工修改权限", 403)
        require(task["published_at"] or self.db.rows("daily_item", assignment_id=assignment["id"]),
                "任务尚未进入安排单", 403)
        _, scanners = self.db.scope(task["responsible_staff_id"])
        excluded = {row["staff_id"] for row in self.db.rows("assignment", division_id=division["id"], revoked_at=None)
                    if row["id"] != assignment["id"]}
        reviewer = self.reviewer(task, valid_only=False)
        if reviewer:
            excluded.add(reviewer["staff_id"])
        return [{"id": key, "name": row["name"]} for key, row in scanners.items() if key not in excluded]

    def edit_sheet_work(self, task, body):
        assignment = self.child("assignment", body.get("assignment_id"), task)
        division = self.db.get("division", assignment["division_id"])
        require(self.can_edit_sheet_work(task, division, assignment), "无此分工修改权限或该人员已提交", 403)
        staff = words(body.get("staff_id"), "执行人员", limit=64)
        content = words(body.get("content", division["content"]), "工作项")
        responsibility = words(body.get("responsibility"), "个人职责")
        self.event_assignment = assignment["id"]
        replacing = staff != assignment["staff_id"]
        if content != division["content"] or not replacing and responsibility != assignment["responsibility"]:
            self.edit_division(task, {"division_id": division["id"], "content": content,
                "responsibilities": {} if replacing else {str(assignment["id"]): responsibility}}, scheduled=True)
        if replacing:
            self.replace(task, {"assignment_id": assignment["id"], "reason": "安排单调整执行人员",
                "member": {"staff_id": staff, "responsibility": responsibility}}, scheduled=True)
        if task["published_at"]:
            self.ensure_reviewer(task)
        return task["id"]

    def create_and_publish(self, _, body):
        identifier = self.create_sheet_draft(None, body)
        return self.publish_sheet_draft(self.db.get("task", identifier), body)

    def create_sheet_draft(self, _, body):
        self.require_admin_publish()
        responsible = words(body.get("responsible_staff_id"), "任务负责人", limit=64)
        person, _ = self.admin_responsible(responsible)
        identifier = self.create_for(body, responsible, person["name"])
        self.ensure_reviewer(self.db.get("task", identifier))
        return identifier

    def publish_sheet_draft(self, task, _):
        self.require_admin_publish()
        responsible = task["responsible_staff_id"]
        self.admin_responsible(responsible)
        self.ensure_reviewer(task)
        require(any(grant["grant_type"] == "owner" and self.grant_valid(grant)
                    for grant in self.db.rows("manager_grant", task_id=task["id"], staff_id=responsible)),
                "负责人权限已变化，请重新核对", 403)
        return self.publish_for(task, responsible)

    def create_for(self, body, responsible, responsible_name):
        require(self.db.leader_stations(responsible) or self.db.exempt(responsible), "只有线长或豁免人员可以发布任务", 403)
        divisions = body.get("divisions")
        require(isinstance(divisions, list) and 1 <= len(divisions) <= 50, "请建立分工", 400)
        source = body.get("source_task_id")
        if source:
            require(self.visible(self.db.get("task", source)), "无来源任务权限", 403)
        identifier = self.db.insert("task", task_no="NW" + uuid.uuid4().hex[:20].upper(), **self.fields(body),
            creator_staff_id=responsible, responsible_staff_id=responsible, creator_name=responsible_name, responsible_name=responsible_name,
            created_at=self.now, status="draft", source_task_id=source)
        task = self.db.get("task", identifier)
        sources = set()
        for division in divisions:
            sources.update(self.add_division(task, division, responsible=responsible))
        self.db.insert("manager_grant", task_id=identifier, staff_id=responsible, staff_name=responsible_name,
            grant_type="owner", permissions=sorted(MANAGER_RIGHTS), qualification_station_ids=sorted(sources),
            starts_at=self.now, operator_staff_id=self.staff, operator_account_id=self.actor.get("account_id"), reason="建立任务",
            qualification_source="exempt" if self.db.exempt(responsible) else "station")
        if body.get("reviewer_staff_id"):
            self.replace_reviewer(task, body["reviewer_staff_id"], "建立任务时指定核对人")
        return identifier

    def publish(self, task, body):
        self.owner(task)
        return self.publish_for(task, self.staff)

    def publish_for(self, task, responsible):
        require(task["status"] == "draft", "任务已发布")
        stations, scanners = self.db.scope(responsible)
        divisions = [d for d in self.db.rows("division", task_id=task["id"]) if d["status"] == "active"]
        require(divisions, "请保留至少一条有效分工")
        for division in divisions:
            require(division["station_id"] is None or division["station_id"] in stations, "关联工站权限已变化，请重新核对", 403)
            require(any(not a["revoked_at"] for a in self.db.rows("assignment", division_id=division["id"])), "每条有效分工都需要指派人员")
        for a in self.db.rows("assignment", task_id=task["id"]):
            if a["revoked_at"]:
                continue
            require(a["staff_id"] in scanners, "指派范围已变化，请调整人员", 403)
        publisher_name = self.actor["name"] if self.admin and self.actor.get("name") else self.name
        self.db.update("task", task["id"], status="active", publisher_staff_id=self.staff, publisher_name=publisher_name, published_at=self.now)
        return task["id"]

    def edit_task(self, task, body):
        self.managed(task, "adjust")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        self.db.update("task", task["id"], **self.fields(body, task, task["id"]))
        return task["id"]

    def add_division_command(self, task, body):
        self.managed(task, "adjust")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        sources = self.add_division(task, body["division"])
        self.extend_sources(task, sources)
        return task["id"]

    def child(self, name, identifier, task):
        row = self.db.get(name, identifier)
        require(row["task_id"] == task["id"], "记录不属于此任务", 400)
        return row

    def employee(self, task, body, allow_closed=False):
        require(not self.admin, "请由员工本人操作", 403)
        a = self.child("assignment", body.get("assignment_id"), task)
        require(task["published_at"] and (a["staff_id"] == self.staff or self.can_operate_all(task)),
                "无此人员任务的执行权限", 403)
        if not allow_closed:
            require(not a["revoked_at"] and task["status"] == "active", "任务已撤销或结束")
        self.event_assignment = a["id"]
        return a

    def bump_assignment(self, a, **values):
        self.db.update("assignment", a["id"], revision=a["revision"] + 1, **values)

    def stop(self, a, reason):
        for segment in self.db.rows("time_segment", assignment_id=a["id"]):
            if segment["ended_at"] is None:
                self.db.update("time_segment", segment["id"], ended_at=self.now, end_reason=reason)

    def blocked(self, assignment_id):
        return any(r["record_type"] == "feedback" and r["payload"].get("blocking") and r["status"] in {"pending", "replied"}
                   for r in self.db.rows("work_record", assignment_id=assignment_id))

    def receive(self, task, body):
        a = self.employee(task, body)
        require(a["status"] == "unreceived", "当前无需接收")
        self.bump_assignment(a, status="ready", accepted_revision=a["requirement_revision"], accepted_at=self.now,
                             first_accepted_at=a["first_accepted_at"] or self.now)
        return task["id"]

    def start(self, task, body):
        a = self.employee(task, body)
        self.db.person(a["staff_id"])
        require(a["status"] in {"ready", "paused", "rework"} and a["accepted_revision"] == a["requirement_revision"], "请先接收当前职责")
        require(not self.blocked(a["id"]), "请先确认问题处理结果")
        require(not any(s["ended_at"] is None for s in self.db.rows("time_segment", staff_id=a["staff_id"])), "请先暂停正在做的无工单任务")
        self.db.insert("time_segment", assignment_id=a["id"], task_id=task["id"], staff_id=a["staff_id"],
            requirement_revision=a["requirement_revision"], started_at=self.now, operator_staff_id=self.staff, source_type="click")
        self.bump_assignment(a, status="running")
        return task["id"]

    def pause(self, task, body):
        a = self.employee(task, body)
        require(a["status"] == "running", "当前没有运行计时")
        category = body.get("pause_kind")
        require(category in {"休息", "等待材料", "等待配合", "临时调配", "其他"}, "请选择暂停原因", 400)
        reason = words(body.get("reason"), "暂停说明") if category == "其他" else category
        self.stop(a, reason)
        self.bump_assignment(a, status="paused")
        return task["id"]

    def new_record(self, kind, task, a, body, payload=None, previous=None):
        if previous is None and body.get("previous_record_id"):
            prior = self.db.get("work_record", body["previous_record_id"])
            require(prior["assignment_id"] == a["id"] and prior["staff_id"] == a["staff_id"] and prior["record_type"] == kind,
                    "重提记录不匹配", 400)
            require(prior["status"] in {"rejected", "confirmed"}, "原申请尚未结束")
            require(not self.db.rows("work_record", previous_record_id=prior["id"]), "已有重提记录，请刷新")
            previous = prior["id"]
        if a["staff_id"] != self.staff:
            payload = {**(payload or {}), "proxy_staff_id": self.staff, "proxy_staff_name": self.name}
        identifier = self.db.insert("work_record", record_type=kind, task_id=task["id"], assignment_id=a["id"], staff_id=a["staff_id"],
            requirement_revision=a["requirement_revision"], requirement_snapshot=a["requirement_snapshot"],
            content=words(body.get("content"), "完成内容" if kind == "completion" else "说明"),
            attachments=self.attachments(body.get("attachments", []), task["id"]), submitted_at=self.now,
            status="pending", payload=plain(payload or {}), previous_record_id=previous)
        self.event_record = identifier
        return identifier

    def submit(self, task, body):
        a = self.employee(task, body, allow_closed=True)
        records = [r for r in self.db.rows("work_record", assignment_id=a["id"]) if r["record_type"] == "completion"]
        last = records[-1] if records else None
        materials = last and last["status"] == "returned" and last["return_kind"] == "materials"
        if not materials:
            require(task["status"] == "active" and not a["revoked_at"] and a["status"] in EXECUTABLE, "当前不能提交完成")
            require(not self.blocked(a["id"]) and a["accepted_revision"] == a["requirement_revision"], "请先处理职责或问题反馈")
        require(not last or last["status"] == "returned", "完成提交已在核对或已通过")
        segments = [s for s in self.db.rows("time_segment", assignment_id=a["id"]) if not s["superseded_by_correction_id"]]
        if not materials:
            require(any(s["requirement_revision"] == a["accepted_revision"] and
                        (not last or s["started_at"] >= last["reviewed_at"]) for s in segments), "请先开工，漏记时间需先申请修正")
        self.stop(a, "提交完成")
        record_a = {**a, "requirement_revision": last["requirement_revision"], "requirement_snapshot": last["requirement_snapshot"]} if materials else a
        self.new_record("completion", task, record_a, body, {"segments": self.db.rows("time_segment", assignment_id=a["id"]), "work_submitted_at":
                        (last["payload"].get("work_submitted_at", last["submitted_at"]) if materials else self.now)}, last["id"] if last else None)
        if not a["revoked_at"]:
            self.bump_assignment(a, status="pending")
        return task["id"]

    def feedback(self, task, body):
        a = self.employee(task, body)
        require(a["status"] in EXECUTABLE | {"unreceived"}, "当前不能提交职责问题")
        blocking = body.get("blocking", False)
        require(isinstance(blocking, bool), "问题类型无效", 400)
        self.new_record("feedback", task, a, body, {"blocking": blocking})
        if blocking and a["status"] == "running":
            self.stop(a, "职责问题")
            self.bump_assignment(a, status="paused")
        return task["id"]

    def confirm_feedback(self, task, body):
        a = self.employee(task, body, allow_closed=True)
        record = self.child("work_record", body.get("record_id"), task)
        require(record["assignment_id"] == a["id"] and record["record_type"] == "feedback" and record["status"] == "replied", "问题尚未处理")
        self.db.update("work_record", record["id"], status="confirmed", confirmed_at=self.now, revision=record["revision"] + 1)
        return task["id"]

    def review(self, task, body):
        record = self.child("work_record", body.get("record_id"), task)
        kind = record["record_type"]
        require(self.can_review_record(record), "无此事项核对权限，请联系指定核对人", 403)
        require(record["status"] == "pending" or self.history_close(record) and body.get("decision") == "unmet", "此记录已处理")
        a = self.db.get("assignment", record["assignment_id"])
        decision = body.get("decision")
        note = words(body.get("reason", ""), "处理意见", decision != "approve")
        status, return_kind = "approved", None
        if kind == "time_correction":
            require(decision in {"approve", "reject"}, "处理方式无效", 400)
            self.check_correction_permissions(record)
            if decision == "approve":
                self.apply_correction(record)
            else:
                status = "rejected"
        elif kind == "feedback":
            require(decision == "reply", "请回复问题", 400)
            status = "replied"
        else:
            require(decision in {"approve", "materials", "rework", "unmet"}, "处理方式无效", 400)
            closed = bool(a["revoked_at"] or task["status"] == "cancelled")
            if decision == "rework":
                require(not closed, "已取消的工作不能退回补做")
            if decision == "unmet":
                require(closed, "未取消任务请退回处理")
                status = "unmet"
            elif decision != "approve":
                status, return_kind = "returned", decision
            if not a["revoked_at"]:
                new_status = {"approve": "done", "materials": "materials", "rework": "rework", "unmet": "cancelled"}[decision]
                self.bump_assignment(a, status=new_status)
        self.db.update("work_record", record["id"], status=status, return_kind=return_kind,
            reviewer_staff_id=self.staff, reviewer_account_id=self.actor.get("account_id"), reviewed_at=self.now,
            review_note=note, revision=record["revision"] + 1)
        self.event_assignment = a["id"]
        self.event_record = record["id"]
        return task["id"]

    def edit_division(self, task, body, *, scheduled=False):
        if not scheduled:
            self.managed(task, "adjust")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        d = self.child("division", body.get("division_id"), task)
        require(d["status"] == "active", "分工已结束，新增要求请另建分工")
        defaults = {**d, "attachments": []} if scheduled else d
        updated = {**d, **self.fields(body, defaults, task["id"])}
        if scheduled:
            updated["attachments"] = d["attachments"]
        if "station_id" in body:
            stations, _ = self.db.scope(self.staff)
            station = body["station_id"] or None
            require(station is None or station in stations, "无关联工站权限", 403)
            updated.update(station_id=station, station_name=stations.get(station))
        responsibilities = body.get("responsibilities", {})
        require(isinstance(responsibilities, dict), "人员职责无效", 400)
        members = self.db.rows("assignment", division_id=d["id"])
        require(set(responsibilities) <= {str(a["id"]) for a in members if not a["revoked_at"]}, "职责人员无效", 400)
        for a in members:
            if a["revoked_at"]:
                continue
            responsibility = words(responsibilities.get(str(a["id"]), a["responsibility"]), "本人负责内容")
            snapshot = self.requirement(updated, responsibility)
            if snapshot == a["requirement_snapshot"]:
                continue
            if a["status"] in {"pending", "materials", "done"}:
                require(str(a["id"]) not in responsibilities or responsibility == a["responsibility"],
                        "已提交人员按原要求核对，新增要求请另建分工")
                # Shared edits apply only to unfinished people. Their submitted peers keep
                # the accepted snapshot, including their original attachments and standard.
                continue
            self.stop(a, "职责变更")
            self.bump_assignment(a, responsibility=responsibility, requirement_snapshot=snapshot,
                                 requirement_revision=a["requirement_revision"] + 1, status="unreceived")
        self.db.update("division", d["id"], **{k: updated[k] for k in ("content", "category_code", "acceptance_standard", "planned_date", "due_at", "remark", "attachments", "station_id", "station_name")}, revision=d["revision"] + 1)
        if updated["station_id"]:
            self.extend_sources(task, {updated["station_id"]})
        return task["id"]

    def replace(self, task, body, *, scheduled=False):
        if not scheduled:
            self.managed(task, "adjust")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        a = self.child("assignment", body.get("assignment_id"), task)
        require(not a["revoked_at"], "人员已撤销")
        require(a["status"] != "done", "已完成人员保留原结果，新增要求请另建分工")
        reason = words(body.get("reason"), "调整原因")
        self.stop(a, "调整人员")
        self.bump_assignment(a, status="revoked", revoked_at=self.now, revoke_reason=reason)
        if body.get("member"):
            division = self.db.get("division", a["division_id"])
            require(division["status"] == "active", "分工已结束")
            responsible = task["responsible_staff_id"] if scheduled else None
            _, sources = self.assign(task["id"], division, body["member"], True, a["id"], responsible=responsible)
            self.extend_sources(task, sources)
        self.event_assignment = a["id"]
        return task["id"]

    def assign_command(self, task, body):
        self.managed(task, "adjust")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        d = self.child("division", body.get("division_id"), task)
        require(d["status"] == "active", "分工已结束")
        words(body.get("reason"), "增加人员原因")
        identifier, sources = self.assign(task["id"], d, body["member"], True)
        self.extend_sources(task, sources)
        self.event_assignment = identifier
        return task["id"]

    def cancel(self, task, body):
        self.managed(task, "adjust")
        reason = words(body.get("reason"), "取消原因")
        require(task["status"] in {"draft", "active"}, "任务已结束")
        target = self.child("division", body["division_id"], task) if body.get("division_id") else None
        require(not target or target["status"] == "active", "分工已结束")
        for a in self.db.rows("assignment", task_id=task["id"]):
            if not a["revoked_at"] and a["status"] != "done" and (not target or a["division_id"] == target["id"]):
                self.stop(a, "取消任务")
                self.bump_assignment(a, revoked_at=self.now, revoke_reason=reason, status="revoked")
        for d in self.db.rows("division", task_id=task["id"]):
            if d["status"] != "done" and (not target or d["id"] == target["id"]):
                self.db.update("division", d["id"], status="cancelled", revision=d["revision"] + 1)
        if not target:
            self.db.update("task", task["id"], status="cancelled", cancel_reason=reason, cancelled_at=self.now)
        return task["id"]

    def confirm_division(self, task, body):
        require(task["status"] == "active", "任务已结束")
        d = self.child("division", body.get("division_id"), task)
        require(d["status"] == "active", "分工已结束")
        require(self.division_review_right(task, d), "无此分工整体核对权限", 403)
        members = [a for a in self.db.rows("assignment", division_id=d["id"]) if not a["revoked_at"]]
        require(members and all(a["status"] == "done" for a in members), "人员完成核对后才能确认整体完成")
        member_ids = {a["id"] for a in self.db.rows("assignment", division_id=d["id"])}
        require(not any(r["assignment_id"] in member_ids and r["record_type"] == "completion" and r["status"] in {"pending", "returned"} and
                        not any(x["previous_record_id"] == r["id"] for x in self.db.rows("work_record", task_id=task["id"]))
                        for r in self.db.rows("work_record", task_id=task["id"])), "请先结清历史完成提交")
        self.db.update("division", d["id"], status="done", confirmed_by=self.staff, confirmed_at=self.now, revision=d["revision"] + 1)
        divisions = self.db.rows("division", task_id=task["id"])
        if all(row["status"] in {"done", "cancelled"} for row in divisions) and any(row["status"] == "done" for row in divisions):
            self.db.update("task", task["id"], status="done")
        return task["id"]

    def grant(self, task, body):
        if not (self.admin and "nonorder.transfer" in self.actor["permissions"]):
            self.owner(task)
        require(task["published_at"], "请先发布任务")
        person = self.db.person(str(body.get("staff_id", "")))
        permissions = body.get("permissions")
        require(isinstance(permissions, list) and permissions and set(permissions) <= MANAGER_RIGHTS, "请选择代管权限", 400)
        ends = moment(body.get("ends_at"))
        require(ends > self.now, "代管结束时间必须晚于当前时间", 400)
        self.db.insert("manager_grant", task_id=task["id"], staff_id=str(person["id"]), staff_name=person["name"],
            grant_type="delegate", permissions=permissions, qualification_station_ids=[], starts_at=self.now, ends_at=ends,
            operator_staff_id=self.staff, operator_account_id=self.actor.get("account_id"), reason=words(body.get("reason"), "代管原因"))
        return task["id"]

    def revoke_grant(self, task, body):
        if not (self.admin and "nonorder.transfer" in self.actor["permissions"]):
            self.owner(task)
        grant = self.child("manager_grant", body.get("grant_id"), task)
        require(grant["grant_type"] == "delegate" and not grant["revoked_at"], "请通过更换核对人调整专门核对授权")
        words(body.get("reason"), "撤销原因")
        self.db.update("manager_grant", grant["id"], revoked_at=self.now)
        return task["id"]

    def transfer(self, task, body):
        if not (self.admin and "nonorder.transfer" in self.actor["permissions"]):
            self.owner(task)
        require(task["published_at"], "草稿不能交接")
        person = self.db.person(str(body.get("staff_id", "")))
        stations = self.db.leader_stations(str(person["id"]))
        exempt = self.db.exempt(str(person["id"]))
        require((stations or exempt) and str(person["id"]) != task["responsible_staff_id"], "请选择其他有效线长或豁免人员", 400)
        sources = body.get("qualification_station_ids")
        if exempt:
            sources = []
        else:
            require(isinstance(sources, list) and sources and set(sources) <= set(stations), "请明确接管资格工站", 400)
        if self.reviewer_required_staff(task) or not exempt and self.participated(task["id"], str(person["id"])):
            require(body.get("reviewer_staff_id"), "交接时请明确保留或更换本人执行核对人", 400)
        reason = words(body.get("reason"), "交接原因")
        for grant in self.db.rows("manager_grant", task_id=task["id"]):
            if not grant["revoked_at"]:
                self.db.update("manager_grant", grant["id"], revoked_at=self.now)
        self.db.insert("manager_grant", task_id=task["id"], staff_id=str(person["id"]), staff_name=person["name"], grant_type="owner",
            permissions=sorted(MANAGER_RIGHTS), qualification_station_ids=sources, starts_at=self.now,
            operator_staff_id=self.staff, operator_account_id=self.actor.get("account_id"), reason=reason, qualification_source="exempt" if exempt else "station")
        self.db.update("task", task["id"], responsible_staff_id=str(person["id"]), responsible_name=person["name"])
        updated = self.db.get("task", task["id"])
        if self.reviewer_required_staff(updated):
            self.replace_reviewer(updated, body.get("reviewer_staff_id"), reason)
            self.ensure_reviewer(updated)
        return task["id"]

    def stop_anomaly(self, task, body):
        self.managed(task, "adjust")
        a = self.child("assignment", body.get("assignment_id"), task)
        require(not self.active_person(a["staff_id"]) and a["status"] == "running", "无账号停用计时异常")
        words(body.get("reason"), "处理说明")
        self.stop(a, "账号停用，管理人终止")
        self.bump_assignment(a, status="paused")
        return task["id"]

    def correct_time(self, task, body):
        a = self.employee(task, body, allow_closed=True)
        originals = body.get("before_segment_ids", [])
        proposals = body.get("proposed_segments", [])
        require(isinstance(originals, list) and isinstance(proposals, list) and (originals or proposals) and len(originals) + len(proposals) <= 100,
                "请选择需修正时段或补记时段", 400)
        require(len(set(originals)) == len(originals), "时段重复", 400)
        before = []
        for identifier in originals:
            s = self.db.get("time_segment", identifier)
            require(s["staff_id"] == a["staff_id"] and s["ended_at"] and not s["superseded_by_correction_id"], "请先暂停，或时段已被修正")
            before.append(s)
        for pending in self.db.rows("work_record", staff_id=a["staff_id"], record_type="time_correction", status="pending"):
            require(not set(originals) & {s["id"] for s in pending["payload"]["before_segments"]}, "此时段已有待确认申请")
        parsed = self.validate_proposals(proposals, a["staff_id"])
        affected = {s["task_id"] for s in before + parsed} | {task["id"]}
        self.touched.update(affected)
        self.new_record("time_correction", task, a, body, {"before_segments": before, "proposed_segments": parsed, "task_ids": sorted(affected)})
        return task["id"]

    def validate_proposals(self, proposals, staff):
        result = []
        for item in proposals:
            a = self.db.get("assignment", item.get("assignment_id"))
            require(a["staff_id"] == staff and a["first_accepted_at"], "只能修正本人已接收任务的时间", 403)
            start, end = moment(item.get("started_at")), moment(item.get("ended_at"))
            require(a["first_accepted_at"] <= start < end <= self.now, "时段必须在接收后且已结束", 400)
            require(not a["revoked_at"] or end <= a["revoked_at"], "时段不能晚于指派撤销时间", 400)
            task = self.db.get("task", a["task_id"])
            require(not task["cancelled_at"] or end <= task["cancelled_at"], "时段不能晚于任务取消时间", 400)
            version = item.get("requirement_revision", a["accepted_revision"])
            require(isinstance(version, int) and 1 <= version <= a["requirement_revision"], "职责版本无效", 400)
            # Historical version must be proved by an acceptance event, never merely a client number.
            accepted = []
            next_requirement = []
            for e in self.db.rows("event", task_id=a["task_id"]):
                for prior in e["data"]["snapshot"]["assignment"]:
                    if prior["id"] == a["id"] and prior["requirement_revision"] > version:
                        next_requirement.append(e["occurred_at"])
            for e in self.db.rows("event", task_id=a["task_id"], event_type="receive"):
                for prior in e["data"]["snapshot"]["assignment"]:
                    if prior["id"] == a["id"] and prior["accepted_revision"] == version:
                        accepted.append(moment(prior["accepted_at"]))
            require(accepted and min(accepted) <= start, "该职责版本在此时段尚未接收")
            require(not next_requirement or end <= min(next_requirement), "时段跨越职责变更，请按要求版本拆分")
            result.append({"assignment_id": a["id"], "task_id": a["task_id"], "staff_id": staff,
                           "started_at": start, "ended_at": end, "requirement_revision": version})
        return result

    def check_correction_permissions(self, record):
        for identifier in record["payload"]["task_ids"]:
            require(self.review_right(self.db.get("task", identifier), record["staff_id"], "time_review"), "没有全部受影响事项的时间核对权", 403)

    def apply_correction(self, record):
        payload = record["payload"]
        before_ids = {s["id"] for s in payload["before_segments"]}
        for previous in payload["before_segments"]:
            current = self.db.get("time_segment", previous["id"])
            require(plain(current) == previous, "原时段已变化，请重新申请")
        proposed = self.validate_proposals(payload["proposed_segments"], record["staff_id"])
        effective = [s for s in self.db.rows("time_segment", staff_id=record["staff_id"]) if not s["superseded_by_correction_id"] and s["id"] not in before_ids]
        intervals = sorted(effective + proposed, key=lambda s: s["started_at"])
        for left, right in zip(intervals, intervals[1:]):
            require(left["ended_at"] is not None and left["ended_at"] <= right["started_at"], "修正后与其他无工单工作时间重叠")
        for identifier in before_ids:
            self.db.update("time_segment", identifier, superseded_by_correction_id=record["id"])
        for item in proposed:
            self.db.insert("time_segment", **item, operator_staff_id=self.staff, source_type="correction",
                           correction_id=record["id"], end_reason="已批准时间修正")
        self.touched.update(payload["task_ids"])
