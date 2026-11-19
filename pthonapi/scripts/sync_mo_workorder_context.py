"""Backfill product and customer context for work orders already present in reporting."""
import os
import sys

import requests


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PTHONAPI_DIR = os.path.dirname(SCRIPT_DIR)
if PTHONAPI_DIR not in sys.path:
    sys.path.insert(0, PTHONAPI_DIR)

from models.db2 import get_db2  # noqa: E402
from services.mo_workorder_context import upsert_workorder_context  # noqa: E402


DETAIL_URL = os.getenv(
    "MO_WORKORDER_DETAIL_URL",
    "https://api.jinmilong.cn/api/mo/workorder/detail",
)


def workorder_keys():
    conn = get_db2()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT DISTINCT mo_code, sort_seq
            FROM (
                SELECT mo_code, sort_seq FROM mo_execution_yx
                UNION ALL
                SELECT mo_code, sort_seq FROM mo_wo_state_yx
                UNION ALL
                SELECT mo_code, sort_seq FROM mo_handover_yx
                UNION ALL
                SELECT mo_code, sort_seq FROM mo_operation_log_yx
            ) workorders
            WHERE mo_code IS NOT NULL AND sort_seq IS NOT NULL
            ORDER BY mo_code, sort_seq
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def main():
    success = 0
    failed = []
    for item in workorder_keys():
        key = f"{item['mo_code']}/{item['sort_seq']}"
        try:
            response = requests.get(
                DETAIL_URL,
                params={"mo_code": item["mo_code"], "sort_seq": item["sort_seq"]},
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("code") != 0:
                raise RuntimeError(payload.get("msg") or "ERP工单查询失败")
            header = ((payload.get("data") or {}).get("header") or {})
            upsert_workorder_context(header)
            success += 1
        except Exception as exc:
            failed.append((key, str(exc)))

    print(f"成功 {success} 条，失败 {len(failed)} 条")
    for key, message in failed:
        print(f"{key}: {message}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
