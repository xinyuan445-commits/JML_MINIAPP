"""Read-only MySQL and U8 access for the standalone production dashboard."""
import json
import logging
import os
import threading
from datetime import date, datetime, timedelta
from decimal import Decimal

import mysql.connector.pooling
import pyodbc


LOGGER = logging.getLogger(__name__)

WORKORDER_CONTEXT_SELECT = """
       a.OrderCode_b AS SOCode008,
       a.OrderSeq_b AS SORow008,
       CASE
           WHEN source001.LinkCount > 0 THEN '001'
           WHEN source002.LinkCount > 0 THEN '002'
           WHEN sales008.ID IS NOT NULL THEN '008'
           ELSE NULL
       END AS SourceAccount,
       CASE
           WHEN source001.LinkCount > 0 THEN source001.SourceSOCode
           WHEN source002.LinkCount > 0 THEN source002.SourceSOCode
           ELSE a.OrderCode_b
       END AS SourceSOCode,
       CASE
           WHEN source001.LinkCount > 0 THEN source001.CustomerCode
           WHEN source002.LinkCount > 0 THEN source002.CustomerCode
           ELSE sales008.cCusCode
       END AS CustomerCode,
       CASE
           WHEN source001.LinkCount > 0 THEN source001.CustomerName
           WHEN source002.LinkCount > 0 THEN source002.CustomerName
           ELSE COALESCE(sales008.cCusName, customer008.cCusName)
       END AS CustomerName
"""

WORKORDER_CONTEXT_JOINS = """
LEFT JOIN dbo.SO_SOMain sales008 ON sales008.cSOCode = a.OrderCode_b
LEFT JOIN dbo.Customer customer008 ON customer008.cCusCode = sales008.cCusCode
OUTER APPLY (
    SELECT
        COUNT(*) AS LinkCount,
        CASE WHEN COUNT(DISTINCT sales001.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(sales001.cSOCode) END AS SourceSOCode,
        CASE WHEN COUNT(DISTINCT sales001.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(sales001.cCusCode) END AS CustomerCode,
        CASE WHEN COUNT(DISTINCT sales001.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(COALESCE(sales001.cCusName, customer001.cCusName)) END AS CustomerName
    FROM dbo.SO_SODetails detail008
    INNER JOIN UFDATA_001_2021.dbo.PO_Podetails purchase001
        ON purchase001.POID = detail008.GCSourceId
       AND purchase001.ID = detail008.GCSourceIds
    INNER JOIN UFDATA_001_2021.dbo.SO_SODetails detail001
        ON detail001.iSOsID = purchase001.iSOsID
    INNER JOIN UFDATA_001_2021.dbo.SO_SOMain sales001
        ON sales001.ID = detail001.ID
    LEFT JOIN UFDATA_001_2021.dbo.Customer customer001
        ON customer001.cCusCode = sales001.cCusCode
    WHERE detail008.ID = sales008.ID
      AND detail008.GCSourceId IS NOT NULL
      AND detail008.GCSourceIds IS NOT NULL
) source001
OUTER APPLY (
    SELECT
        COUNT(*) AS LinkCount,
        CASE WHEN COUNT(DISTINCT sales002.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(sales002.cSOCode) END AS SourceSOCode,
        CASE WHEN COUNT(DISTINCT sales002.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(sales002.cCusCode) END AS CustomerCode,
        CASE WHEN COUNT(DISTINCT sales002.cCusCode) > 1 THEN N'待核对'
             ELSE MAX(COALESCE(sales002.cCusName, customer002.cCusName)) END AS CustomerName
    FROM UFDATA_002_2025.dbo.PO_Pomain purchase_main002
    INNER JOIN UFDATA_002_2025.dbo.PO_Podetails purchase002
        ON purchase002.POID = purchase_main002.POID
    INNER JOIN UFDATA_002_2025.dbo.SO_SODetails detail002
        ON detail002.iSOsID = purchase002.iSOsID
    INNER JOIN UFDATA_002_2025.dbo.SO_SOMain sales002
        ON sales002.ID = detail002.ID
    LEFT JOIN UFDATA_002_2025.dbo.Customer customer002
        ON customer002.cCusCode = sales002.cCusCode
    WHERE purchase_main002.cPOID = LTRIM(RTRIM(sales008.cDefine3))
      AND sales008.cCusCode = N'0086'
) source002
"""

