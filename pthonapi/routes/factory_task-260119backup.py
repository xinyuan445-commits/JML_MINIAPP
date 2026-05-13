# routes/factory_task.py
from flask import Blueprint, request, jsonify
from models.db import get_db
from models.db2 import get_db2   # ✅ 使用 db2（阿里云 RDS: wecom-db）

from datetime import datetime, timedelta

factory_task_bp = Blueprint("factory_task", __name__, url_prefix="/api/factory/task")

@factory_task_bp.get("/list")
def list_devices():
    """
    获取工厂设备任务列表（只取启用设备，按 sort 排序）
    """
    try:
        sql = """
            SELECT id, device_name, location
            FROM jml_device_yx
            WHERE enable = 1
            ORDER BY sort ASC, id ASC
        """
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


# 1) 取单号：KG-yyyymmdd-XXX（方案A：无存储过程）
@factory_task_bp.get("/docno/next")
def get_next_docno():
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO jml_docseq_yx (doc_type, seq_date, counter)
            VALUES ('KG', CURRENT_DATE(), 1)
            ON DUPLICATE KEY UPDATE counter = LAST_INSERT_ID(counter + 1)
        """)
        cur.execute("""
            SELECT CONCAT('KG-', DATE_FORMAT(CURRENT_DATE(), '%Y%m%d'), '-', LPAD(LAST_INSERT_ID(), 3, '0')) AS doc_no
        """)
        doc_no = cur.fetchone()[0]
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"code":0,"msg":"success","data":{"doc_no":doc_no}})
    except Exception as e:
        return jsonify({"code":1,"msg":"error","error":str(e)}), 500

# 2) 新增开关登记（制单提交）
@factory_task_bp.post("/switch-log/add")
def add_switch_log():
    try:
        data = request.get_json(silent=True) or {}
        need = ["doc_no","device_id","op_type","staff_id"]
        miss = [k for k in need if not data.get(k)]
        if miss:
            return jsonify({"code":1,"msg":f"缺少参数: {', '.join(miss)}"}), 400

        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO jml_device_switch_log_yx
            (doc_no, device_id, op_type, staff_id, photo_url, remark)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data["doc_no"], data["device_id"], data["op_type"], data["staff_id"],
            data.get("photo_url"), data.get("remark")
        ))
        conn.commit()
        inserted_id = cur.lastrowid
        cur.close(); conn.close()
        return jsonify({"code":0,"msg":"success","data":{"id":inserted_id,"doc_no":data["doc_no"]}})
    except Exception as e:
        return jsonify({"code":1,"msg":"error","error":str(e)}), 500
        
        
@factory_task_bp.get("/switch-log/list")
def list_switch_log_by_range():
    try:
        from datetime import datetime, timedelta

        start = request.args.get("start")
        end   = request.args.get("end")
        device_id = request.args.get("device_id")
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 50))
        offset = (page - 1) * page_size

        start_dt = start + " 00:00:00"
        end_dt   = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")

        # 基础 SQL
        sql = """
        SELECT
            a.doc_no,
            c.device_name,
            b.staff_name,
            a.op_type,
            a.photo_url,
            a.remark,
            a.created_time
        FROM jml_device_switch_log_yx a
        LEFT JOIN jml_staff_yx b  ON a.staff_id  = b.staff_id
        LEFT JOIN jml_device_yx c ON a.device_id = c.id
        WHERE a.created_time >= %s AND a.created_time < %s
        """
        params = [start_dt, end_dt]

        if device_id:
            sql += " AND a.device_id = %s"
            params.append(device_id)

        # ✅ 使用 LIMIT offset, size 写法
        sql += " ORDER BY a.created_time DESC, a.id DESC LIMIT %s, %s"
        params.extend([offset, page_size])

        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": rows})

    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)}), 500





@factory_task_bp.get("/switch-log/detail")
def get_switch_log_detail_by_docno():
    try:
        doc_no = (request.args.get("doc_no") or "").strip()
        if not doc_no:
            return jsonify({"code": 1, "msg": "缺少参数：doc_no"}), 400

        sql = """
        SELECT a.id, a.doc_no,
               a.device_id, c.device_name, c.location,
               a.op_type, 
               a.staff_id, b.staff_name,
               a.photo_url, a.remark,
               a.created_time

        FROM jml_device_switch_log_yx a
        LEFT JOIN jml_staff_yx b ON a.staff_id = b.staff_id
        LEFT JOIN jml_device_yx c ON a.device_id = c.id
        WHERE a.doc_no = %s
        """
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, (doc_no,))
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return jsonify({"code": 0, "msg": "not found", "data": None})
        return jsonify({"code": 0, "msg": "success", "data": row})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500




# 顶部确保引入 db2
from models.db2 import get_db2

@factory_task_bp.get("/tools/user-permissions")
def get_user_tools_from_db2():
    """
    传入 user_id，只返回：工具启用 && 用户授权启用 的工具清单
    只要有一个没启用，就不返回此条数据
    """
    try:
        user_id = (request.args.get("user_id") or "").strip()
        if not user_id:
            return jsonify({"code": 1, "msg": "缺少参数：user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        # 1) 查用户（可选，但便于返回用户名）
        cur.execute("SELECT id AS user_id, name AS user_name FROM jml_staff WHERE id = %s", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            cur.close(); conn.close()
            return jsonify({"code": 0, "msg": "user not found", "data": None})

        # 2) 只返回双方都启用的工具
        #   - 工具启用：t.is_active = 1
        #   - 用户启用：p.is_enabled = 1（无记录视为 0，用 COALESCE 过滤）
        sql = """
            SELECT
              t.id        AS tool_id,
              t.tool_name,
              t.path,
              t.icon,
              t.emoji
            FROM tool_yx t
            LEFT JOIN user_tool_permission_yx p
              ON p.tool_id = t.id AND p.user_id = %s
            WHERE t.is_active = 1
              AND COALESCE(p.is_enabled, 0) = 1
            ORDER BY t.id ASC
        """
        cur.execute(sql, (user_id,))
        rows = cur.fetchall()

        cur.close(); conn.close()

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": {
                "user": user_row,
                "tools": rows
            }
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

        
@factory_task_bp.post("/scan/check")
def scan_check():
    try:
        data = request.get_json(silent=True) or {}
        work_order_no = (data.get("work_order_no") or "").strip()
        line_no = int(data.get("line_no") or 0)
        user_id = (data.get("user_id") or "").strip()
        if not work_order_no or not line_no or not user_id:
            return jsonify({"code": 1, "msg": "缺少参数：work_order_no / line_no / user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        # 仅检查“今天”的最新一条记录
        cur.execute("""
            SELECT id, work_order_no, line_no, user_id, line_name,
                   scan_time, end_time, end_qty
            FROM scan_report_yx
            WHERE work_order_no=%s AND line_no=%s AND user_id=%s
              AND DATE(scan_time)=CURRENT_DATE()
            ORDER BY scan_time DESC, id DESC
            LIMIT 1
        """, (work_order_no, line_no, user_id))
        row = cur.fetchone()
        cur.close(); conn.close()

        def fmt(dt):
            from datetime import datetime
            return dt.strftime("%Y-%m-%d %H:%M:%S") if dt and not isinstance(dt, str) else dt

        if row:
            # 今天有记录：如果未完结 -> 禁止再次开始，只能结束；已完结 -> 允许开始新段
            is_finished = row["end_time"] is not None
            if not is_finished:
                # 未结束：前端显示结束栏，禁止开始
                return jsonify({
                    "code": 0, "msg": "success",
                    "data": {
                        "has_record": True,               # 今天存在未结束的
                        "can_submit_start": False,
                        "show_end_fields": True,
                        "data": {
                            "work_order_no": row["work_order_no"],
                            "line_no": row["line_no"],
                            "line_name": row["line_name"],
                            "scan_time": fmt(row["scan_time"]),
                            "end_time": fmt(row["end_time"]),
                            "end_qty": float(row["end_qty"]) if row["end_qty"] is not None else None
                        }
                    }
                })
            else:
                # 已结束：允许重新开始，不显示结束栏。可把最新已完结信息返给前端参考
                return jsonify({
                    "code": 0, "msg": "success",
                    "data": {
                        "has_record": False,              # 视为“没有阻止开始的记录”
                        "can_submit_start": True,
                        "show_end_fields": False,
                        "last_finished": {
                            "scan_time": fmt(row["scan_time"]),
                            "end_time": fmt(row["end_time"]),
                            "end_qty": float(row["end_qty"]) if row["end_qty"] is not None else None,
                            "line_name": row["line_name"],
                        }
                    }
                })
        else:
            # 今天完全没有记录：可开始
            return jsonify({
                "code": 0, "msg": "success",
                "data": {
                    "has_record": False,
                    "can_submit_start": True,
                    "show_end_fields": False,
                    "data": None
                }
            })
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500



@factory_task_bp.post("/scan/submit")
def scan_submit():
    try:
        data = request.get_json(silent=True) or {}
        work_order_no = (data.get("work_order_no") or "").strip()
        line_no = int(data.get("line_no") or 0)
        user_id = (data.get("user_id") or "").strip()
        if not work_order_no or not line_no or not user_id:
            return jsonify({"code": 1, "msg": "缺少参数：work_order_no / line_no / user_id"}), 400

        line_name = (data.get("line_name") or "").strip() or None
        scan_time = (data.get("scan_time") or "").strip() or None
        end_time  = (data.get("end_time")  or "").strip() or None
        end_qty   = data.get("end_qty", None)

        from datetime import datetime
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        # 只把“今天未结束”的记录视为可更新目标
        cur.execute("""
            SELECT id FROM scan_report_yx
            WHERE work_order_no=%s AND line_no=%s AND user_id=%s
              AND DATE(scan_time)=CURRENT_DATE()
              AND end_time IS NULL
            ORDER BY scan_time DESC, id DESC
            LIMIT 1
        """, (work_order_no, line_no, user_id))
        exist = cur.fetchone()

        if not exist:
            # 插入新的“开始段”（允许同一工单同一天多段）
            if not line_name:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "开始报工需要提供 line_name"}), 400
            use_scan_time = scan_time or now_str
            cur.execute("""
                INSERT INTO scan_report_yx
                (work_order_no, line_no, user_id, line_name, scan_time)
                VALUES (%s, %s, %s, %s, %s)
            """, (work_order_no, line_no, user_id, line_name, use_scan_time))
            conn.commit()
            new_id = cur.lastrowid
            cur.close(); conn.close()
            return jsonify({"code":0,"msg":"inserted","data":{"id":new_id,"mode":"insert","scan_time":use_scan_time}})
        else:
            # 更新“今天未结束”的那条
            use_end_time = end_time or now_str
            cur.execute("""
                UPDATE scan_report_yx
                SET end_time=%s, end_qty=%s, update_time=NOW()
                WHERE id=%s
            """, (use_end_time, end_qty, exist["id"]))
            conn.commit()
            rows = cur.rowcount
            cur.close(); conn.close()
            return jsonify({"code":0,"msg":"updated","data":{"rows":rows,"mode":"update","end_time":use_end_time}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/mo/info")
def get_mocode_info():
    """
    body: {"MoCode": "scdd2505949"}
    从阿里云 wecom-db.factory_mo_yx 表查询该工单的所有行号明细，
    返回数组 [{MoCode, RowNum, InvCode, InvName, Qty, CusName}, ...]
    """
    try:
        data = request.get_json(silent=True) or {}
        mocode = (data.get("MoCode") or "").strip().upper()
        if not mocode:
            return jsonify({"code": 1, "msg": "缺少参数: MoCode"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)

        sql = """
            SELECT
              mo_code   AS MoCode,
              sortseq   AS RowNum,
              invcode   AS InvCode,
              part_name AS InvName,
              qty       AS Qty,
              cus_name  AS CusName
            FROM factory_mo_yx
            WHERE mo_code = %s
            ORDER BY sortseq
        """
        cur.execute(sql, (mocode,))
        rows = cur.fetchall()
        cur.close(); conn.close()

        return jsonify({
            "code": 0,
            "msg": "success",
            "data": rows
        })
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


# =========================
# GET 版本：按路径参数
# 例：/api/factory/task/mo/info/SCDD25102119
# =========================
@factory_task_bp.get("/mo/info/<mocode>")
def get_mocode_info_by_path(mocode):
    try:
        mocode = (mocode or "").strip().upper()
        if not mocode:
            return jsonify({"code": 1, "msg": "缺少参数: MoCode"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
              mo_code   AS MoCode,
              sortseq   AS RowNum,
              invcode   AS InvCode,
              part_name AS InvName,
              qty       AS Qty,
              cus_name  AS CusName
            FROM factory_mo_yx
            WHERE mo_code = %s
            ORDER BY sortseq
        """, (mocode,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


# =========================
# GET 版本：按查询参数
# 例：/api/factory/task/mo/info?mocode=SCDD25102119
# =========================
@factory_task_bp.get("/mo/info")
def get_mocode_info_by_query():
    try:
        mocode = (request.args.get("mocode") or "").strip().upper()
        if not mocode:
            return jsonify({"code": 1, "msg": "缺少参数: mocode"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
              mo_code   AS MoCode,
              sortseq   AS RowNum,
              invcode   AS InvCode,
              part_name AS InvName,
              qty       AS Qty,
              cus_name  AS CusName
            FROM factory_mo_yx
            WHERE mo_code = %s
            ORDER BY sortseq
        """, (mocode,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


# ===========================================================
# 🧩 测试接口：确认 factory_task 蓝图是否正常注册
# ===========================================================
@factory_task_bp.get("/ping")
def factory_task_ping():
    """
    简单健康检查接口，用于验证路由注册是否正常。
    访问路径：/api/factory/task/ping
    """
    return jsonify({
        "code": 0,
        "msg": "factory_task 蓝图加载成功",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })




# # ========= 扫码报工：检查 =========
# @factory_task_bp.post("/scan/check")
# def scan_check():
#     try:
#         data = request.get_json(silent=True) or {}
#         work_order_no = (data.get("work_order_no") or "").strip()
#         line_no = int(data.get("line_no") or 0)
#         user_id = (data.get("user_id") or "").strip()

#         if not work_order_no or not line_no or not user_id:
#             return jsonify({"code": 1, "msg": "缺少参数：work_order_no / line_no / user_id"}), 400

#         conn = get_db2()
#         cur = conn.cursor(dictionary=True)
#         cur.execute("""
#             SELECT id, work_order_no, line_no, user_id, line_name, scan_time, end_time, end_qty
#             FROM scan_report_yx
#             WHERE work_order_no=%s AND line_no=%s AND user_id=%s
#             LIMIT 1
#         """, (work_order_no, line_no, user_id))
#         row = cur.fetchone()
#         cur.close(); conn.close()

#         if row:
#             # 已有记录：不允许再次提交开始；显示结束项；返回基础信息
#             def fmt(x):
#                 from datetime import datetime
#                 return x.strftime("%Y-%m-%d %H:%M:%S") if x and not isinstance(x, str) else x

#             resp = {
#                 "has_record": True,
#                 "can_submit_start": False,
#                 "show_end_fields": True,
#                 "data": {
#                     "work_order_no": row["work_order_no"],
#                     "line_no": row["line_no"],
#                     "line_name": row["line_name"],
#                     "scan_time": fmt(row["scan_time"]),
#                     "end_time": fmt(row["end_time"]),
#                     "end_qty": float(row["end_qty"]) if row["end_qty"] is not None else None
#                 }
#             }
#             return jsonify({"code": 0, "msg": "success", "data": resp})
#         else:
#             # 无记录：允许提交开始；不显示结束项
#             resp = {
#                 "has_record": False,
#                 "can_submit_start": True,
#                 "show_end_fields": False,
#                 "data": None
#             }
#             return jsonify({"code": 0, "msg": "success", "data": resp})
#     except Exception as e:
#         return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500




# # ========= 扫码报工：提交（插入或更新） =========
# @factory_task_bp.post("/scan/submit")
# def scan_submit():
#     try:
#         data = request.get_json(silent=True) or {}
#         work_order_no = (data.get("work_order_no") or "").strip()
#         line_no = int(data.get("line_no") or 0)
#         user_id = (data.get("user_id") or "").strip()

#         if not work_order_no or not line_no or not user_id:
#             return jsonify({"code": 1, "msg": "缺少参数：work_order_no / line_no / user_id"}), 400

#         line_name = (data.get("line_name") or "").strip() or None
#         scan_time = (data.get("scan_time") or "").strip() or None     # 开始时间，可不传
#         end_time  = (data.get("end_time")  or "").strip() or None     # 结束时间，可不传
#         end_qty   = data.get("end_qty", None)                          # 结束数量，可不传

#         from datetime import datetime
#         now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

#         conn = get_db2()
#         cur = conn.cursor(dictionary=True)

#         # 先判断是否存在
#         cur.execute("""
#             SELECT id FROM scan_report_yx
#             WHERE work_order_no=%s AND line_no=%s AND user_id=%s
#             LIMIT 1
#         """, (work_order_no, line_no, user_id))
#         exist = cur.fetchone()

#         if not exist:
#             # 插入：需要 line_name
#             if not line_name:
#                 cur.close(); conn.close()
#                 return jsonify({"code": 1, "msg": "开始报工插入需要提供 line_name"}), 400

#             use_scan_time = scan_time or now_str
#             cur.execute("""
#                 INSERT INTO scan_report_yx
#                 (work_order_no, line_no, user_id, line_name, scan_time)
#                 VALUES (%s, %s, %s, %s, %s)
#             """, (work_order_no, line_no, user_id, line_name, use_scan_time))
#             conn.commit()
#             new_id = cur.lastrowid
#             cur.close(); conn.close()
#             return jsonify({
#                 "code": 0, "msg": "inserted",
#                 "data": {"id": new_id, "mode": "insert", "scan_time": use_scan_time}
#             })
#         else:
#             # 更新结束：仅 end_time / end_qty（end_time 未传则用当前）
#             use_end_time = end_time or now_str
#             cur.execute("""
#                 UPDATE scan_report_yx
#                 SET end_time=%s, end_qty=%s, update_time=NOW()
#                 WHERE work_order_no=%s AND line_no=%s AND user_id=%s
#             """, (use_end_time, end_qty, work_order_no, line_no, user_id))
#             conn.commit()
#             affected = cur.rowcount
#             cur.close(); conn.close()
#             return jsonify({
#                 "code": 0, "msg": "updated",
#                 "data": {"rows": affected, "mode": "update", "end_time": use_end_time}
#             })
#     except Exception as e:
#         return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

        
        
        
        
# ===========================================================
# 📦 扫码工单：根据 MoCode 查询工单明细
# ===========================================================


# 查询电表倍率
@factory_task_bp.route("/electricity-meter-ratio", methods=["GET"])
def get_electricity_meter_ratio():
    """
    查询电表倍率
    """
    spec_location = request.args.get("spec_location")
    electricity_type = request.args.get("electricity_type")

    # ====== 参数校验 ======
    if not spec_location or not electricity_type:
        return jsonify({
            "success": False,
            "message": "缺少参数 spec_location 或 electricity_type"
        }), 400

    conn = None
    cursor = None
    try:
        conn = get_db2()
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT ratio
            FROM electricity_meter_ratio_yx
            WHERE spec_location = %s
              AND electricity_type = %s
            LIMIT 1
        """
        cursor.execute(sql, (spec_location, electricity_type))
        row = cursor.fetchone()

        if not row:
            return jsonify({
                "success": False,
                "message": "未找到对应的电表倍率",
                "data": None
            })

        return jsonify({
            "success": True,
            "data": {
                "ratio": row["ratio"]
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": "查询电表倍率失败",
            "error": str(e)
        }), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
