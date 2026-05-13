from decimal import Decimal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pyodbc

app = FastAPI(title="JML Internal DB API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "server": "172.16.1.9",
    "database": "UFDATA_008_2021",
    "uid": "sa",
    "pwd": "Ks123456"
}

def get_db():
    conn_str = (
        "DRIVER={SQL Server};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"UID={DB_CONFIG['uid']};"
        f"PWD={DB_CONFIG['pwd']};"
    )
    return pyodbc.connect(conn_str, timeout=5)

def serialize(val):
    if isinstance(val, Decimal):
        return float(val)
    return val

WORKORDER_SQL = """
SELECT MoCode_a, SortSeq_b, a.MDeptCode_b AS DeptCode, cDepName,
       InvCode_b, cInvName, Qty_b, MoDId_b,StartDate_c,DueDate_c
FROM momlist_yx a
LEFT JOIN Inventory  inv ON a.InvCode_b   = inv.cInvCode
LEFT JOIN Department dp  ON a.MDeptCode_b = dp.cDepCode
WHERE a.RelsDate_b IS NOT NULL
  AND a.CloseDate_b IS NULL
"""

@app.get("/api/mo/workorder/list")
async def get_workorder_list():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(WORKORDER_SQL)
        columns = [col[0] for col in cursor.description]
        rows = [{k: serialize(v) for k, v in zip(columns, row)} for row in cursor.fetchall()]
        conn.close()
        return {"code": 0, "data": rows}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": []}


DETAIL_SQL = """
SELECT MoCode_a, SortSeq_b, a.MDeptCode_b AS DeptCode, cDepName,
       InvCode_b, inv.cInvName, Qty_b, MoDId_b,
       ma.InvCode AS sub_code, inv2.cInvName AS sub_name,
       ma.Qty AS qty_plan, ma.IssQty AS qty_issued,StartDate_c,DueDate_c
FROM momlist_yx a
LEFT JOIN Inventory      inv  ON a.InvCode_b   = inv.cInvCode
LEFT JOIN mom_moallocate ma   ON a.MoDId_b     = ma.MoDId
LEFT JOIN Inventory      inv2 ON ma.InvCode    = inv2.cInvCode
LEFT JOIN Department     dp   ON a.MDeptCode_b = dp.cDepCode
WHERE a.MoCode_a = ? AND a.SortSeq_b = ?
  AND a.RelsDate_b IS NOT NULL
--  AND a.CloseDate_b IS NUL
"""

@app.get("/api/mo/workorder/detail")
async def get_workorder_detail(mo_code: str, sort_seq: int):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(DETAIL_SQL, (mo_code, sort_seq))
        columns = [col[0] for col in cursor.description]
        rows = [{k: serialize(v) for k, v in zip(columns, row)} for row in cursor.fetchall()]
        conn.close()
        if not rows:
            return {"code": 1, "msg": "未找到工单"}
        first = rows[0]
        header = {
            "MoCode_a":   first["MoCode_a"],
            "SortSeq_b":  first["SortSeq_b"],
            "DeptCode":   first["DeptCode"],
            "cDepName":   first["cDepName"],
            "InvCode_b":  first["InvCode_b"],
            "cInvName":   first["cInvName"],
            "Qty_b":      first["Qty_b"],
            "StartDate_c": str(first["StartDate_c"]) if first["StartDate_c"] else None,
            "DueDate_c":   str(first["DueDate_c"])   if first["DueDate_c"]   else None,
        }
        components = [
            {
                "sub_code":   r["sub_code"],
                "sub_name":   r["sub_name"],
                "qty_plan":   r["qty_plan"],
                "qty_issued": r["qty_issued"],
            }
            for r in rows if r["sub_code"]
        ]
        return {"code": 0, "data": {"header": header, "components": components}}
    except Exception as e:
        return {"code": 1, "msg": str(e)}

@app.get("/api/mo/departments")
async def get_departments():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT cDepCode, cDepName FROM Department ORDER BY cDepCode")
        rows = [{"code": r[0], "name": r[1]} for r in cursor.fetchall()]
        conn.close()
        return {"code": 0, "data": rows}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
