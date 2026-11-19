"""Daily planning rules; caller owns the mixed-sheet transaction and lock."""
from collections import defaultdict
from datetime import date
from .service import require, words
from .storage import plain

PLANNABLE = {"unreceived", "ready", "running", "paused", "rework"}


def eligible(task, division, assignment):
    return (task["status"] == "active" and division["status"] == "active" and
            not assignment["revoked_at"] and assignment["status"] in PLANNABLE)


def can_plan(service, task, *, linked_draft=False):
    permissions = service.actor.get("permissions", set())
    return (service.admin and "daily-tasks.manage" in permissions and "nonorder.manage" in permissions
            and (linked_draft and task["status"] == "draft" or task["published_at"] and service.visible(task))
            and ("nonorder.manage-all" in permissions or service.right(task, "adjust")))


def can_view_plan(service, task, *, linked_draft=False):
    return bool((linked_draft and task["status"] == "draft" or task["published_at"] and service.visible(task)) and
                (service.managing(task) or "nonorder.view-all" in service.actor["permissions"]))


def save_changes(service, sheet, changes, target_sheet=None, *, draft_task_ids=()):
    """Explicit versioned deltas only. Never infer deletion/publication from omitted rows."""
    require(isinstance(changes, list) and len(changes) <= 1000, "无工单安排明细无效", 400)
    now = service.db.now()
    require(now < min(sheet["plan_cutoff"], sheet["result_cutoff"]), "安排单已跨日锁定")
    touched, seen = defaultdict(list), set()
    publish_tasks = set()
    work_versions, work_titles = {}, {}
    cutoffs = [min(sheet["plan_cutoff"], sheet["result_cutoff"])]
    for change in changes:
        require(isinstance(change, dict), "安排明细无效", 400)
        action = change.get("action")
        require(action in {"add", "update", "cancel", "reschedule", "append"}, "安排操作无效", 400)
        require(type(change.get("publish", False)) is bool, "发布参数无效", 400)
        old = service.db.get("daily_item", change.get("id")) if action != "add" else None
        if old:
            require(old["sheet_id"] == sheet["id"] and old["revision"] == change.get("revision"), "安排已变化，请刷新核对，草稿已保留")
            require(not old["cancelled_at"], "安排已取消")
        assignment = service.db.get("assignment", old["assignment_id"] if old else change.get("assignment_id"))
        require(assignment["id"] not in seen, "同一人员分工重复安排")
        seen.add(assignment["id"])
        task = service.db.get("task", assignment["task_id"])
        linked_draft = task["status"] == "draft" and (old is not None or task["id"] in draft_task_ids)
        require(can_plan(service, task, linked_draft=linked_draft), "没有此任务的安排权限", 403)
        versions = work_versions.get(task["id"])
        task_revision, assignment_revision = (task["revision"], assignment["revision"]) if versions is None else (
            versions[0], versions[1].get(assignment["id"]))
        require(task_revision == change.get("task_revision") and assignment_revision == change.get("assignment_revision"), "任务职责或状态已变化，请刷新核对，草稿已保留")
        division = service.db.get("division", assignment["division_id"])
        work_edit = change.get("work_edit")
        replaced_plan = None
        if work_edit is not None:
            require(action in {"add", "update"} and isinstance(work_edit, dict), "分工修改无效", 400)
            if "content" in work_edit:
                content = words(work_edit["content"], "工作项")
                require(work_titles.setdefault(division["id"], content) == content, "同一分工的工作项修改不一致")
            if versions is None:
                work_versions[task["id"]] = (task["revision"], {row["id"]: row["revision"]
                    for row in service.db.rows("assignment", task_id=task["id"])})
            previous_assignment = assignment
            service.command({**work_edit, "action": "edit_sheet_work", "task_id": task["id"],
                "revision": task["revision"], "assignment_id": assignment["id"],
                "reason": "安排单修改分工"}, daily_sheet=True)
            task = service.db.get("task", task["id"])
            division = service.db.get("division", division["id"])
            assignment = service.db.get("assignment", previous_assignment["id"])
            if assignment["revoked_at"]:
                [assignment] = service.db.rows("assignment", replaces_assignment_id=previous_assignment["id"], revoked_at=None)
                if old:
                    replaced_plan, old = old, None
                    service.db.update("daily_item", replaced_plan["id"], status="cancelled", cancelled_at=now,
                                      revision=replaced_plan["revision"] + 1, operator_account_id=service.actor["account_id"])
                    touched[task["id"]].append({"plan_id": replaced_plan["id"], "source_sheet_id": sheet["id"],
                        "target_sheet_id": sheet["id"], "action": "cancel", "work_date": sheet["work_date"].isoformat(),
                        "old_date": sheet["work_date"].isoformat(), "staff_name": previous_assignment["staff_name"],
                        "work": division["content"], "remark": "更换执行人员"})
                    action = "add"
        if linked_draft:
            require(action not in {"reschedule", "append"}, "请先发布无工单任务再调整日期")
            require(division["status"] == "active" or action == "cancel", "该分工已取消")
        destination = sheet
        if action in {"reschedule", "append"}:
            try:
                requested = date.fromisoformat(change.get("target_date", ""))
            except (ValueError, TypeError):
                require(False, "请选择执行日期", 400)
            require(target_sheet and requested >= now.date() and requested != sheet["work_date"], "请选择另一个可安排日期", 400)
            destination = target_sheet(requested)
            cutoffs.append(min(destination["plan_cutoff"], destination["result_cutoff"]))
        if action in {"cancel", "reschedule"}:
            service.db.update("daily_item", old["id"], status="cancelled", cancelled_at=now, revision=old["revision"] + 1,
                              operator_account_id=service.actor["account_id"])
        saved_id = old["id"] if old else None
        if action != "cancel":
            require(task["status"] != "cancelled" and not assignment["revoked_at"], "任务已取消或人员已更换")
            if action != "update" and not linked_draft:
                require(eligible(task, division, assignment), "该人员分工不再待安排")
            destination_items = service.db.rows("daily_item", work_date=destination["work_date"])
            occupied = [r for r in destination_items if r["assignment_id"] == assignment["id"]
                        and (not old or r["id"] != old["id"]) and not r["cancelled_at"] and
                        (r["status"] == "published" or r["status"] == "draft" and r["plan_cutoff"] > now)]
            require(not occupied, "此人员分工在该日期已有安排，请刷新核对")
            publish = change.get("publish") is True or bool(replaced_plan and replaced_plan["published_at"]) or bool(old and old["published_at"] and action != "append")
            if linked_draft and publish:
                require(assignment["status"] == "unreceived", "指派已变化，请刷新核对")
                publish_tasks.add(task["id"])
            order = change.get("sort_order", old["sort_order"] if old else 0)
            if destination["id"] != sheet["id"]:
                order = 1 + max((r["sort_order"] for r in destination_items if r["sheet_id"] == destination["id"]), default=0)
            require(type(order) is int and 0 <= order <= 100000, "顺序无效", 400)
            values = dict(sort_order=order, remark=words(change.get("remark", old["remark"] if old else ""), "备注", False, limit=500),
                          status="published" if publish else "draft", operator_account_id=service.actor["account_id"],
                          published_at=old["published_at"] if action == "update" and old["published_at"] else now if publish else None)
            if action == "update":
                if work_edit is not None:
                    values["snapshot"] = plain({"task": task, "division": division, "assignment": assignment})
                service.db.update("daily_item", old["id"], **values, revision=old["revision"] + 1)
            else:
                saved_id = service.db.insert("daily_item", **values, sheet_id=destination["id"], assignment_id=assignment["id"],
                    work_date=destination["work_date"], station_id=division["station_id"], responsible_staff_id=task["responsible_staff_id"],
                    revision=1, created_at=now, plan_cutoff=destination["plan_cutoff"],
                    snapshot=plain({"task": task, "division": division, "assignment": assignment}))
        touched[task["id"]].append({
            "plan_id": saved_id, "source_sheet_id": sheet["id"], "target_sheet_id": destination["id"],
            "action": "publish" if action == "update" and publish and old["status"] == "draft" else action,
            "work_date": destination["work_date"].isoformat(), "old_date": sheet["work_date"].isoformat(),
            "staff_name": assignment["staff_name"], "work": division["content"],
            "remark": change.get("remark") if action != "cancel" else old["remark"],
        })
    for identifier in sorted(touched):
        service.db.insert("event", task_id=identifier, event_type="daily_plan", staff_id=service.staff,
            account_id=service.actor["account_id"], actor_source="admin", actor_name=service.name,
            occurred_at=now, reason="每日安排", data={"snapshot": service.snapshot(identifier)},
            result={"sheet_id": sheet["id"], "changes": touched[identifier]})
    for identifier in sorted(publish_tasks):
        revision = service.db.get("task", identifier)["revision"]
        service.command({"action": "publish_sheet_draft", "task_id": identifier, "revision": revision,
                         "request_id": f"sheet-publish:{sheet['id']}:{identifier}:{revision}"}, daily_sheet=True)
    require(service.db.now() < min(cutoffs), "安排单已跨日锁定")


