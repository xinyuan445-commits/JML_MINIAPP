"""工序正常流转数量限制；返工不进入本模块。"""
from decimal import Decimal, InvalidOperation


ZERO = Decimal("0")
EPSILON = Decimal("0.0001")
DEFAULT_SETTINGS = {
    "completion_not_exceed_received": False,
    "receive_not_exceed_previous_completed": False,
    "completion_not_exceed_previous_completed": False,
}
PRODUCTION_DEPARTMENT_PREFIX = "041"


def decimal_qty(value):
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("数量格式错误") from exc


def _missing_table(exc):
    return getattr(exc, "errno", None) == 1146 or "doesn't exist" in str(exc)


def load_global_settings(cur):
    """读取全局开关；配置表未初始化时保持全部关闭。"""
    try:
        cur.execute("""
            SELECT completion_not_exceed_received,
                   receive_not_exceed_previous_completed,
                   completion_not_exceed_previous_completed
            FROM mo_quantity_rule_setting_yx WHERE id=1
        """)
        row = cur.fetchone() or {}
    except Exception as exc:
        if _missing_table(exc):
            return dict(DEFAULT_SETTINGS)
        raise
    return {key: bool(row.get(key, 0)) for key in DEFAULT_SETTINGS}


def load_settings(cur, department_code=None):
    """只对ERP生产部门（041及下级）启用数量限制。"""
    settings = load_global_settings(cur)
    if not str(department_code or "").strip().startswith(PRODUCTION_DEPARTMENT_PREFIX):
        return dict(DEFAULT_SETTINGS)
    return settings


def validate_receive(settings, current_received, pending_received,
                     added_qty, previous_completed):
    if not settings["receive_not_exceed_previous_completed"]:
        return
    after = decimal_qty(current_received) + decimal_qty(pending_received) + decimal_qty(added_qty)
    previous = decimal_qty(previous_completed)
    if after > previous + EPSILON:
        available = max(ZERO, previous - decimal_qty(current_received) - decimal_qty(pending_received))
        raise ValueError(f"本次最多可接收{available.normalize()}件，不能超过上一工序完工数量")


def validate_complete(settings, current_completed, added_qty, current_received,
                      previous_completed, has_previous):
    after = decimal_qty(current_completed) + decimal_qty(added_qty)
    caps = []
    if settings["completion_not_exceed_received"] and has_previous:
        caps.append((decimal_qty(current_received), "本工站接收数量"))
    if settings["completion_not_exceed_previous_completed"] and has_previous:
        caps.append((decimal_qty(previous_completed), "上一工序完工数量"))
    if not caps:
        return
    cap, label = min(caps, key=lambda item: item[0])
    if after > cap + EPSILON:
        available = max(ZERO, cap - decimal_qty(current_completed))
        raise ValueError(f"本次最多可完工{available.normalize()}件，不能超过{label}")

