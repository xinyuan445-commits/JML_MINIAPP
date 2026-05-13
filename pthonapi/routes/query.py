# routes/query.py
# -*- coding: utf-8 -*-
import re
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

from models.db import get_db      # MySQL 主库
from models.db2 import get_db2    # MySQL 第二个库（currentstock_yx）
from urllib.parse import unquote


query_bp = Blueprint("query", __name__)

# ============ 通用安全规则 ============

DDL_BLOCK = re.compile(r"\b(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b", re.I)


def _is_single_statement(sql: str) -> bool:
    """
    只允许单条语句：
      - 允许末尾有一个分号
      - 但不允许中间出现分号再继续写别的
    """
    stripped = sql.strip()
    if not stripped:
        return False
    # 去掉末尾单个分号再看是否还有 ';'
    core = stripped[:-1] if stripped.endswith(";") else stripped
    return ";" not in core


def only_select(sql: str) -> bool:
    """
    仅允许单条 SELECT 语句，不含 DDL 关键字
    """
    s = sql.lstrip()  # 去掉前导空白再判断
    return (
        s[:6].lower() == "select"
        and _is_single_statement(s)
        and not DDL_BLOCK.search(s)
    )


def only_insert(sql: str) -> bool:
    """
    仅允许单条 INSERT 语句，不含 DDL 关键字
    """
    s = sql.lstrip()
    return (
        s[:6].lower() == "insert"
        and _is_single_statement(s)
        and not DDL_BLOCK.search(s)
    )


# =========================
# License 验证接口
# =========================
@query_bp.route("/license", methods=["GET"])
def check_license():
    """
    大屏后端会定期调用此接口检查授权状态
    返回 1 表示授权有效，可以正常访问
    返回其他值表示授权无效，大屏将被锁定
    """
    # 可以在这里接入您的动态授权逻辑（比如查库、验证机器码等）
    # 目前按照需求，固定返回 1
    return jsonify({"status": 1, "msg": "Authorized"})

