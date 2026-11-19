"""Capacity helpers used by the standalone production dashboard."""
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, localcontext


def _json_value(value):
    def encode(item):
        if isinstance(item, (datetime, date)):
            return item.isoformat()
        if isinstance(item, Decimal):
            return format(item, "f")
        raise TypeError(type(item).__name__)

    return json.loads(json.dumps(value, ensure_ascii=False, default=encode))


def _number(value, label, maximum=Decimal("999999999999.99999999")):
    if isinstance(value, bool) or value is None or value == "":
        raise ValueError(f"请填写有效的{label}")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"请填写有效的{label}") from None
    if result <= 0 or result > maximum:
        raise ValueError(f"请填写有效的{label}")
    return result


def conversion(standard, target_quantity=None, unit=None):
    if target_quantity is not None:
        target_quantity = _number(target_quantity, "计算数量")
    if not standard:
        return {"state": "unconfigured", "hourly": None, "unit_minutes": None, "target_minutes": None}
    if standard.get("is_active", 1) != 1:
        return {"state": "inactive", "hourly": None, "unit_minutes": None, "target_minutes": None}
    if target_quantity is not None and standard.get("unit") and unit != standard["unit"]:
        raise ValueError("计算单位与标准不一致")
    if standard.get("capacity_mode") == "unlimited":
        return {"state": "unlimited", "hourly": None, "unit_minutes": None, "target_minutes": None}
    try:
        quantity = _number(standard.get("quantity"), "标准数量")
        period = standard.get("period")
        if period in {"day", "shift"}:
            minutes = _number(standard.get("effective_hours"), "有效工时", Decimal("24")) * 60
        elif period in {"minute", "hour"}:
            minutes = Decimal(1 if period == "minute" else 60)
        else:
            raise ValueError("时间周期缺失")
        if standard.get("capacity_mode") != "finite" or not standard.get("unit"):
            raise ValueError("标准待补")
    except ValueError:
        return {"state": "incomplete", "hourly": None, "unit_minutes": None, "target_minutes": None}
    with localcontext() as context:
        context.prec = 50
        return _json_value({
            "state": "finite",
            "hourly": quantity * 60 / minutes,
            "unit_minutes": minutes / quantity,
            "target_minutes": None if target_quantity is None else target_quantity * minutes / quantity,
        })


def select_standard(rows, process_id, category_code=""):
    enabled = [row for row in rows if row["process_id"] == process_id and row["is_active"] == 1]
    return next((row for row in enabled if row["category_code"] == category_code), None) or next(
        (row for row in enabled if not row["category_code"]), None
    )
