"""Station staffing and centrally managed reporting authorization switch."""
import json

from flask import g, request


def scanner_ids(value):
    return json.loads(value) if isinstance(value, str) else value


def staff_id(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 64 or any(ord(c) < 32 for c in value):
        raise ValueError("请选择有效的员工")
    return value.strip()


def register_station_permissions(bp, transaction, audit):
    def global_admin_only():
        if getattr(g, "audit_username", "") == "admin":
            return None
        return {"code": 403, "msg": "仅 admin 账号可查看或修改全局工站权限设置"}, 403

    def setting(cur, lock=False):
        cur.execute("SELECT enabled,report_access_mode,revision FROM mo_station_access_setting_yx WHERE id=1" + (" FOR UPDATE" if lock else ""))
        row = cur.fetchone()
        if not row:
            raise ValueError("请先初始化工站权限设置")
        return {"enforcement_enabled": bool(row["enabled"]),
            "report_access_mode": row["report_access_mode"], "setting_revision": row["revision"]}

    @bp.post("/api/admin/station-permissions/settings/save")
    def station_permissions_setting_save():
        denied = global_admin_only()
        if denied:
            return denied

        def work(cur):
            body = request.get_json()
            if (not isinstance(body, dict) or set(body) not in ({"enabled", "revision"},
                    {"enabled", "report_access_mode", "revision"})
                    or type(body["enabled"]) is not bool or type(body["revision"]) is not int):
                raise ValueError("开关参数无效")
            before = setting(cur, lock=True)
            if body["revision"] != before["setting_revision"]:
                raise ValueError("设置已变化，请刷新后重试")
            report_access_mode = body.get("report_access_mode", before["report_access_mode"])
            if report_access_mode not in ("exempt", "station", "all"):
                raise ValueError("报表开放范围无效")
            if body["enabled"]:
                # Validate schema readiness without changing bindings or employee accounts.
                cur.execute("SELECT handover_id FROM mo_station_receive_binding_yx LIMIT 0")
                cur.fetchall()
                cur.execute("SELECT station_id FROM mo_station_staff_config_yx LIMIT 0")
                cur.fetchall()
                cur.execute("SELECT id FROM mo_station_staff_exemption_yx LIMIT 0")
                cur.fetchall()
            revision = body["revision"] + 1
            cur.execute("""UPDATE mo_station_access_setting_yx
                SET enabled=%s,report_access_mode=%s,revision=%s,updated_by=%s WHERE id=1""",
                (int(body["enabled"]), report_access_mode, revision, g.audit_username))
            if body["enabled"] != before["enforcement_enabled"]:
                action = "开启工站权限" if body["enabled"] else "关闭工站权限"
            else:
                action = "设置小程序报表开放范围"
            audit(cur, action, 1, {"before": {
                "enforcement_enabled": before["enforcement_enabled"],
                "report_access_mode": before["report_access_mode"],
            }, "after": {
                "enforcement_enabled": body["enabled"],
                "report_access_mode": report_access_mode,
            }})
            return {"id": 1, "enforcement_enabled": body["enabled"],
                "report_access_mode": report_access_mode, "setting_revision": revision}
        return transaction(work)

    @bp.get("/api/admin/station-permissions")
    def station_permissions_list():
        def work(cur):
            cur.execute("""SELECT w.id,w.station_code,w.station_name,w.is_active,
                c.leader_staff_id,c.scanner_staff_ids,c.revision,c.updated_by,c.update_time
                FROM mo_workstation_yx w LEFT JOIN mo_station_staff_config_yx c ON c.station_id=w.id
                ORDER BY w.id""")
            rows = cur.fetchall()
            identifiers = set()
            for row in rows:
                row["scanner_staff_ids"] = scanner_ids(row["scanner_staff_ids"]) or []
                identifiers.update(row["scanner_staff_ids"])
                if row["leader_staff_id"]:
                    identifiers.add(row["leader_staff_id"])
            people = {}
            if identifiers:
                cur.execute("SELECT id,name,position,status FROM jml_staff WHERE id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ")", tuple(sorted(identifiers)))
                people = {person["id"]: person for person in cur.fetchall()}

            def person(identifier):
                return people.get(identifier, {"id": identifier, "name": "人员已不存在", "position": "", "status": "missing"})

            for row in rows:
                row["configured"] = row["revision"] is not None
                row["revision"] = row["revision"] or 0
                row["leader"] = person(row["leader_staff_id"]) if row["leader_staff_id"] else None
                row["scanners"] = [person(identifier) for identifier in row["scanner_staff_ids"]]
                row["update_time"] = str(row["update_time"]) if row["update_time"] else None
            result = {"stations": rows}
            if getattr(g, "audit_username", "") == "admin":
                result.update(setting(cur))
            return result
        return transaction(work)

    @bp.get("/api/admin/station-permissions/staff")
    def station_permissions_staff():
        def work(cur):
            cur.execute("SELECT id,name,position,status FROM jml_staff WHERE status='1' ORDER BY name,id")
            return cur.fetchall()
        return transaction(work)

    @bp.get("/api/admin/station-permissions/exemptions")
    def station_permissions_exemptions():
        denied = global_admin_only()
        if denied:
            return denied

        def work(cur):
            cur.execute("SELECT staff_ids,revision,updated_by,update_time FROM mo_station_staff_exemption_yx WHERE id=1")
            row = cur.fetchone()
            current_setting = {"enforcement_enabled": setting(cur)["enforcement_enabled"]}
            result = {"staff_ids": [], "staff": [], "revision": 0,
                "updated_by": None, "update_time": None, **current_setting}
            if not row:
                return result
            identifiers = scanner_ids(row["staff_ids"]) or []
            people = {}
            if identifiers:
                cur.execute("SELECT id,name,position,status FROM jml_staff WHERE id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ")", tuple(identifiers))
                people = {person["id"]: person for person in cur.fetchall()}
            result.update(staff_ids=identifiers, revision=row["revision"], updated_by=row["updated_by"],
                update_time=str(row["update_time"]) if row["update_time"] else None,
                staff=[people.get(identifier, {"id": identifier, "name": "人员已不存在",
                    "position": "", "status": "missing"}) for identifier in identifiers])
            return result
        return transaction(work)

    @bp.post("/api/admin/station-permissions/exemptions/save")
    def station_permissions_exemptions_save():
        denied = global_admin_only()
        if denied:
            return denied

        def work(cur):
            body = request.get_json()
            if set(body) - {"staff_ids", "revision"}:
                raise ValueError("人员配置参数无效")
            revision = body.get("revision")
            if type(revision) is not int or revision < 0:
                raise ValueError("配置版本无效，请刷新后再保存")
            identifiers = body.get("staff_ids")
            if not isinstance(identifiers, list) or len(identifiers) > 100:
                raise ValueError("豁免人员必须为人员列表，最多 100 人")
            identifiers = sorted({staff_id(value) for value in identifiers})
            cur.execute("SELECT staff_ids,revision FROM mo_station_staff_exemption_yx WHERE id=1 FOR UPDATE")
            before = cur.fetchone()
            if revision != (before["revision"] if before else 0):
                raise ValueError("这条配置已被修改，请刷新后重新编辑")
            if identifiers:
                cur.execute("SELECT id FROM jml_staff WHERE status='1' AND id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ") FOR UPDATE", tuple(identifiers))
                if {person["id"] for person in cur.fetchall()} != set(identifiers):
                    raise ValueError("选择的员工已停用或不存在，请刷新人员后重新选择")
            cur.execute("""INSERT INTO mo_station_staff_exemption_yx
                (id,staff_ids,revision,updated_by) VALUES (1,%s,%s,%s)
                ON DUPLICATE KEY UPDATE staff_ids=VALUES(staff_ids),revision=VALUES(revision),
                updated_by=VALUES(updated_by),update_time=CURRENT_TIMESTAMP""",
                (json.dumps(identifiers), revision + 1, g.audit_username))
            current_setting = {"enforcement_enabled": setting(cur)["enforcement_enabled"]}
            audit(cur, "保存工站豁免人员配置", 1, {
                "before": {"staff_ids": scanner_ids(before["staff_ids"])} if before else None,
                "after": {"staff_ids": identifiers}, **current_setting,
            })
            return {"id": 1, "revision": revision + 1, **current_setting}
        return transaction(work)

    @bp.post("/api/admin/station-permissions/save")
    def station_permissions_save():
        def work(cur):
            body = request.get_json()
            if set(body) - {"station_id", "leader_staff_id", "scanner_staff_ids", "revision"}:
                raise ValueError("人员配置参数无效")
            station = body.get("station_id")
            revision = body.get("revision")
            if type(station) is not int or station <= 0:
                raise ValueError("请选择有效的工站")
            if type(revision) is not int or revision < 0:
                raise ValueError("配置版本无效，请刷新后再保存")
            leader = body.get("leader_staff_id")
            leader = staff_id(leader) if leader is not None else None
            scanners = body.get("scanner_staff_ids")
            if not isinstance(scanners, list) or len(scanners) > 100:
                raise ValueError("扫码员工必须为人员列表，最多 100 人")
            scanners = sorted({staff_id(value) for value in scanners})
            cur.execute("SELECT id,station_name FROM mo_workstation_yx WHERE id=%s FOR UPDATE", (station,))
            station_row = cur.fetchone()
            if not station_row:
                raise ValueError("工站不存在，请刷新后重试")
            cur.execute("SELECT leader_staff_id,scanner_staff_ids,revision FROM mo_station_staff_config_yx WHERE station_id=%s", (station,))
            before = cur.fetchone()
            if revision != (before["revision"] if before else 0):
                raise ValueError("这条配置已被修改，请刷新后重新编辑")
            identifiers = sorted(set(scanners) | ({leader} if leader else set()))
            if identifiers:
                cur.execute("SELECT id FROM jml_staff WHERE status='1' AND id IN ("
                    + ",".join(["%s"] * len(identifiers)) + ")", tuple(identifiers))
                if {person["id"] for person in cur.fetchall()} != set(identifiers):
                    raise ValueError("选择的员工已停用或不存在，请刷新人员后重新选择")
            cur.execute("""INSERT INTO mo_station_staff_config_yx
                (station_id,leader_staff_id,scanner_staff_ids,revision,updated_by)
                VALUES (%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE leader_staff_id=VALUES(leader_staff_id),
                scanner_staff_ids=VALUES(scanner_staff_ids),revision=VALUES(revision),
                updated_by=VALUES(updated_by),update_time=CURRENT_TIMESTAMP""",
                (station, leader, json.dumps(scanners), revision + 1, g.audit_username))
            current_setting = {"enforcement_enabled": setting(cur)["enforcement_enabled"]}
            audit(cur, "保存工站人员配置", station, {
                "station_name": station_row["station_name"],
                "before": {"leader_staff_id": before["leader_staff_id"],
                    "scanner_staff_ids": scanner_ids(before["scanner_staff_ids"])} if before else None,
                "after": {"leader_staff_id": leader, "scanner_staff_ids": scanners},
                **current_setting,
            })
            return {"id": station, "revision": revision + 1, **current_setting}
        return transaction(work)