# -------------------------
# GET /api/query/run  —— 只读查询（仅 SELECT）
# -------------------------
@query_bp.route("/run", methods=["GET"])
def run_query():
    """
    浏览器示例：
    https://api.quanshenghuoqin.com/api/query/run?sql=select%20*%20from%20inventory%20limit%205
    """
    conn = None
    cur = None
    try:
        sql = request.args.get("sql")
        if not sql:
            return jsonify({"code": 1, "msg": "缺少 sql 参数"}), 400

        if not only_select(sql):
            return jsonify({"code": 1, "msg": "只允许执行单条 SELECT 语句"}), 400

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql)
        data = cur.fetchall()

        return jsonify({"code": 0, "msg": "success", "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# -------------------------
# POST /api/query/exec  —— 仅允许原始 INSERT 语句
# -------------------------
@query_bp.route("/exec", methods=["POST"])
def exec_insert():
    """
    Body: { "sql": "INSERT INTO table(col1,col2) VALUES('a','b')" }
    仅允许 INSERT 开头的单条语句
    """
    conn = None
    cur = None
    try:
        body = request.get_json(silent=True) or {}
        sql = body.get("sql")
        if not sql:
            return jsonify({"code": 1, "msg": "缺少 sql 参数"}), 400

        if not only_insert(sql):
            return jsonify({"code": 1, "msg": "只允许执行单条 INSERT 语句，且禁止 DDL/多语句"}), 400

        conn = get_db()
        cur = conn.cursor()
        cur.execute(sql)     # 注意：这是原始 SQL，自己确保来源可信
        affected = cur.rowcount
        conn.commit()

        return jsonify({"code": 0, "msg": "success", "data": {"affected": affected}})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# -------------------------
# POST /api/query/insert  —— 参数化插入（推荐，避免 SQL 注入）
# -------------------------
@query_bp.route("/insert", methods=["POST"])
def param_insert():
    """
    Body 示例：
    {
      "table": "inventory_log",
      "values": {"itemCode":"210001","qty":5.2,"batchNo":"B001","binLoc":"A-01"}
    }
    """
    conn = None
    cur = None
    try:
        body = request.get_json(silent=True) or {}
        table = body.get("table")
        values = body.get("values")

        if not table or not isinstance(values, dict) or not values:
            return jsonify({"code": 1, "msg": "缺少或非法的参数：table/values"}), 400

        # 基础白名单/表名校验（按需扩展到你的业务表）
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table):
            return jsonify({"code": 1, "msg": "非法表名"}), 400

        cols = list(values.keys())
        placeholders = ",".join(["%s"] * len(cols))  # MySQL 占位符
        collist = ",".join([f"`{c}`" for c in cols])
        sql = f"INSERT INTO `{table}` ({collist}) VALUES ({placeholders})"
        params = [values[c] for c in cols]

        conn = get_db()
        cur = conn.cursor()
        cur.execute(sql, params)
        affected = cur.rowcount
        last_id = getattr(cur, "lastrowid", None)
        conn.commit()

        return jsonify({"code": 0, "msg": "success",
                        "data": {"affected": affected, "last_id": last_id}})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================
# 盘点相关接口
# =========================

# 查询：盘点录入记录
@query_bp.route("/checkvouch", methods=["GET"])
def query_checkvouch():
    """
    盘点记录查询（必须传入 date / userId / pos）
    支持分页：
      page: 页码（从 1 开始）
      pageSize: 每页条数
    """

    conn = None
    cur = None
    try:
        # ===== 必填参数 =====
        date_str = request.args.get("date")
        user_id = request.args.get("userId")
        pos = request.args.get("pos")

        if not date_str or not user_id or not pos:
            return jsonify({"code": 1, "msg": "缺少必填参数：date / userId / pos"}), 400

        # 将 date（YYYY-MM-DD）转换为当日 [00:00, 次日00:00)
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({"code": 1, "msg": "date 格式应为 YYYY-MM-DD"}), 400

        start_dt = d.strftime("%Y-%m-%d 00:00:00")
        end_dt = (d + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")

        # ===== 分页参数 =====
        try:
            page = int(request.args.get("page", 1))
            page_size = int(request.args.get("pageSize", 20))
        except Exception:
            return jsonify({"code": 1, "msg": "分页参数非法"}), 400

        if page <= 0:
            page = 1
        if page_size <= 0:
            page_size = 20

        offset = (page - 1) * page_size

        # ===== SQL：数据列表 =====
        sql = """
            SELECT 
                id,
                cinvcode,
                cbatch,
                cposname,
                qty,
                `user`,
                remark,
                createtime,
                Delete_allowed
            FROM Checkvouch
            WHERE createtime >= %s
              AND createtime <  %s
              AND `user` = %s
              AND cposname = %s
              AND Delete_allowed = 1
            ORDER BY createtime DESC, id DESC
            LIMIT %s OFFSET %s
        """
        params = [start_dt, end_dt, user_id, pos, page_size, offset]

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()

        # ===== SQL：统计总数（含 Delete_allowed = 1） =====
        count_sql = """
            SELECT COUNT(*) AS total
            FROM Checkvouch
            WHERE createtime >= %s
              AND createtime <  %s
              AND `user` = %s
              AND cposname = %s
              AND Delete_allowed = 1
        """
        cur.execute(count_sql, [start_dt, end_dt, user_id, pos])
        total = cur.fetchone().get("total", 0)

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": rows,
            "total": total,
            "page": page,
            "pageSize": page_size
        })

    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# 盘点输入记录删除（软删除）
@query_bp.route("/checkvouch/delete", methods=["DELETE"])
def delete_checkvouch():
    """
    软删除：根据 id 将 Delete_allowed 设置为 0
    不物理删除记录
    """
    conn = None
    cur = None
    try:
        rid = request.args.get("id")
        if not rid:
            return jsonify({"code": 1, "msg": "缺少 id 参数"}), 400

        # 简单整数校验
        if not rid.isdigit():
            return jsonify({"code": 1, "msg": "非法 id 参数"}), 400

        conn = get_db()
        cur = conn.cursor()
        sql = "UPDATE Checkvouch SET Delete_allowed = 0 WHERE id = %s"
        cur.execute(sql, (rid,))
        conn.commit()
        affected = cur.rowcount

        return jsonify({"code": 0, "msg": "删除成功（软删除）", "data": {"affected": affected}})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================
