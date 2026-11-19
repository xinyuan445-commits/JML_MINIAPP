"""Standalone read-only API for the production dashboard."""
import argparse
import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from werkzeug.serving import make_server

from dashboard_operations import (
    build_operations_snapshot,
    include_unreported_orders,
    load_operation_rows,
    tracked_order_rows,
)
from data_sources import DashboardDataSources, _product_info


PROJECT_DIRECTORY = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_DIRECTORY / ".env")


class DashboardSnapshotService:
    def __init__(self, sources=None, cache_seconds=None):
        self.sources = sources or DashboardDataSources()
        self.cache_seconds = max(0, int(cache_seconds if cache_seconds is not None else os.getenv("DASHBOARD_CACHE_SECONDS", "10")))
        self._lock = threading.Lock()
        self._expires_at = 0.0
        self._snapshot = None

    def _read_snapshot(self):
        now = datetime.now()
        connection = None
        try:
            connection = self.sources.mysql_connection()
            connection.start_transaction(
                isolation_level="REPEATABLE READ",
                consistent_snapshot=True,
                readonly=True,
            )
            data = load_operation_rows(connection, now)
            connection.rollback()
            connection.close()
            connection = None

            open_orders, open_orders_available = self.sources.open_order_map()
            candidates = tracked_order_rows(data) + [
                {"mo_code": key[0], "sort_seq": key[1]} for key in open_orders
            ]
            products, warnings = self.sources.product_context(candidates)
            for key, row in open_orders.items():
                open_product = _product_info(row)
                product = products.setdefault(key, {
                    **open_product,
                    "first_issued_qty": None,
                    "unit_name": "未标单位",
                })
                for field in (
                    "so_code_008", "so_row_008", "source_account",
                    "source_so_code", "customer_code", "customer_name",
                ):
                    if product.get(field) in (None, "") and open_product.get(field) not in (None, ""):
                        product[field] = open_product[field]
                product["erp_open"] = True
            if not open_orders_available:
                warnings.append("ERP开放工单列表暂未更新，未报工工单可能显示不完整。")
            include_unreported_orders(data, products)
            return build_operations_snapshot(data, products, now, warnings)
        finally:
            if connection is not None:
                try:
                    connection.rollback()
                finally:
                    connection.close()

    def snapshot(self):
        current = time.monotonic()
        if self._snapshot is not None and current < self._expires_at:
            return self._snapshot
        with self._lock:
            current = time.monotonic()
            if self._snapshot is not None and current < self._expires_at:
                return self._snapshot
            self._snapshot = self._read_snapshot()
            self._expires_at = time.monotonic() + self.cache_seconds
            return self._snapshot


def create_app(sources=None, cache_seconds=None):
    app = Flask(__name__)
    service = DashboardSnapshotService(sources=sources, cache_seconds=cache_seconds)
    app.extensions["dashboard_snapshot_service"] = service

    @app.after_request
    def no_store(response):
        if response.content_type and response.content_type.startswith("application/json"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/healthz")
    def healthz():
        return jsonify({"status": "ok", "service": "jml-production-dashboard-api", "mode": "standalone"})

    @app.get("/readyz")
    def readyz():
        connection = None
        try:
            connection = service.sources.mysql_connection()
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return jsonify({"status": "ready"})
        except Exception:
            app.logger.exception("dashboard readiness check failed")
            return jsonify({"status": "not_ready"}), 503
        finally:
            if connection is not None:
                connection.close()

    @app.get("/api/mo/dashboard/operations")
    def dashboard_operations():
        try:
            return jsonify({"code": 0, "data": service.snapshot()})
        except Exception:
            app.logger.exception("standalone dashboard snapshot failed")
            return jsonify({"code": 1, "msg": "生产看板数据读取失败，请稍后重试"}), 500

    return app


def main():
    parser = argparse.ArgumentParser(description="金米龙独立生产现场看板 API")
    parser.add_argument("--host", default=os.getenv("DASHBOARD_API_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("DASHBOARD_API_PORT", "8891")))
    arguments = parser.parse_args()
    logging.basicConfig(
        level=os.getenv("DASHBOARD_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    server = make_server(arguments.host, arguments.port, create_app(), threaded=True)
    print(f"[看板API] http://{arguments.host}:{arguments.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
