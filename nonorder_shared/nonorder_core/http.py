"""Shared Flask adapter. Identity resolution remains local to each host service."""
import json
import os
from pathlib import Path
import uuid
from datetime import date

from flask import Blueprint, jsonify, request, send_file, current_app
from sqlalchemy.exc import IntegrityError

from .storage import transaction, RuleError, plain
from .service import Service, require, words
from .planning import candidates, can_plan, eligible
from .snapshots import calculate, visible_result, later_changes


def blueprint(database_engine, identity, name="nonorder", enabled=None):
    bp = Blueprint(name, __name__)
    prefix = "/api/nonorder"

    def ready():
        require((enabled() if enabled else os.getenv("NONORDER_ENABLED") == "1"), "无工单任务尚未启用", 503)

    def private_root():
        value = os.getenv("NONORDER_ATTACHMENT_DIR")
        require(value and Path(value).is_absolute(), "附件存储尚未配置", 503)
        return Path(value)

    def file_meta(key):
        require(len(key) == 32 and all(c in "0123456789abcdef" for c in key), "附件不存在", 404)
        path = private_root() / (key + ".json")
        require(path.is_file(), "附件不存在", 404)
        return json.loads(path.read_text(encoding="utf-8"))

    def run(work, write=False):
        try:
            ready()
            with transaction(database_engine(), write=write) as store:
                actor = identity(store)
                service = Service(store, actor)
                def file_check(key, task_id, staff):
                    meta = file_meta(key)
                    return meta["task_id"] == task_id and (meta["staff_id"] == staff or service.managing(store.get("task", task_id)))
                actor["file_check"] = file_check
                result = work(service)
            return jsonify({"code": 0, "success": True, "data": plain(result)})
        except RuleError as error:
            return jsonify({"code": error.status, "msg": str(error)}), error.status
        except (ValueError, TypeError, KeyError):
            return jsonify({"code": 400, "msg": "请求内容无效"}), 400
        except IntegrityError:
            return jsonify({"code": 409, "msg": "记录已变化或重复，请刷新后重试"}), 409
        except Exception:
            current_app.logger.exception("Nonorder operation failed")
            return jsonify({"code": 503, "msg": "任务服务暂不可用"}), 503

    @bp.get(prefix + "/context")
    def context():
        return run(lambda s: s.context())

    @bp.get(prefix + "/tasks")
    def tasks():
        return run(lambda s: s.list_tasks(request.args.get("tab", "mine"), request.args.get("assignment_id")))

    @bp.get(prefix + "/publish-options")
    def publish_options():
        return run(lambda s: s.admin_publish_options(request.args.get("responsible_staff_id")))

    @bp.get(prefix + "/sheet-work-people")
    def sheet_work_people():
        return run(lambda s: s.sheet_work_people(request.args.get("assignment_id")))

    @bp.get(prefix + "/detail")
    def detail():
        return run(lambda s: s.detail(request.args.get("id")))

    @bp.get(prefix + "/candidates")
    def task_candidates():
        return run(lambda s: candidates(s, date.fromisoformat(request.args["date"]),
            date.fromisoformat(request.args["planned_date"]) if request.args.get("planned_date") else None))

    @bp.get(prefix + "/daily-result")
    def daily_result():
        def work(s):
            require(s.admin and "nonorder.view" in s.actor["permissions"], "请从后台查询执行", 403)
            day = date.fromisoformat(request.args["date"])
            saved = s.db.rows("daily_result", work_date=day)
            baseline = saved[0]["result_data"] if saved else calculate(s.db, day)
            original = visible_result(s, baseline)
            locked = day < s.now.date()
            if not locked:
                for row in original["items"]:
                    if row["arrangement"] != "planned" and not row["activity_only"]:
                        assignment = s.db.get("assignment", row["assignment"]["id"])
                        task = s.db.get("task", assignment["task_id"])
                        division = s.db.get("division", assignment["division_id"])
                        row["can_supplement"] = bool(can_plan(s, task) and eligible(task, division, assignment))
            return {"frozen": bool(saved), "locked": locked, "original": original, "later_changes": later_changes(s, day)}
        return run(work)

    @bp.get(prefix + "/people")
    def people():
        def work(s):
            task = s.db.get("task", request.args.get("task_id"))
            if not (s.admin and "nonorder.transfer" in s.actor["permissions"]):
                s.owner(task)
            if request.args.get("purpose") == "reviewer":
                return s.reviewer_candidates(task)
            if request.args.get("purpose") == "delegate":
                return [{"id": str(p["id"]), "name": p["name"]} for p in s.db.external("SELECT id,name FROM jml_staff WHERE status=1")]
            if request.args.get("purpose") == "transfer":
                people = s.db.exemption_ids()
                people.update(str(row["leader_staff_id"]) for row in s.db.external("""SELECT c.leader_staff_id
                    FROM mo_station_staff_config_yx c JOIN mo_workstation_yx w ON w.id=c.station_id
                    WHERE w.is_active=1 AND c.leader_staff_id IS NOT NULL"""))
                return [{"id": identifier, "name": person["name"], "exempt": s.db.exempt(identifier),
                         "requires_reviewer": s.participated(task["id"], identifier),
                         "stations": [{"id": k, "name": v} for k, v in s.db.leader_stations(identifier).items()]}
                        for identifier, person in s.db.active_people(people).items() if identifier != task["responsible_staff_id"]]
            persons = s.db.external("SELECT id,name,status FROM jml_staff WHERE status=1")
            return [{"id": str(p["id"]), "name": p["name"], "exempt": s.db.exempt(str(p["id"])), "stations": [{"id": k, "name": v} for k, v in s.db.leader_stations(str(p["id"])).items()]} for p in persons]
        return run(work)

    @bp.post(prefix + "/command")
    def command():
        return run(lambda s: s.command(request.get_json(silent=True)), write=True)

    @bp.post(prefix + "/attachment")
    def upload():
        def work(s):
            task_id = int(request.form.get("task_id", "0"))
            task = s.db.get("task", task_id)
            require(s.visible(task), "无附件上传权限", 403)
            # Maximum independent of the host application's upload limits.
            file = request.files.get("file")
            require(file is not None, "请选择附件", 400)
            content = file.stream.read(10 * 1024 * 1024 + 1)
            require(0 < len(content) <= 10 * 1024 * 1024, "附件不能超过10MB", 400)
            mime = ("image/jpeg" if content.startswith(b"\xff\xd8\xff") else "image/png" if content.startswith(b"\x89PNG\r\n\x1a\n") else "application/pdf" if content.startswith(b"%PDF-") else None)
            require(mime is not None, "请选择JPG、PNG或PDF文件", 400)
            key = uuid.uuid4().hex
            meta = {"key": key, "task_id": task_id, "staff_id": s.staff, "name": words(request.form.get("display_name") or file.filename, "附件名称", limit=200), "type": mime}
            root = private_root()
            root.mkdir(parents=True, exist_ok=True)
            (root / (key + ".bin")).write_bytes(content)
            (root / (key + ".json")).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            return {k: meta[k] for k in ("key", "name", "type")}
        return run(work)

    @bp.get(prefix + "/attachment")
    def download():
        # Authorize before opening the private file; no public static URL or signed long-lived link.
        authorized = {}
        def work(s):
            key = request.args.get("key", "")
            meta = file_meta(key)
            detail = s.detail(meta["task_id"])
            refs = detail["task"]["attachments"] + [a for d in detail["division"] for a in d["attachments"]] + [a for r in detail["work_record"] for a in r["attachments"]]
            refs += [f for a in detail["assignment"] for f in a["requirement_snapshot"].get("attachments", [])]
            refs += [f for r in detail["work_record"] for f in r["requirement_snapshot"].get("attachments", [])]
            if s.managing(s.db.get("task", meta["task_id"])):
                for event in s.db.rows("event", task_id=meta["task_id"]):
                    snapshot = event["data"]["snapshot"]
                    refs += snapshot["task"]["attachments"] + [a for d in snapshot["division"] for a in d["attachments"]] + [a for r in snapshot["work_record"] for a in r["attachments"]]
            require(meta["staff_id"] == s.staff or key in {a["key"] for a in refs}, "无此附件权限", 403)
            authorized.update(meta)
            return True
        result = run(work)
        if not authorized:
            return result
        response = send_file(private_root() / (authorized["key"] + ".bin"), mimetype=authorized["type"],
                             as_attachment=True, download_name=authorized["name"], conditional=False, max_age=0)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    return bp