# 库存查询（按 cinvcode + cbatch）
# =========================

@query_bp.route("/stock", methods=["GET"])
def query_stock_by_cinvcode_batch():
    """
    用法示例：
    GET /api/query/stock?cinvcode=11103-PB-F4-4018-CKB0540&cbatch=B001

    返回字段：
      cInvCode, cinvname, iQuantity, cBatch, cposname, cWhName, company
    """
    conn = None
    cur = None
    try:
        cinvcode = request.args.get("cinvcode", "").strip()
        cbatch = request.args.get("cbatch", "").strip()

        if not cinvcode or not cbatch:
            return jsonify({"code": 1, "msg": "缺少参数 cinvcode 或 cbatch"}), 400

        # 校验
        if not re.match(r"^[A-Za-z0-9._\\-]+$", cinvcode):
            return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400
        if not re.match(r"^[A-Za-z0-9._\\-]+$", cbatch):
            return jsonify({"code": 1, "msg": "非法的 cbatch 格式"}), 400

        sql = """
        SELECT 
            a.cInvCode,
            inv.cinvname,
            a.iQuantity,
            a.cBatch,
            b.cPosName AS cposname,
            wh.cWhName,
            CASE 
                WHEN a.source_db = 'UFDATA_001_2021' THEN '金米龙江苏'
                ELSE '科米龙江苏'
            END AS company
        FROM InvPositionSum_all a
        LEFT JOIN Position   b   ON a.cPosCode = b.cPosCode AND a.source_db = b.source_db
        LEFT JOIN Warehouse  wh  ON a.cWhCode  = wh.cWhCode AND a.source_db = wh.source_db
        LEFT JOIN inventory  inv ON a.cInvCode = inv.cinvcode
        WHERE a.cInvCode = %s
          AND a.cBatch   = %s
        """

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, (cinvcode, cbatch))
        rows = cur.fetchall()

        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# =========================
# /stock2 —— db2.currentstock_yx 库存查询
# =========================

