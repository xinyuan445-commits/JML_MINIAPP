# ===========================================================
# 🛠️ 形态转换 (Quality Conversion) 模块 API
# ===========================================================

# 1. 列表查询
@factory_task_bp.get("/quality-conversion/list")
def list_quality_conversion():
    try:
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 20))
        offset = (page - 1) * page_size
        
        # 筛选参数
        order_no = request.args.get("order_no")
        date = request.args.get("date")
        status_code = request.args.get("status_code")
        submit_user_id = request.args.get("submit_user_id")
        current_approval_user_id = request.args.get("current_approval_user_id")
        
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        
        # 构建 SQL
        where_clauses = []
        params = []
        
        if order_no:
            where_clauses.append("order_no LIKE %s")
            params.append(f"%{order_no}%")
        if date:
            where_clauses.append("date = %s")
            params.append(date)
        if status_code:
            where_clauses.append("status_code = %s")
            params.append(status_code)
        if submit_user_id:
            where_clauses.append("submit_user_id = %s")
            params.append(submit_user_id)
        if current_approval_user_id:
            where_clauses.append("current_approval_user_id = %s")
            params.append(current_approval_user_id)
            
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # 查询数据
        sql = f"""
            SELECT * FROM quality_conversion_log_yx 
            {where_sql}
            ORDER BY id DESC 
            LIMIT %s, %s
        """
        cur.execute(sql, (*params, offset, page_size))
        rows = cur.fetchall()
        
        cur.close(); conn.close()
        
        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

# 1.5 字典查询
@factory_task_bp.get("/quality-conversion/dict")
def get_quality_conversion_dict():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT dict_type, dict_value 
            FROM quality_conversion_dict_yx 
            WHERE enabled = 1 
            ORDER BY dict_type, sort_order ASC, id ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        
        result = {
            "conversionTypes": [],
            "qualityLevels": [],
            "dutyOptions": []
        }
        for row in rows:
            if row["dict_type"] == "conversion_type":
                result["conversionTypes"].append(row["dict_value"])
            elif row["dict_type"] == "quality_level":
                result["qualityLevels"].append(row["dict_value"])
            elif row["dict_type"] == "duty_department":
                result["dutyOptions"].append(row["dict_value"])
                
        return jsonify({"code": 0, "msg": "success", "data": result})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

# 2. 详情查询
@factory_task_bp.get("/quality-conversion/detail")
def get_quality_conversion_detail():
    try:
        id = request.args.get("id")
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
            
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        
        history = []
        if row:
            try:
                cur.execute("""
                    SELECT id, conversion_id, action, from_status_code, to_status_code,
                           operator_user_id, operator_user_name, remark, created_time
                    FROM quality_conversion_approval_history_yx
                    WHERE conversion_id = %s
                    ORDER BY id ASC
                """, (id,))
                history = cur.fetchall()
            except Exception:
                history = []

        attachments = []
        if row:
            try:
                attachments = _qc_get_attachments(cur, id, "DRAFT")
            except Exception:
                attachments = []

        if row:
            try:
                cur_user_id = row.get("current_approval_user_id") or ""
                row["current_approval_user_name"] = _qc_get_cfg_user_name(cur, cur_user_id) if cur_user_id else ""
            except Exception:
                row["current_approval_user_name"] = ""

            try:
                owners = {
                    "QC": _qc_get_approval_user(cur, "QC"),
                    "DIRECTOR": _qc_get_approval_user(cur, "DIRECTOR"),
                    "WAREHOUSE": _qc_get_approval_user(cur, "WAREHOUSE")
                }
            except Exception:
                owners = {}
            row["approval_role_owners"] = owners
        
        cur.close(); conn.close()
        
        if not row:
            return jsonify({"code": 0, "msg": "not found", "data": None})
        return jsonify({"code": 0, "msg": "success", "data": row, "history": history, "attachments": attachments})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