def candidates(service, work_date, planned_date=None):
    require(service.admin, "请从后台安排任务", 403)
    require("nonorder.view" in service.actor["permissions"], "没有查看权限", 403)
    plans = defaultdict(list)
    for item in service.db.rows("daily_item"):
        plans[item["assignment_id"]].append(item)
    started_ids = {r["assignment_id"] for r in service.db.rows("time_segment")}
    result = []
    for task in service.db.rows("task", status="active"):
        if not can_view_plan(service, task):
            continue
        for assignment in service.db.rows("assignment", task_id=task["id"]):
            if assignment["revoked_at"] or assignment["status"] not in PLANNABLE:
                continue
            division = service.db.get("division", assignment["division_id"])
            if division["status"] != "active":
                continue
            started = assignment["id"] in started_ids
            if planned_date and division["planned_date"] != planned_date and not started:
                continue
            items = plans[assignment["id"]]
            occupied = [r for r in items if r["work_date"] == work_date and not r["cancelled_at"] and (
                r["status"] == "published" or r["status"] == "draft" and r["plan_cutoff"] > service.now)]
            result.append({"source": "nonorder", "key": f"nonorder:{assignment['id']}", "task": task,
                "division": division, "assignment": assignment,
                "group": {"type": "station" if division["station_id"] else "leader", "id": division["station_id"] or task["responsible_staff_id"],
                          "name": division["station_name"] or task["responsible_name"]},
                "can_plan": can_plan(service, task), "can_edit_work": service.can_edit_sheet_work(task, division, assignment),
                "occupied": bool(occupied), "sheet_ids": [r["sheet_id"] for r in occupied], "started": started,
                "arranged_dates": sorted({r["work_date"].isoformat() for r in items if r["status"] == "published" and not r["cancelled_at"]})})
    return plain(result)
