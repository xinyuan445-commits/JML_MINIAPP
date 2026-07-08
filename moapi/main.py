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
    "server": "172.16.1.159",
    "database": "UFDATA_008_2021",
    "uid": "sa",
    "pwd": "r7B3LshWfs4.JH.F5f8Xpc+R"
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
       InvCode_b, cInvName,
       LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
       Qty_b, MoDId_b,StartDate_c,DueDate_c
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
       InvCode_b, inv.cInvName,
       LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
       Qty_b, MoDId_b,
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
            "CategoryName": first["CategoryName"],
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


# ===================== 报价：BOM 材料成本（B） =====================

# 母件最新一版 BOM 的子件（取该母件最大 BomId 的资料）
BOM_LATEST_SQL = """
SELECT minvcode AS parent, zinvcode AS sub_code,
       BaseQtyN / BaseQtyD AS qty, compscrap AS scrap
FROM bomdetail_yx
WHERE RelsDate IS NOT NULL
  AND minvcode = ?
  AND BomId = (
      SELECT MAX(BomId) FROM bomdetail_yx
      WHERE RelsDate IS NOT NULL AND minvcode = ?
  )
ORDER BY zinvcode
"""

# 子件最近一次入库成本（AutoID 最大 = 最近）
SUB_COST_SQL = """
SELECT TOP 1 iInCost
FROM IA_Subsidiary
WHERE bRdFlag = 1 AND cVouCode NOT LIKE '-%' AND iInCost > 0
  AND cInvCode = ?
ORDER BY AutoID DESC
"""

@app.get("/api/mo/material/cost")
async def get_material_cost(inv_code: str):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(BOM_LATEST_SQL, (inv_code, inv_code))
        cols = [c[0] for c in cursor.description]
        bom_rows = [{k: serialize(v) for k, v in zip(cols, r)} for r in cursor.fetchall()]
        if not bom_rows:
            conn.close()
            return {"code": 1, "msg": "未找到该存货的 BOM", "data": None}

        components = []
        total = 0.0
        for r in bom_rows:
            sub = r["sub_code"]
            cursor.execute(SUB_COST_SQL, (sub,))
            crow = cursor.fetchone()
            unit_cost = serialize(crow[0]) if crow else None
            qty = r["qty"] or 0
            scrap = r["scrap"] or 0
            # 损耗率按百分数处理：实际用量 = 单位耗用量 ×(1 + 损耗率/100)
            qty_eff = qty * (1 + scrap / 100)
            # 子件查不到成本：unit_cost=None，跳过不计入合计，前端标记
            amount = (qty_eff * unit_cost) if unit_cost is not None else None
            if amount is not None:
                total += amount
            components.append({
                "sub_code":  sub,
                "qty":       qty,
                "scrap":     scrap,
                "unit_cost": unit_cost,
                "amount":    round(amount, 6) if amount is not None else None,
            })
        conn.close()
        return {"code": 0, "data": {
            "parent":        inv_code,
            "components":    components,
            "material_cost": round(total, 6),
        }}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": None}


# ===================== 报价：材料最近采购单价 =====================
# 按料号取最近一次已审核采购明细：iunitprice=未税单价，isum/iquantity=含税单价
MATERIAL_PRICE_SQL = """
SELECT cinvcode, iunitprice AS price_excl, price_incl
FROM (
    SELECT
        b.cinvcode,
        b.iunitprice,
        b.isum / NULLIF(b.iquantity, 0)                                       AS price_incl,
        ROW_NUMBER() OVER (PARTITION BY b.cinvcode ORDER BY a.cAuditTime DESC) AS rn
    FROM po_pomain a
    LEFT JOIN po_podetails b ON a.poid = b.poid
    WHERE b.isum > 0 AND a.cAuditTime IS NOT NULL AND b.cinvcode = ?
) x
WHERE rn = 1
"""

VENEER_IN_COST_SQL = """
SELECT TOP 1 cInvCode, iInCost
FROM IA_Subsidiary
WHERE bRdFlag = 1 AND iInCost > 0 AND cInvCode = ?
ORDER BY AutoID DESC
"""

@app.get("/api/mo/material/price")
async def get_material_price(inv_code: str, mat_type: str = ""):
    try:
        conn = get_db()
        cursor = conn.cursor()
        if mat_type in ("正面装饰木皮", "反面装饰木皮"):
            cursor.execute(VENEER_IN_COST_SQL, (inv_code,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                return {"code": 1, "msg": "未找到该木皮料号的入库成本", "data": None}
            return {"code": 0, "data": {
                "cinvcode":   row[0],
                "price_excl": serialize(row[1]),
                "price_incl": None,
                "price_source": "IA_Subsidiary.iInCost",
            }}
        cursor.execute(MATERIAL_PRICE_SQL, (inv_code,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return {"code": 1, "msg": "未找到该料号的采购单价", "data": None}
        return {"code": 0, "data": {
            "cinvcode":   row[0],
            "price_excl": serialize(row[1]),
            "price_incl": serialize(row[2]),
        }}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8189)