# 3. 新增/提交
@factory_task_bp.post("/quality-conversion/add")
def add_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        required = ["date", "material_code", "batch_no", "quantity", "conversion_type", "target_quality_level"]
        miss = [k for k in required if not data.get(k)]
        if miss:
            return jsonify({"code": 1, "msg": f"缺少必填参数: {', '.join(miss)}"}), 400

        attachments = data.get("attachments") or []
        if not isinstance(attachments, list):
            return jsonify({"code": 1, "msg": "attachments 必须为数组"}), 400
        attachments = [x for x in attachments if isinstance(x, str) and x.strip()]
        if len(attachments) > 5:
            return jsonify({"code": 1, "msg": "草稿附件最多5张"}), 400
            
        conn = get_db2()
        cur = conn.cursor()
        
        sql = """
            INSERT INTO quality_conversion_log_yx (
                date, conversion_type, material_code, spec_model, batch_no, 
                quantity, target_quality_level, user_id, order_no, 
                related_order_no, duty_department, conversion_reason, description,
                status_code, status_name, submit_user_id, submit_time,
                current_approval_role_code, current_approval_user_id,
                last_action, last_action_time, reject_reason
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        vals = (
            data.get("date"),
            data.get("conversion_type"),
            data.get("material_code"),
            data.get("spec_model", ""),
            data.get("batch_no"),
            data.get("quantity"),
            data.get("target_quality_level"),
            data.get("user_id", ""),
            data.get("order_no", ""),
            data.get("related_order_no", ""),
            data.get("duty_department", ""),
            data.get("conversion_reason", ""),
            data.get("description", ""),
            "DRAFT",
            "草稿",
            data.get("user_id", ""),
            None,
            "",
            "",
            "",
            None,
            ""
        )
        cur.execute(sql, vals)
        new_id = cur.lastrowid
        if attachments:
            _qc_replace_attachments(conn, new_id, "DRAFT", attachments, data.get("user_id", ""), data.get("user_name", ""))
        conn.commit()
        cur.close(); conn.close()
        
        return jsonify({"code": 0, "msg": "success", "data": {"id": new_id}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/quality-conversion/update")
def update_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        id = data.get("id")
        operator_user_id = data.get("user_id") or ""
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
        if not operator_user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "单据不存在"}), 404

        status_code = row.get("status_code") or ""
        submit_user_id = row.get("submit_user_id") or row.get("user_id") or ""
        if submit_user_id and submit_user_id != operator_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只有发起人可修改"}), 403
        if status_code not in ("DRAFT", "REJECTED", ""):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前状态不可修改"}), 400

        attachments = data.get("attachments") or []
        if not isinstance(attachments, list):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "attachments 必须为数组"}), 400
        attachments = [x for x in attachments if isinstance(x, str) and x.strip()]
        if len(attachments) > 5:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "草稿附件最多5张"}), 400

        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE quality_conversion_log_yx
            SET date=%s, conversion_type=%s, material_code=%s, spec_model=%s, batch_no=%s,
                quantity=%s, target_quality_level=%s, order_no=%s,
                related_order_no=%s, duty_department=%s, conversion_reason=%s, description=%s
            WHERE id=%s
        """, (
            data.get("date"),
            data.get("conversion_type"),
            data.get("material_code"),
            data.get("spec_model", ""),
            data.get("batch_no"),
            data.get("quantity"),
            data.get("target_quality_level"),
            data.get("order_no", ""),
            data.get("related_order_no", ""),
            data.get("duty_department", ""),
            data.get("conversion_reason", ""),
            data.get("description", ""),
            id
        ))
        _qc_replace_attachments(conn, id, "DRAFT", attachments, operator_user_id, data.get("user_name", ""))
        conn.commit()
        cur2.close(); cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"id": id}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/quality-conversion/submit")
