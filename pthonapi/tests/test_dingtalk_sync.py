import importlib
import os
import sys
import types
import unittest
from unittest.mock import patch


PTHONAPI_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PTHONAPI_ROOT not in sys.path:
    sys.path.insert(0, PTHONAPI_ROOT)

fake_db2 = types.ModuleType("models.db2")
fake_db2.get_db2 = lambda: None
sys.modules["models.db2"] = fake_db2

dingtalk_sync = importlib.import_module("services.dingtalk_sync")
dingtalk_route = importlib.import_module("routes.dingtalk")
mo_route = importlib.import_module("routes.mo")


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self.data


class FakeSession:
    def __init__(self):
        self.posts = []

    def get(self, url, params, timeout):
        return FakeResponse({"errcode": 0, "access_token": "token"})

    def post(self, url, params, json, timeout):
        self.posts.append(json)
        cursor = json["cursor"]
        if cursor == 0:
            return FakeResponse({
                "errcode": 0,
                "result": {
                    "list": [{"userid": "u1", "name": "甲"}],
                    "has_more": True,
                    "next_cursor": 100,
                },
            })
        return FakeResponse({
            "errcode": 0,
            "result": {
                "list": [{"userid": "u2", "name": "乙"}],
                "has_more": False,
            },
        })


class TreeClient:
    departments = {
        1: [{"dept_id": 10, "name": "生产中心", "order": 1}],
        10: [{"dept_id": 20, "name": "木门部", "order": 1}],
        20: [{"dept_id": 30, "name": "压贴车间", "order": 1}],
        30: [],
    }

    users = {
        1: [],
        10: [{"userid": "u1", "name": "张三", "dept_id_list": [10, 30]}],
        20: [],
        30: [{"userid": "u1", "name": "张三", "dept_id_list": [10, 30]}],
    }

    def list_sub_departments(self, dept_id):
        return self.departments[dept_id]

    def list_department_users(self, dept_id):
        return self.users[dept_id]


class ThrottledSession:
    def __init__(self):
        self.calls = 0

    def get(self, url, params, timeout):
        return FakeResponse({"errcode": 0, "access_token": "token"})

    def post(self, url, params, json, timeout):
        self.calls += 1
        if self.calls == 1:
            return FakeResponse({"errcode": 88, "errmsg": "qps limited"})
        return FakeResponse({"errcode": 0, "result": []})


class DingTalkSyncTests(unittest.TestCase):
    def test_user_list_paginates(self):
        session = FakeSession()
        client = dingtalk_sync.DingTalkClient("key", "secret", session=session)

        rows = client.list_department_users(10)

        self.assertEqual(["u1", "u2"], [row["userid"] for row in rows])
        self.assertEqual([0, 100], [post["cursor"] for post in session.posts])

    def test_department_tree_builds_four_level_path(self):
        rows = dingtalk_sync._department_rows(TreeClient(), "金米龙")
        last = next(row for row in rows if row["dept_id"] == 30)

        self.assertEqual(4, last["level"])
        self.assertEqual("金米龙/生产中心/木门部/压贴车间", last["path"])

    def test_duplicate_user_is_merged_and_keeps_memberships(self):
        departments = dingtalk_sync._department_rows(TreeClient(), "金米龙")

        users, memberships, _ = dingtalk_sync._user_rows(TreeClient(), departments)

        self.assertEqual(["u1"], list(users))
        self.assertEqual({("u1", 10), ("u1", 30)}, memberships)

    @patch("services.dingtalk_sync.time.sleep")
    def test_qps_limit_is_retried(self, sleep):
        session = ThrottledSession()
        client = dingtalk_sync.DingTalkClient("key", "secret", session=session)

        result = client.list_sub_departments(1)

        self.assertEqual([], result)
        self.assertEqual(2, session.calls)
        sleep.assert_called()


class VisibleDepartmentTests(unittest.TestCase):
    def test_only_configured_company_subtrees_are_visible(self):
        class Cursor:
            def execute(self, sql):
                pass

            def fetchall(self):
                return [
                    {"dept_id": 1, "parent_dept_id": None},
                    {"dept_id": 661823215, "parent_dept_id": 1},
                    {"dept_id": 10, "parent_dept_id": 661823215},
                    {"dept_id": 594600049, "parent_dept_id": 1},
                    {"dept_id": 20, "parent_dept_id": 594600049},
                    {"dept_id": 999, "parent_dept_id": 1},
                    {"dept_id": 30, "parent_dept_id": 999},
                ]

        visible = dingtalk_route._visible_dept_ids(Cursor())

        self.assertEqual({1, 661823215, 10, 594600049, 20}, visible)


class DurationTests(unittest.TestCase):
    def test_less_than_one_minute(self):
        start = dingtalk_sync.datetime(2026, 7, 6, 8, 0, 0)
        end = dingtalk_sync.datetime(2026, 7, 6, 8, 0, 59)
        self.assertEqual("不足1分钟", mo_route._format_duration(start, end))

    def test_minutes_only(self):
        start = dingtalk_sync.datetime(2026, 7, 6, 8, 0)
        end = dingtalk_sync.datetime(2026, 7, 6, 8, 45)
        self.assertEqual("45分钟", mo_route._format_duration(start, end))

    def test_hours_and_minutes(self):
        start = dingtalk_sync.datetime(2026, 7, 6, 8, 0)
        end = dingtalk_sync.datetime(2026, 7, 6, 10, 5)
        self.assertEqual("2小时5分钟", mo_route._format_duration(start, end))

    def test_days_hours_and_minutes(self):
        start = dingtalk_sync.datetime(2026, 7, 5, 8, 0)
        end = dingtalk_sync.datetime(2026, 7, 6, 10, 3)
        self.assertEqual("1天2小时3分钟", mo_route._format_duration(start, end))


if __name__ == "__main__":
    unittest.main()
