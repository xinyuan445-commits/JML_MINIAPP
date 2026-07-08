import hmac
import os

from flask import Blueprint, jsonify, request

from models.db2 import get_db2
from services.dingtalk_sync import DingTalkSyncError, latest_sync, sync_contacts


dingtalk_bp = Blueprint("dingtalk", __name__)
VISIBLE_ROOT_DEPT_IDS = {661823215, 594600049}


def _authorized():
    expected = os.getenv("DINGTALK_SYNC_TOKEN", "").strip()
    provided = request.headers.get("X-Sync-Token", "").strip()
    return bool(expected) and hmac.compare_digest(expected, provided)


def _visible_dept_ids(cur):
    cur.execute("""SELECT dept_id,parent_dept_id FROM ding_department_yx
                   WHERE is_active=1""")
    departments = cur.fetchall()
    visible = set(VISIBLE_ROOT_DEPT_IDS)
    changed = True
    while changed:
        changed = False
        for item in departments:
            dept_id = int(item["dept_id"])
            parent_id = item["parent_dept_id"]
            if parent_id is not None and int(parent_id) in visible and dept_id not in visible:
                visible.add(dept_id)
                changed = True
    visible.add(1)
    return visible


@dingtalk_bp.post("/sync")
def manual_sync():
    if not _authorized():
        return jsonify({"code": 1, "msg": "无权执行同步"}), 403
    try:
        return jsonify({"code": 0, "data": sync_contacts("manual")})
    except DingTalkSyncError as exc:
        return jsonify({"code": 1, "msg": str(exc)}), 409
    except Exception:
        return jsonify({"code": 1, "msg": "同步失败，请查看服务日志"}), 500


@dingtalk_bp.get("/sync-status")
def sync_status():
    if not _authorized():
        return jsonify({"code": 1, "msg": "无权查看同步状态"}), 403
    return jsonify({"code": 0, "data": latest_sync()})


@dingtalk_bp.get("/departments")
def departments():
    conn = get_db2()
    try:
        cur = conn.cursor(dictionary=True)
        visible = _visible_dept_ids(cur)
        placeholders = ",".join(["%s"] * len(visible))
        cur.execute(
            f"""SELECT dept_id,parent_dept_id,dept_name,dept_level,dept_path
               FROM ding_department_yx
               WHERE is_active=1 AND dept_id IN ({placeholders})
               ORDER BY dept_path""",
            tuple(visible),
        )
        rows = cur.fetchall()
        cur.close()
        return jsonify({"code": 0, "data": rows})
    except Exception:
        return jsonify({"code": 1, "msg": "部门加载失败", "data": []}), 500
    finally:
        conn.close()


@dingtalk_bp.get("/workers")
def workers():
    conn = get_db2()
    try:
        cur = conn.cursor(dictionary=True)
        visible = _visible_dept_ids(cur) - {1}
        placeholders = ",".join(["%s"] * len(visible))
        cur.execute(
            f"""SELECT u.user_id,u.user_name,u.main_dept_id,
                      d.dept_path AS main_dept_path,
                      GROUP_CONCAT(ud.dept_id ORDER BY ud.dept_id SEPARATOR ',') AS dept_ids
               FROM ding_user_yx u
               LEFT JOIN ding_department_yx d ON d.dept_id=u.main_dept_id
               LEFT JOIN ding_user_department_yx ud ON ud.user_id=u.user_id
               WHERE u.is_active=1 AND EXISTS (
                 SELECT 1 FROM ding_user_department_yx scope
                 WHERE scope.user_id=u.user_id AND scope.dept_id IN ({placeholders})
               )
               GROUP BY u.user_id,u.user_name,u.main_dept_id,d.dept_path
               ORDER BY d.dept_path,u.user_name""",
            tuple(visible),
        )
        rows = cur.fetchall()
        cur.close()
        for row in rows:
            row["dept_ids"] = [
                int(value) for value in (row["dept_ids"] or "").split(",") if value
            ]
            row["avatar_text"] = row["user_name"][:1]
        return jsonify({"code": 0, "data": rows})
    except Exception:
        return jsonify({"code": 1, "msg": "人员加载失败", "data": []}), 500
    finally:
        conn.close()
