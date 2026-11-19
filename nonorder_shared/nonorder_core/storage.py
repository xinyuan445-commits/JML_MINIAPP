import json
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta, date

from sqlalchemy import create_engine, select, text
from sqlalchemy.pool import NullPool
from .schema import TABLES


class RuleError(Exception):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status


def plain(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def engine_for(database):
    # Existing factories select the same business database; never import an app here.
    return create_engine("mysql+mysqlconnector://", creator=database, poolclass=NullPool)


@contextmanager
def transaction(engine, write=False):
    with engine.connect() as conn:
        locked = False
        try:
            if write and conn.dialect.name == "mysql":
                # One short lock for this module only, shared by both services and freezing.
                locked = conn.execute(text("SELECT GET_LOCK(CONCAT(DATABASE(), ':nonorder:v1'), 5)")).scalar() == 1
                if not locked:
                    raise RuleError("任务正在处理，请稍后重试")
            elif write and conn.dialect.name == "sqlite":
                conn.exec_driver_sql("BEGIN IMMEDIATE")
            store = Store(conn)
            yield store
            if write:
                store.stamp_events()
                conn.commit()
            else:
                conn.rollback()
        except Exception:
            conn.rollback()
            raise
        finally:
            if locked:
                conn.execute(text("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':nonorder:v1'))"))
                conn.commit()


class Store:
    def __init__(self, conn, clock=None):
        self.conn = conn
        self.clock = clock
        self.event_ids = []

    def now(self):
        if self.clock:
            return self.clock()
        if self.conn.dialect.name == "mysql":
            return self.conn.execute(text("SELECT UTC_TIMESTAMP(6) + INTERVAL 8 HOUR")).scalar()
        return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)

    def rows(self, name, **where):
        table = TABLES[name]
        query = select(table).order_by(table.c.id)
        for key, val in where.items():
            query = query.where(table.c[key] == val)
        return [dict(row) for row in self.conn.execute(query).mappings()]

    def get(self, name, identifier):
        if isinstance(identifier, bool) or not str(identifier).isdigit():
            raise RuleError("记录编号无效", 400)
        rows = self.rows(name, id=int(identifier))
        if not rows:
            raise RuleError("记录不存在", 404)
        return rows[0]

    def insert(self, name, **values):
        identifier = self.conn.execute(TABLES[name].insert().values(**values)).inserted_primary_key[0]
        if name == "event":
            self.event_ids.append(identifier)
        return identifier

    def stamp_events(self):
        # The final transaction write is the serialization point for cutoff replay.
        # Freeze acquires the same lock and can only observe a committed whole action.
        if self.event_ids:
            table = TABLES["event"]
            self.conn.execute(table.update().where(table.c.id.in_(self.event_ids)).values(occurred_at=self.now()))

    def update(self, name, identifier, **values):
        table = TABLES[name]
        self.conn.execute(table.update().where(table.c.id == identifier).values(**values))

    def external(self, sql, **params):
        # Authorization rows stay shared-locked until the action commits.
        if self.conn.dialect.name == "mysql":
            sql += " FOR SHARE"
        return [dict(row) for row in self.conn.execute(text(sql), params).mappings()]

    def person(self, staff_id, active=True):
        rows = self.external("SELECT id,name,status FROM jml_staff WHERE id=:id", id=staff_id)
        person = rows[0] if rows else None
        if not person or str(person["id"]) != str(staff_id) or active and str(person["status"]) != "1":
            raise RuleError("员工账号不可用", 403)
        return person

    def exemption_ids(self):
        rows = self.external("SELECT staff_ids FROM mo_station_staff_exemption_yx WHERE id=1")
        ids = rows[0]["staff_ids"] if rows else []
        ids = json.loads(ids) if isinstance(ids, str) else ids or []
        return {str(value) for value in ids}

    def exempt(self, staff_id):
        return str(staff_id) in self.exemption_ids()

    def active_people(self, staff_ids):
        ids = sorted(set(map(str, staff_ids)))
        if not ids:
            return {}
        params = {f"person_{i}": identifier for i, identifier in enumerate(ids)}
        placeholders = ",".join(":" + key for key in params)
        rows = self.external(f"SELECT id,name,status FROM jml_staff WHERE status=1 AND id IN ({placeholders})", **params)
        return {str(row["id"]): row for row in rows if str(row["id"]) in ids and str(row["status"]) == "1"}

    def leader_stations(self, staff_id):
        return {r["station_id"]: r["station_name"] for r in self.external("""SELECT c.station_id,w.station_name
            FROM mo_station_staff_config_yx c JOIN mo_workstation_yx w ON c.station_id=w.id
            WHERE c.leader_staff_id=:id AND w.is_active=1""", id=staff_id)}

    def scope(self, staff_id):
        exempt = self.exempt(staff_id)
        rows = self.external("""SELECT c.station_id,c.scanner_staff_ids,w.station_name
            ,c.leader_staff_id
            FROM mo_station_staff_config_yx c JOIN mo_workstation_yx w ON c.station_id=w.id
            WHERE (c.leader_staff_id=:id OR :exempt=1) AND w.is_active=1""", id=staff_id, exempt=int(exempt))
        stations, scanners, station_people = {}, {}, {}
        for row in rows:
            stations[row["station_id"]] = row["station_name"]
            ids = row["scanner_staff_ids"]
            ids = list(json.loads(ids) if isinstance(ids, str) else ids or [])
            if row["leader_staff_id"]:
                ids.append(row["leader_staff_id"])
            station_people[row["station_id"]] = set(map(str, ids))
        people = self.active_people(identifier for ids in station_people.values() for identifier in ids)
        for row in rows:
            for identifier in station_people[row["station_id"]]:
                person = people.get(identifier)
                if person is None:
                    continue
                scanners.setdefault(str(identifier), {**person, "station_ids": []})["station_ids"].append(row["station_id"])
        return stations, scanners
