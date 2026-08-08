from decimal import Decimal
from datetime import datetime
from hashlib import sha256
from uuid import UUID, uuid4
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pyodbc
import re

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

def get_db(database=None):
    conn_str = (
        "DRIVER={SQL Server};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={database or DB_CONFIG['database']};"
        f"UID={DB_CONFIG['uid']};"
        f"PWD={DB_CONFIG['pwd']};"
    )
    return pyodbc.connect(conn_str, timeout=5)

def get_yx_test_db():
    return get_db("yx_test")

def serialize(val):
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    return val

def row_to_dict(cursor, row):
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    return {key: serialize(value) for key, value in zip(columns, row)}

def get_operator_name(cursor, user_id):
    if not user_id:
        return ""
    cursor.execute("""
        SELECT TOP 1 staff_name
        FROM dbo.jml_staff_yx
        WHERE staff_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    return (row[0] or "").strip() if row else ""

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


# ===================== 报价：材料存货搜索及最近采购单价 =====================
def material_prefix(mat_type: str):
    if mat_type == "基材":
        return "31"
    if "装饰纸" in mat_type:
        return "3401"
    if "木皮" in mat_type:
        return "3402"
    return ""


MATERIAL_SEARCH_SQL = """
WITH purchase_rows AS (
    SELECT
        inv.cInvCode AS code,
        inv.cInvName AS name,
        inv.cInvStd  AS spec,
        p.iUnitPrice AS price_excl,
        p.price_incl,
        p.cDefine14,
        p.cAuditTime,
        ROW_NUMBER() OVER (
            PARTITION BY inv.cInvCode
            ORDER BY CASE WHEN p.cInvCode IS NULL THEN 1 ELSE 0 END,
                     p.cAuditTime DESC
        ) AS rn
    FROM UFDATA_008_2021..Inventory inv
    LEFT JOIN (
        SELECT
            b.cInvCode,
            b.iUnitPrice,
            b.iSum / NULLIF(b.iQuantity, 0) AS price_incl,
            a.cDefine14,
            a.cAuditTime
        FROM UFDATA_008_2021..PO_Pomain a
        INNER JOIN UFDATA_008_2021..PO_Podetails b ON a.POID = b.POID
        WHERE a.cAuditTime IS NOT NULL
          AND b.iSum > 0
          AND b.iQuantity <> 0
    ) p ON inv.cInvCode = p.cInvCode
    WHERE {where_sql}
)
SELECT TOP 50
    pr.code,
    pr.name,
    pr.spec,
    CASE WHEN ? = 1 THEN veneer.iInCost ELSE pr.price_excl END AS price_excl,
    CASE WHEN ? = 1 THEN NULL ELSE pr.price_incl END            AS price_incl,
    CASE WHEN ? = 1 THEN NULL ELSE pr.cDefine14 END             AS price_remark,
    CASE WHEN pr.cAuditTime IS NULL THEN 0 ELSE 1 END           AS has_purchase
FROM purchase_rows pr
OUTER APPLY (
    SELECT TOP 1 ia.iInCost
    FROM UFDATA_008_2021..IA_Subsidiary ia
    WHERE ia.bRdFlag = 1
      AND ia.iInCost > 0
      AND ia.cInvCode = pr.code
    ORDER BY ia.AutoID DESC
) veneer
WHERE pr.rn = 1
  AND (? = 1 OR pr.cAuditTime IS NOT NULL)
ORDER BY CASE WHEN pr.cAuditTime IS NULL THEN 1 ELSE 0 END,
         pr.code
"""


@app.get("/api/mo/material/search")
async def search_material(keyword: str = "", mat_type: str = "", include_unpurchased: bool = False):
    tokens = [t for t in re.split(r"[\s,，、]+", keyword.strip()) if t]
    if not tokens:
        return {"code": 1, "msg": "请输入料号或存货名称", "data": []}

    prefix = material_prefix(mat_type.strip())
    if not prefix:
        return {"code": 1, "msg": "未知材料类型", "data": []}

    where, params = [], []
    for token in tokens:
        where.append("(inv.cInvCode LIKE ? OR inv.cInvName LIKE ?)")
        like = f"%{token}%"
        params.extend((like, like))
    where.append("inv.cInvCode LIKE ?")
    params.append(prefix + "%")

    is_veneer = 1 if "木皮" in mat_type else 0
    params.extend((is_veneer, is_veneer, is_veneer, 1 if include_unpurchased else 0))

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(MATERIAL_SEARCH_SQL.format(where_sql=" AND ".join(where)), tuple(params))
        columns = [col[0] for col in cursor.description]
        rows = [{k: serialize(v) for k, v in zip(columns, row)} for row in cursor.fetchall()]
        conn.close()

        data = []
        for row in rows:
            remark = (row.get("price_remark") or "").strip()
            data.append({
                "code": row.get("code"),
                "name": row.get("name"),
                "spec": row.get("spec"),
                "price_excl": row.get("price_excl"),
                "price_incl": row.get("price_incl"),
                "price_remark": remark or None,
                "has_purchase": bool(row.get("has_purchase")),
                "default_logistics_enabled": not is_veneer and remark == "供应商出厂价",
            })
        return {"code": 0, "data": data}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": []}


# 按料号取最近一次已审核采购明细：iUnitPrice=未税单价，iSum/iQuantity=含税单价
MATERIAL_PRICE_SQL = """
SELECT TOP 1
    inv.cInvCode,
    inv.cInvName,
    inv.cInvStd,
    purchase.iUnitPrice AS price_excl,
    purchase.price_incl,
    purchase.cDefine14,
    CASE WHEN purchase.cAuditTime IS NULL THEN 0 ELSE 1 END AS has_purchase
FROM UFDATA_008_2021..Inventory inv
OUTER APPLY (
    SELECT TOP 1
        b.iUnitPrice,
        b.iSum / NULLIF(b.iQuantity, 0) AS price_incl,
        a.cDefine14,
        a.cAuditTime
    FROM UFDATA_008_2021..PO_Pomain a
    INNER JOIN UFDATA_008_2021..PO_Podetails b ON a.POID = b.POID
    WHERE a.cAuditTime IS NOT NULL
      AND b.iSum > 0
      AND b.iQuantity <> 0
      AND b.cInvCode = inv.cInvCode
    ORDER BY a.cAuditTime DESC
) purchase
WHERE inv.cInvCode = ?
"""

VENEER_IN_COST_SQL = """
SELECT TOP 1 cInvCode, iInCost
FROM UFDATA_008_2021..IA_Subsidiary
WHERE bRdFlag = 1 AND iInCost > 0 AND cInvCode = ?
ORDER BY AutoID DESC
"""

@app.get("/api/mo/material/price")
async def get_material_price(inv_code: str, mat_type: str = ""):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(MATERIAL_PRICE_SQL, (inv_code.strip(),))
        purchase_row = cursor.fetchone()
        if not purchase_row:
            conn.close()
            return {"code": 1, "msg": "未找到该存货料号", "data": None}

        has_purchase = bool(purchase_row[6])
        if mat_type in ("正面装饰木皮", "反面装饰木皮"):
            cursor.execute(VENEER_IN_COST_SQL, (inv_code,))
            veneer_row = cursor.fetchone()
            conn.close()
            return {"code": 0, "data": {
                "cinvcode":   purchase_row[0],
                "price_excl": serialize(veneer_row[1]) if veneer_row else None,
                "price_incl": None,
                "price_source": "IA_Subsidiary.iInCost" if veneer_row else None,
                "price_remark": None,
                "has_purchase": has_purchase,
                "default_logistics_enabled": False,
            }}

        conn.close()
        price_remark = (purchase_row[5] or "").strip() if purchase_row[5] is not None else ""
        return {"code": 0, "data": {
            "cinvcode":   purchase_row[0],
            "price_excl": serialize(purchase_row[3]),
            "price_incl": serialize(purchase_row[4]),
            "price_remark": price_remark or None,
            "has_purchase": has_purchase,
            "default_logistics_enabled": price_remark == "供应商出厂价",
        }}
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": None}


# ===================== 木皮裁切后宽度 =====================

class VeneerCutCreate(BaseModel):
    scan_content: str = Field(min_length=1, max_length=500)
    width_cm: Decimal = Field(gt=0)
    length_cm: Decimal = Field(default=Decimal("285.00"), gt=0)
    user_id: str = Field(min_length=1, max_length=64)
    user_name: str = Field(default="", max_length=100)
    request_id: str | None = None


@app.post("/api/mo/veneer-cut")
async def create_veneer_cut(payload: VeneerCutCreate):
    scan_content = payload.scan_content.strip()
    user_id = payload.user_id.strip()
    user_name = payload.user_name.strip()
    if not scan_content:
        return {"code": 1, "msg": "扫码内容不能为空", "data": None}
    if not user_id:
        return {"code": 1, "msg": "用户不能为空", "data": None}

    try:
        request_id = str(UUID(payload.request_id)) if payload.request_id else str(uuid4())
    except ValueError:
        return {"code": 1, "msg": "request_id 格式不正确", "data": None}

    scan_hash = sha256(scan_content.encode("utf-8")).hexdigest().upper()
    length_cm = payload.length_cm.quantize(Decimal("0.01"))
    width_cm = payload.width_cm.quantize(Decimal("0.01"))

    conn = None
    cursor = None
    try:
        conn = get_yx_test_db()
        cursor = conn.cursor()
        cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
        operator_name = get_operator_name(cursor, user_id) or user_name

        cursor.execute("""
            SELECT RecordId, RequestId, ScanContent, CutNo, LengthCm, WidthCm,
                   OperatorId, OperatorName, CreatedAt
            FROM dbo.MupiCutWidthRecord_yx WITH (UPDLOCK, HOLDLOCK)
            WHERE RequestId = ?
        """, (request_id,))
        existing = cursor.fetchone()
        if existing:
            record = row_to_dict(cursor, existing)
            conn.commit()
            return {
                "code": 0,
                "msg": "success",
                "data": record,
                "duplicate": True
            }

        cursor.execute("""
            SELECT ISNULL(MAX(CutNo), 0) + 1
            FROM dbo.MupiCutWidthRecord_yx WITH (UPDLOCK, HOLDLOCK)
            WHERE ScanHash = ? AND ScanContent = ?
        """, (scan_hash, scan_content))
        cut_no = int(cursor.fetchone()[0])

        cursor.execute("""
            INSERT INTO dbo.MupiCutWidthRecord_yx
                (RequestId, ScanContent, ScanHash, CutNo, LengthCm, WidthCm,
                 OperatorId, OperatorName)
            OUTPUT INSERTED.RecordId, INSERTED.RequestId, INSERTED.ScanContent,
                   INSERTED.CutNo, INSERTED.LengthCm, INSERTED.WidthCm,
                   INSERTED.OperatorId, INSERTED.OperatorName, INSERTED.CreatedAt
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            request_id,
            scan_content,
            scan_hash,
            cut_no,
            length_cm,
            width_cm,
            user_id,
            operator_name
        ))
        record = row_to_dict(cursor, cursor.fetchone())
        conn.commit()
        return {
            "code": 0,
            "msg": "success",
            "data": record,
            "duplicate": False
        }
    except Exception as e:
        if conn:
            conn.rollback()
        return {"code": 1, "msg": str(e), "data": None}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/api/mo/veneer-cut/history")
