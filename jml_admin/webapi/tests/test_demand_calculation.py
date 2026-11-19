from datetime import date
from decimal import Decimal

import pytest
import demand_calculation

from demand_calculation import (
    _allocate_backward,
    _capacity_minutes,
    _line_ids,
    _material_action,
    _material_suggestion,
    allocate_sales_demand,
    assign_preview_orders,
    calculate_layered_material_requirements,
)


def test_sales_stock_and_linked_production_are_allocated_once():
    rows = [
        {
            "line_id": 1,
            "so_code": "SO1",
            "line_no": 1,
            "due_date": "2026-10-22",
            "inv_code": "P1",
            "open_qty": 8,
            "linked_mo_qty": 0,
        },
        {
            "line_id": 2,
            "so_code": "SO2",
            "line_no": 1,
            "due_date": "2026-10-23",
            "inv_code": "P1",
            "open_qty": 7,
            "linked_mo_qty": 3,
        },
    ]

    result = allocate_sales_demand(rows, {"P1": 10})

    assert result[0]["stock_allocated"] == 8
    assert result[0]["net_production_qty"] == 0
    assert result[1]["stock_allocated"] == 2
    assert result[1]["linked_mo_allocated"] == 3
    assert result[1]["net_production_qty"] == 2


def test_sales_keeps_actual_production_supply_documents():
    rows = [{
        "line_id": 1,
        "so_code": "SO1",
        "line_no": 2,
        "due_date": "2026-10-22",
        "inv_code": "P1",
        "open_qty": 10,
        "linked_mo_qty": 8,
    }]
    supplies = {1: [
        {"order_no": "MO-A", "line_no": 1, "supply_date": "2026-10-20", "quantity": 4},
        {"order_no": "MO-B", "line_no": 2, "supply_date": "2026-10-21", "quantity": 4},
    ]}

    result = allocate_sales_demand(rows, {"P1": 3}, supplies)

    assert result[0]["stock_allocated"] == 3
    assert result[0]["linked_mo_allocated"] == 7
    assert [item["quantity"] for item in result[0]["linked_mo_allocations"]] == [4, 3]
    assert result[0]["net_production_qty"] == 0


def test_sales_returns_remaining_stock_for_material_netting():
    rows = [{
        "line_id": 1,
        "so_code": "SO1",
        "line_no": 1,
        "due_date": "2026-10-22",
        "inv_code": "SHARED",
        "open_qty": 6,
        "linked_mo_qty": 0,
    }]
    remaining_stock = {}

    allocate_sales_demand(rows, {"SHARED": 10}, remaining_stock=remaining_stock)

    assert remaining_stock == {"SHARED": Decimal("4")}


def test_sales_stock_keeps_warehouse_allocations():
    rows = [{
        "line_id": 1,
        "so_code": "SO1",
        "line_no": 1,
        "due_date": "2026-10-22",
        "inv_code": "P1",
        "open_qty": 6,
        "linked_mo_qty": 0,
    }]
    lots = [
        {"inv_code": "P1", "warehouse_code": "W1", "warehouse_name": "一仓", "mrp_enabled": 1, "on_hand_qty": 4},
        {"inv_code": "P1", "warehouse_code": "W2", "warehouse_name": "二仓", "mrp_enabled": 0, "on_hand_qty": 5},
    ]
    remaining_lots = {}

    result = allocate_sales_demand(
        rows,
        {"P1": 9},
        stock_lots=lots,
        remaining_stock_lots=remaining_lots,
    )

    assert result[0]["stock_allocations"] == [
        {"warehouse_code": "W1", "warehouse_name": "一仓", "mrp_enabled": True, "quantity": 4},
        {"warehouse_code": "W2", "warehouse_name": "二仓", "mrp_enabled": False, "quantity": 2},
    ]
    assert remaining_lots["P1"][1]["remaining"] == Decimal("3")


def test_dual_source_material_uses_active_bom_to_choose_make_or_buy():
    material = {"is_self": True, "is_purchase": True}

    assert _material_suggestion(material, has_active_bom=False) == "采购"
    assert _material_suggestion(material, has_active_bom=True) == "生产"


def test_material_with_no_net_requirement_needs_no_order():
    assert _material_action("采购", 0) == "无需下单"
    assert _material_action("采购", 1) == "采购"