def submit_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        id = data.get("id")
        operator_user_id = data.get("user_id") or ""
        operator_user_name = data.get("user_name") or ""
        remark = data.get("remark", "") or ""
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
        if not operator_user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "单据不存在"}), 404

        status_code = row.get("status_code") or ""
        submit_user_id = row.get("submit_user_id") or row.get("user_id") or ""
        if submit_user_id and submit_user_id != operator_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只有发起人可提交"}), 403
        if status_code not in ("DRAFT", "REJECTED", ""):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前状态不可提交"}), 400

        if not operator_user_name:
            operator_user_name = _qc_get_cfg_user_name(cur, operator_user_id)

        qc_user_id = _qc_get_approval_user_id(cur, "QC")
        if not qc_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "未配置质检审批人"}), 400

        from_status = status_code or "DRAFT"
        now = datetime.now()
        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE quality_conversion_log_yx
            SET status_code=%s, status_name=%s,
                submit_user_id=%s,
                submit_time=COALESCE(submit_time, %s),
                current_approval_role_code=%s,
                current_approval_user_id=%s,
                last_action=%s,
                last_action_time=%s,
                reject_reason=%s
            WHERE id=%s
        """, ("PENDING_QC", "待质检", operator_user_id, now, "QC", qc_user_id, "SUBMIT", now, "", id))
        _qc_insert_history(cur2, id, "SUBMIT", from_status, "PENDING_QC", operator_user_id, operator_user_name, remark)
        conn.commit()
        cur2.close(); cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"id": id, "status_code": "PENDING_QC"}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/quality-conversion/approve")
def approve_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        id = data.get("id")
        operator_user_id = data.get("user_id") or ""
        operator_user_name = data.get("user_name") or ""
        remark = data.get("remark", "") or ""
        warehouse_conversion_no = (data.get("warehouse_conversion_no") or "").strip()
        
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
        if not operator_user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "单据不存在"}), 404

        status_code = row.get("status_code") or ""
        current_approval_user_id = row.get("current_approval_user_id") or ""
        if current_approval_user_id != operator_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前用户无审批权限"}), 403
        if status_code not in ("PENDING_QC", "PENDING_DIRECTOR", "PENDING_WAREHOUSE"):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前状态不可审批"}), 400
            
        # 仓库审批环节校验形态转换单号
        if status_code == "PENDING_WAREHOUSE":
            if not warehouse_conversion_no:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "请输入形态转换单号"}), 400
            if not warehouse_conversion_no.startswith("XTZH"):
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": "形态转换单号格式不正确，必须以 XTZH 开头"}), 400

        if not operator_user_name:
            operator_user_name = _qc_get_cfg_user_name(cur, operator_user_id)

        next_status, next_name, next_role = _qc_next_status(status_code)
        next_user_id = ""
        if next_role:
            next_user_id = _qc_get_approval_user_id(cur, next_role)
            if not next_user_id:
                cur.close(); conn.close()
                return jsonify({"code": 1, "msg": f"未配置{next_role}审批人"}), 400

        now = datetime.now()
        cur2 = conn.cursor()
        
        # 构建 UPDATE 语句，如果是仓库节点则额外更新 warehouse_conversion_no
        if status_code == "PENDING_WAREHOUSE":
            update_sql = """
                UPDATE quality_conversion_log_yx
                SET status_code=%s, status_name=%s,
                    current_approval_role_code=%s,
                    current_approval_user_id=%s,
                    last_action=%s,
                    last_action_time=%s,
                    warehouse_conversion_no=%s
                WHERE id=%s
            """
            update_params = (next_status, next_name, next_role or "", next_user_id or "", "APPROVE", now, warehouse_conversion_no, id)
        else:
            update_sql = """
                UPDATE quality_conversion_log_yx
                SET status_code=%s, status_name=%s,
                    current_approval_role_code=%s,
                    current_approval_user_id=%s,
                    last_action=%s,
                    last_action_time=%s
                WHERE id=%s
            """
            update_params = (next_status, next_name, next_role or "", next_user_id or "", "APPROVE", now, id)
            
        cur2.execute(update_sql, update_params)
        _qc_insert_history(cur2, id, "APPROVE", status_code, next_status, operator_user_id, operator_user_name, remark)
        conn.commit()
        cur2.close(); cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"id": id, "status_code": next_status}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/quality-conversion/reject")
def reject_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        id = data.get("id")
        operator_user_id = data.get("user_id") or ""
        operator_user_name = data.get("user_name") or ""
        remark = (data.get("remark") or "").strip()
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
        if not operator_user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400
        if not remark:
            return jsonify({"code": 1, "msg": "缺少参数: remark"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "单据不存在"}), 404

        status_code = row.get("status_code") or ""
        current_approval_user_id = row.get("current_approval_user_id") or ""
        submit_user_id = row.get("submit_user_id") or row.get("user_id") or ""
        if current_approval_user_id != operator_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前用户无审批权限"}), 403
        if status_code not in ("PENDING_QC", "PENDING_DIRECTOR", "PENDING_WAREHOUSE"):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前状态不可驳回"}), 400

        if not operator_user_name:
            operator_user_name = _qc_get_cfg_user_name(cur, operator_user_id)

        now = datetime.now()
        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE quality_conversion_log_yx
            SET status_code=%s, status_name=%s,
                current_approval_role_code=%s,
                current_approval_user_id=%s,
                last_action=%s,
                last_action_time=%s,
                reject_reason=%s
            WHERE id=%s
        """, ("REJECTED", "已驳回", "", submit_user_id, "REJECT", now, remark, id))
        _qc_insert_history(cur2, id, "REJECT", status_code, "REJECTED", operator_user_id, operator_user_name, remark)
        conn.commit()
        cur2.close(); cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"id": id, "status_code": "REJECTED"}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.post("/quality-conversion/recall")
