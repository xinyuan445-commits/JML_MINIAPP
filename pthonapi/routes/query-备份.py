# # routes/query.py
# from flask import Blueprint, request, jsonify
# from models.db import get_db

# query_bp = Blueprint("query", __name__)

# @query_bp.route("/run", methods=["GET"])
# def run_query():
#     """
#     通用 SQL 查询接口 (GET 版)
#     浏览器访问示例：
#     http://api.quanshenghuoqin.com:8668/api/query/run?sql=SELECT+id,name,price+FROM+PRODUCT
#     """
#     try:
#         sql = request.args.get("sql")
#         if not sql:
#             return jsonify({"code": 1, "msg": "缺少 sql 参数"}), 400

#         # 简单安全限制：只允许 SELECT
#         if not sql.strip().lower().startswith("select,intern"):
#             return jsonify({"code": 1, "msg": "只允许执行 SELECT 语句"}), 400

#         conn = get_db()
#         cursor = conn.cursor(dictionary=True)
#         cursor.execute(sql)
#         data = cursor.fetchall()
#         cursor.close()
#         conn.close()

#         return jsonify({
#             "code": 0,
#             "msg": "success",
#             "data": data
#         })
#     except Exception as e:
#         return jsonify({
#             "code": 1,
#             "msg": "error",
#             "error": str(e)
#         }), 500


# routes/query.py
from flask import Blueprint, request, jsonify
from models.db import get_db
import re

query_bp = Blueprint("query", __name__)

# --- 简单的安全校验 ---
DDL_BLOCK = re.compile(r"\b(DROP|TRUNCATE|ALTER|CREATE)\b", re.I)
MULTI_STMT = re.compile(r";\s*(--|/\*|$)", re.I)

def only_select(sql: str) -> bool:
    s = sql.strip()
    return s[:6].lower() == "select" and not DDL_BLOCK.search(s) and not MULTI_STMT.search(s)

def only_insert(sql: str) -> bool:
    s = sql.strip()
    # 仅允许 INSERT 开头，禁止 DDL、多语句
    return s[:6].lower() == "insert" and not DDL_BLOCK.search(s) and not MULTI_STMT.search(s)

# -------------------------
# GET /api/query/run  —— 只读查询（仅 SELECT）
# -------------------------
@query_bp.route("/run", methods=["GET"])
def run_query():
    """
    浏览器示例：
    https://api.quanshenghuoqin.com/api/query/run?sql=select%20*%20from%20inventory%20limit%205
    """
    try:
        sql = request.args.get("sql")
        if not sql:
            return jsonify({"code": 1, "msg": "缺少 sql 参数"}), 400

        if not only_select(sql):
            return jsonify({"code": 1, "msg": "只允许执行 SELECT 语句"}), 400

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql)
        data = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify({"code": 0, "msg": "success", "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


# -------------------------
# POST /api/query/exec  —— 仅允许原始 INSERT 语句
# -------------------------
@query_bp.route("/exec", methods=["POST"])
def exec_insert():
    """
    Body: { "sql": "INSERT INTO table(col1,col2) VALUES('a','b')" }
    仅允许 INSERT 开头的单条语句
    """
    try:
        body = request.get_json(silent=True) or {}
        sql = body.get("sql")
        if not sql:
            return jsonify({"code": 1, "msg": "缺少 sql 参数"}), 400

        if not only_insert(sql):
            return jsonify({"code": 1, "msg": "只允许执行 INSERT 语句，且禁止 DDL/多语句"}), 400

        conn = get_db()
        cur = conn.cursor()
        cur.execute(sql)     # 注意：这是原始 SQL，自己确保来源可信
        affected = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"affected": affected}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


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
        cur.close()
        conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"affected": affected, "last_id": last_id}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
        
        
