"""Backfill reporting context by reading U8 directly from the internal network."""
import importlib.util
import os
from pathlib import Path
import sys


import pyodbc


SCRIPT_DIR = Path(__file__).resolve().parent
PTHONAPI_DIR = SCRIPT_DIR.parent
PROJECT_DIR = PTHONAPI_DIR.parent
if str(PTHONAPI_DIR) not in sys.path:
    sys.path.insert(0, str(PTHONAPI_DIR))

from models.db2 import get_db2  # noqa: E402
from services.mo_workorder_context import upsert_workorder_context  # noqa: E402


MOAPI_MAIN = Path(os.getenv(
    "LOCAL_MOAPI_MAIN",
    str(PROJECT_DIR / "moapi" / "main.py"),
))


def load_moapi():
    spec = importlib.util.spec_from_file_location("jml_local_moapi", MOAPI_MAIN)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def header_from_row(row):
    return {
        "MoCode_a": row["MoCode_a"],
        "SortSeq_b": row["SortSeq_b"],
        "InvCode_b": row["InvCode_b"],
        "cInvName": row["cInvName"],
        "cInvStd": row["cInvStd"],
        "Qty_b": row["Qty_b"],
        "SOCode008": row["SOCode008"],
        "SORow008": row["SORow008"],
        "SourceAccount": row["SourceAccount"],
        "SourceSOCode": row["SourceSOCode"],
        "CustomerCode": row["CustomerCode"],
        "CustomerName": row["CustomerName"],
    }


def main():
    moapi = load_moapi()
    keys = workorder_keys()
    u8_conn = moapi.get_db()
    u8_cur = u8_conn.cursor()
    success = 0
    failed = []
    try:
        for item in keys:
            key = f"{item['mo_code']}/{item['sort_seq']}"
            try:
                u8_cur.execute(
                    moapi.DETAIL_SQL,
                    (item["mo_code"], item["sort_seq"]),
                )
                columns = [column[0] for column in u8_cur.description]
                raw = u8_cur.fetchone()
                if raw is None:
                    raise RuntimeError("U8未找到工单")
                row = dict(zip(columns, raw))
                upsert_workorder_context(header_from_row(row))
                success += 1
            except (pyodbc.Error, RuntimeError, ValueError) as exc:
                failed.append((key, str(exc)))
    finally:
        u8_cur.close()
        u8_conn.close()

    print(f"总数 {len(keys)}，成功 {success}，失败 {len(failed)}")
    for key, message in failed:
        print(f"{key}: {message}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