OPEN_WORKORDER_SQL = f"""
SELECT a.MoCode_a,a.SortSeq_b,a.MDeptCode_b AS DeptCode,dp.cDepName,
       a.InvCode_b,inv.cInvName,inv.cInvStd,
       LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
       a.Qty_b,a.MoDId_b,a.StartDate_c,a.DueDate_c,
       original_plan.StartDate AS OriginalStartDate,
       original_plan.DueDate AS OriginalDueDate,
       {WORKORDER_CONTEXT_SELECT}
FROM momlist_yx a
LEFT JOIN Inventory inv ON a.InvCode_b=inv.cInvCode
LEFT JOIN Department dp ON a.MDeptCode_b=dp.cDepCode
OUTER APPLY (
    SELECT TOP 1 snapshot.StartDate,snapshot.DueDate
    FROM YX_TEST.dbo.mom_morder snapshot
    WHERE snapshot.MoDId=a.MoDId_b AND LTRIM(RTRIM(snapshot.zt))='008'
    ORDER BY CASE WHEN snapshot.UpdateTime IS NULL THEN 0 ELSE 1 END,
             snapshot.UpdateTime
) original_plan
{WORKORDER_CONTEXT_JOINS}
WHERE a.RelsDate_b IS NOT NULL AND a.CloseDate_b IS NULL
"""