@query_bp.get("/stock2")
def query_stock2_from_currentstock_yx():
    """
    查询库存（db2 / currentstock_yx）
    参数：
      cinvcode   可选，料号（支持 '%' 模糊；为空=查全部）
      ckb        可选，CKB（模糊）
      ptype      可选，'1'|'2'|'3'，按料号首位判断（1=成品 2=半成品 3=封边带）
      company    可选，'金米龙'|'科米龙'（空=全部）
      page       可选，默认 1
      page_size  可选，默认 50，最大 200

    返回：
      { code, msg, data: { total, page, page_size, rows: [
          id, cWhName, cInvCode, cInvName, cInvStd, CKB, iQuantity(两位小数), cBatch, company, sync_time
      ]}}
    """
    conn = None
    cur = None
    try:
        # 取参
        cinvcode = (request.args.get("cinvcode") or "").strip()
        ckb = (request.args.get("ckb") or "").strip()
        ptype = (request.args.get("ptype") or "").strip()      # '1'|'2'|'3'
        company = (request.args.get("company") or "").strip()  # '金米龙'|'科米龙' or ''

        # 分页
        try:
            page = max(1, int(request.args.get("page", 1)))
            page_size = min(200, max(1, int(request.args.get("page_size", 50))))
        except Exception:
            return jsonify({"code": 1, "msg": "非法分页参数"}), 400
        offset = (page - 1) * page_size

        # ------- 安全校验 & 构造条件 -------
        # 料号为空 => 查全部：用 LIKE '%'
        if not cinvcode:
            cinvcode = "%"

        safe_like = re.compile(r"^[A-Za-z0-9._\-%]+$")
        safe_val = re.compile(r"^[A-Za-z0-9._\-]+$")

        # cinvcode 允许 '%'；其它字段不允许通配符
        if "%" in cinvcode:
            if not safe_like.match(cinvcode):
                return jsonify({"code": 1, "msg": "非法的 cinvcode"}), 400
        else:
            if not safe_val.match(cinvcode):
                return jsonify({"code": 1, "msg": "非法的 cinvcode"}), 400

        if ckb and not safe_val.match(ckb):
            return jsonify({"code": 1, "msg": "非法的 ckb"}), 400

        if ptype and ptype not in ("1", "2", "3"):
            return jsonify({"code": 1, "msg": "非法的 ptype"}), 400

        if company and company not in ("金米龙", "科米龙"):
            return jsonify({"code": 1, "msg": "非法的 company"}), 400

        where = []
        params = []

        # 料号 LIKE
        like_code = cinvcode if "%" in cinvcode else f"%{cinvcode}%"
        where.append("cInvCode LIKE %s")
        params.append(like_code)

        # CKB 模糊
        if ckb:
            where.append("CKB LIKE %s")
            params.append(f"%{ckb}%")

        # 产品类型（按料号前1位）
        if ptype:
            where.append("LEFT(cInvCode, 1) = %s")
            params.append(ptype)

        # 公司精确
        if company:
            where.append("company = %s")
            params.append(company)

        where_sql = " AND ".join(where) if where else "1=1"

        # ------- SQL -------
        count_sql = f"SELECT COUNT(*) AS cnt FROM currentstock_yx WHERE {where_sql}"
        main_sql = f"""
            SELECT
              id,
              cWhName,
              cInvCode,
              cInvName,
              cInvStd,
              CKB,
              CAST(ROUND(iQuantity, 2) AS DOUBLE) AS iQuantity,  -- 数量保留两位小数，返回数字
              cBatch,
              company,
              sync_time
            FROM currentstock_yx
            WHERE {where_sql}
            ORDER BY cWhName ASC, cInvCode ASC, cBatch ASC, id ASC
            LIMIT %s OFFSET %s
        """

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        # 总数
        cur.execute(count_sql, params)
        total = (cur.fetchone() or {}).get("cnt", 0)

        # 数据
        run_params = params + [page_size, offset]
        cur.execute(main_sql, run_params)
        rows = cur.fetchall()

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "rows": rows
            }
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()



@query_bp.route("/stock/by-cinvcode", methods=["GET"])
def query_stock_by_cinvcode():
    """
    GET /api/query/stock/by-cinvcode?cinvcode=11103-PB-F4-4018-CKB0540

    返回字段：
      cInvCode, cinvname, iQuantity, cBatch, cposname, cWhName, company
    """
    conn = None
    cur = None
    try:
        cinvcode = request.args.get("cinvcode", "").strip()

        if not cinvcode:
            return jsonify({"code": 1, "msg": "缺少参数 cinvcode"}), 400

        # 参数校验
        if not re.match(r"^[A-Za-z0-9._\\-]+$", cinvcode):
            return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400

        sql = """
        SELECT
            cInvCode,
            cinvname,
            iQuantity,
            cBatch,
            cposname,
            cWhName,
            '' AS company
        FROM InvPositionSum_yx
        WHERE cInvCode = %s
        """

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, (cinvcode,))
        rows = cur.fetchall()

        return jsonify({"code": 0, "msg": "success", "data": rows})

    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# @query_bp.route("/stock/by-cinvcode", methods=["GET"])
# def query_stock_by_cinvcode():
#     """
#     用法示例：
#     GET /api/query/stock/by-cinvcode?cinvcode=11103-PB-F4-4018-CKB0540

#     返回字段：
#       cInvCode, cinvname, iQuantity, cBatch, cposname, cWhName, company
#     """
#     conn = None
#     cur = None
#     try:
#         cinvcode = request.args.get("cinvcode", "").strip()

#         if not cinvcode:
#             return jsonify({"code": 1, "msg": "缺少参数 cinvcode"}), 400

#         # 参数校验
#         if not re.match(r"^[A-Za-z0-9._\\-]+$", cinvcode):
#             return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400

