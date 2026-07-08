import os
import time
import uuid
from datetime import datetime

import requests

from models.db2 import get_db2


OAPI_BASE = "https://oapi.dingtalk.com"
SYNC_LOCK_NAME = "dingtalk_contacts_sync"


class DingTalkSyncError(RuntimeError):
    pass


class DingTalkClient:
    def __init__(self, app_key, app_secret, timeout=20, session=None):
        self.app_key = app_key
        self.app_secret = app_secret
        self.timeout = timeout
        self.session = session or requests.Session()
        self._access_token = None
        self._last_post_at = 0.0

    def _token(self):
        if self._access_token:
            return self._access_token
        response = self.session.get(
            f"{OAPI_BASE}/gettoken",
            params={"appkey": self.app_key, "appsecret": self.app_secret},
            timeout=self.timeout,
        )
        data = self._json(response)
        self._check(data, "获取钉钉 access_token 失败")
        token = data.get("access_token")
        if not token:
            raise DingTalkSyncError("钉钉未返回 access_token")
        self._access_token = token
        return token

    def _post(self, path, body):
        for attempt in range(5):
            elapsed = time.monotonic() - self._last_post_at
            if elapsed < 0.06:
                time.sleep(0.06 - elapsed)
            response = self.session.post(
                f"{OAPI_BASE}{path}",
                params={"access_token": self._token()},
                json=body,
                timeout=self.timeout,
            )
            self._last_post_at = time.monotonic()
            data = self._json(response)
            if data.get("errcode") in (88, "88") and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            self._check(data, f"调用钉钉接口 {path} 失败")
            return data.get("result") or {}
        raise DingTalkSyncError(f"调用钉钉接口 {path} 多次触发限流")

    @staticmethod
    def _json(response):
        response.raise_for_status()
        try:
            return response.json()
        except ValueError as exc:
            raise DingTalkSyncError("钉钉返回了非 JSON 数据") from exc

    @staticmethod
    def _check(data, prefix):
        errcode = data.get("errcode", 0)
        if errcode not in (0, "0", None):
            raise DingTalkSyncError(
                f"{prefix}: {data.get('errmsg') or errcode} (errcode={errcode})"
            )

    def list_sub_departments(self, dept_id):
        result = self._post(
            "/topapi/v2/department/listsub", {"dept_id": dept_id}
        )
        return result if isinstance(result, list) else result.get("list", [])

    def list_department_users(self, dept_id):
        users = []
        cursor = 0
        while True:
            result = self._post(
                "/topapi/v2/user/list",
                {"dept_id": dept_id, "cursor": cursor, "size": 100},
            )
            users.extend(result.get("list") or [])
            if not result.get("has_more"):
                break
            next_cursor = result.get("next_cursor")
            if next_cursor is None or next_cursor == cursor:
                raise DingTalkSyncError("钉钉用户分页游标异常")
            cursor = next_cursor
        return users


def _flag(value):
    return 1 if value is True or value == 1 or value == "1" else 0


def _department_rows(client, root_name):
    rows = {
        1: {
            "dept_id": 1,
            "parent_dept_id": None,
            "name": root_name,
            "order": 0,
            "level": 1,
            "path": root_name,
        }
    }
    queue = [1]
    while queue:
        parent_id = queue.pop(0)
        parent = rows[parent_id]
        for item in client.list_sub_departments(parent_id):
            dept_id = int(item["dept_id"])
            if dept_id in rows:
                continue
            name = (item.get("name") or "").strip()
            if not name:
                raise DingTalkSyncError(f"部门 {dept_id} 缺少名称")
            level = parent["level"] + 1
            rows[dept_id] = {
                "dept_id": dept_id,
                "parent_dept_id": parent_id,
                "name": name,
                "order": int(item.get("order") or 0),
                "level": level,
                "path": f"{parent['path']}/{name}",
            }
            queue.append(dept_id)
    return list(rows.values())


def _user_rows(client, departments):
    users = {}
    memberships = set()
    leaders = set()
    for department in departments:
        listed_dept_id = department["dept_id"]
        for item in client.list_department_users(listed_dept_id):
            user_id = str(item.get("userid") or "").strip()
            name = str(item.get("name") or "").strip()
            if not user_id or not name:
                raise DingTalkSyncError("钉钉用户缺少 userid 或姓名")
            users[user_id] = item
            dept_ids = item.get("dept_id_list") or [listed_dept_id]
            for dept_id in dept_ids:
                memberships.add((user_id, int(dept_id)))
            for dept_id in item.get("leader_in_dept") or []:
                leaders.add((user_id, int(dept_id)))
    return users, memberships, leaders


