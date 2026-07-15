import re
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_DOWN
from uuid import uuid4
from flask import Blueprint, jsonify, request
from models.db import get_db        # 主库（inventory 存货表）
from models.db2 import get_db2      # db2（bj_* 报价表）

quote_bp = Blueprint("quote", __name__)


def _f(v):
    return float(v) if v is not None else None


# ----------------------------------------------------------------
# 产品类别列表（报价新增页产品类型下拉用）
# ----------------------------------------------------------------
@quote_bp.get("/category/list")
def category_list():
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT code, name
            FROM bj_product_cost_yx
            WHERE is_enabled = 1
            ORDER BY code ASC, id ASC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []}), 500


# ----------------------------------------------------------------
# 按产品类别计算工序成本（新模型）
#   路线中的明确工序直接取值；工序组按人工/辅材/能耗分别取单位成本最高的启用方案。
#   管理费用、能耗公摊、包装辅材按每条产品路线增加一次。
# ----------------------------------------------------------------
@quote_bp.get("/cost/calc")
def cost_calc():
    category_code = request.args.get("category_code", "").strip()
    if not category_code:
        return jsonify({"code": 1, "msg": "category_code 不能为空"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT code, name, route_desc, unit, mgmt_rate, mgmt_method
            FROM bj_product_cost_yx
            WHERE code = %s AND is_enabled = 1
        """, (category_code,))
        product = cur.fetchone()
        if not product:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "产品类别不存在或未启用"})

        cur.execute("""
            SELECT seq_no, process_code, process_group, remark
            FROM bj_product_process_yx
            WHERE product_code = %s
            ORDER BY seq_no ASC
        """, (category_code,))
        steps = cur.fetchall()

        process_sql = """
            SELECT p.process_code, p.process_name,
                   COALESCE(l.cost_amount, 0) AS labor,
                   COALESCE(a.cost_amount, 0) AS aux_material,
                   COALESCE(e.cost_amount, 0) AS energy
            FROM bj_process_yx p
            LEFT JOIN bj_process_labor_cost_yx l
              ON l.process_code = p.process_code AND l.is_enabled = 1
            LEFT JOIN bj_process_aux_cost_yx a
              ON a.process_code = p.process_code AND a.is_enabled = 1
            LEFT JOIN bj_process_energy_cost_yx e
              ON e.process_code = p.process_code AND e.is_enabled = 1
            WHERE p.is_enabled = 1 AND {condition}
        """
        processes = []
        for step in steps:
            if step["process_code"]:
                cur.execute(process_sql.format(condition="p.process_code = %s"),
                            (step["process_code"],))
                candidates = cur.fetchall()
            else:
                cur.execute(process_sql.format(condition="p.process_group = %s"),
                            (step["process_group"],))
                candidates = cur.fetchall()
            if not candidates:
                continue

            labor_source = max(candidates, key=lambda p: ((_f(p["labor"]) or 0), p["process_code"]))
            aux_source = max(candidates, key=lambda p: ((_f(p["aux_material"]) or 0), p["process_code"]))
            energy_source = max(candidates, key=lambda p: ((_f(p["energy"]) or 0), p["process_code"]))
            process = candidates[0]
            labor = _f(labor_source["labor"]) or 0
            aux = _f(aux_source["aux_material"]) or 0
            energy = _f(energy_source["energy"]) or 0
            processes.append({
                "seq_no": step["seq_no"],
                "process_code": step["process_code"] or step["process_group"],
                "process_name": process["process_name"] if step["process_code"] else "三胺压贴工序",
                "source_group": step["process_group"],
                "remark": step["remark"],
                "labor": labor,
                "labor_process_code": labor_source["process_code"],
                "labor_process_name": labor_source["process_name"],
                "aux_material": aux,
                "aux_process_code": aux_source["process_code"],
                "aux_process_name": aux_source["process_name"],
                "energy": energy,
                "energy_process_code": energy_source["process_code"],
                "energy_process_name": energy_source["process_name"],
                "subtotal_excl_tax": labor + energy + aux / 1.13,
            })

        # 任一工序标注“含覆膜”时，辅材增加一次19号包装材料；路线已含19时不重复。
        has_film = any("含覆膜" in (step["remark"] or "") for step in steps)
        has_process_19 = any(p["process_code"] == "19" for p in processes)
        if has_film and not has_process_19:
            cur.execute(process_sql.format(condition="p.process_code = %s"), ("19",))
            film = cur.fetchone()
            if film:
                film_aux = _f(film["aux_material"]) or 0
                processes.append({
                    "seq_no": len(steps) + 1,
                    "process_code": "19",
                    "process_name": "包装材料（覆膜）",
                    "source_group": None,
                    "remark": "路线含覆膜自动增加",
                    "labor": 0,
                    "labor_process_code": "19",
                    "labor_process_name": film["process_name"],
                    "aux_material": film_aux,
                    "aux_process_code": "19",
                    "aux_process_name": "包装材料（覆膜）",
                    "energy": 0,
                    "energy_process_code": "19",
                    "energy_process_name": film["process_name"],
                    "subtotal_excl_tax": film_aux / 1.13,
                })

        cur.execute("""
            SELECT cost_code, cost_amount
            FROM bj_common_cost_yx
            WHERE is_enabled = 1
        """)
        common = {r["cost_code"]: (_f(r["cost_amount"]) or 0) for r in cur.fetchall()}
        cur.close(); conn.close()

        process_labor = sum(p["labor"] for p in processes)
        process_aux = sum(p["aux_material"] for p in processes)
        process_energy = sum(p["energy"] for p in processes)
        management_base = common.get("MANAGEMENT", 0)
        management_rate = _f(product["mgmt_rate"]) or 0
        management = management_base * management_rate
        packaging_aux = common.get("PACKAGING_AUX", 0)
        common_energy = common.get("COMMON_ENERGY", 0)
        aux_total = process_aux + packaging_aux
        energy_total = process_energy + common_energy
        total_excl_tax = process_labor + management + energy_total + aux_total / 1.13

        return jsonify({"code": 0, "data": {
            "code": product["code"],
            "name": product["name"],
            "route_no": int(product["code"]),
            "route_desc": product["route_desc"] or "",
            "unit": product["unit"],
            "mgmt_method": product["mgmt_method"],
            "costs": {
                "labor": process_labor + management,
                "aux_material": aux_total / 1.13,
                "energy": energy_total,
            },
            "breakdown": {
                "process_labor": process_labor,
                "management_base": management_base,
                "management_rate": management_rate,
                "management": management,
                "process_aux_material": process_aux,
                "packaging_aux": packaging_aux,
                "process_energy": process_energy,
                "common_energy": common_energy,
            },
            "processes": processes,
            "total_excl_tax": total_excl_tax,
            "total_incl_tax": total_excl_tax * 1.13,
        }})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _rate(v):
    # 率存比率；空/无效 -> NULL（表示该步不参与计算）
    if v is None or v == "":
        return None


def _decimal(v, default="0"):
    try:
        return Decimal(str(v if v not in (None, "") else default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _percent(v):
    if v in (None, ""):
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _trunc2(v):
    return _decimal(v).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ----------------------------------------------------------------
# 保存报价记录（v2完整快照）
#   form_snapshot保存当前表格全部分组；关键字段另存列用于列表查询。
# ----------------------------------------------------------------
@quote_bp.post("/save")
def quote_save():
    body = request.get_json(silent=True) or {}
    snapshot = body.get("form_snapshot") or {}
    if not isinstance(snapshot, dict):
        return jsonify({"code": 1, "msg": "报价快照格式错误"})

    basic = snapshot.get("basic") or {}
    route = snapshot.get("route") or {}
    labor = snapshot.get("labor") or {}
    auxiliary = snapshot.get("auxiliary") or {}
    energy = snapshot.get("energy") or {}
    materials = snapshot.get("materials") or {}
    rates = snapshot.get("rates") or {}

    customer = str(basic.get("customer") or "").strip()
    category_code = str(basic.get("categoryCode") or "").strip()
    category_name = str(basic.get("categoryName") or "").strip()
    created_staff_id = str(body.get("created_staff_id") or "").strip()
    if not customer:
        return jsonify({"code": 1, "msg": "请填写客户"})
    if not category_code or not category_name:
        return jsonify({"code": 1, "msg": "请选择产品类型"})
    if not created_staff_id:
        return jsonify({"code": 1, "msg": "未获取到当前登录员工"})

    first_pass = _percent(rates.get("firstPass"))
    direct_margin = _percent(rates.get("directMargin"))
    dealer_margin = _percent(rates.get("dealerMargin"))
    tax_rate = _percent(rates.get("tax"))
    if first_pass is None or first_pass <= 0 or first_pass > 100:
        return jsonify({"code": 1, "msg": "一次合格率须大于0且不超过100"})
    if direct_margin is None or direct_margin < 0 or direct_margin >= 100:
        return jsonify({"code": 1, "msg": "直营毛利率须在0到100之间"})
    if dealer_margin is None or dealer_margin < 0 or dealer_margin >= 100:
        return jsonify({"code": 1, "msg": "经销商毛利率须在0到100之间"})
    if tax_rate is None or tax_rate < 0:
        return jsonify({"code": 1, "msg": "报价税率不能小于0"})

    labor_cost = _decimal(labor.get("total"))
    aux_cost = _decimal(auxiliary.get("totalExclTax"))
    energy_cost = _decimal(energy.get("total"))
    material_items = materials.get("items") if isinstance(materials.get("items"), list) else []
    material_cost = sum((_decimal(item.get("priceExcl")) for item in material_items), Decimal("0"))
    has_row_logistics = any("logisticsEnabled" in item for item in material_items)
    if has_row_logistics:
        logistics_cost = sum((
            _decimal(item.get("logisticsCost"))
            for item in material_items
            if item.get("logisticsEnabled") is True
        ), Decimal("0"))
        logistics_enabled = any(item.get("logisticsEnabled") is True for item in material_items)
    else:
        # 兼容旧版整单物流快照。
        old_logistics = snapshot.get("logistics") or {}
        logistics_enabled = bool(old_logistics.get("enabled"))
        logistics_cost = _decimal(old_logistics.get("unitCost")) if logistics_enabled else Decimal("0")
    snapshot["logistics"] = {"enabled": logistics_enabled, "unitCost": str(_trunc2(logistics_cost))}
    base_cost = labor_cost + aux_cost + energy_cost + material_cost + logistics_cost
    cost_after_yield = (base_cost / (first_pass / Decimal("100"))).quantize(
        Decimal("1"), rounding=ROUND_CEILING
    )
    tax_multiplier = Decimal("1") + (tax_rate or Decimal("0")) / Decimal("100")

    direct_excl = cost_after_yield / (Decimal("1") - direct_margin / Decimal("100"))
    dealer_excl = cost_after_yield / (Decimal("1") - dealer_margin / Decimal("100"))
    direct_incl = direct_excl * tax_multiplier if direct_excl is not None else None
    dealer_incl = dealer_excl * tax_multiplier if dealer_excl is not None else None

    # 结果以服务端按“截断两位”规则计算后的值覆盖，输入分组保持原样。
    snapshot["materials"] = {
        **materials,
        "baseExclTax": str(_trunc2(material_cost)),
        "logisticsTotal": str(_trunc2(logistics_cost)),
        "totalExclTax": str(_trunc2(material_cost + logistics_cost)),
    }
    snapshot["result"] = {
        "baseCostExclTax": str(_trunc2(base_cost)),
        "costAfterYield": str(cost_after_yield),
        "directExclTax": str(_trunc2(direct_excl)) if direct_excl is not None else None,
        "directInclTax": str(_trunc2(direct_incl)) if direct_incl is not None else None,
        "dealerExclTax": str(_trunc2(dealer_excl)) if dealer_excl is not None else None,
        "dealerInclTax": str(_trunc2(dealer_incl)) if dealer_incl is not None else None,
    }

    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name FROM jml_staff WHERE id = %s", (created_staff_id,))
        staff = cur.fetchone()
        if not staff:
            cur.close(); conn.close()
            return jsonify({"code": 1, "msg": "当前登录员工不存在"})

        quote_no = f"BJ{datetime.now():%Y%m%d-%H%M%S}-{uuid4().hex[:4].upper()}"

        cur.execute(
            """
            INSERT INTO bj_quote_yx
              (quote_no, customer, category_code, category_name, unit, route_no, route_desc,
               labor_cost, aux_cost_excl_tax, energy_cost, material_cost_excl_tax,
               logistics_enabled, logistics_cost, base_cost_excl_tax,
               first_pass_rate, tax_rate, cost_after_yield,
               direct_margin_rate, direct_price_excl_tax, direct_price_incl_tax,
               dealer_margin_rate, dealer_price_excl_tax, dealer_price_incl_tax,
               form_snapshot, created_staff_id, created_staff_name)
            VALUES
              (%s, %s, %s, %s, %s, %s, %s,
               %s, %s, %s, %s,
               %s, %s, %s,
               %s, %s, %s,
               %s, %s, %s,
               %s, %s, %s,
               %s, %s, %s)
            """,
            (
                quote_no, customer, category_code, category_name, basic.get("unit"),
                str(route.get("routeNo") or ""), route.get("routeDesc"),
                _trunc2(labor_cost), _trunc2(aux_cost), _trunc2(energy_cost), _trunc2(material_cost),
                1 if logistics_enabled else 0, _trunc2(logistics_cost), _trunc2(base_cost),
                first_pass, tax_rate, cost_after_yield,
                direct_margin, _trunc2(direct_excl) if direct_excl is not None else None,
                _trunc2(direct_incl) if direct_incl is not None else None,
                dealer_margin, _trunc2(dealer_excl) if dealer_excl is not None else None,
                _trunc2(dealer_incl) if dealer_incl is not None else None,
                json.dumps(snapshot, ensure_ascii=False), created_staff_id, staff["name"],
            ),
        )
        conn.commit()
        new_id = cur.lastrowid
        cur.close(); conn.close()
        return jsonify({"code": 0, "msg": "保存成功", "data": {"id": new_id, "quote_no": quote_no}})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 报价记录列表（倒序）；支持客户/单号关键词、日期范围、产品类别筛选
# ----------------------------------------------------------------
@quote_bp.get("/list")
def quote_list():
    keyword = (request.args.get("keyword") or "").strip()
    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()
    category_code = (request.args.get("category_code") or "").strip()
    customer = (request.args.get("customer") or "").strip()   # 精确：看某客户全部历史
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        where, params = [], []
        if customer:
            where.append("customer = %s"); params.append(customer)
        if keyword:
            where.append("(customer LIKE %s OR quote_no LIKE %s)")
            kw = f"%{keyword}%"
            params += [kw, kw]
        if category_code:
            where.append("category_code = %s"); params.append(category_code)
        if start_date:
            where.append("created_at >= %s"); params.append(start_date + " 00:00:00")
        if end_date:
            where.append("created_at <= %s"); params.append(end_date + " 23:59:59")

        sql = """
            SELECT id, quote_no, customer, category_code, category_name, unit, route_no,
                   direct_price_incl_tax, dealer_price_incl_tax,
                   COALESCE(direct_price_incl_tax, dealer_price_incl_tax) AS price_with_tax,
                   created_staff_name, created_at
            FROM bj_quote_yx
        """
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id DESC LIMIT 200"

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        for r in rows:
            r["price_with_tax"] = _f(r["price_with_tax"])
            r["direct_price_incl_tax"] = _f(r["direct_price_incl_tax"])
            r["dealer_price_incl_tax"] = _f(r["dealer_price_incl_tax"])
            r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M") if r["created_at"] else None
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": rows})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []}), 500


# ----------------------------------------------------------------
# 报价记录详情（v2完整表格快照）
# ----------------------------------------------------------------
@quote_bp.get("/detail")
def quote_detail():
    qid = request.args.get("id")
    if not qid:
        return jsonify({"code": 1, "msg": "缺少 id"})
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM bj_quote_yx WHERE id = %s", (qid,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return jsonify({"code": 1, "msg": "记录不存在"})

        snapshot = row.get("form_snapshot")
        if isinstance(snapshot, (str, bytes)):
            try:
                row["form_snapshot"] = json.loads(snapshot)
            except (ValueError, TypeError):
                row["form_snapshot"] = {}

        for k in ("labor_cost", "aux_cost_excl_tax", "energy_cost", "material_cost_excl_tax",
                  "logistics_cost", "base_cost_excl_tax", "first_pass_rate", "tax_rate",
                  "cost_after_yield", "direct_margin_rate", "direct_price_excl_tax",
                  "direct_price_incl_tax", "dealer_margin_rate", "dealer_price_excl_tax",
                  "dealer_price_incl_tax"):
            row[k] = _f(row[k])
        for k in ("created_at", "updated_at"):
            row[k] = row[k].strftime("%Y-%m-%d %H:%M:%S") if row.get(k) else None

        return jsonify({"code": 0, "data": row})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e)})


# ----------------------------------------------------------------
# 历史客户联想（去重，按最近报价排序）；数据来源即历史报价记录
# ----------------------------------------------------------------
@quote_bp.get("/customers")
def quote_customers():
    keyword = (request.args.get("keyword") or "").strip()
    try:
        conn = get_db2()
        cur = conn.cursor(dictionary=True)
        where = ["customer IS NOT NULL", "customer <> ''"]
        params = []
        if keyword:
            where.append("customer LIKE %s"); params.append(f"%{keyword}%")
        cur.execute(f"""
            SELECT customer, MAX(created_at) AS last_at
            FROM bj_quote_yx
            WHERE {' AND '.join(where)}
            GROUP BY customer
            ORDER BY last_at DESC
            LIMIT 20
        """, tuple(params))
        data = [r["customer"] for r in cur.fetchall()]
        cur.close(); conn.close()
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []}), 500


# 材料类型 -> 料号前缀
def _mat_prefix(mat_type):
    if mat_type == "基材":
        return "31"
    if "装饰纸" in mat_type:   # 正面装饰纸 / 背面装饰纸
        return "3401"
    if "木皮" in mat_type:     # 正面装饰木皮 / 反面装饰木皮
        return "3402"
    return ""


# ----------------------------------------------------------------
# 存货搜索（产品 + 材料共用）
#   keyword: 空格/逗号分词，按 cinvcode 模糊
#   mat_type: 传则按材料类型料号前缀过滤(基材31/装饰纸3401/木皮3402)；
#             不传则按产品固定过滤(1开头、不含88、第4组≤6、末组>2、名称不含测试/客供)
# ----------------------------------------------------------------
@quote_bp.get("/inventory/search")
def inventory_search():
    keyword = (request.args.get("keyword") or "").strip()
    mat_type = (request.args.get("mat_type") or "").strip()
    tokens = [t for t in re.split(r"[\s,，、]+", keyword) if t]
    if not tokens:
        return jsonify({"code": 1, "msg": "请输入关键词", "data": []})
    try:
        where, params = [], []

        if mat_type:
            for t in tokens:
                where.append("(cinvcode LIKE %s OR cinvname LIKE %s)")
                params.extend([f"%{t}%", f"%{t}%"])
            prefix = _mat_prefix(mat_type)
            if not prefix:
                return jsonify({"code": 1, "msg": "未知材料类型", "data": []})
            where.append("cinvcode LIKE %s"); params.append(prefix + "%")
        else:
            for t in tokens:
                where.append("cinvcode LIKE %s"); params.append(f"%{t}%")
            where += [
                "cinvcode LIKE '1%'",
                "cinvcode NOT LIKE '%88%'",
                "cinvname NOT LIKE '%测试%'",
                "cinvname NOT LIKE '%客供%'",
                "cinvcode LIKE '%-%-%-%'",
                "CHAR_LENGTH(SUBSTRING_INDEX(SUBSTRING_INDEX(cinvcode, '-', 4), '-', -1)) <= 6",
                "CHAR_LENGTH(SUBSTRING_INDEX(cinvcode, '-', -1)) > 2",
            ]

        sql = f"""
            SELECT cinvcode, cinvname FROM inventory
            WHERE {' AND '.join(where)}
            ORDER BY cinvcode ASC LIMIT 50
        """
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        cur.close(); conn.close()
        data = [{"code": r["cinvcode"], "name": r["cinvname"]} for r in rows if r.get("cinvcode")]
        return jsonify({"code": 0, "data": data})
    except Exception as e:
        return jsonify({"code": 1, "msg": str(e), "data": []}), 500
