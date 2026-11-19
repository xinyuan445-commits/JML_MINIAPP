"""Read-only sales demand, MRP and daily capacity preview."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, jsonify, request


MAX_SELECTED_LINES = 500
MAX_BOM_LEVELS = 10
MAX_SCHEDULE_DAYS = 366


def _decimal(value):
    if value in (None, ""):
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _number(value):
    return float(_decimal(value))


def _date(value, default=None):
    if value is None:
        return default
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return default


def _json_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _rows(cursor):
    columns = [column[0] for column in cursor.description]
    return [
        {key: _json_value(value) for key, value in zip(columns, row)}
        for row in cursor.fetchall()
    ]


def _line_ids(value):
    values = []
    for item in (value or "").split(","):
        if not item.strip():
            continue
        try:
            number = int(item)
        except ValueError:
            raise ValueError("销售订单行无效") from None
        if number <= 0:
            raise ValueError("销售订单行无效")
        if number in values:
            continue
        values.append(number)
    if not values:
        raise ValueError("请先选择销售订单行")
    if len(values) > MAX_SELECTED_LINES:
        raise ValueError(f"一次最多试算{MAX_SELECTED_LINES}条销售订单行")
    return values


def _sales_lines(cursor, line_ids=None, start=None, end=None, keyword="", limit=200):
    filters = [
        "m.cVerifier IS NOT NULL",
        "m.cCloser IS NULL",
        "d.cSCloser IS NULL",
        "ISNULL(d.iQuantity,0)>ISNULL(d.iFHQuantity,0)",
    ]
    params = []
    if line_ids:
        filters.append(f"d.iSOsID IN ({','.join('?' for _ in line_ids)})")
        params.extend(line_ids)
    else:
        filters.extend(["CONVERT(date,m.dDate)>=?", "CONVERT(date,m.dDate)<=?"])
        params.extend([start, end])
        if keyword:
            filters.append("(m.cSOCode LIKE ? OR d.cInvCode LIKE ? OR inv.cInvName LIKE ? OR cus.cCusName LIKE ?)")
            params.extend([f"%{keyword}%"] * 4)
    top = "" if line_ids or not limit else f"TOP {int(limit)}"
    cursor.execute(f"""
        SELECT {top}
            d.iSOsID AS line_id,
            m.cSOCode AS so_code,
            d.iRowNo AS line_no,
            m.dDate AS order_date,
            d.dPreDate AS due_date,
            m.cCusCode AS customer_code,
            COALESCE(cus.cCusName,m.cCusName,'') AS customer_name,
            d.cInvCode AS inv_code,
            COALESCE(inv.cInvName,d.cInvName,'') AS inv_name,
            COALESCE(inv.cInvStd,'') AS inv_std,
            COALESCE(unit.cComUnitName,'') AS unit_name,
            LTRIM(RTRIM(COALESCE(inv.cInvDefine7,''))) AS category_name,
            ISNULL(d.iQuantity,0) AS order_qty,
            ISNULL(d.iFHQuantity,0) AS shipped_qty,
            ISNULL(d.iQuantity,0)-ISNULL(d.iFHQuantity,0) AS open_qty,
            ISNULL(mo.open_qty,0) AS linked_mo_qty
        FROM SO_SODetails d
        JOIN SO_SOMain m ON m.ID=d.ID
        LEFT JOIN Inventory inv ON inv.cInvCode=d.cInvCode
        LEFT JOIN ComputationUnit unit ON unit.cComunitCode=inv.cComUnitCode
        LEFT JOIN Customer cus ON cus.cCusCode=m.cCusCode
        OUTER APPLY (
            SELECT SUM(CASE WHEN md.Qty>ISNULL(md.QualifiedInQty,0)
                            THEN md.Qty-ISNULL(md.QualifiedInQty,0) ELSE 0 END) AS open_qty
            FROM mom_orderdetail md
            WHERE md.SoDId=d.iSOsID AND md.RelsDate IS NOT NULL
              AND md.CloseDate IS NULL AND md.Status=3
        ) mo
        WHERE {' AND '.join(filters)}
        ORDER BY d.dPreDate,m.cSOCode,d.iRowNo
    """, params)
    return _rows(cursor)


def _stock_lots(cursor, inv_codes):
    if not inv_codes:
        return []
    placeholders = ",".join("?" for _ in inv_codes)
    cursor.execute(f"""
        SELECT cs.cInvCode AS inv_code,
               COALESCE(inv.cInvName,'') AS inv_name,
               COALESCE(unit.cComUnitName,'') AS unit_name,
               cs.cWhCode AS warehouse_code,COALESCE(wh.cWhName,cs.cWhCode) AS warehouse_name,
               ISNULL(wh.bMRP,0) AS mrp_enabled,
               SUM(ISNULL(cs.iQuantity,0)) AS on_hand_qty,
               SUM(ISNULL(cs.fAvaQuantity,0)) AS available_qty
        FROM CurrentStock cs
        JOIN Warehouse wh ON wh.cWhCode=cs.cWhCode
        LEFT JOIN Inventory inv ON inv.cInvCode=cs.cInvCode
        LEFT JOIN ComputationUnit unit ON unit.cComunitCode=inv.cComUnitCode
        WHERE cs.cInvCode IN ({placeholders})
        GROUP BY cs.cInvCode,inv.cInvName,unit.cComUnitName,
                 cs.cWhCode,wh.cWhName,wh.bMRP
        ORDER BY cs.cInvCode,cs.cWhCode
    """, inv_codes)
    return _rows(cursor)


def _stock_totals(stock_lots):
    totals = defaultdict(Decimal)
    for lot in stock_lots:
        totals[lot["inv_code"]] += max(Decimal("0"), _decimal(lot["on_hand_qty"]))
    return dict(totals)


def _stock(cursor, inv_codes):
    return _stock_totals(_stock_lots(cursor, inv_codes))


def _linked_production_supplies(cursor, line_ids):
    if not line_ids:
        return {}
    placeholders = ",".join("?" for _ in line_ids)
    cursor.execute(f"""
        SELECT d.SoDId AS line_id,h.MoCode AS order_no,d.SortSeq AS line_no,
               o.DueDate AS supply_date,
               CASE WHEN d.Qty>ISNULL(d.QualifiedInQty,0)
                    THEN d.Qty-ISNULL(d.QualifiedInQty,0) ELSE 0 END AS qty
        FROM mom_orderdetail d
        JOIN mom_order h ON h.MoId=d.MoId
        LEFT JOIN mom_morder o ON o.MoDId=d.MoDId
        WHERE d.SoDId IN ({placeholders}) AND d.RelsDate IS NOT NULL
          AND d.CloseDate IS NULL AND d.Status=3
        ORDER BY o.DueDate,h.MoCode,d.SortSeq
    """, line_ids)
    supplies = defaultdict(list)
    for row in _rows(cursor):
        supplies[row["line_id"]].append({
            "order_no": row["order_no"],
            "line_no": row["line_no"],
            "supply_date": row["supply_date"],
            "quantity": _decimal(row["qty"]),
        })
    return supplies


def allocate_sales_demand(
    rows,
    stock,
    linked_supplies=None,
    remaining_stock=None,
    stock_lots=None,
    remaining_stock_lots=None,
):
    pools = {code: _decimal(qty) for code, qty in stock.items()}
    lot_pools = defaultdict(list)
    if stock_lots is not None:
        for lot in stock_lots:
            lot_pools[lot["inv_code"]].append({
                **lot,
                "remaining": max(Decimal("0"), _decimal(lot["on_hand_qty"])),
            })
    result = []
    for row in sorted(rows, key=lambda item: (str(item.get("due_date") or ""), item["so_code"], item["line_no"])):
        open_qty = _decimal(row["open_qty"])
        pool = max(Decimal("0"), pools.get(row["inv_code"], Decimal("0")))
        stock_allocations = []
        if stock_lots is None:
            stock_qty = min(open_qty, pool)
        else:
            stock_qty = Decimal("0")
            for lot in lot_pools.get(row["inv_code"], []):
                quantity = min(open_qty - stock_qty, lot["remaining"])
                if quantity <= 0:
                    continue
                lot["remaining"] -= quantity
                stock_qty += quantity
                stock_allocations.append({
                    "warehouse_code": lot["warehouse_code"],
                    "warehouse_name": lot["warehouse_name"],
                    "mrp_enabled": bool(lot["mrp_enabled"]),
                    "quantity": _number(quantity),
                })
                if stock_qty >= open_qty:
                    break
        pools[row["inv_code"]] = pool - stock_qty
        remaining = open_qty - stock_qty
        mo_allocations = []
        if linked_supplies is None:
            mo_qty = min(remaining, max(Decimal("0"), _decimal(row.get("linked_mo_qty"))))
        else:
            mo_qty = Decimal("0")
            for supply in linked_supplies.get(row["line_id"], []):
                quantity = min(remaining - mo_qty, max(Decimal("0"), _decimal(supply["quantity"])))
                if quantity <= 0:
                    continue
                mo_allocations.append({
                    **supply,
                    "quantity": _number(quantity),
                })
                mo_qty += quantity
                if mo_qty >= remaining:
                    break
        net_qty = max(Decimal("0"), remaining - mo_qty)
        result.append({
            **row,
            "stock_allocated": _number(stock_qty),
            "stock_allocations": stock_allocations,
            "linked_mo_allocated": _number(mo_qty),
            "linked_mo_allocations": mo_allocations,
            "net_production_qty": _number(net_qty),
        })
    if remaining_stock is not None:
        remaining_stock.clear()
        remaining_stock.update(pools)
    if remaining_stock_lots is not None:
        remaining_stock_lots.clear()
        remaining_stock_lots.update(lot_pools)
    return result


def _bom_children(cursor, parent_codes, as_of):
    if not parent_codes:
        return {}
    placeholders = ",".join("?" for _ in parent_codes)
    cursor.execute(f"""
        WITH selected_bom AS (
            SELECT pp.InvCode AS parent_code,b.BomId,ISNULL(bp.ParentScrap,0) AS parent_scrap,
                   ROW_NUMBER() OVER (
                       PARTITION BY pp.InvCode
                       ORDER BY ISNULL(b.Version,0) DESC,b.BomId DESC
                   ) AS row_no
            FROM bas_part pp
            JOIN bom_parent bp ON bp.ParentId=pp.PartId
            JOIN bom_bom b ON b.BomId=bp.BomId
            WHERE pp.InvCode IN ({placeholders}) AND b.Status=3
              AND ? BETWEEN CONVERT(date,b.VersionEffDate) AND CONVERT(date,b.VersionEndDate)
        )
        SELECT sb.parent_code,sb.BomId AS bom_id,sb.parent_scrap,
               cp.InvCode AS material_code,COALESCE(inv.cInvName,'') AS material_name,
               COALESCE(inv.cInvStd,'') AS material_std,
               COALESCE(unit.cComUnitName,'') AS unit_name,
               ISNULL(oc.BaseQtyN,0) AS base_qty_n,ISNULL(oc.BaseQtyD,0) AS base_qty_d,
               ISNULL(oc.CompScrap,0) AS component_scrap,
               ISNULL(inv.bSelf,0) AS is_self,ISNULL(inv.bPurchase,0) AS is_purchase,
               ISNULL(cp.SafeQty,0) AS safe_qty,ISNULL(cp.MinQty,0) AS minimum_qty,
               ISNULL(cp.MulQty,0) AS multiple_qty,ISNULL(inv.iSupplyDay,0) AS supply_days
        FROM selected_bom sb
        JOIN bom_opcomponent oc ON oc.BomId=sb.BomId
        JOIN bas_part cp ON cp.PartId=oc.ComponentId
        LEFT JOIN Inventory inv ON inv.cInvCode=cp.InvCode
        LEFT JOIN ComputationUnit unit ON unit.cComunitCode=inv.cComUnitCode
        WHERE sb.row_no=1 AND ISNULL(oc.ByproductFlag,0)=0
          AND ? BETWEEN CONVERT(date,oc.EffBegDate) AND CONVERT(date,oc.EffEndDate)
        ORDER BY sb.parent_code,oc.SortSeq
    """, [*parent_codes, as_of, as_of])
    result = defaultdict(list)
    for row in _rows(cursor):
        denominator = _decimal(row["base_qty_d"])
        if denominator <= 0:
            continue
        parent_yield = Decimal("1") - _decimal(row["parent_scrap"]) / Decimal("100")
        if parent_yield <= 0:
            continue
        factor = (
            _decimal(row["base_qty_n"])
            / denominator
            * (Decimal("1") + _decimal(row["component_scrap"]) / Decimal("100"))
            / parent_yield
        )
        result[row["parent_code"]].append({**row, "factor": factor})
    return result


def _active_bom_codes(cursor, inv_codes, as_of):
    if not inv_codes:
        return set()
    placeholders = ",".join("?" for _ in inv_codes)
    cursor.execute(f"""
        SELECT DISTINCT p.InvCode
        FROM bas_part p
        JOIN bom_parent bp ON bp.ParentId=p.PartId
        JOIN bom_bom b ON b.BomId=bp.BomId
        WHERE p.InvCode IN ({placeholders}) AND b.Status=3
          AND ? BETWEEN CONVERT(date,b.VersionEffDate) AND CONVERT(date,b.VersionEndDate)
    """, [*inv_codes, as_of])
    return {row[0] for row in cursor.fetchall()}


def _material_suggestion(row, has_active_bom):
    if has_active_bom and row["is_self"]:
        return "生产"
    if row["is_purchase"]:
        return "采购"
    if row["is_self"]:
        return "生产"
    return "待确认"


def _material_action(supply_method, net_requirement):
    return supply_method if _decimal(net_requirement) > 0 else "无需下单"


def _supply_events(cursor, inv_codes):
    if not inv_codes:
        return [], {}, {}
    placeholders = ",".join("?" for _ in inv_codes)
    stock = _stock_lots(cursor, inv_codes)
    cursor.execute(f"""
        SELECT d.cInvCode AS inv_code,m.dPODate AS order_date,d.dArriveDate AS supply_date,
               m.cPOID AS order_no,d.ID AS line_no,
               CASE WHEN d.iQuantity>ISNULL(d.iReceivedQTY,0)
                    THEN d.iQuantity-ISNULL(d.iReceivedQTY,0) ELSE 0 END AS qty
        FROM PO_Podetails d
        JOIN PO_Pomain m ON m.POID=d.POID
        WHERE d.cInvCode IN ({placeholders})
          AND NULLIF(LTRIM(RTRIM(m.cVerifier)),'') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(m.cCloser)),'') IS NULL
          AND NULLIF(LTRIM(RTRIM(d.cbCloser)),'') IS NULL
          AND d.iQuantity>ISNULL(d.iReceivedQTY,0)
        ORDER BY d.dArriveDate,m.cPOID,d.ID
    """, inv_codes)
    purchase = defaultdict(list)
    for row in _rows(cursor):
        purchase[row["inv_code"]].append({
            "supply_type": "existing_purchase",
            "order_no": row["order_no"],
            "line_no": row["line_no"],
            "order_date": _date(row["order_date"]),
            "supply_date": _date(row["supply_date"], date.max),
            "remaining": _decimal(row["qty"]),
        })
    cursor.execute(f"""
        SELECT d.InvCode AS inv_code,o.DueDate AS supply_date,
               h.MoCode AS order_no,d.SortSeq AS line_no,
               CASE WHEN d.Qty>ISNULL(d.QualifiedInQty,0)
                    THEN d.Qty-ISNULL(d.QualifiedInQty,0) ELSE 0 END AS qty
        FROM mom_orderdetail d
        JOIN mom_order h ON h.MoId=d.MoId
        JOIN mom_morder o ON o.MoDId=d.MoDId
        WHERE d.InvCode IN ({placeholders}) AND d.RelsDate IS NOT NULL
          AND d.CloseDate IS NULL AND d.Status=3 AND d.SoDId IS NULL
        ORDER BY o.DueDate,h.MoCode,d.SortSeq
    """, inv_codes)
    production = defaultdict(list)
    for row in _rows(cursor):
        production[row["inv_code"]].append({
            "supply_type": "existing_production",
            "order_no": row["order_no"],
            "line_no": row["line_no"],
            "supply_date": _date(row["supply_date"], date.max),
            "remaining": _decimal(row["qty"]),
        })
    return stock, purchase, production


def net_material_requirements(
    cursor,
    requirements,
    stock_overrides=None,
    stock_lot_overrides=None,
    as_of=None,
    supply_state=None,
):
    grouped = {}
    for item in requirements:
        key = (item["material_code"], item["need_date"])
        row = grouped.setdefault(key, {
            **item,
            "gross_qty": Decimal("0"),
            "sources": set(),
            "source_quantities": defaultdict(Decimal),
            "level": item["level"],
        })
        row["gross_qty"] += item["gross_qty"]
        row["sources"].add(item["source"])
        row["source_quantities"][item["source"]] += item["gross_qty"]
        row["level"] = min(row["level"], item["level"])
    codes = sorted({key[0] for key in grouped})
    state = supply_state if supply_state is not None else {}
    initialized_codes = state.setdefault("initialized_codes", set())
    lots_by_code = state.setdefault("lots_by_code", defaultdict(list))
    purchase_by_code = state.setdefault("purchase_by_code", defaultdict(list))
    active_bom_codes = state.setdefault("active_bom_codes", set())
    safe_applied_codes = state.setdefault("safe_applied_codes", set())
    missing_codes = [code for code in codes if code not in initialized_codes]
    if missing_codes:
        stock_lots, purchase, production = _supply_events(cursor, missing_codes)
        stock_by_code = defaultdict(list)
        for lot in stock_lots:
            stock_by_code[lot["inv_code"]].append(lot)
        active_bom_codes.update(
            _active_bom_codes(cursor, missing_codes, as_of or date.today())
        )
        for code in missing_codes:
            source_lots = stock_by_code.get(code, [])
            if stock_lot_overrides and code in stock_lot_overrides:
                source_lots = stock_lot_overrides[code]
            elif stock_overrides and not stock_lot_overrides and code in stock_overrides:
                source_lots = [{
                    "warehouse_code": None,
                    "warehouse_name": "现有库存",
                    "mrp_enabled": False,
                    "on_hand_qty": stock_overrides[code],
                    "available_qty": stock_overrides[code],
                    "remaining": stock_overrides[code],
                }]
            for lot in source_lots:
                on_hand = max(Decimal("0"), _decimal(lot.get("on_hand_qty")))
                lots_by_code[code].append({
                    "supply_type": "inventory",
                    "order_no": lot.get("warehouse_name") or "现有库存",
                    "line_no": None,
                    "supply_date": None,
                    "warehouse_code": lot.get("warehouse_code"),
                    "warehouse_name": lot.get("warehouse_name") or "现有库存",
                    "mrp_enabled": bool(lot.get("mrp_enabled")),
                    "on_hand_qty": on_hand,
                    "available_qty": max(Decimal("0"), _decimal(lot.get("available_qty"))),
                    "remaining": max(
                        Decimal("0"),
                        _decimal(lot.get("remaining", on_hand)),
                    ),
                })
            for supply in purchase.get(code, []):
                original = {**supply, "original_qty": _decimal(supply["remaining"])}
                purchase_by_code[code].append(original)
                lots_by_code[code].append({**original})
            for supply in production.get(code, []):
                lots_by_code[code].append({
                    **supply,
                    "original_qty": _decimal(supply["remaining"]),
                })
        initialized_codes.update(missing_codes)
    by_code = defaultdict(list)
    for row in grouped.values():
        by_code[row["material_code"]].append(row)
    result = []
    for code, rows in by_code.items():
        available_lots = lots_by_code.get(code, [])
        for row in sorted(rows, key=lambda item: item["need_date"]):
            eligible_lots = [
                supply
                for supply in available_lots
                if supply["supply_type"] == "inventory"
                or supply["supply_date"] <= row["need_date"]
            ]
            safe_qty = (
                _decimal(row["safe_qty"])
                if code not in safe_applied_codes
                else Decimal("0")
            )
            safe_applied_codes.add(code)
            demands = [(source, quantity) for source, quantity in sorted(row["source_quantities"].items())]
            if safe_qty > 0:
                demands.append(("安全库存", safe_qty))
            allocations = []
            shortages = []
            allocated = Decimal("0")
            for source, quantity in demands:
                remaining = quantity
                for supply in eligible_lots:
                    take = min(remaining, supply["remaining"])
                    if take <= 0:
                        continue
                    supply["remaining"] -= take
                    remaining -= take
                    allocated += take
                    allocations.append({
                        "source": source,
                        "quantity": _number(take),
                        "supply_type": supply["supply_type"],
                        "supply_order_no": supply["order_no"],
                        "supply_line_no": supply["line_no"],
                        "supply_order_date": supply.get("order_date").isoformat() if supply.get("order_date") else None,
                        "supply_date": supply["supply_date"].isoformat() if supply["supply_date"] else None,
                        "warehouse_code": supply.get("warehouse_code"),
                        "warehouse_name": supply.get("warehouse_name"),
                        "mrp_enabled": supply.get("mrp_enabled"),
                    })
                    if remaining <= 0:
                        break
                if remaining > 0:
                    shortages.append({"source": source, "quantity": _number(remaining)})
            required = row["gross_qty"] + safe_qty
            net = max(Decimal("0"), required - allocated)
            multiple = _decimal(row["multiple_qty"])
            minimum = _decimal(row["minimum_qty"])
            suggested = net
            if suggested > 0 and minimum > suggested:
                suggested = minimum
            if suggested > 0 and multiple > 0:
                suggested = ((suggested + multiple - Decimal("0.00000001")) // multiple) * multiple
            need_date = row["need_date"]
            release_date = need_date - timedelta(days=max(0, int(_decimal(row["supply_days"]))))
            has_active_bom = code in active_bom_codes
            supply_method = _material_suggestion(row, has_active_bom)
            suggestion = _material_action(supply_method, net)
            inventory_allocated = defaultdict(Decimal)
            purchase_allocated = defaultdict(Decimal)
            production_allocated = Decimal("0")
            for allocation in allocations:
                if allocation["supply_type"] == "inventory":
                    inventory_allocated[allocation.get("warehouse_code")] += _decimal(allocation["quantity"])
                elif allocation["supply_type"] == "existing_purchase":
                    purchase_allocated[(allocation["supply_order_no"], allocation["supply_line_no"])] += _decimal(allocation["quantity"])
                elif allocation["supply_type"] == "existing_production":
                    production_allocated += _decimal(allocation["quantity"])
            inventory_details = [
                {
                    "warehouse_code": supply["warehouse_code"],
                    "warehouse_name": supply["warehouse_name"],
                    "mrp_enabled": supply["mrp_enabled"],
                    "on_hand_qty": _number(supply["on_hand_qty"]),
                    "available_qty": _number(supply["available_qty"]),
                    "allocated_qty": _number(inventory_allocated[supply["warehouse_code"]]),
                    "remaining_qty": _number(supply["remaining"]),
                }
                for supply in available_lots
                if supply["supply_type"] == "inventory" and supply.get("on_hand_qty", 0) > 0
            ]
            purchase_remaining = {
                (supply["order_no"], supply["line_no"]): supply["remaining"]
                for supply in available_lots
                if supply["supply_type"] == "existing_purchase"
            }
            open_purchase_orders = []
            for supply in purchase_by_code.get(code, []):
                key = (supply["order_no"], supply["line_no"])
                eligible = supply["supply_date"] <= need_date
                open_purchase_orders.append({
                    "order_no": supply["order_no"],
                    "line_no": supply["line_no"],
                    "order_date": supply["order_date"].isoformat() if supply["order_date"] else None,
                    "supply_date": supply["supply_date"].isoformat() if supply["supply_date"] != date.max else None,
                    "remaining_qty": _number(supply["original_qty"]),
                    "allocated_qty": _number(purchase_allocated[key]),
                    "remaining_after": _number(purchase_remaining.get(key, supply["original_qty"])),
                    "eligible": eligible,
                })
            result.append({
                **row,
                "need_date": need_date.isoformat(),
                "gross_qty": _number(row["gross_qty"]),
                "safe_qty": _number(safe_qty),
                "purchase_supply": _number(sum(purchase_allocated.values(), Decimal("0"))),
                "production_supply": _number(production_allocated),
                "supply_allocated": _number(allocated),
                "net_requirement": _number(net),
                "suggested_qty": _number(suggested),
                "suggested_release_date": release_date.isoformat(),
                "suggestion": suggestion,
                "supply_method": supply_method,
                "has_active_bom": has_active_bom,
                "inventory_details": inventory_details,
                "open_purchase_orders": open_purchase_orders,
                "sources": sorted(row["sources"]),
                "source_quantities": {
                    source: _number(quantity)
                    for source, quantity in row["source_quantities"].items()
                },
                "supply_allocations": allocations,
                "shortages": shortages,
            })
    return sorted(result, key=lambda item: (item["need_date"], item["material_code"]))


def _merge_quantity_items(items, key_fields):
    merged = {}
    for item in items:
        key = tuple(item.get(field) for field in key_fields)
        if key not in merged:
            merged[key] = {**item, "quantity": Decimal("0")}
        merged[key]["quantity"] += _decimal(item.get("quantity"))
    return [
        {**item, "quantity": _number(item["quantity"])}
        for item in merged.values()
    ]


def _merge_material_rows(rows):
    grouped = {}
    sum_fields = (
        "gross_qty",
        "safe_qty",
        "purchase_supply",
        "production_supply",
        "supply_allocated",
        "net_requirement",
    )
    for item in rows:
        key = (item["material_code"], item["need_date"])
        if key not in grouped:
            grouped[key] = {
                **item,
                "sources": list(item["sources"]),
                "source_quantities": dict(item["source_quantities"]),
                "supply_allocations": list(item["supply_allocations"]),
                "shortages": list(item["shortages"]),
                "inventory_details": [dict(detail) for detail in item["inventory_details"]],
                "open_purchase_orders": [dict(order) for order in item["open_purchase_orders"]],
            }
            continue
        row = grouped[key]
        for field in sum_fields:
            row[field] = _number(_decimal(row[field]) + _decimal(item[field]))
        row["level"] = min(row["level"], item["level"])
        row["sources"] = sorted(set(row["sources"]) | set(item["sources"]))
        for source, quantity in item["source_quantities"].items():
            row["source_quantities"][source] = _number(
                _decimal(row["source_quantities"].get(source)) + _decimal(quantity)
            )
        row["supply_allocations"].extend(item["supply_allocations"])
        row["shortages"].extend(item["shortages"])

        previous_inventory = {
            detail.get("warehouse_code"): detail
            for detail in row["inventory_details"]
        }
        row["inventory_details"] = [
            {
                **detail,
                "allocated_qty": _number(
                    _decimal(previous_inventory.get(detail.get("warehouse_code"), {}).get("allocated_qty"))
                    + _decimal(detail.get("allocated_qty"))
                ),
            }
            for detail in item["inventory_details"]
        ]
        previous_purchase = {
            (order["order_no"], order["line_no"]): order
            for order in row["open_purchase_orders"]
        }
        row["open_purchase_orders"] = [
            {
                **order,
                "allocated_qty": _number(
                    _decimal(previous_purchase.get((order["order_no"], order["line_no"]), {}).get("allocated_qty"))
                    + _decimal(order.get("allocated_qty"))
                ),
            }
            for order in item["open_purchase_orders"]
        ]

    result = []
    allocation_keys = (
        "source",
        "supply_type",
        "supply_order_no",
        "supply_line_no",
        "supply_order_date",
        "supply_date",
        "warehouse_code",
        "warehouse_name",
        "mrp_enabled",
    )
    for row in grouped.values():
        net = _decimal(row["net_requirement"])
        suggested = net
        minimum = _decimal(row["minimum_qty"])
        multiple = _decimal(row["multiple_qty"])
        if suggested > 0 and minimum > suggested:
            suggested = minimum
        if suggested > 0 and multiple > 0:
            suggested = ((suggested + multiple - Decimal("0.00000001")) // multiple) * multiple
        row["suggested_qty"] = _number(suggested)
        row["suggestion"] = _material_action(row["supply_method"], net)
        row["supply_allocations"] = _merge_quantity_items(
            row["supply_allocations"], allocation_keys
        )
        row["shortages"] = _merge_quantity_items(row["shortages"], ("source",))
        result.append(row)
    return sorted(result, key=lambda item: (item["need_date"], item["material_code"]))


def calculate_layered_material_requirements(
    cursor,
    sales_rows,
    as_of,
    stock_overrides=None,
    stock_lot_overrides=None,
):
    supply_state = {}
    bom_cache = {}
    material_rows = []
    exceptions = []
    ordered_sales = sorted(
        sales_rows,
        key=lambda item: (str(item.get("due_date") or ""), item["so_code"], item["line_no"]),
    )
    for sale in ordered_sales:
        root_quantity = _decimal(sale["net_production_qty"])
        if root_quantity <= 0:
            continue
        root_code = sale["inv_code"]
        root_source = f"{sale['so_code']}#{sale['line_no']}"
        frontier = [{
            "parent_code": root_code,
            "quantity": root_quantity,
            "level": 0,
            "path": (root_code,),
            "source": root_source,
            "need_date": _date(sale.get("due_date"), as_of),
        }]
        for _ in range(MAX_BOM_LEVELS):
            if not frontier:
                break
            missing = sorted({
                node["parent_code"]
                for node in frontier
                if node["parent_code"] not in bom_cache
            })
            bom_cache.update(_bom_children(cursor, missing, as_of))
            requirements = []
            expansion_candidates = defaultdict(list)
            for node in frontier:
                children = bom_cache.get(node["parent_code"], [])
                if not children:
                    if node["level"] == 0:
                        message = "产品没有当前有效BOM"
                        source = f"{sale['so_code']} · 行号 {sale['line_no']}"
                    else:
                        message = "自制物料没有当前有效BOM子件"
                        source = node["parent_code"]
                    exceptions.append({"type": "bom", "source": source, "message": message})
                    continue
                for child in children:
                    code = child["material_code"]
                    if code in node["path"]:
                        exceptions.append({
                            "type": "bom",
                            "source": code,
                            "message": "BOM存在循环引用",
                        })
                        continue
                    quantity = node["quantity"] * child["factor"]
                    level = node["level"] + 1
                    requirements.append({
                        **child,
                        "gross_qty": quantity,
                        "level": level,
                        "need_date": node["need_date"],
                        "source": node["source"],
                    })
                    expansion_candidates[(code, node["need_date"], node["source"])].append({
                        "quantity": quantity,
                        "level": level,
                        "path": (*node["path"], code),
                    })
            if not requirements:
                frontier = []
                break
            current_rows = net_material_requirements(
                cursor,
                requirements,
                stock_overrides,
                stock_lot_overrides,
                as_of,
                supply_state,
            )
            material_rows.extend(current_rows)
            following = []
            for row in current_rows:
                if row["supply_method"] != "生产" or _decimal(row["net_requirement"]) <= 0:
                    continue
                if not row["has_active_bom"]:
                    exceptions.append({
                        "type": "bom",
                        "source": row["material_code"],
                        "message": "自制物料没有当前有效BOM",
                    })
                    continue
                need_date = _date(row["need_date"], as_of)
                for shortage in row["shortages"]:
                    remaining = _decimal(shortage["quantity"])
                    source = shortage["source"]
                    if source == "安全库存":
                        following.append({
                            "parent_code": row["material_code"],
                            "quantity": remaining,
                            "level": row["level"],
                            "path": (row["material_code"],),
                            "source": source,
                            "need_date": need_date,
                        })
                        continue
                    candidates = expansion_candidates.get(
                        (row["material_code"], need_date, source),
                        [],
                    )
                    for candidate in candidates:
                        quantity = min(remaining, candidate["quantity"])
                        if quantity <= 0:
                            continue
                        following.append({
                            "parent_code": row["material_code"],
                            "quantity": quantity,
                            "level": candidate["level"],
                            "path": candidate["path"],
                            "source": source,
                            "need_date": need_date,
                        })
                        remaining -= quantity
                        if remaining <= 0:
                            break
            frontier = following
        if frontier:
            exceptions.append({
                "type": "bom",
                "source": "BOM展开",
                "message": f"BOM超过{MAX_BOM_LEVELS}层，已停止继续展开",
            })
    return _merge_material_rows(material_rows), exceptions


def assign_preview_orders(sales_rows, material_rows, as_of):
    stamp = as_of.strftime("%Y%m%d")
    mo_sequence = 0
    po_sequence = 0
    relations = []

    def relation(**values):
        relations.append({"key": f"relation-{len(relations) + 1}", **values})

    sales = []
    root_orders = {}
    for row in sorted(sales_rows, key=lambda item: (str(item.get("due_date") or ""), item["so_code"], item["line_no"])):
        net = _decimal(row["net_production_qty"])
        order_no = None
        if net > 0:
            mo_sequence += 1
            order_no = f"MO{stamp}{mo_sequence:04d}"
        sale = {**row, "suggested_order_no": order_no}
        sales.append(sale)
        source = f"{row['so_code']}#{row['line_no']}"
        if order_no:
            root_orders[source] = order_no
        common = {
            "item_code": row["inv_code"],
            "item_name": row.get("inv_name") or "",
            "unit_name": row.get("unit_name") or "",
            "demand_type": "sales",
            "demand_order_no": row["so_code"],
            "demand_line_no": row["line_no"],
            "demand_date": _json_value(row.get("due_date")),
            "root_sales_order": source,
        }
        stock_allocations = row.get("stock_allocations") or []
        for allocation in stock_allocations:
            relation(
                **common,
                supply_type="inventory",
                supply_order_no=allocation["warehouse_name"],
                supply_line_no=None,
                supply_order_date=None,
                supply_date=None,
                supply_location=allocation["warehouse_code"],
                quantity=_number(allocation["quantity"]),
                preview=False,
            )
        if not stock_allocations and _decimal(row.get("stock_allocated")) > 0:
            relation(
                **common,
                supply_type="inventory",
                supply_order_no="现有库存",
                supply_line_no=None,
                supply_order_date=None,
                supply_date=None,
                supply_location=None,
                quantity=_number(row["stock_allocated"]),
                preview=False,
            )
        for supply in row.get("linked_mo_allocations", []):
            relation(
                **common,
                supply_type="existing_production",
                supply_order_no=supply["order_no"],
                supply_line_no=supply.get("line_no"),
                supply_order_date=None,
                supply_date=_json_value(supply.get("supply_date")),
                supply_location=None,
                quantity=_number(supply["quantity"]),
                preview=False,
            )
        if order_no:
            relation(
                **common,
                supply_type="planned_production",
                supply_order_no=order_no,
                supply_line_no=1,
                supply_order_date=None,
                supply_date=_json_value(row.get("due_date")),
                supply_location=None,
                quantity=_number(net),
                preview=True,
            )

    materials = []
    for row in sorted(material_rows, key=lambda item: (item["need_date"], item["material_code"])):
        net = _decimal(row["net_requirement"])
        order_no = None
        order_type = None
        if net > 0 and row["suggestion"] == "采购":
            po_sequence += 1
            order_no = f"PO{stamp}{po_sequence:04d}"
            order_type = "planned_purchase"
        elif net > 0 and row["suggestion"] == "生产":
            mo_sequence += 1
            order_no = f"MO{stamp}{mo_sequence:04d}"
            order_type = "planned_production"
        material = {
            **row,
            "suggested_order_no": order_no,
            "suggested_order_type": order_type,
            "excess_qty": _number(max(Decimal("0"), _decimal(row["suggested_qty"]) - net)),
        }
        materials.append(material)
        common = {
            "item_code": row["material_code"],
            "item_name": row.get("material_name") or "",
            "unit_name": row.get("unit_name") or "",
            "demand_type": "production",
            "demand_date": row["need_date"],
        }
        for allocation in row.get("supply_allocations", []):
            source = allocation["source"]
            relation(
                **common,
                demand_order_no=root_orders.get(source, source),
                demand_line_no=1 if source in root_orders else None,
                root_sales_order=source,
                supply_type=allocation["supply_type"],
                supply_order_no=allocation["supply_order_no"],
                supply_line_no=allocation.get("supply_line_no"),
                supply_order_date=allocation.get("supply_order_date"),
                supply_date=allocation.get("supply_date"),
                supply_location=allocation.get("warehouse_code"),
                quantity=_number(allocation["quantity"]),
                preview=False,
            )
        for shortage in row.get("shortages", []):
            source = shortage["source"]
            relation(
                **common,
                demand_order_no=root_orders.get(source, source),
                demand_line_no=1 if source in root_orders else None,
                root_sales_order=source,
                supply_type=order_type or "unresolved",
                supply_order_no=order_no or "待确认",
                supply_line_no=1 if order_no else None,
                supply_order_date=None,
                supply_date=row["need_date"] if order_no else None,
                supply_location=None,
                quantity=_number(shortage["quantity"]),
                preview=bool(order_no),
            )
    return sales, materials, relations


def _route_data(mysql_connection, category_names):
    if not category_names:
        return {}, {}
    cursor = mysql_connection.cursor(dictionary=True)
    placeholders = ",".join("%s" for _ in category_names)
    cursor.execute(f"""
        SELECT TRIM(pc.name) AS category_name,pc.code AS category_code,
               r.id AS route_id,r.route_name
        FROM bj_product_cost_yx pc
        JOIN mo_product_route_yx pr ON pr.product_code=pc.code
        JOIN mo_route_yx r ON r.id=pr.route_id
        WHERE TRIM(pc.name) IN ({placeholders}) AND r.is_active=1 AND r.is_current=1
    """, tuple(category_names))
    routes = {row["category_name"]: row for row in cursor.fetchall()}
    route_ids = sorted({row["route_id"] for row in routes.values()})
    if not route_ids:
        cursor.close()
        return routes, {}
    route_placeholders = ",".join("%s" for _ in route_ids)
    cursor.execute(f"""
        SELECT s.route_id,s.id AS step_id,s.seq,p.id AS process_id,p.process_name,
               ss.station_id,w.station_name,e.device_id,d.device_name,d.device_enabled,
               c.id AS standard_id,c.category_code AS capacity_category,c.capacity_mode,
               c.quantity,c.unit,c.period,c.effective_hours,c.staffing,c.setup_minutes
        FROM mo_route_step_yx s
        JOIN mo_process_yx p ON p.id=s.process_id
        LEFT JOIN mo_step_station_yx ss ON ss.step_id=s.id
        LEFT JOIN mo_workstation_yx w ON w.id=ss.station_id AND w.is_active=1
        LEFT JOIN mo_equipment_yx e ON e.station_id=ss.station_id
        LEFT JOIN mo_equipment_device_yx d ON d.device_id=e.device_id AND d.device_enabled=1
        LEFT JOIN mo_equipment_capacity_yx c ON c.device_id=e.device_id
             AND c.process_id=s.process_id AND c.is_active=1
        WHERE s.route_id IN ({route_placeholders})
        ORDER BY s.route_id,s.seq,ss.station_id,c.category_code DESC,c.id DESC
    """, tuple(route_ids))
    steps = defaultdict(list)
    for row in cursor.fetchall():
        steps[row["route_id"]].append(row)
    cursor.close()
    return routes, steps


def _capacity_minutes(row, quantity, task_unit):
    if not row.get("standard_id"):
        return "unconfigured", None, None
    if row.get("capacity_mode") == "unlimited":
        return "unlimited", None, None
    if row.get("capacity_mode") != "finite" or _decimal(row.get("quantity")) <= 0:
        return "incomplete", None, None
    if (row.get("unit") or "").strip() != (task_unit or "").strip():
        return "unit_mismatch", None, None
    period = row.get("period")
    if period in {"day", "shift"}:
        period_minutes = _decimal(row.get("effective_hours")) * Decimal("60")
        daily_minutes = period_minutes
    elif period == "hour":
        period_minutes = Decimal("60")
        daily_minutes = Decimal("480")
    elif period == "minute":
        period_minutes = Decimal("1")
        daily_minutes = Decimal("480")
    else:
        return "incomplete", None, None
    target = _decimal(quantity) * period_minutes / _decimal(row["quantity"])
    target += _decimal(row.get("setup_minutes"))
    return "finite", target, daily_minutes


def _pick_step(rows, category_code, unit):
    candidates = []
    for row in rows:
        capacity_category = row.get("capacity_category") or ""
        if capacity_category not in {"", category_code}:
            continue
        state, minutes, daily = _capacity_minutes(row, Decimal("1"), unit)
        rank = {
            "finite": 0,
            "unlimited": 1,
            "unit_mismatch": 2,
            "incomplete": 3,
            "unconfigured": 4,
        }[state]
        candidates.append((0 if capacity_category == category_code else 1, rank, row, minutes, daily))
    if not candidates:
        return rows[0] if rows else None
    return min(candidates, key=lambda item: (item[0], item[1], item[2].get("station_id") or 10**12))[2]


def _allocate_backward(usage, limits, station_id, due_date, minutes, daily_minutes):
    remaining = minutes
    current = due_date
    segments = []
    for _ in range(MAX_SCHEDULE_DAYS):
        key = (station_id, current)
        limits[key] = max(limits.get(key, Decimal("0")), daily_minutes)
        available = max(Decimal("0"), limits[key] - usage.get(key, Decimal("0")))
        take = min(available, remaining)
        if take > 0:
            usage[key] = usage.get(key, Decimal("0")) + take
            segments.append({"date": current.isoformat(), "minutes": _number(take)})
            remaining -= take
        if remaining <= 0:
            break
        current -= timedelta(days=1)
    return segments, remaining


def capacity_preview(mysql_connection, sales_rows, as_of):
    categories = sorted({(row.get("category_name") or "").strip() for row in sales_rows if row.get("category_name")})
    routes, route_steps = _route_data(mysql_connection, categories)
    usage = {}
    limits = {}
    tasks = []
    exceptions = []
    for sale in sorted(sales_rows, key=lambda item: (str(item.get("due_date") or ""), item["so_code"], item["line_no"])):
        quantity = _decimal(sale["net_production_qty"])
        if quantity <= 0:
            continue
        category_name = (sale.get("category_name") or "").strip()
        route = routes.get(category_name)
        source = f"{sale['so_code']} · 行号 {sale['line_no']}"
        if not route:
            exceptions.append({"type": "route", "source": source, "message": "产品类别没有匹配到当前工艺路线"})
            continue
        grouped_steps = defaultdict(list)
        for row in route_steps.get(route["route_id"], []):
            grouped_steps[(row["step_id"], row["seq"], row["process_id"], row["process_name"])].append(row)
        line_tasks = []
        for (step_id, seq, process_id, process_name), candidates in grouped_steps.items():
            selected = _pick_step(candidates, route["category_code"], sale.get("unit_name"))
            if not selected or not selected.get("station_id"):
                exceptions.append({"type": "station", "source": f"{source} · {process_name}", "message": "工序没有可用工站"})
                continue
            state, duration, daily = _capacity_minutes(selected, quantity, sale.get("unit_name"))
            task = {
                "key": f"{sale['line_id']}-{step_id}",
                "line_id": sale["line_id"],
                "so_code": sale["so_code"],
                "line_no": sale["line_no"],
                "planned_order_no": sale.get("suggested_order_no"),
                "inv_code": sale["inv_code"],
                "inv_name": sale["inv_name"],
                "route_name": route["route_name"],
                "step_id": step_id,
                "seq": seq,
                "process_id": process_id,
                "process_name": process_name,
                "station_id": selected["station_id"],
                "station_name": selected.get("station_name") or "未标工站",
                "device_name": selected.get("device_name") or "未建设备",
                "quantity": _number(quantity),
                "task_unit": sale.get("unit_name") or "",
                "capacity_state": state,
                "capacity_quantity": _number(selected.get("quantity")) if selected.get("quantity") is not None else None,
                "capacity_unit": selected.get("unit") or "",
                "duration_minutes": _number(duration) if duration is not None else None,
                "staffing": selected.get("staffing"),
                "due_date": _date(sale.get("due_date"), as_of),
                "segments": [],
                "schedule_start": None,
                "schedule_end": None,
            }
            line_tasks.append(task)
            if state == "unconfigured":
                exceptions.append({"type": "capacity", "source": f"{source} · {process_name}", "message": "工站没有标准产能"})
            elif state == "unit_mismatch":
                exceptions.append({"type": "unit", "source": f"{source} · {process_name}", "message": f"订单单位“{sale.get('unit_name') or '未标'}”与产能单位“{selected.get('unit') or '未标'}”不一致"})
            elif state == "incomplete":
                exceptions.append({"type": "capacity", "source": f"{source} · {process_name}", "message": "标准产能资料不完整"})
            elif state == "unlimited":
                exceptions.append({"type": "capacity", "source": f"{source} · {process_name}", "message": "无限产能暂按零流转时间试算"})
        anchor = _date(sale.get("due_date"), as_of)
        for task in sorted(line_tasks, key=lambda item: item["seq"], reverse=True):
            if task["capacity_state"] == "finite":
                selected_rows = grouped_steps[(task["step_id"], task["seq"], task["process_id"], task["process_name"])]
                selected = _pick_step(selected_rows, route["category_code"], sale.get("unit_name"))
                _state, duration, daily = _capacity_minutes(selected, quantity, sale.get("unit_name"))
                segments, remaining = _allocate_backward(
                    usage, limits, task["station_id"], anchor, duration, daily
                )
                task["segments"] = segments
                if segments:
                    dates = sorted(segment["date"] for segment in segments)
                    task["schedule_start"], task["schedule_end"] = dates[0], dates[-1]
                    anchor = _date(dates[0], anchor)
                if remaining > 0:
                    exceptions.append({"type": "schedule", "source": f"{source} · {task['process_name']}", "message": "倒排超过一年仍未安排完"})
            elif task["capacity_state"] == "unlimited":
                task["schedule_start"] = anchor.isoformat()
                task["schedule_end"] = anchor.isoformat()
        tasks.extend(line_tasks)
    loads = [
        {
            "key": f"{station_id}-{work_date.isoformat()}",
            "station_id": station_id,
            "station_name": next((task["station_name"] for task in tasks if task["station_id"] == station_id), "未标工站"),
            "date": work_date.isoformat(),
            "used_minutes": _number(minutes),
            "available_minutes": _number(limits[(station_id, work_date)]),
            "load_percent": _number(minutes / limits[(station_id, work_date)] * Decimal("100")) if limits[(station_id, work_date)] else 0,
        }
        for (station_id, work_date), minutes in sorted(usage.items(), key=lambda item: (item[0][1], item[0][0]))
    ]
    for task in tasks:
        task["due_date"] = task["due_date"].isoformat()
    return tasks, loads, exceptions


def demand_blueprint(mysql_factory, u8_factory):
    blueprint = Blueprint("demand_calculation", __name__)

    @blueprint.get("/api/demand/sales-orders")
    def sales_orders():
        today = date.today()
        start = _date(request.args.get("start_date"), today - timedelta(days=30))
        end = _date(request.args.get("end_date"), today)
        if start > end:
            return jsonify({"code": 1, "msg": "开始日期不能晚于结束日期", "data": []}), 400
        keyword = (request.args.get("keyword") or "").strip()[:100]
        limit = min(max(request.args.get("limit", default=500, type=int) or 500, 1), 500)
        connection = None
        cursor = None
        try:
            connection = u8_factory()
            cursor = connection.cursor()
            rows = _sales_lines(cursor, start=start, end=end, keyword=keyword, limit=limit)
            return jsonify({"code": 0, "data": rows})
        except Exception:
            current_app.logger.exception("demand sales order query failed")
            return jsonify({"code": 1, "msg": "销售订单读取失败，请检查U8连接", "data": []}), 502
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @blueprint.get("/api/demand/calculate")
    def calculate():
        try:
            ids = _line_ids(request.args.get("line_ids"))
            as_of = _date(request.args.get("as_of"), date.today())
        except ValueError as error:
            return jsonify({"code": 1, "msg": str(error), "data": None}), 400
        u8_connection = None
        u8_cursor = None
        mysql_connection = None
        try:
            u8_connection = u8_factory()
            u8_cursor = u8_connection.cursor()
            raw_sales = _sales_lines(u8_cursor, line_ids=ids)
            if len(raw_sales) != len(ids):
                return jsonify({"code": 1, "msg": "部分销售订单已关闭或不存在", "data": None}), 409
            linked_supplies = _linked_production_supplies(u8_cursor, ids)
            sales_codes = sorted({row["inv_code"] for row in raw_sales})
            sales_stock_lots = _stock_lots(u8_cursor, sales_codes)
            remaining_stock = {}
            remaining_stock_lots = {}
            sales = allocate_sales_demand(
                raw_sales,
                _stock_totals(sales_stock_lots),
                linked_supplies,
                remaining_stock,
                sales_stock_lots,
                remaining_stock_lots,
            )
            materials, exceptions = calculate_layered_material_requirements(
                u8_cursor,
                sales,
                as_of,
                remaining_stock,
                remaining_stock_lots,
            )
            sales, materials, relations = assign_preview_orders(sales, materials, as_of)
            mysql_connection = mysql_factory()
            tasks, loads, capacity_exceptions = capacity_preview(mysql_connection, sales, as_of)
            exceptions.extend(capacity_exceptions)
            unique_exceptions = list({
                (item["type"], item["source"], item["message"]): item
                for item in exceptions
            }.values())
            return jsonify({
                "code": 0,
                "data": {
                    "calculated_at": datetime.now().isoformat(timespec="seconds"),
                    "persisted": False,
                    "sales": sales,
                    "materials": materials,
                    "relations": relations,
                    "tasks": tasks,
                    "station_loads": loads,
                    "exceptions": unique_exceptions,
                    "summary": {
                        "sales_lines": len(sales),
                        "production_lines": sum(1 for row in sales if row["net_production_qty"] > 0),
                        "material_shortages": sum(1 for row in materials if row["net_requirement"] > 0),
                        "planned_purchase_orders": sum(1 for row in materials if row["suggested_order_type"] == "planned_purchase"),
                        "planned_production_orders": sum(1 for row in sales if row["suggested_order_no"])
                        + sum(1 for row in materials if row["suggested_order_type"] == "planned_production"),
                        "scheduled_tasks": sum(1 for task in tasks if task["schedule_start"]),
                        "exceptions": len(unique_exceptions),
                    },
                },
            })
        except Exception:
            current_app.logger.exception("demand calculation failed")
            return jsonify({"code": 1, "msg": "需求试算失败，请检查U8及工艺资料", "data": None}), 502
        finally:
            if u8_cursor is not None:
                u8_cursor.close()
            if u8_connection is not None:
                u8_connection.close()
            if mysql_connection is not None:
                mysql_connection.close()

    return blueprint