async def get_veneer_cut_history(scan_content: str, limit: int = 20):
    scan_content = scan_content.strip()
    if not scan_content:
        return {"code": 1, "msg": "扫码内容不能为空", "data": None}

    limit = min(max(limit, 1), 100)
    scan_hash = sha256(scan_content.encode("utf-8")).hexdigest().upper()

    conn = None
    cursor = None
    try:
        conn = get_yx_test_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*)
            FROM dbo.MupiCutWidthRecord_yx
            WHERE ScanHash = ? AND ScanContent = ?
        """, (scan_hash, scan_content))
        total = int(cursor.fetchone()[0])

        cursor.execute(f"""
            SELECT TOP {limit}
                   RecordId, RequestId, ScanContent, CutNo, LengthCm, WidthCm,
                   OperatorId, OperatorName, CreatedAt
            FROM dbo.MupiCutWidthRecord_yx
            WHERE ScanHash = ? AND ScanContent = ?
            ORDER BY CutNo DESC, RecordId DESC
        """, (scan_hash, scan_content))
        columns = [col[0] for col in cursor.description]
        history = [
            {key: serialize(value) for key, value in zip(columns, row)}
            for row in cursor.fetchall()
        ]
        return {
            "code": 0,
            "msg": "success",
            "data": {
                "scan_content": scan_content,
                "cut_count": total,
                "latest": history[0] if history else None,
                "history": history
            }
        }
    except Exception as e:
        return {"code": 1, "msg": str(e), "data": None}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8189)