#         sql = """
#         SELECT 
#             a.cInvCode,
#             inv.cinvname,
#             a.iQuantity,
#             a.cBatch,
#             b.cPosName AS cposname,
#             wh.cWhName
#             CASE 
#                 WHEN a.source_db = 'UFDATA_001_2021' THEN '金米龙江苏'
#                 ELSE '科米龙江苏'
#             END AS company
#         FROM InvPositionSum_all a
#         LEFT JOIN Position   b   ON a.cPosCode = b.cPosCode 
#         LEFT JOIN Warehouse  wh  ON a.cWhCode  = wh.cWhCode 
#         LEFT JOIN inventory  inv ON a.cInvCode = inv.cinvcode
#         WHERE a.cInvCode = %s
#         ORDER BY a.cBatch
#         """

#         conn = get_db()
#         cur = conn.cursor(dictionary=True)
#         cur.execute(sql, (cinvcode,))
#         rows = cur.fetchall()

#         return jsonify({"code": 0, "msg": "success", "data": rows})

#     except Exception as e:
#         return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()



# 查询标签剩余数量
@query_bp.route("/label/qty", methods=["GET"])
def query_label_qty():
    """
    GET /api/query/label/qty?traceBackCode=xxx
    返回：
      qty        标签剩余数量
      warehouse  最近一次操作仓库
      cPosName   最近一次操作货位
    """
    conn = None
    cur = None
    try:
        traceBackCode_raw = request.args.get("traceBackCode", "").strip()
        traceBackCode = unquote(traceBackCode_raw)

        if not traceBackCode:
            return jsonify({"code": 1, "msg": "缺少参数 traceBackCode"}), 400

        if not re.match(r"^[A-Za-z0-9._\-|]+$", traceBackCode):
            return jsonify({"code": 1, "msg": "非法的 traceBackCode 格式"}), 400

        conn = get_db()
        cur = conn.cursor(dictionary=True)

        # ① 剩余数量
        sql_qty = """
        SELECT SUM(`sum`) AS qty
        FROM TraceBackOnlyCode_all
        WHERE traceBackCode = %s
        """
        cur.execute(sql_qty, (traceBackCode,))
        row_qty = cur.fetchone()
        qty = int(row_qty["qty"]) if row_qty and row_qty["qty"] is not None else 0

        # ② 最近一次仓库 + 货位
        sql_pos = """
        SELECT 
            JSON_UNQUOTE(JSON_EXTRACT(tgoods.json, '$.inventory.warehouse'))       AS warehouse,
            JSON_UNQUOTE(JSON_EXTRACT(tgoods.json, '$.inventory.storageLocation')) AS cPosName,
            tcode.time   AS last_time,
            tcode.`User` AS last_user
        FROM TraceBackOnlyCode_all tcode
        JOIN TraceBackGoods_all tgoods
            ON tcode.pdaGoodsUuid = tgoods.pdaGoodsUuid
        JOIN (
            SELECT traceBackCode, MAX(time) AS max_time
            FROM TraceBackOnlyCode_all
            WHERE traceBackCode = %s 
            AND pdaGoodsUuid IS NOT NULL 
            AND pdaGoodsUuid <> ''
            GROUP BY traceBackCode
        ) latest
            ON latest.traceBackCode = tcode.traceBackCode
           AND latest.max_time = tcode.time
        """

        cur.execute(sql_pos, (traceBackCode,))
        row_pos = cur.fetchone() or {}

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": {
                "traceBackCode": traceBackCode,
                "qty": qty,
                "warehouse": row_pos.get("warehouse", ""),
                "cPosName": row_pos.get("cPosName", ""),
                "last_time": row_pos.get("last_time"),
                "last_user": row_pos.get("last_user")
            }
        })

    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# @query_bp.route("/label/qty", methods=["GET"])
# def query_label_qty():
#     """
#     用法示例：
#     GET /api/query/label/qty?traceBackCode=008|1320ZZ-PB-F4-4918-WNCR9-9001|20251103|49|2512170001

#     返回：
#       qty  标签剩余数量
#     """
#     conn = None
#     cur = None
#     try:
#         # traceBackCode = request.args.get("traceBackCode", "").strip()

#         # if not traceBackCode:
#         #     return jsonify({"code": 1, "msg": "缺少参数 traceBackCode"}), 400