PRODUCT_CONTEXT_SQL = """
SELECT a.MoCode_a,a.SortSeq_b,a.InvCode_b,a.CloseDate_b,inv.cInvName,
       inv.cInvStd,unit.cComUnitName AS unit_name,
       a.Qty_b,a.StartDate_c,a.DueDate_c,
       original_plan.StartDate AS OriginalStartDate,
       original_plan.DueDate AS OriginalDueDate,dp.cDepName,
       LTRIM(RTRIM(inv.cInvDefine7)) AS CategoryName,
       panel_lines.material_json AS panel_material_json,
       panel_area.required_area AS panel_required_area,
       panel_area.issued_area AS panel_issued_area,
       materials.issued_qty AS first_issued_qty,
       materials.calc_mode AS first_issue_calc_mode,
       materials.material_line_count AS first_issue_material_count,
       bottleneck.InvCode AS first_issue_bottleneck_inv_code,
       bottleneck.required_qty AS first_issue_bottleneck_required_qty,
       bottleneck.issued_qty AS first_issue_bottleneck_issued_qty,
       bottleneck.receipt_ratio AS first_issue_bottleneck_ratio
FROM momlist_yx a
LEFT JOIN Inventory inv ON inv.cInvCode=a.InvCode_b
LEFT JOIN Department dp ON dp.cDepCode=a.MDeptCode_b
LEFT JOIN ComputationUnit unit ON unit.cComunitCode=inv.cComUnitCode
OUTER APPLY (
    SELECT TOP 1 snapshot.StartDate,snapshot.DueDate
    FROM YX_TEST.dbo.mom_morder snapshot
    WHERE snapshot.MoDId=a.MoDId_b
      AND LTRIM(RTRIM(snapshot.zt))='008'
    ORDER BY CASE WHEN snapshot.UpdateTime IS NULL THEN 0 ELSE 1 END,
             snapshot.UpdateTime
) original_plan
OUTER APPLY (
    SELECT CASE WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN (
        SELECT LTRIM(RTRIM(ma.InvCode)) AS sub_code, inv_mat.cInvName AS sub_name,
               ma.Qty AS qty_plan,
               CASE WHEN ma.IssQty>0 THEN ma.IssQty ELSE 0 END AS qty_issued
        FROM dbo.mom_moallocate ma
        LEFT JOIN dbo.Inventory inv_mat ON inv_mat.cInvCode=ma.InvCode
        WHERE ma.MoDId=a.MoDId_b AND LEFT(LTRIM(RTRIM(ma.InvCode)),4)='4402'
        ORDER BY ma.SortSeq, ma.AllocateId
        FOR JSON PATH, INCLUDE_NULL_VALUES
    ) END AS material_json
) panel_lines
OUTER APPLY (
    SELECT CAST(SUM(line.qty_plan) AS decimal(28,8)) AS required_area,
           CAST(SUM(line.qty_issued) AS decimal(28,8)) AS issued_area,
           SUM(CASE WHEN line.qty_plan IS NULL OR line.qty_plan<=0 THEN 1 ELSE 0 END) AS invalid_lines
    FROM OPENJSON(panel_lines.material_json)
    WITH (qty_plan decimal(28,8), qty_issued decimal(28,8)) line
) panel_area
OUTER APPLY (
    SELECT CASE WHEN panel_area.required_area>0 AND panel_area.invalid_lines=0 AND a.Qty_b>0
        THEN ROUND(a.Qty_b * (panel_area.issued_area / NULLIF(panel_area.required_area,0)),4)
    END AS issued_qty
) panel_issue
OUTER APPLY (
    SELECT CASE
        WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN panel_issue.issued_qty
        WHEN SUM(CASE WHEN LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                           OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                      THEN 1 ELSE 0 END)>0
        THEN SUM(CASE WHEN ma.IssQty>0 AND (
                          LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                          OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                      ) THEN ma.IssQty ELSE 0 END)
        WHEN SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END)>0 AND a.Qty_b>0
        THEN a.Qty_b * MIN(CASE WHEN ma.Qty>0 THEN
            CASE WHEN COALESCE(ma.IssQty,0)<=0 THEN 0
                 WHEN ma.IssQty>=ma.Qty THEN 1
                 ELSE CAST(ma.IssQty AS decimal(28,10))
                      / NULLIF(CAST(ma.Qty AS decimal(28,10)),0) END END)
        ELSE NULL
    END AS issued_qty,
    CASE
        WHEN LTRIM(RTRIM(a.MDeptCode_b))='04125' THEN 'panel_area'
        WHEN SUM(CASE WHEN LEFT(LTRIM(RTRIM(ma.InvCode)),1) IN ('1','2')
                           OR LEFT(LTRIM(RTRIM(ma.InvCode)),2)='31'
                      THEN 1 ELSE 0 END)>0 THEN 'controlled_sum'
        WHEN SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END)>0 AND a.Qty_b>0 THEN 'bom_ratio'
        ELSE NULL
    END AS calc_mode,
    SUM(CASE WHEN ma.Qty>0 THEN 1 ELSE 0 END) AS material_line_count
    FROM mom_moallocate ma
    WHERE ma.MoDId=a.MoDId_b
) materials
OUTER APPLY (
    SELECT TOP 1 LTRIM(RTRIM(ma.InvCode)) AS InvCode,
        ma.Qty AS required_qty,
        CASE WHEN COALESCE(ma.IssQty,0)>0 THEN ma.IssQty ELSE 0 END AS issued_qty,
        ratio.receipt_ratio
    FROM mom_moallocate ma
    CROSS APPLY (
        SELECT CASE WHEN COALESCE(ma.IssQty,0)<=0 THEN 0
                    WHEN ma.IssQty>=ma.Qty THEN 1
                    ELSE CAST(ma.IssQty AS decimal(28,10))
                         / NULLIF(CAST(ma.Qty AS decimal(28,10)),0) END AS receipt_ratio
    ) ratio
    WHERE ma.MoDId=a.MoDId_b AND ma.Qty>0 AND materials.calc_mode='bom_ratio'
    ORDER BY ratio.receipt_ratio,LTRIM(RTRIM(ma.InvCode))
) bottleneck
WHERE a.RelsDate_b IS NOT NULL AND ({conditions})
"""


