"""Persist ERP work-order product and customer context in the reporting database."""
from models.db2 import get_db2


UPSERT_SQL = """
INSERT INTO mo_workorder_context_yx (
    mo_code, sort_seq, inv_code, inv_name, inv_std, plan_qty,
    so_code_008, so_row_008, source_account, source_so_code,
    source_so_row, customer_code, customer_name
) VALUES (
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s
)
ON DUPLICATE KEY UPDATE
    inv_code=VALUES(inv_code),
    inv_name=VALUES(inv_name),
    inv_std=VALUES(inv_std),
    plan_qty=VALUES(plan_qty),
    so_code_008=COALESCE(VALUES(so_code_008),so_code_008),
    so_row_008=COALESCE(VALUES(so_row_008),so_row_008),
    source_account=COALESCE(VALUES(source_account),source_account),
    source_so_code=COALESCE(VALUES(source_so_code),source_so_code),
    source_so_row=COALESCE(VALUES(source_so_row),source_so_row),
    customer_code=COALESCE(VALUES(customer_code),customer_code),
    customer_name=COALESCE(VALUES(customer_name),customer_name)
"""


def values_from_header(header):
    if not header or not header.get("MoCode_a") or header.get("SortSeq_b") is None:
        raise ValueError("工单资料不完整")
    return (
        str(header.get("MoCode_a")),
        int(header.get("SortSeq_b")),
        header.get("InvCode_b"),
        header.get("cInvName"),
        header.get("cInvStd"),
        header.get("Qty_b"),
        header.get("SOCode008"),
        header.get("SORow008"),
        header.get("SourceAccount"),
        header.get("SourceSOCode"),
        header.get("SourceSORow"),
        header.get("CustomerCode"),
        header.get("CustomerName"),
    )


def upsert_workorder_context(header, connection=None):
    own_connection = connection is None
    conn = connection or get_db2()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute(UPSERT_SQL, values_from_header(header))
        if own_connection:
            conn.commit()
    except Exception:
        if own_connection:
            conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        if own_connection:
            conn.close()