def recall_quality_conversion():
    try:
        data = request.get_json(silent=True) or {}
        id = data.get("id")
        operator_user_id = data.get("user_id") or ""
        operator_user_name = data.get("user_name") or ""
        remark = data.get("remark", "") or ""
        if not id:
            return jsonify({"code": 1, "msg": "缺少参数: id"}), 400
        if not operator_user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM quality_conversion_log_yx WHERE id = %s", (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "单据不存在"}), 404

        status_code = row.get("status_code") or ""
        submit_user_id = row.get("submit_user_id") or row.get("user_id") or ""
        if submit_user_id != operator_user_id:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "只有发起人可撤回"}), 403
        if status_code not in ("PENDING_QC", "PENDING_DIRECTOR", "PENDING_WAREHOUSE"):
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前状态不可撤回"}), 400

        if not operator_user_name:
            operator_user_name = _qc_get_cfg_user_name(cur, operator_user_id)

        now = datetime.now()
        cur2 = conn.cursor()
        cur2.execute("""
            UPDATE quality_conversion_log_yx
            SET status_code=%s, status_name=%s,
                current_approval_role_code=%s,
                current_approval_user_id=%s,
                last_action=%s,
                last_action_time=%s
            WHERE id=%s
        """, ("DRAFT", "草稿", "", "", "RECALL", now, id))
        _qc_insert_history(cur2, id, "RECALL", status_code, "DRAFT", operator_user_id, operator_user_name, remark)
        conn.commit()
        cur2.close(); cur.close(); conn.close()

        return jsonify({"code": 0, "msg": "success", "data": {"id": id, "status_code": "DRAFT"}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


@factory_task_bp.get("/quality-conversion/todo-list")
def list_quality_conversion_todo():
    try:
        user_id = request.args.get("user_id") or ""
        if not user_id:
            return jsonify({"code": 1, "msg": "缺少参数: user_id"}), 400
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 20))
        offset = (page - 1) * page_size

        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT * FROM quality_conversion_log_yx
            WHERE current_approval_user_id = %s
            ORDER BY id DESC
            LIMIT %s, %s
        """, (user_id, offset, page_size))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "success", "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

# 4. 生成下一个单号
@factory_task_bp.get("/quality-conversion/next-no")
def get_quality_conversion_next_no():
    try:
        date_str = request.args.get("date") # YYYY-MM-DD
        if not date_str:
            return jsonify({"code": 1, "msg": "缺少参数: date"}), 400
            
        conn = get_db2()
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM quality_conversion_log_yx WHERE date = %s", (date_str,))
        count = cur.fetchone()[0]
        cur.close(); conn.close()
        
        # 生成逻辑：XTZH_YYYYMMDD-SEQ
        seq = count + 1
        date_part = date_str.replace("-", "")
        order_no = f"XTZH_{date_part}-{seq:03d}"
        
        return jsonify({"code": 0, "msg": "success", "data": {"order_no": order_no}})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500

# 5. 物料查询 (库存模糊搜索)
@factory_task_bp.get("/inventory/search")
def search_inventory():
    try:
        keyword = request.args.get("keyword", "").strip()
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("pageSize", 50))
        offset = (page - 1) * page_size
        
        if not keyword:
            return jsonify({"code": 0, "msg": "success", "data": [], "total": 0})
            
        # 简单的空格分词逻辑
        tokens = [t for t in keyword.replace("，", ",").replace(" ", ",").split(",") if t]
        if not tokens:
             return jsonify({"code": 0, "msg": "success", "data": [], "total": 0})
             
        where_clauses = [f"cinvcode LIKE %s" for _ in tokens]
        where_sql = " OR ".join(where_clauses)
        params = [f"%{t}%" for t in tokens]
        
        conn = get_db2() # 假设 inventory 表也在 db2，如果不在需换 get_db()
        cur = conn.cursor(dictionary=True)
        
        # 查询列表
        sql = f"""
            SELECT cinvcode, cinvname, cinvstd 
            FROM inventory 
            WHERE {where_sql} 
            ORDER BY cinvcode ASC 
            LIMIT %s, %s
        """
        cur.execute(sql, (*params, offset, page_size))
        rows = cur.fetchall()
        
        # 查询总数 (可选)
        count_sql = f"SELECT count(*) as total FROM inventory WHERE {where_sql}"
        cur.execute(count_sql, tuple(params))
        total = cur.fetchone()["total"]
        
        cur.close(); conn.close()
        
        # 格式化返回，适配前端 selectList 结构
        result = []
        for r in rows:
            result.append({
                "code": r["cinvcode"],
                "name": r["cinvname"],
                "std": r.get("cinvstd", "")
            })
            
        return jsonify({"code": 0, "msg": "success", "data": result, "total": total})
    except Exception as e:
        return jsonify({"code": 1, "msg": "error", "error": str(e)}), 500


def _qc_get_approval_user_id(cur_dict, role_code: str) -> str:
    try:
        cur_dict.execute("""
            SELECT user_id
            FROM quality_conversion_approval_user_cfg_yx
            WHERE enabled = 1 AND role_code = %s
            ORDER BY sort ASC, id ASC
            LIMIT 1
        """, (role_code,))
        row = cur_dict.fetchone()
        return (row or {}).get("user_id", "") if isinstance(row, dict) else ""
    except Exception:
        return ""

def _qc_get_approval_user(cur_dict, role_code: str):
    try:
        cur_dict.execute("""
            SELECT user_id, user_name, role_code, role_name
            FROM quality_conversion_approval_user_cfg_yx
            WHERE enabled = 1 AND role_code = %s
            ORDER BY sort ASC, id ASC
            LIMIT 1
        """, (role_code,))
        row = cur_dict.fetchone()
        return row if isinstance(row, dict) else {}
    except Exception:
        return {}

def _qc_get_cfg_user_name(cur_dict, user_id: str) -> str:
    try:
        cur_dict.execute("""
            SELECT user_name
            FROM quality_conversion_approval_user_cfg_yx
            WHERE enabled = 1 AND user_id = %s
            ORDER BY sort ASC, id ASC
            LIMIT 1
        """, (user_id,))
        row = cur_dict.fetchone()
        if isinstance(row, dict):
            return row.get("user_name", "") or ""
        return ""
    except Exception:
        return ""


def _qc_insert_history(cur, conversion_id, action, from_status_code, to_status_code, operator_user_id, operator_user_name, remark):
    cur.execute("""
        INSERT INTO quality_conversion_approval_history_yx
        (conversion_id, action, from_status_code, to_status_code, operator_user_id, operator_user_name, remark, created_time)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        conversion_id,
        action,
        from_status_code or "",
        to_status_code or "",
        operator_user_id or "",
        operator_user_name or "",
        remark or "",
        datetime.now()
    ))