def test_multilevel_bom_expands_from_semifinished_net_requirement(monkeypatch):
    def material(code, factor, is_self=False, is_purchase=False):
        return {
            "material_code": code,
            "material_name": code,
            "material_std": "",
            "unit_name": "件",
            "factor": Decimal(str(factor)),
            "is_self": is_self,
            "is_purchase": is_purchase,
            "safe_qty": 0,
            "minimum_qty": 0,
            "multiple_qty": 0,
            "supply_days": 0,
        }

    bom = {
        "P1": [material("A", 1, is_self=True)],
        "A": [material("B", 2, is_purchase=True)],
    }

    monkeypatch.setattr(
        demand_calculation,
        "_bom_children",
        lambda _cursor, codes, _as_of: {code: bom.get(code, []) for code in codes},
    )

    def supply_events(_cursor, codes):
        stock = []
        if "A" in codes:
            stock.append({
                "inv_code": "A",
                "warehouse_code": "W1",
                "warehouse_name": "一仓",
                "mrp_enabled": 1,
                "on_hand_qty": 4,
                "available_qty": 4,
            })
        return stock, {}, {}

    monkeypatch.setattr(demand_calculation, "_supply_events", supply_events)
    monkeypatch.setattr(
        demand_calculation,
        "_active_bom_codes",
        lambda _cursor, codes, _as_of: {code for code in codes if code == "A"},
    )
    sales = [{
        "so_code": "SO1",
        "line_no": 1,
        "due_date": "2026-10-25",
        "inv_code": "P1",
        "net_production_qty": 10,
    }]

    rows, exceptions = calculate_layered_material_requirements(
        object(), sales, date(2026, 10, 23)
    )

    by_code = {row["material_code"]: row for row in rows}
    assert by_code["A"]["gross_qty"] == 10
    assert by_code["A"]["supply_allocated"] == 4
    assert by_code["A"]["net_requirement"] == 6
    assert by_code["B"]["gross_qty"] == 12
    assert by_code["B"]["net_requirement"] == 12
    assert exceptions == []


def test_preview_orders_are_deterministic_and_keep_demand_identity():
    sales = [{
        "line_id": 1,
        "so_code": "SO1",
        "line_no": 2,
        "due_date": "2026-10-25",
        "inv_code": "P1",
        "inv_name": "产品一",
        "unit_name": "件",
        "stock_allocated": 2,
        "linked_mo_allocations": [],
        "net_production_qty": 8,
    }]
    materials = [{
        "material_code": "M1",
        "material_name": "物料一",
        "unit_name": "件",
        "need_date": "2026-10-25",
        "net_requirement": 5,
        "suggested_qty": 10,
        "suggestion": "采购",
        "supply_allocations": [{
            "source": "SO1#2",
            "quantity": 3,
            "supply_type": "inventory",
            "supply_order_no": "现有库存",
            "supply_line_no": None,
            "supply_date": None,
        }],
        "shortages": [{"source": "SO1#2", "quantity": 5}],
    }]

    numbered_sales, numbered_materials, relations = assign_preview_orders(
        sales, materials, date(2026, 10, 22)
    )

    assert numbered_sales[0]["suggested_order_no"] == "MO202610220001"
    assert numbered_materials[0]["suggested_order_no"] == "PO202610220001"
    assert numbered_materials[0]["excess_qty"] == 5
    material_relations = [row for row in relations if row["item_code"] == "M1"]
    assert {row["demand_order_no"] for row in material_relations} == {"MO202610220001"}
    assert {row["supply_order_no"] for row in material_relations} == {
        "现有库存",
        "PO202610220001",
    }


def test_capacity_time_uses_standard_period_and_setup_time():
    state, minutes, daily = _capacity_minutes(
        {
            "standard_id": 1,
            "capacity_mode": "finite",
            "quantity": 400,
            "unit": "张",
            "period": "day",
            "effective_hours": 8,
            "setup_minutes": 10,
        },
        Decimal("100"),
        "张",
    )

    assert state == "finite"
    assert minutes == Decimal("130")
    assert daily == Decimal("480")


def test_daily_backward_allocation_never_exceeds_resource_limit():
    usage = {}
    limits = {}
    segments, remaining = _allocate_backward(
        usage,
        limits,
        7,
        date(2026, 10, 22),
        Decimal("600"),
        Decimal("480"),
    )

    assert remaining == 0
    assert segments == [
        {"date": "2026-10-22", "minutes": 480.0},
        {"date": "2026-10-21", "minutes": 120.0},
    ]
    assert all(usage[key] <= limits[key] for key in usage)


def test_selected_sales_lines_are_limited_and_validated():
    assert _line_ids("3,2,3") == [3, 2]
    with pytest.raises(ValueError, match="请先选择"):
        _line_ids("")
    with pytest.raises(ValueError, match="无效"):
        _line_ids("abc")
    assert len(_line_ids(",".join(str(number) for number in range(1, 501)))) == 500
    with pytest.raises(ValueError, match="最多试算500条"):
        _line_ids(",".join(str(number) for number in range(1, 502)))