# 查询，盘点录入记录
@query_bp.route("/checkvouch", methods=["GET"])
def query_checkvouch():
    """
    盘点记录查询（必须传入 date / userId / pos）
    支持分页：
      page: 页码（从 1 开始）
      pageSize: 每页条数
    """

    try:
        # ===== 必填参数 =====
        date = request.args.get("date")
        user_id = request.args.get("userId")
        pos = request.args.get("pos")

        if not date or not user_id or not pos:
            return jsonify({"code": 1, "msg": "缺少必填参数：date / userId / pos"}), 400

        # ===== 分页参数 =====
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 20))

        if page <= 0:
            page = 1
        if page_size <= 0:
            page_size = 20

        offset = (page - 1) * page_size

        # ===== SQL =====
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
            WHERE DATE(createtime) = %s
              AND `user` = %s
              AND cposname = %s
              and Delete_allowed = 1
            ORDER BY createtime DESC, id DESC
            LIMIT %s OFFSET %s
        """

        params = [date, user_id, pos, page_size, offset]

        # ===== 查询数据 =====
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()

        # ===== 统计总数（用于分页） =====
        count_sql = """
            SELECT COUNT(*) AS total
            FROM Checkvouch
            WHERE DATE(createtime) = %s
              AND `user` = %s
              AND cposname = %s
        """
        cur.execute(count_sql, [date, user_id, pos])
        total = cur.fetchone().get("total", 0)

        cur.close()
        conn.close()

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
        

# 盘点输入记录删除      
@query_bp.route("/checkvouch/delete", methods=["DELETE"])
def delete_checkvouch():
    """
    软删除：根据 id 将 Delete_allowed 设置为 0
    不物理删除记录
    """
    try:
        rid = request.args.get("id")
        if not rid:
            return jsonify({"code": 1, "msg": "缺少 id 参数"}), 400

        conn = get_db()
        cur = conn.cursor()

        # 将 Delete_allowed 更新为 0（软删除）
        sql = "UPDATE Checkvouch SET Delete_allowed = 0 WHERE id = %s"
        cur.execute(sql, (rid,))
        conn.commit()

        return jsonify({"code": 0, "msg": "删除成功（软删除）"})

    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500





# -------------------------
# GET /api/query/stock —— 库存查询（传入 cinvcode）
# -------------------------
# @query_bp.route("/stock", methods=["GET"])
# def query_stock_by_cinvcode():
#     """
#     用法示例：
#     GET /api/query/stock?cinvcode=11103-PB-F4-4018-CKB0540
#     返回字段：
#       cInvCode, cinvname, iQuantity, cBatch, cposname, cWhName, company
#     """
#     try:
#         cinvcode = request.args.get("cinvcode", "").strip()
#         if not cinvcode:
#             return jsonify({"code": 1, "msg": "缺少参数 cinvcode"}), 400

#         # 可选的基本校验（允许字母数字/中划线/下划线/点号）
#         if not re.match(r"^[A-Za-z0-9._\-]+$", cinvcode):
#             return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400

#         sql = """
#         SELECT 
#             a.cInvCode,
#             inv.cinvname,
#             a.iQuantity,
#             a.cBatch,
#             b.cPosName AS cposname,
#             wh.cWhName,
#             CASE 
#                 WHEN a.source_db = 'UFDATA_001_2021' THEN '金米龙江苏'
#                 ELSE '科米龙江苏'
#             END AS company
#         FROM InvPositionSum_all a
#         LEFT JOIN Position   b   ON a.cPosCode = b.cPosCode AND a.source_db = b.source_db
#         LEFT JOIN Warehouse  wh  ON a.cWhCode  = wh.cWhCode AND a.source_db = wh.source_db
#         LEFT JOIN inventory  inv ON a.cInvCode = inv.cinvcode
#         WHERE a.cInvCode = %s
#         """

#         conn = get_db()
#         cur = conn.cursor(dictionary=True)
#         cur.execute(sql, (cinvcode,))
#         rows = cur.fetchall()
#         cur.close()
#         conn.close()

#         return jsonify({"code": 0, "msg": "success", "data": rows})
#     except Exception as e:
#         return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
@query_bp.route("/stock", methods=["GET"])
def query_stock_by_cinvcode_batch():
    """
    用法示例：
    GET /api/query/stock?cinvcode=11103-PB-F4-4018-CKB0540&cbatch=B001

    返回字段：
      cInvCode, cinvname, iQuantity, cBatch, cposname, cWhName, company
    """
    try:
        cinvcode = request.args.get("cinvcode", "").strip()
        cbatch   = request.args.get("cbatch", "").strip()

        if not cinvcode or not cbatch:
            return jsonify({"code": 1, "msg": "缺少参数 cinvcode 或 cbatch"}), 400

        # 校验
        if not re.match(r"^[A-Za-z0-9._\-]+$", cinvcode):
            return jsonify({"code": 1, "msg": "非法的 cinvcode 格式"}), 400
        if not re.match(r"^[A-Za-z0-9._\-]+$", cbatch):
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
        cur.close()
        conn.close()

        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500
        
        
        
        
        
# routes/query.py
import re
from flask import Blueprint, request, jsonify
from models.db2 import get_db2

# 如果文件里已有 query_bp，就不要重复定义
# query_bp = Blueprint("query", __name__)  # 若已定义，请删掉本行

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
    try:
      # 取参
      cinvcode = (request.args.get("cinvcode") or "").strip()
      ckb      = (request.args.get("ckb") or "").strip()
      ptype    = (request.args.get("ptype") or "").strip()      # '1'|'2'|'3'
      company  = (request.args.get("company") or "").strip()    # '金米龙'|'科米龙' or ''

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
      safe_val  = re.compile(r"^[A-Za-z0-9._\-]+$")

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

      cur.close(); conn.close()

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
