import json
from unittest.mock import MagicMock

import app as webapp
from admin_permissions import READ_RULES


def test_operation_log_filters_and_decodes_detail_json(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = {"cnt": 1}
    cursor.fetchall.return_value = [
        {
            "id": 9,
            "event_type": "complete",
            "event_name": "完工",
            "occurred_at": "2026-09-23 10:20:00",
            "operator_id": "u-1",
            "operator_name": "张三",
            "worker_names": "李四、王五",
            "worker_details": json.dumps([{"id": "u-2", "name": "李四"}]),
            "mo_code": "MO-001",
            "sort_seq": 10,
            "route_id": 3,
            "seq": 2,
            "process_name": "喷涂",
            "station_id": 5,
            "station_name": "喷涂一站",
            "qty": 20,
            "qty_a": 18,
            "qty_a1": 2,
            "qty_a2": 0,
            "qty_c": 0,
            "reason": None,
            "photo_urls": json.dumps(["https://example.test/photo.jpg"]),
            "source_type": "completion",
            "source_id": 7,
            "details": json.dumps({"is_final": True}),
        }
    ]
    monkeypatch.setattr(webapp, "db", lambda: connection)

    with webapp.app.test_request_context(
        "/api/mo/dashboard/operation-log",
        query_string={
            "current": 2,
            "pageSize": 20,
            "event_type": "complete",
            "operator": "张",
            "worker": "李",
            "mo_code": "MO-001",
            "start_date": "2026-09-23",
            "end_date": "2026-09-23",
        },
    ):
        payload = webapp.dashboard_operation_log().get_json()

    assert payload["code"] == 0
    assert payload["total"] == 1
    assert payload["data"][0]["worker_details"][0]["name"] == "李四"
    assert payload["data"][0]["photo_urls"] == [
        "https://example.test/photo.jpg"
    ]
    list_query, list_params = cursor.execute.call_args_list[1].args
    assert "event_type=%s" in list_query
    assert "operator_name LIKE %s" in list_query
    assert "worker_names LIKE %s" in list_query
    assert list_params[-2:] == (20, 20)
    connection.commit.assert_not_called()


def test_operation_log_page_is_independently_authorized():
    assert READ_RULES["/api/mo/dashboard/operation-log"] == {
        "operation-log.view"
    }