#         # # 基础校验（允许 | - _ . 数字字母）
#         # if not re.match(r"^[A-Za-z0-9._\\-|]+$", traceBackCode):
#         #     return jsonify({"code": 1, "msg": "非法的 traceBackCode 格式"}), 400
            
#         traceBackCode_raw = request.args.get("traceBackCode", "").strip()
#         traceBackCode = unquote(traceBackCode_raw)
        
#         if not traceBackCode:
#             return jsonify({"code": 1, "msg": "缺少参数 traceBackCode"}), 400
        
#         if not re.match(r"^[A-Za-z0-9._\-|]+$", traceBackCode):
#             return jsonify({"code": 1, "msg": "非法的 traceBackCode 格式"}), 400

#         sql = """
#         SELECT 
#             traceBackCode,
#             SUM(`sum`) AS qty
#         FROM TraceBackOnlyCode_all
#         WHERE traceBackCode = %s
#         GROUP BY traceBackCode
#         """

#         conn = get_db()
#         cur = conn.cursor(dictionary=True)
#         cur.execute(sql, (traceBackCode,))
#         row = cur.fetchone()

#         # 如果没记录，默认数量为 0
#         qty = row["qty"] if row and row["qty"] is not None else 0

#         return jsonify({
#             "code": 0,
#             "msg": "success",
#             "data": {
#                 "traceBackCode": traceBackCode,
#                 "qty": qty
#             }
#         })

#     except Exception as e:
#         return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
#     finally:
#         if cur:
#             cur.close()
#         if conn:
#             conn.close()
            
            
            # 根据料号查询名称
@query_bp.route("/inventory/name", methods=["GET"])
def query_inventory_name():
    """
    用法示例：
    GET /api/query/inventory/name?cinvcode=1313ZS-HDF-E1-4008-ELCR9-5004

    返回：
      cinvcode, cinvname
    """
    conn = None
    cur = None
    try:
        cinvcode = request.args.get("cinvcode", "").strip()

        if not cinvcode:
            return jsonify({"code": 1, "msg": "缺少参数 cinvcode"}), 400

        # 参数校验（与库存接口保持一致）
        if not re.match(r"^[A-Za-z0-9._\-]+$", cinvcode):
            return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400

        sql = """
        SELECT 
            cInvCode AS cinvcode,
            cinvname
        FROM inventory
        WHERE cInvCode = %s
        LIMIT 1
        """

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, (cinvcode,))
        row = cur.fetchone()

        if not row:
            return jsonify({
                "code": 0,
                "msg": "未找到存货",
                "data": None
            })

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": row
        })

    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# 货位存量查询
@query_bp.route("/stock/by-position", methods=["GET"])
def query_stock_by_position():
    """
    用法示例：
    GET /api/query/stock/by-position?position=1101&page=1&page_size=20
    """
    conn = None
    cur = None
    try:
        position = request.args.get("position", "").strip()
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))

        if not position:
            return jsonify({"code": 1, "msg": "缺少参数 position"}), 400

        if page < 1 or page_size < 1 or page_size > 100:
            return jsonify({"code": 1, "msg": "分页参数不合法"}), 400

        offset = (page - 1) * page_size

        sql = """
        SELECT
            cInvCode,
            cinvname,
            iQuantity,
            cBatch
        FROM InvPositionSum_yx
        WHERE cPosName = %s
        ORDER BY cInvCode
        LIMIT %s OFFSET %s
        """

        count_sql = """
        SELECT COUNT(1)
        FROM InvPositionSum_yx
        WHERE cPosName = %s
        """

        conn = get_db()
        cur = conn.cursor()

        # 总数
        cur.execute(count_sql, (position,))
        total = cur.fetchone()[0]

        # 分页数据
        cur.execute(sql, (position, page_size, offset))
        rows = cur.fetchall()

        data = []
        for r in rows:
            data.append({
                "cInvCode": r[0],
                "cinvname": r[1],
                "iQuantity": float(r[2]) if r[2] is not None else 0,
                "cBatch": r[3]
            })

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": data,
            "page": page,
            "page_size": page_size,
            "total": total
        })

    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