def _start_log(sync_id, trigger_type):
    conn = get_db2()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO ding_sync_log_yx
               (sync_id, trigger_type, status, start_time)
               VALUES (%s,%s,'running',%s)""",
            (sync_id, trigger_type, datetime.now()),
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def _finish_log(sync_id, status, result=None, error=None):
    result = result or {}
    conn = get_db2()
    try:
        cur = conn.cursor()
        cur.execute(
            """UPDATE ding_sync_log_yx
               SET status=%s, department_count=%s, user_count=%s,
                   disabled_depts=%s, disabled_users=%s,
                   error_message=%s, end_time=%s
               WHERE sync_id=%s""",
            (
                status,
                result.get("department_count", 0),
                result.get("user_count", 0),
                result.get("disabled_depts", 0),
                result.get("disabled_users", 0),
                (str(error)[:1000] if error else None),
                datetime.now(),
                sync_id,
            ),
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def _persist(sync_id, departments, users, memberships, leaders):
    conn = get_db2()
    try:
        cur = conn.cursor()
        for item in departments:
            cur.execute(
                """INSERT INTO ding_department_yx
                   (dept_id,parent_dept_id,dept_name,dept_level,dept_path,
                    sort_order,is_active,last_seen_sync)
                   VALUES (%s,%s,%s,%s,%s,%s,1,%s)
                   ON DUPLICATE KEY UPDATE
                     parent_dept_id=VALUES(parent_dept_id),
                     dept_name=VALUES(dept_name), dept_level=VALUES(dept_level),
                     dept_path=VALUES(dept_path), sort_order=VALUES(sort_order),
                     is_active=1, last_seen_sync=VALUES(last_seen_sync)""",
                (
                    item["dept_id"], item["parent_dept_id"], item["name"],
                    item["level"], item["path"], item["order"], sync_id,
                ),
            )

        for user_id, item in users.items():
            dept_ids = item.get("dept_id_list") or []
            main_dept_id = item.get("main_dept_id")
            if main_dept_id is None and dept_ids:
                main_dept_id = dept_ids[0]
            cur.execute(
                """INSERT INTO ding_user_yx
                   (user_id,union_id,user_name,mobile,job_number,title,
                    main_dept_id,is_admin,is_boss,is_active,last_seen_sync)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,1,%s)
                   ON DUPLICATE KEY UPDATE
                     union_id=VALUES(union_id), user_name=VALUES(user_name),
                     mobile=VALUES(mobile), job_number=VALUES(job_number),
                     title=VALUES(title), main_dept_id=VALUES(main_dept_id),
                     is_admin=VALUES(is_admin), is_boss=VALUES(is_boss),
                     is_active=1, last_seen_sync=VALUES(last_seen_sync)""",
                (
                    user_id, item.get("unionid"), item.get("name"),
                    item.get("mobile"), item.get("job_number"), item.get("title"),
                    main_dept_id, _flag(item.get("admin")),
                    _flag(item.get("boss")), sync_id,
                ),
            )

        cur.execute("DELETE FROM ding_user_department_yx")
        if memberships:
            cur.executemany(
                """INSERT INTO ding_user_department_yx
                   (user_id,dept_id,is_leader) VALUES (%s,%s,%s)""",
                [
                    (user_id, dept_id, 1 if (user_id, dept_id) in leaders else 0)
                    for user_id, dept_id in sorted(memberships)
                ],
            )

        cur.execute(
            "UPDATE ding_department_yx SET is_active=0 WHERE last_seen_sync<>%s OR last_seen_sync IS NULL",
            (sync_id,),
        )
        disabled_depts = cur.rowcount
        cur.execute(
            "UPDATE ding_user_yx SET is_active=0 WHERE last_seen_sync<>%s OR last_seen_sync IS NULL",
            (sync_id,),
        )
        disabled_users = cur.rowcount
        conn.commit()
        cur.close()
        return disabled_depts, disabled_users
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def sync_contacts(trigger_type="manual", client=None):
    if trigger_type not in ("manual", "cron"):
        raise ValueError("trigger_type 必须是 manual 或 cron")

    app_key = os.getenv("DINGTALK_APP_KEY", "").strip()
    app_secret = os.getenv("DINGTALK_APP_SECRET", "").strip()
    if client is None:
        if not app_key or not app_secret:
            raise DingTalkSyncError("未配置 DINGTALK_APP_KEY/DINGTALK_APP_SECRET")
        client = DingTalkClient(app_key, app_secret)

    lock_conn = get_db2()
    # MySQL Connector 要求命名锁的单行结果在连接复用前被完整消费。
    lock_cur = lock_conn.cursor(buffered=True)
    sync_id = str(uuid.uuid4())
    log_started = False
    try:
        lock_cur.execute("SELECT GET_LOCK(%s, 0)", (SYNC_LOCK_NAME,))
        if lock_cur.fetchone()[0] != 1:
            raise DingTalkSyncError("已有钉钉通讯录同步正在运行")

        _start_log(sync_id, trigger_type)
        log_started = True
        departments = _department_rows(
            client, os.getenv("DINGTALK_ROOT_DEPT_NAME", "企业").strip() or "企业"
        )
        users, memberships, leaders = _user_rows(client, departments)
        if len(departments) <= 1:
            raise DingTalkSyncError("钉钉未返回任何子部门，已停止同步以保护现有数据")
        if not users:
            raise DingTalkSyncError("钉钉未返回任何用户，已停止同步以保护现有数据")

        disabled_depts, disabled_users = _persist(
            sync_id, departments, users, memberships, leaders
        )
        result = {
            "sync_id": sync_id,
            "department_count": len(departments),
            "user_count": len(users),
            "disabled_depts": disabled_depts,
            "disabled_users": disabled_users,
        }
        _finish_log(sync_id, "success", result=result)
        return result
    except Exception as exc:
        if log_started:
            _finish_log(sync_id, "failed", error=exc)
        raise
    finally:
        try:
            lock_cur.execute("SELECT RELEASE_LOCK(%s)", (SYNC_LOCK_NAME,))
        finally:
            lock_cur.close()
            lock_conn.close()


def latest_sync():
    conn = get_db2()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT sync_id,trigger_type,status,department_count,user_count,
                      disabled_depts,disabled_users,error_message,start_time,end_time
               FROM ding_sync_log_yx ORDER BY id DESC LIMIT 1"""
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return None
        for key in ("start_time", "end_time"):
            if row.get(key):
                row[key] = row[key].strftime("%Y-%m-%d %H:%M:%S")
        return row
    finally:
        conn.close()