def _required_env(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少环境变量 {name}")
    return value


def _u8_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return value


def _u8_rows(cursor):
    columns = [column[0] for column in cursor.description]
    return [{key: _u8_value(value) for key, value in zip(columns, row)} for row in cursor.fetchall()]


def _product_info(row):
    if not row:
        return {
            "inv_code": "", "inv_name": "", "inv_std": "", "plan_qty": None,
            "product_category": "", "production_department": "",
            "plan_start_date": None, "plan_due_date": None,
            "original_start_date": None, "original_due_date": None,
            "so_code_008": "", "so_row_008": None, "source_account": "",
            "source_so_code": "", "customer_code": "", "customer_name": "",
            "is_closed": False,
        }
    return {
        "inv_code": row.get("InvCode_b") or row.get("inv_code") or "",
        "inv_name": row.get("cInvName") or row.get("inv_name") or "",
        "inv_std": row.get("cInvStd") or row.get("inv_std") or "",
        "plan_qty": row.get("Qty_b") if row.get("Qty_b") is not None else row.get("plan_qty"),
        "product_category": row.get("CategoryName") or "",
        "production_department": row.get("cDepName") or "",
        "plan_start_date": row.get("StartDate_c"),
        "plan_due_date": row.get("DueDate_c"),
        "original_start_date": row.get("OriginalStartDate") or row.get("original_start_date"),
        "original_due_date": row.get("OriginalDueDate") or row.get("original_due_date"),
        "so_code_008": row.get("SOCode008") or row.get("so_code_008") or "",
        "so_row_008": row.get("SORow008") if row.get("SORow008") is not None else row.get("so_row_008"),
        "source_account": row.get("SourceAccount") or row.get("source_account") or "",
        "source_so_code": row.get("SourceSOCode") or row.get("source_so_code") or "",
        "customer_code": row.get("CustomerCode") or row.get("customer_code") or "",
        "customer_name": row.get("CustomerName") or row.get("customer_name") or "",
        "is_closed": bool(row.get("CloseDate_b") or row.get("is_closed")),
    }


class DashboardDataSources:
    def __init__(self):
        self._pool = None
        self._pool_lock = threading.Lock()
        self._open_order_cache = {"expires_at": None, "rows": []}
        self._open_order_lock = threading.Lock()

    def mysql_connection(self):
        if self._pool is None:
            with self._pool_lock:
                if self._pool is None:
                    self._pool = mysql.connector.pooling.MySQLConnectionPool(
                        pool_name=os.getenv("DASHBOARD_DB_POOL_NAME", "jml_dashboard_pool"),
                        pool_size=max(1, int(os.getenv("DASHBOARD_DB_POOL_SIZE", "5"))),
                        pool_reset_session=True,
                        host=_required_env("DB2_HOST"),
                        user=_required_env("DB2_USER"),
                        password=_required_env("DB2_PASSWORD"),
                        database=_required_env("DB2_NAME"),
                        charset="utf8mb4",
                    )
        return self._pool.get_connection()

    def u8_connection(self):
        driver = os.getenv("U8_DB_DRIVER", "ODBC Driver 17 for SQL Server").strip()
        server = _required_env("U8_DB_SERVER")
        port = os.getenv("U8_DB_PORT", "1433").strip()
        if port and "," not in server and "\\" not in server:
            server = f"{server},{port}"
        timeout = max(1, int(os.getenv("U8_DB_TIMEOUT", "5")))
        connection_string = (
            f"DRIVER={{{driver}}};SERVER={server};DATABASE={_required_env('U8_DB_NAME')};"
            f"UID={_required_env('U8_DB_USER')};PWD={_required_env('U8_DB_PASSWORD')};"
            f"Connection Timeout={timeout};"
        )
        if driver.lower().startswith("odbc driver"):
            connection_string += "Encrypt=no;TrustServerCertificate=yes;"
        return pyodbc.connect(connection_string, timeout=timeout)

    def open_order_map(self):
        now = datetime.now()
        with self._open_order_lock:
            expires_at = self._open_order_cache["expires_at"]
            if expires_at and expires_at > now:
                rows = self._open_order_cache["rows"]
                return {(str(row["MoCode_a"]), int(row["SortSeq_b"])): row for row in rows}, True
            connection = None
            cursor = None
            try:
                connection = self.u8_connection()
                cursor = connection.cursor()
                cursor.execute(OPEN_WORKORDER_SQL)
                rows = _u8_rows(cursor)
                self._open_order_cache = {"expires_at": now + timedelta(minutes=2), "rows": rows}
                return {(str(row["MoCode_a"]), int(row["SortSeq_b"])): row for row in rows}, True
            except Exception:
                LOGGER.exception("dashboard open work-order lookup failed")
                rows = self._open_order_cache["rows"]
                return {(str(row["MoCode_a"]), int(row["SortSeq_b"])): row for row in rows}, False
            finally:
                if cursor is not None:
                    cursor.close()
                if connection is not None:
                    connection.close()

    def _report_workorder_context(self, rows):
        keys = sorted({
            (str(row["mo_code"]), int(row["sort_seq"]))
            for row in rows if row.get("mo_code") is not None and row.get("sort_seq") is not None
        })
        if not keys:
            return {}
        connection = None
        cursor = None
        result = {}
        try:
            connection = self.mysql_connection()
            cursor = connection.cursor(dictionary=True)
            for offset in range(0, len(keys), 300):
                chunk = keys[offset:offset + 300]
                conditions = " OR ".join(["(mo_code=%s AND sort_seq=%s)"] * len(chunk))
                cursor.execute(f"""
                    SELECT mo_code,sort_seq,inv_code,inv_name,inv_std,plan_qty,
                           so_code_008,so_row_008,source_account,source_so_code,
                           customer_code,customer_name
                    FROM mo_workorder_context_yx
                    WHERE {conditions}
                """, [value for key in chunk for value in key])
                for row in cursor.fetchall():
                    result[(str(row["mo_code"]), int(row["sort_seq"]))] = row
        except Exception:
            LOGGER.warning("work-order context table is not available", exc_info=True)
            return {}
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
        return result

    def product_context(self, rows):
        keys = sorted({(str(row["mo_code"]), int(row["sort_seq"])) for row in rows})
        if not keys:
            return {}, []
        products = {}
        warnings = []
        found_keys = set()
        connection = None
        cursor = None
        lookup_ok = False
        try:
            connection = self.u8_connection()
            connection.timeout = 20
            cursor = connection.cursor()
            for offset in range(0, len(keys), 400):
                chunk = keys[offset:offset + 400]
                conditions = " OR ".join(["(a.MoCode_a=? AND a.SortSeq_b=?)"] * len(chunk))
                cursor.execute(PRODUCT_CONTEXT_SQL.format(conditions=conditions), [value for key in chunk for value in key])
                for row in _u8_rows(cursor):
                    key = (str(row["MoCode_a"]), int(row["SortSeq_b"]))
                    found_keys.add(key)
                    products[key] = {
                        **_product_info(row),
                        "inv_std": row.get("cInvStd") or "",
                        "unit_name": row.get("unit_name") or "未标单位",
                        "first_issued_qty": row.get("first_issued_qty"),
                        "first_issue_calculation": {
                            "mode": "bom_ratio",
                            "material_count": row.get("first_issue_material_count"),
                            "bottleneck_inv_code": row.get("first_issue_bottleneck_inv_code"),
                            "bottleneck_required_qty": row.get("first_issue_bottleneck_required_qty"),
                            "bottleneck_issued_qty": row.get("first_issue_bottleneck_issued_qty"),
                            "bottleneck_ratio": row.get("first_issue_bottleneck_ratio"),
                        } if row.get("first_issue_calc_mode") == "bom_ratio" else (
                            {
                                "mode": "panel_area",
                                "required_area": row.get("panel_required_area"),
                                "issued_area": row.get("panel_issued_area"),
                                "materials": json.loads(row.get("panel_material_json") or "[]"),
                            } if row.get("first_issue_calc_mode") == "panel_area" else None
                        ),
                    }
            lookup_ok = True
        except Exception:
            LOGGER.exception("dashboard ERP context lookup failed")
            warnings.append("ERP实时资料查询未完成；未核对的首站可接收量显示为待核对，不影响查看报工记录。")
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

        context_map = self._report_workorder_context(rows)
        for key, context in context_map.items():
            context_product = _product_info(context)
            if key not in products:
                products[key] = {**context_product, "first_issued_qty": None, "unit_name": "未标单位"}
                continue
            for field in (
                "so_code_008", "so_row_008", "source_account", "source_so_code",
                "customer_code", "customer_name",
            ):
                products[key][field] = context_product[field]
        if lookup_ok:
            for key in keys:
                products.setdefault(key, {**_product_info(None), "first_issued_qty": None, "unit_name": "未标单位"})
                products[key]["erp_deleted"] = key not in found_keys
        return products, warnings


__all__ = ["DashboardDataSources", "_product_info"]
