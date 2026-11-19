import sys
import unittest
from pathlib import Path
from unittest.mock import patch


API_DIRECTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIRECTORY))

import app as dashboard_app  # noqa: E402


class FakeConnection:
    def __init__(self):
        self.started = 0
        self.rollbacks = 0
        self.closed = 0

    def start_transaction(self, **options):
        self.started += 1
        self.options = options

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed += 1


class FakeSources:
    def __init__(self):
        self.connection = FakeConnection()

    def mysql_connection(self):
        return self.connection

    def open_order_map(self):
        return {("SCDD1", 1): {
            "MoCode_a": "SCDD1",
            "SortSeq_b": 1,
            "InvCode_b": "TEST",
            "cInvName": "测试产品",
            "Qty_b": 10,
            "CustomerName": "测试客户",
        }}, True

    def product_context(self, _rows):
        return {}, []


class DashboardApiTests(unittest.TestCase):
    def setUp(self):
        self.sources = FakeSources()
        self.app = dashboard_app.create_app(self.sources, cache_seconds=60)
        self.client = self.app.test_client()

    def test_health_is_public(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["mode"], "standalone")

    def test_operations_does_not_accept_writes(self):
        response = self.client.post("/api/mo/dashboard/operations", json={})
        self.assertEqual(response.status_code, 405)

    def test_operations_is_public_read_only_and_cached(self):
        with patch.object(dashboard_app, "load_operation_rows", return_value={}), \
             patch.object(dashboard_app, "tracked_order_rows", return_value=[]), \
             patch.object(dashboard_app, "include_unreported_orders") as include_orders, \
             patch.object(dashboard_app, "build_operations_snapshot", return_value={"orders": []}) as build:
            first = self.client.get("/api/mo/dashboard/operations")
            second = self.client.get("/api/mo/dashboard/operations")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.get_json(), {"code": 0, "data": {"orders": []}})
        self.assertEqual(self.sources.connection.started, 1)
        self.assertEqual(self.sources.connection.rollbacks, 1)
        self.assertEqual(self.sources.connection.closed, 1)
        include_orders.assert_called_once()
        products = include_orders.call_args.args[1]
        self.assertEqual(products[("SCDD1", 1)]["customer_name"], "测试客户")
        build.assert_called_once()

    def test_failures_do_not_expose_database_details(self):
        with patch.object(self.app.logger, "exception"), \
             patch.object(dashboard_app, "load_operation_rows", side_effect=RuntimeError("secret database error")):
            response = self.client.get("/api/mo/dashboard/operations")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret database error", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