def _qc_next_status(current_status_code: str):
    mapping = {
        "PENDING_QC": ("PENDING_DIRECTOR", "待厂长", "DIRECTOR"),
        "PENDING_DIRECTOR": ("PENDING_WAREHOUSE", "待仓库", "WAREHOUSE"),
        "PENDING_WAREHOUSE": ("APPROVED", "已完成", ""),
    }
    return mapping.get(current_status_code, ("APPROVED", "已完成", ""))


def _qc_get_attachments(cur_dict, conversion_id, stage_code: str):
    cur_dict.execute("""
        SELECT id, conversion_id, stage_code, file_url, uploader_user_id, uploader_user_name, created_time
        FROM quality_conversion_attachment_yx
        WHERE conversion_id = %s AND stage_code = %s
        ORDER BY id ASC
    """, (conversion_id, stage_code))
    return cur_dict.fetchall()


def _qc_replace_attachments(conn, conversion_id, stage_code: str, file_urls, uploader_user_id: str, uploader_user_name: str):
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM quality_conversion_attachment_yx
        WHERE conversion_id = %s AND stage_code = %s
    """, (conversion_id, stage_code))
    if file_urls:
        vals = []
        now = datetime.now()
        for u in file_urls[:5]:
            vals.append((conversion_id, stage_code, u, uploader_user_id or "", uploader_user_name or "", now))
        cur.executemany("""
            INSERT INTO quality_conversion_attachment_yx
            (conversion_id, stage_code, file_url, uploader_user_id, uploader_user_name, created_time)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, vals)
    cur.close()