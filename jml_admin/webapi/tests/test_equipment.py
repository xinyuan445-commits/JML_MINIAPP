"""Local SQL integration using an in-memory database; never reads production config."""
import json
import re
import sqlite3
from pathlib import Path

import pytest
from flask import Flask, g

from config_approvals import config_approval_blueprint
from equipment import conversion, equipment_blueprint, normalize, select_standard
from admin_permissions import ALL_PERMISSIONS, normalize_permissions, page_request_enabled, permits


class Database:
    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.create_function("NOW", 0, lambda: "2026-10-22 12:00:00")
        self.fail_audit = False
        self.commits = self.rollbacks = 0
        self.queries = []
        schema = Path(__file__).parents[1].joinpath("equipment.sql").read_text(encoding="utf-8")
        schema = re.sub(r"--[^\n]*", "", schema)
        schema = schema.replace("COLLATE utf8mb4_bin", "COLLATE BINARY")
        schema = schema.replace("BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        schema = schema.replace(" ON UPDATE CURRENT_TIMESTAMP", "")
        schema = re.sub(r"UNIQUE KEY \w+", "UNIQUE", schema)
        schema = re.sub(r",\s*INDEX \w+ \([^)]+\)", "", schema)
        schema = schema.replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", "")
        self.connection.executescript(schema)
        self.connection.executescript("""
            CREATE TABLE jml_device(id TEXT PRIMARY KEY,name TEXT,enable TEXT,brand TEXT,password TEXT);
            INSERT INTO jml_device VALUES ('d1','裁切机01','1','原品牌','must-not-leave-source');
            INSERT INTO jml_device VALUES ('d2','裁切机02','1',NULL,'must-not-leave-source');
            INSERT INTO jml_device VALUES ('d3','停用设备','0',NULL,NULL);
            CREATE TABLE mo_workstation_yx(id INTEGER PRIMARY KEY,station_code TEXT,station_name TEXT,is_active INT);
            INSERT INTO mo_workstation_yx VALUES (1,'W1','一号工站',1),(2,'W2','二号工站',1),(3,'W3','停用工站',0);
            CREATE TABLE mo_process_yx(id INTEGER PRIMARY KEY,process_name TEXT,is_active INT);
            INSERT INTO mo_process_yx VALUES (1,'裁切',1),(2,'包装',1);
            CREATE TABLE mo_route_step_yx(id INTEGER PRIMARY KEY,process_id INT);
            INSERT INTO mo_route_step_yx VALUES (1,1),(2,2);
            CREATE TABLE mo_step_station_yx(step_id INT,station_id INT);
            INSERT INTO mo_step_station_yx VALUES (1,1),(1,2),(2,2);
            CREATE TABLE bj_product_cost_yx(code TEXT PRIMARY KEY,name TEXT,unit TEXT,is_enabled INT);
            INSERT INTO bj_product_cost_yx VALUES ('01','厚料','件',1),('02','停用类别','套',0);
            CREATE TABLE mo_config_approval_yx(id INTEGER PRIMARY KEY AUTOINCREMENT,request_no TEXT,
                module_type TEXT,action_type TEXT,target_key TEXT,pending_key TEXT UNIQUE,before_data TEXT,after_data TEXT,
                status TEXT DEFAULT 'pending',revision INT DEFAULT 1,applicant_seen INT DEFAULT 0,
                applicant_account_id INT,applicant_name TEXT,reviewer_account_id INT,reviewer_name TEXT,
                review_comment TEXT,review_time TEXT,apply_time TEXT DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE mo_admin_audit_log_yx(username TEXT,action_name TEXT,request_method TEXT,request_path TEXT,
                target_id TEXT,request_data TEXT,result_code INT,result_message TEXT,ip_address TEXT);
            CREATE TABLE jml_device_repair(id TEXT,marker TEXT);
            INSERT INTO jml_device_repair VALUES ('old','unchanged');
        """)

    def cursor(self, dictionary=False):
        return Cursor(self)

    def commit(self):
        self.connection.commit()
        self.commits += 1

    def rollback(self):
        self.connection.rollback()
        self.rollbacks += 1

    def close(self):
        pass

    def rows(self, table):
        return [dict(row) for row in self.connection.execute(f"SELECT * FROM {table}")]


class Cursor:
    def __init__(self, database):
        self.database = database
        self.cursor = database.connection.cursor()

    def execute(self, query, params=()):
        self.database.queries.append(query)
        if self.database.fail_audit and "INSERT INTO mo_admin_audit_log_yx" in query:
            raise RuntimeError("synthetic audit failure")
        self.cursor.execute(query.replace(" FOR UPDATE", "").replace("%s", "?"), params)

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def fetchall(self):
        return [dict(row) for row in self.cursor.fetchall()]

    def close(self):
        self.cursor.close()


@pytest.fixture
def environment():
    db = Database()
    app = Flask(__name__)
    app.config.update(TESTING=True, ACTOR=1, PERMISSIONS=set(ALL_PERMISSIONS), DISABLED=set())

    @app.before_request
    def actor():
        g.admin_account = {"id": app.config["ACTOR"]}
        g.admin_display_name = g.audit_username = f"用户{g.admin_account['id']}"
        g.admin_permissions = app.config["PERMISSIONS"]
        g.disabled_pages = app.config["DISABLED"]
        from flask import jsonify, request
        if not permits(g.admin_permissions, request.path, request.method):
            return jsonify(code=403), 403
        if not page_request_enabled(g.disabled_pages, request.path, request.method, request.get_json(silent=True)):
            return jsonify(code=403), 403

    app.register_blueprint(equipment_blueprint(lambda: db))
    app.register_blueprint(config_approval_blueprint(lambda: db, lambda *_: 0, lambda *_: None, lambda *_: ""))
    return app, app.test_client(), db


def archive(**overrides):
    return {"device_id": "d1", "device_code": "EQ-W1", "device_name": "一号工站", "new_device": overrides.get("profile_revision", 0) == 0,
            "station_id": 1, "device_type": "裁切机", "profile_revision": 0, "revision": 1, **overrides}


def standard(**overrides):
    return {"device_id": "d1", "process_id": 1, "category_code": "", "capacity_mode": "finite",
            "quantity": "400", "unit": "件", "period": "day", "effective_hours": "8",
            "basis": "measured", "revision": 1, **overrides}


def submit(client, module, payload, action="create"):
    response = client.post("/api/admin/config-approvals/submit", json={"module_type": module, "action_type": action, "payload": payload})
    assert response.status_code == 200, response.json
    return response.json["data"]["id"]


def review(client, approval_id, revision=1):
    return client.post("/api/admin/config-approvals/review", json={"id": approval_id, "revision": revision, "decision": "approve"})


def create_archive(client, **overrides):
    assert review(client, submit(client, "equipment", archive(**overrides))).status_code == 200


def create_standard(client, **overrides):
    response = review(client, submit(client, "equipment-capacity", standard(**overrides)))
    assert response.status_code == 200, response.json


def test_archive_only_effective_after_approval_and_legacy_devices_unused(environment):
    _, client, db = environment
    originals = db.rows("jml_device")
    request_id = submit(client, "equipment", archive(brand="client must not override"))
    assert json.loads(db.rows("mo_config_approval_yx")[0]["after_data"])["brand"] == "client must not override"
    assert db.rows("mo_equipment_yx") == []
    pending = client.get("/api/mo/equipment/list").json["data"][0]
    assert pending["approval_status"] == "pending" and pending["id"] < 0
    assert pending["device_name"] == "一号工站"
    assert review(client, request_id).status_code == 200
    assert db.rows("mo_equipment_device_yx")[0]["brand"] == "client must not override"
    assert db.rows("jml_device") == originals
    assert db.rows("jml_device_repair") == [{"id": "old", "marker": "unchanged"}]
    assert len(db.rows("mo_equipment_history_yx")) == 1
    options = client.get("/api/mo/equipment/options").json["data"]
    assert len(options["devices"]) == 1
    assert options["devices"][0]["name"] == "一号工站"
    assert {"张", "面", "片", "个"} <= set(options["units"])
    assert not any("jml_device" in query for query in db.queries)
    assert "password" not in json.dumps(options)


@pytest.mark.parametrize("values", [archive(station_id=3), archive(device_id="missing", new_device=False)])
def test_inactive_or_missing_source_rejected_at_approval(environment, values):
    _, client, db = environment
    if values["device_id"] == "missing":
        response = client.post("/api/admin/config-approvals/submit", json={"module_type": "equipment", "action_type": "create", "payload": values})
        assert response.status_code == 400
    else:
        assert review(client, submit(client, "equipment", values)).status_code == 400
    assert db.rows("mo_equipment_yx") == []


def test_second_equipment_or_station_binding_rejected(environment):
    _, client, db = environment
    # Both requests exist before approval; second approval rechecks actual occupancy.
    one = submit(client, "equipment", archive())
    two = submit(client, "equipment", archive(station_id=2))
    assert review(client, one).status_code == 200
    assert review(client, two).status_code == 400
    assert len(db.rows("mo_equipment_yx")) == 1


def test_device_replacement_keeps_old_profile_capacity_and_history(environment):
    _, client, db = environment
    create_archive(client)
    create_standard(client)
    request_id = submit(client, "equipment", archive(id=1, device_id="d2", device_code="EQ-W2", device_type="新设备类型"), "edit")
    assert review(client, request_id).status_code == 200
    assert db.rows("mo_equipment_yx")[0]["device_id"] == "d2"
    assert {r["device_id"] for r in db.rows("mo_equipment_device_yx")} == {"d1", "d2"}
    assert db.rows("mo_equipment_capacity_yx")[0]["device_id"] == "d1"
    detail = client.get("/api/mo/equipment/detail?id=1").json["data"]
    assert detail["standards"] == []
    assert len(detail["history"]) == 2


def test_category_specific_and_general_standard_selection(environment):
    _, client, _ = environment
    create_archive(client)
    create_standard(client)
    create_standard(client, category_code="01", quantity="240")
    query = "/api/mo/equipment/calculate?equipment_id=1&process_id=1&quantity=100&unit=件"
    result = client.get(query).json["data"]
    assert result["hourly"] == "50" and result["target_minutes"] == "120"
    result = client.get(query + "&category_code=01").json["data"]
    assert result["hourly"] == "30" and result["target_minutes"] == "200"
    request_id = submit(client, "equipment-capacity", {"id": 2, "revision": 1, "is_active": 0}, "status")
    assert review(client, request_id).status_code == 200
    assert client.get(query + "&category_code=01").json["data"]["hourly"] == "50"
    duplicate = submit(client, "equipment-capacity", standard())
    assert review(client, duplicate).status_code == 400


def test_unlimited_transition_clears_numbers_and_keeps_revisions(environment):
    _, client, db = environment
    create_archive(client)
    create_standard(client)
    request_id = submit(client, "equipment-capacity", standard(id=1, capacity_mode="unlimited"), "edit")
    assert review(client, request_id).status_code == 200
    current = db.rows("mo_equipment_capacity_yx")[0]
    assert current["quantity"] is current["period"] is current["effective_hours"] is None
    assert conversion(current, "100", "件")["target_minutes"] is None
    histories = db.rows("mo_equipment_history_yx")
    assert json.loads(histories[-1]["before_data"])["quantity"] == 400
    # Returning to finite mode does not recover quantities hidden in history.
    invalid = standard(id=1, quantity=None)
    response = client.post("/api/admin/config-approvals/submit", json={"module_type": "equipment-capacity", "action_type": "edit", "payload": invalid})
    assert response.status_code == 400


def test_stale_formal_revision_and_stale_application_rejected(environment):
    _, client, db = environment
    create_archive(client)
    request_id = submit(client, "equipment", archive(id=1, profile_revision=1), "edit")
    db.connection.execute("UPDATE mo_equipment_device_yx SET revision=2 WHERE device_id='d1'")
    db.connection.commit()
    assert review(client, request_id).status_code == 400
    response = client.post("/api/admin/config-approvals/update", json={"id": request_id, "revision": 1, "payload": archive(id=1, profile_revision=2)})
    assert response.status_code == 200
    assert review(client, request_id).status_code == 400
    assert review(client, request_id, 2).status_code == 200


def test_audit_failure_rolls_back_archive_approval_and_history(environment):
    _, client, db = environment
    request_id = submit(client, "equipment", archive())
    db.fail_audit = True
    assert review(client, request_id).status_code == 503
    assert db.rows("mo_equipment_yx") == []
    assert db.rows("mo_equipment_device_yx") == []
    assert db.rows("mo_equipment_history_yx") == []
    assert db.rows("mo_config_approval_yx")[0]["status"] == "pending"
    assert db.rollbacks > 0


def test_permissions_page_switch_and_owner_checks(environment):
    app, client, _ = environment
    request_id = submit(client, "equipment", archive())
    app.config["ACTOR"] = 2
    assert client.get(f"/api/mo/equipment/approval?id={request_id}").status_code == 400
    app.config["ACTOR"] = 1
    app.config["PERMISSIONS"] = {"equipment.view"}
    assert client.post("/api/admin/config-approvals/submit", json={}).status_code == 403
    assert client.get("/api/mo/equipment/preview").status_code == 403
    app.config["PERMISSIONS"] = set(ALL_PERMISSIONS)
    app.config["DISABLED"] = {"equipment"}
    assert client.get("/api/mo/equipment/options").status_code == 403
    assert review(client, request_id).status_code == 400
    assert {"equipment.view", "equipment-capacity.view", "approval.mine"} <= set(normalize_permissions(["equipment-capacity.edit"]))


@pytest.mark.parametrize("overrides, hourly, minutes", [
    ({}, "50", "120"), ({"effective_hours": "10"}, "40", "150"),
    ({"period": "shift"}, "50", "120"),
    ({"period": "hour", "quantity": "120"}, "120", "50"),
    ({"period": "minute", "quantity": "2"}, "120", "50"),
])
def test_time_conversion_examples(overrides, hourly, minutes):
    result = conversion(normalize("equipment-capacity", "create", standard(**overrides)), "100", "件")
    assert result["hourly"] == hourly and result["target_minutes"] == minutes


@pytest.mark.parametrize("overrides", [
    {"quantity": "0"}, {"quantity": "-1"}, {"quantity": "NaN"}, {"quantity": "Infinity"},
    {"quantity": "0.123456789"}, {"effective_hours": None}, {"effective_hours": "0"},
    {"effective_hours": "24.01"}, {"effective_hours": "-1"}, {"period": "week"},
    {"unit": ""}, {"staffing": 0}, {"staffing": 1.2}, {"setup_minutes": "-1"},
])
def test_invalid_standards_rejected(overrides):
    with pytest.raises(ValueError):
        normalize("equipment-capacity", "create", standard(**overrides))


def test_unknown_unlimited_incomplete_and_precision_are_distinct():
    assert conversion(None)["state"] == "unconfigured"
    assert conversion(standard(quantity=None))["state"] == "incomplete"
    assert conversion(standard(capacity_mode="unlimited"))["target_minutes"] is None
    exact = conversion(standard(quantity="3"), "3", "件")
    assert exact["target_minutes"] == "480"
    tiny = conversion(standard(quantity="999999999999"))["unit_minutes"]
    assert 0 < float(tiny) < 0.0001
    with pytest.raises(ValueError, match="单位"):
        conversion(standard(), "100", "套")


def test_sql_unique_constraint_independently_guards_active_standards(environment):
    _, client, db = environment
    create_archive(client)
    create_standard(client)
    with pytest.raises(sqlite3.IntegrityError):
        db.connection.execute("""INSERT INTO mo_equipment_capacity_yx
            (device_id,process_id,category_code,capacity_mode,basis,quantity,unit,period,effective_hours)
            VALUES ('d1',1,'','finite','measured',400,'件','day',8)""")
    db.connection.rollback()


def test_wrong_station_process_and_inactive_category_rejected(environment):
    _, client, db = environment
    create_archive(client)
    for values in (standard(process_id=2), standard(category_code="02")):
        assert review(client, submit(client, "equipment-capacity", values)).status_code == 400
    assert db.rows("mo_equipment_capacity_yx") == []


def test_archives_do_not_grant_capacity_details_and_source_errors_are_visible(environment):
    app, client, db = environment
    create_archive(client)
    create_standard(client)
    app.config["PERMISSIONS"] = {"equipment.view"}
    detail = client.get("/api/mo/equipment/detail?id=1").json["data"]
    assert detail["standards"] == []
    assert all(row["module_type"] == "equipment" for row in detail["history"])
    db.connection.execute("DROP TABLE jml_device")
    assert client.get("/api/mo/equipment/options").status_code == 200
    db.connection.execute("DROP TABLE mo_equipment_device_yx")
    response = client.get("/api/mo/equipment/options")
    assert response.status_code == 503
    assert response.json["code"] == 503
    assert "data" not in response.json


def test_preview_is_decimal_and_does_not_write_business_data(environment):
    _, client, db = environment
    before_commits = db.commits
    result = client.get("/api/mo/equipment/preview?capacity_mode=finite&quantity=400&unit=件&period=day&effective_hours=8&target_quantity=100")
    assert result.json["data"]["hourly"] == "50"
    assert result.json["data"]["target_minutes"] == "120"
    assert db.commits == before_commits
    assert db.rows("mo_equipment_yx") == []


def test_photos_are_validated_and_only_kept_in_authorized_records():
    import base64
    photo = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'test').decode()
    assert normalize("equipment", "create", archive(photo=photo))["photo"] == photo
    for value in ('https://example.invalid/photo.png', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,not base64'):
        with pytest.raises(ValueError):
            normalize("equipment", "create", archive(photo=value))


@pytest.mark.parametrize("module, action", [("equipment", "edit"), ("equipment-capacity", "edit"), ("equipment-capacity", "status")])
def test_old_page_revision_cannot_submit_over_new_formal_data(environment, module, action):
    _, client, db = environment
    create_archive(client)
    create_standard(client)
    table = "mo_equipment_yx" if module == "equipment" else "mo_equipment_capacity_yx"
    db.connection.execute(f"UPDATE {table} SET revision=2 WHERE id=1")
    db.connection.commit()
    payload = archive(id=1, profile_revision=1) if module == "equipment" else standard(id=1)
    if action == "status":
        payload = {"id": 1, "revision": 1, "is_active": 0}
    response = client.post("/api/admin/config-approvals/submit", json={"module_type": module, "action_type": action, "payload": payload})
    assert response.status_code == 400
    assert "正式资料已变更" in response.json["msg"]
    assert len(db.rows("mo_config_approval_yx")) == 2


def test_station_bootstrap_is_independent_named_and_idempotent(environment):
    from init_equipment import initialize_from_stations
    _, client, db = environment
    originals = db.rows("jml_device")
    stations = db.rows("mo_workstation_yx")
    assert initialize_from_stations(db) == 3
    assert initialize_from_stations(db) == 0
    options = client.get("/api/mo/equipment/options").json["data"]
    assert {r["name"] for r in options["devices"]} == {r["station_name"] for r in stations}
    assert {r["device_code"] for r in options["devices"]} == {"EQ-W1", "EQ-W2", "EQ-W3"}
    assert len(db.rows("mo_equipment_history_yx")) == 3
    assert len(db.rows("mo_equipment_yx")) == 3
    assert db.rows("mo_equipment_capacity_yx") == []
    assert db.rows("jml_device") == originals and db.rows("mo_workstation_yx") == stations
    assert next(r for r in options["devices"] if r["name"] == "停用工站")["enable"] == 0
    assert not any("jml_device" in query for query in db.queries)


def test_manual_device_id_is_stable_and_renaming_preserves_history(environment):
    _, client, db = environment
    values = archive(device_id=None)
    request_id = submit(client, "equipment", values)
    generated = json.loads(db.rows("mo_config_approval_yx")[0]["after_data"])["device_id"]
    assert generated and generated != "d1"
    assert review(client, request_id).status_code == 200
    assert db.rows("mo_equipment_device_yx")[0]["device_id"] == generated
    edit = archive(id=1, device_id=generated, profile_revision=1, device_name="设备新名称")
    assert review(client, submit(client, "equipment", edit, "edit")).status_code == 200
    history = db.rows("mo_equipment_history_yx")[-1]
    assert json.loads(history["before_data"])["device_name"] == "一号工站"
    assert json.loads(history["after_data"])["device_name"] == "设备新名称"


def test_duplicate_device_code_is_rejected_and_disabled_device_blocks_capacity(environment):
    _, client, db = environment
    create_archive(client, device_enabled=0)
    assert review(client, submit(client, "equipment-capacity", standard())).status_code == 400
    duplicate = submit(client, "equipment", archive(device_id="d2", station_id=2))
    assert review(client, duplicate).status_code == 400
    assert len(db.rows("mo_equipment_device_yx")) == 1


def test_same_name_process_and_station_can_define_capacity_before_route_assignment(environment):
    from init_equipment import initialize_from_stations
    _, client, db = environment
    db.connection.execute("INSERT INTO mo_process_yx VALUES (4,'CNC',1)")
    db.connection.execute("INSERT INTO mo_workstation_yx VALUES (4,'WS-CNC','CNC',1)")
    db.connection.commit()
    assert initialize_from_stations(db) == 4
    device_id = db.connection.execute(
        "SELECT device_id FROM mo_equipment_yx WHERE station_id=4"
    ).fetchone()[0]
    options = client.get("/api/mo/equipment/options").json["data"]
    assert {"id": 4, "process_name": "CNC", "station_id": 4} in options["processes"]
    request_id = submit(client, "equipment-capacity", standard(
        device_id=device_id, process_id=4, capacity_mode="unlimited"
    ))
    assert review(client, request_id).status_code == 200
    assert db.rows("mo_equipment_capacity_yx")[0]["capacity_mode"] == "unlimited"
