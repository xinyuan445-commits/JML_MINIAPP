"""Reporting authorization controlled by the shared admin database switch."""
from flask import Blueprint, current_app, g, jsonify, request
from routes import mo
from services import mo_station_access as access

mo_station_v2_bp = Blueprint("mo_station_v2", __name__)
ACTIONS = {
    "start": "start_work", "receive-first": "receive_first_step_materials",
    "receive": "receive_handover", "complete": "complete_work",
    "receive-work/start": "start_receive_work", "receive-work/complete": "complete_receive_work",
    "rework/start": "start_rework", "rework/complete": "complete_rework",
    "complete-combined": "complete_combined",
    "makeup": "makeup_work",
}


@mo.mo_bp.before_request
def guard_legacy_writes():
    action = request.path.removeprefix("/api/mo/")
    if request.method == "POST" and action in ACTIONS:
        return submit(action, legacy=True)


def run(work, commit=False):
    conn = cur = None
    try:
        conn = access.database()
        conn.start_transaction()
        cur = conn.cursor(dictionary=True)
        result = work(cur, conn)
        if commit:
            conn.commit()
        else:
            conn.rollback()
        return result
    except access.AccessError as error:
        if conn:
            conn.rollback()
        return jsonify({"code": error.status, "msg": str(error)}), error.status
    except Exception:
        if conn:
            conn.rollback()
        # Driver/HTTP exception strings may contain credentials. Never echo them.
        current_app.logger.warning("mo_station_v2 request failed: %s", request.endpoint)
        return jsonify({"code": 503, "msg": "工站服务暂不可用，请稍后重试"}), 503
    finally:
        g.pop("mo_station_connection", None)
        if cur:
            cur.close()
        if conn:
            conn.close()


def require_enabled(cur):
    if not access.setting(cur)["enabled"]:
        raise access.AccessError(409, "工站权限已关闭，请刷新页面")


@mo_station_v2_bp.get("/settings")
def settings():
    response = current_app.make_response(run(lambda cur, _conn: jsonify({"code": 0, "data": access.setting(cur)})))
    response.headers["Cache-Control"] = "no-store"
    return response


@mo_station_v2_bp.get("/context")
def context():
    def work(cur, _conn):
        require_enabled(cur)
        person = access.staff_from_cache(cur, request.headers.get("staff-id"))
        policy = access.policy(cur, person["id"])
        resolved = access.targets(cur, "context", request.args.to_dict(), mo._find_route)
        available = access.choices(cur, resolved[0], policy)
        return jsonify({"code": 0, "data": {
            "staff_id": person["id"], "can_operate": bool(available),
            "enforcement_enabled": bool(policy["scope"]),
            "stations": [{"id": station, "name": policy["stations"][station]} for station in available],
            "is_exempt": policy["exempt"],
        }})
    return run(work)


@mo_station_v2_bp.post("/<path:action>")
def submit(action, legacy=False):
    if action not in ACTIONS:
        return jsonify({"code": 404, "msg": "操作不存在"}), 404

    def work(cur, conn):
        enabled = access.setting(cur)["enabled"]
        if not enabled:
            if not legacy:
                raise access.AccessError(409, "工站权限已关闭，请刷新页面")
            deferred = access.DeferredConnection(conn)
            g.mo_station_connection = deferred
            response = current_app.make_response(getattr(mo, ACTIONS[action])())
            payload = response.get_json(silent=True) or {}
            if response.status_code >= 400 or payload.get("code") != 0 or not deferred.committed or deferred.rolled_back:
                conn.rollback()
            return response
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise access.AccessError(400, "请求参数无效")
        person = access.staff_from_cache(cur, request.headers.get("staff-id") or body.get("user_id"))
        if body.get("user_id") not in (None, "", person["id"]):
            raise access.AccessError(403, "登录人员已变化，请刷新页面")
        body["user_id"] = person["id"]
        policy = access.policy(cur, person["id"])
        resolved = access.targets(cur, action, body, mo._find_route)
        station = access.authorize(cur, resolved, body, policy)
        body["station_id"] = station
        deferred = access.DeferredConnection(conn)
        g.mo_station_connection = deferred
        response = current_app.make_response(getattr(mo, ACTIONS[action])())
        payload = response.get_json(silent=True) or {}
        if response.status_code >= 400 or payload.get("code") != 0 or deferred.rolled_back:
            conn.rollback()
            # Do not return raw exceptions echoed by legacy handlers on the new path.
            if deferred.rolled_back:
                raise access.AccessError(503, "报工未完成，请核对记录后重试")
            return response
        if not deferred.committed:
            raise access.AccessError(503, "报工未提交，请核对记录")
        if action in ("receive-first", "receive"):
            identifier = (payload.get("data") or {}).get("handover_id") if action == "receive-first" else body["handover_id"]
            cur.execute("""INSERT INTO mo_station_receive_binding_yx (handover_id,station_id,staff_id)
                VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE station_id=VALUES(station_id),staff_id=VALUES(staff_id)""",
                (access.positive_id(identifier), station, person["id"]))
        return response
    return run(work, commit=True)
