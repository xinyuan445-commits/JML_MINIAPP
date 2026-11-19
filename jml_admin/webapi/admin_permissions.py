"""Admin-only authorization. No miniapp or station/department data filtering."""
import hashlib
import json


MODULES = [
    ("dashboard", "生产看板", ["view"]),
    ("reports", "生产报表", ["view"]),
    ("reports2", "生产报表2", ["view"]),
    ("receipt-comparison", "末工序入库对账", ["view"]),
    ("workorder-process-report", "工单工序报告", ["view"]),
    ("inventory-route-report", "料号工艺路线", ["view"]),
    ("completed", "完工记录", ["view"]),
    ("operation-log", "工序操作明细", ["view"]),
    ("production-label", "生产标签", ["view", "print"]),
    ("completion-flow-report", "工序完工报表", ["view", "print"]),
    ("daily-tasks", "工站每日任务", ["view", "manage"]),
    ("nonorder", "无工单任务", ["view", "manage", "publish", "review", "transfer", "view-all", "manage-all"]),
    ("outsource", "委外单据", ["view", "print"]),
    ("demand-calculation", "需求计算", ["view"]),
    ("workorder", "工单路线指定", ["view", "edit", "remove"]),
    ("route-trace", "工单路线追踪", ["view"]),
    ("route", "工艺路线", ["view", "add", "edit", "toggle", "restore", "approve"]),
    ("material-coding", "物料编码规则", ["view", "edit"]),
    ("equipment", "设备档案", ["view", "add", "edit", "approve"]),
    ("equipment-capacity", "标准产能", ["view", "edit", "approve"]),
    ("quantity-rules", "报工数量规则", ["view", "manage"]),
    ("process", "工序管理", ["view", "add", "edit", "toggle", "approve"]),
    ("workstation", "工站管理", ["view", "add", "edit", "toggle", "approve"]),
    ("category", "报工类别", ["view", "add", "edit", "toggle", "approve"]),
    ("worker-department", "报工人员部门", ["view", "edit"]),
    ("accounts", "后台账号", ["view", "manage"]),
    ("roles", "角色权限", ["view", "manage"]),
    ("audit", "操作日志", ["view"]),
    ("station-permissions", "工站权限", ["view", "manage"]),
    ("page-settings", "页面开关", ["view", "manage"]),
    ("basic-settings", "基础配置", ["view", "manage"]),
    ("report-email-settings", "报表发送", ["view", "manage"]),
    ("production-scheduling", "生产排程", ["view", "manage"]),
    ("approval", "审批中心", ["mine"]),
]
ACTION_NAMES = {
    "view": "查看", "print": "打印", "add": "新增", "edit": "修改",
    "toggle": "启用／停用", "restore": "版本恢复",
    "remove": "移除指定", "manage": "管理（含授权）", "approve": "审批",
    "mine": "查看我的申请",
    "publish": "发布无工单任务", "review": "成果及时间核对入口", "transfer": "任务交接",
    "view-all": "全范围查看", "manage-all": "全范围安排",
}
ALL_PERMISSIONS = frozenset(f"{key}.{action}" for key, _, actions in MODULES for action in actions)
DEFAULT_PERMISSIONS = frozenset(p for p in ALL_PERMISSIONS if not p.startswith("nonorder."))
VIEW_PERMISSIONS = frozenset(p for p in ALL_PERMISSIONS if p.endswith(".view") or p == "nonorder.view-all")
BUSINESS_VIEWS = frozenset(p for p in VIEW_PERMISSIONS if p.split(".")[0] not in {
    "nonorder",
    "accounts", "roles", "audit", "station-permissions", "page-settings",
    "basic-settings",
    "report-email-settings",
    "production-scheduling",
})
ROLE_TEMPLATES = [
    ("system-admin", "系统管理员", DEFAULT_PERMISSIONS),
    ("production-manager", "生产管理", frozenset(
        p for p in DEFAULT_PERMISSIONS
        if p.split(".")[0] not in {"accounts", "roles", "station-permissions", "page-settings", "basic-settings", "report-email-settings"}
        and not p.endswith(".approve") and p != "material-coding.edit"
    )),
    ("process-maintainer", "工艺维护", frozenset(
        p for p in ALL_PERMISSIONS
        if p.split(".")[0] in {"workorder", "route-trace", "route", "process", "workstation", "category", "approval"}
        and not p.endswith(".approve")
    )),
    ("document-printer", "单据打印", frozenset(p for p in ALL_PERMISSIONS if p.split(".")[0] in {
        "production-label", "completion-flow-report", "outsource",
    })),
    ("viewer", "只读查看", BUSINESS_VIEWS),
]

PAGE_CATALOG = (
    {"key": "dashboard", "name": "生产看板", "group": "数据看板", "path": "/board/production"},
    {"key": "reports", "name": "生产报表", "group": "数据看板", "path": "/board/reports"},
    {"key": "reports2", "name": "生产报表2", "group": "数据看板", "path": "/board/reports2"},
    {"key": "receipt-comparison", "name": "末工序入库对账", "group": "报表", "path": "/reports/receipt-comparison"},
    {"key": "workorder-process-report", "name": "工单工序报告", "group": "报表", "path": "/reports/workorder-process"},
    {"key": "inventory-route-report", "name": "料号工艺路线", "group": "报表", "path": "/reports/inventory-route"},
    {"key": "completed", "name": "完工记录", "group": "数据看板", "path": "/board/completed"},
    {"key": "operation-log", "name": "工序操作明细", "group": "数据看板", "path": "/board/operation-log"},
    {"key": "production-label", "name": "生产标签打印", "group": "生产管理", "path": "/mo/production-label"},
    {"key": "completion-flow-report", "name": "工序完工报表打印", "group": "生产管理", "path": "/mo/completion-flow-report"},
    {"key": "daily-tasks", "name": "工站每日任务", "group": "生产管理", "path": "/mo/daily-tasks"},
    {"key": "outsource", "name": "委外单据打印", "group": "委外管理", "path": "/outsource/document-print"},
    {"key": "demand-calculation", "name": "需求计算", "group": "需求计划", "path": "/demand/calculation"},
    {"key": "workorder", "name": "工单路线指定", "group": "工序管理", "path": "/mo/workorder"},
    {"key": "route-trace", "name": "工单路线追踪", "group": "工序管理", "path": "/mo/workorder-trace"},
    {"key": "route", "name": "工艺路线", "group": "工序管理", "path": "/mo/route"},
    {"key": "material-coding", "name": "物料编码规则", "group": "档案管理", "path": "/archives/material-coding"},
    {"key": "equipment", "name": "设备管理", "group": "工序配置", "path": "/mo/equipment"},
    {"key": "quantity-rules", "name": "报工数量规则", "group": "系统配置", "path": "/mo/quantity-rules"},
    {"key": "process", "name": "工序管理", "group": "工序配置", "path": "/mo/process"},
    {"key": "workstation", "name": "工站管理", "group": "工序配置", "path": "/mo/workstation"},
    {"key": "category", "name": "报工类别", "group": "工序配置", "path": "/mo/product-category"},
    {"key": "worker-department", "name": "报工人员部门", "group": "工序配置", "path": "/mo/worker-department"},
    {"key": "approval", "name": "审批中心", "group": "审批", "path": "/system/approvals"},
    {"key": "accounts", "name": "后台账号", "group": "系统配置", "path": "/system/accounts"},
    {"key": "roles", "name": "角色权限", "group": "系统配置", "path": "/system/roles"},
    {"key": "station-permissions", "name": "工站权限", "group": "系统配置", "path": "/system/station-permissions"},
    {"key": "audit", "name": "操作日志", "group": "系统配置", "path": "/mo/audit"},
    {"key": "page-settings", "name": "页面开关", "group": "系统配置", "path": "/system/page-settings", "locked": True},
    {"key": "basic-settings", "name": "基础配置", "group": "系统配置", "path": "/system/basic-settings"},
    {"key": "report-email-settings", "name": "报表发送", "group": "系统配置", "path": "/system/report-email-settings"},
    {"key": "production-scheduling", "name": "生产排程", "group": "系统配置", "path": "/system/production-scheduling"},
)
PAGE_KEYS = frozenset(item["key"] for item in PAGE_CATALOG)
PERMISSION_PAGE_KEYS = {
    "nonorder": "daily-tasks",
    "approval": "approval",
    **{item["key"]: item["key"] for item in PAGE_CATALOG},
    "equipment-capacity": "equipment",
}


def permission_catalog():
    request_modules = {"process", "workstation", "category", "route", "equipment", "equipment-capacity"}
    page_groups = {item["key"]: item["group"] for item in PAGE_CATALOG}
    page_groups["equipment-capacity"] = page_groups["equipment"]
    request_names = {
        "add": "申请新增", "edit": "申请编辑", "toggle": "申请状态调整",
        "restore": "申请设为默认版本",
    }
    return [{"key": key, "name": name, "group": page_groups.get(key, "其他"), "permissions": [
        {"key": f"{key}.{action}", "name": request_names[action]
         if key in request_modules and action in request_names else ACTION_NAMES[action]}
        for action in actions
    ]} for key, name, actions in MODULES]


def normalize_permissions(values):
    if not isinstance(values, list) or any(not isinstance(v, str) or v not in ALL_PERMISSIONS for v in values):
        raise ValueError("存在无效权限")
    result = set(values)
    result.update(
        f"{value.split('.')[0]}.view"
        for value in values
        if f"{value.split('.')[0]}.view" in ALL_PERMISSIONS
    )
    if any(value.startswith("equipment-capacity.") for value in values):
        result.add("equipment.view")
    if any(
        value.split(".")[0] in {"process", "workstation", "category", "route", "equipment", "equipment-capacity"}
        and not value.endswith((".view", ".approve"))
        for value in values
    ):
        result.add("approval.mine")
    return sorted(result)


def identity_key(source, identifier, issuer=""):
    return hashlib.sha256(json.dumps([source, issuer, str(identifier)], ensure_ascii=False).encode()).hexdigest()


MATERIAL_CODING_VIEW_MODULES = ("material-coding", "route", "workstation", "process")


def can_view_material_coding(permissions, disabled_pages):
    return "material-coding" not in disabled_pages and any(
        f"{module}.view" in permissions and module not in disabled_pages
        for module in MATERIAL_CODING_VIEW_MODULES
    )


READ_RULES = {
    "/api/nonorder/context": {"nonorder.view", "nonorder.transfer"},
    "/api/nonorder/tasks": {"nonorder.view", "nonorder.transfer"},
    "/api/nonorder/detail": {"nonorder.view"},
    "/api/nonorder/publish-options": {"nonorder.publish"},
    "/api/nonorder/sheet-work-people": {"nonorder.manage"},
    "/api/nonorder/candidates": {"nonorder.view"},
    "/api/nonorder/daily-result": {"nonorder.view"},
    "/api/nonorder/people": {"nonorder.manage", "nonorder.transfer"},
    "/api/nonorder/attachment": {"nonorder.view"},
    "/api/mo/departments": {"route.view"},
    "/api/mo/worker-department-scope": {"worker-department.view"},
    "/api/mo/workorder/list": {"workorder.view"},
    "/api/mo/production-label/options": {"production-label.view"},
    "/api/mo/production-label": {"production-label.view"},
    "/api/mo/completion-flow-report/options": {"completion-flow-report.view"},
    "/api/mo/completion-flow-report/lines": {"completion-flow-report.view"},
    "/api/mo/completion-flow-report": {"completion-flow-report.view"},
    "/api/mo/daily-tasks": {"daily-tasks.view"},
    "/api/mo/daily-tasks/export": {"daily-tasks.view"},
    "/api/outsource/document-print/options": {"outsource.view"},
    "/api/outsource/document-print": {"outsource.view"},
    "/api/demand/sales-orders": {"demand-calculation.view"},
    "/api/demand/calculate": {"demand-calculation.view"},
    "/api/mo/process/list": {"process.view", "route.view"},
    "/api/mo/process-archive": {"route.view", "workstation.view", "process.view"},
    "/api/mo/process-archive/export": {"route.view", "workstation.view", "process.view"},
    "/api/admin/material-coding/cover": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/admin/material-coding/export": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/admin/material-coding/category": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/admin/material-coding/accessory-drawing": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/admin/material-coding/product-models": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/admin/material-coding/product-image": {f"{module}.view" for module in MATERIAL_CODING_VIEW_MODULES},
    "/api/mo/workstation/list": {"workstation.view", "route.view"},
    "/api/mo/product-category/list": {"category.view", "route.view", "workorder.view"},
    "/api/mo/product-category/manage-list": {"category.view"},
    "/api/mo/route/list": {"route.view", "workorder.view", "completed.view"},
    "/api/mo/route/detail": {"route.view"},
    "/api/mo/route/next-code": {"route.add"},
    "/api/mo/route/version/history": {"route.view"},
    "/api/mo/wo-state/started": {"workorder.view"},
    "/api/mo/wo-route/list": {"workorder.view"},
    "/api/mo/workorder-trace/search": {"route-trace.view"},
    "/api/mo/completed-workorder/list": {"completed.view"},
    "/api/mo/completed-workorder/detail": {"completed.view", "route-trace.view"},
    "/api/mo/completed-workorder/qr-code": {"completed.view"},
    "/api/mo/dashboard/operations": {"dashboard.view", "reports.view", "reports2.view"},
    "/api/mo/dashboard/schedule-preview": {"dashboard.view"},
    "/api/mo/receipt-comparison": {"receipt-comparison.view"},
    "/api/mo/workorder-process-report": {"workorder-process-report.view"},
    "/api/mo/inventory-route-report": {"inventory-route-report.view"},
    "/api/mo/process-labor-report": {"workorder-process-report.view"},
    "/api/mo/dashboard/operation-log": {"operation-log.view"},
    "/api/mo/audit/list": {"audit.view"},
    "/api/admin/permissions": {"roles.view", "accounts.view"},
    "/api/admin/roles": {"roles.view", "accounts.view"},
    "/api/admin/accounts": {"accounts.view"},
    "/api/admin/accounts/staff-binding": {"accounts.manage"},
    "/api/admin/station-permissions": {"station-permissions.view"},
    "/api/admin/station-permissions/staff": {"station-permissions.view"},
    "/api/admin/station-permissions/exemptions": {"station-permissions.view"},
    "/api/admin/station-permissions/proxies": {"station-permissions.view"},
    "/api/admin/page-settings": {"page-settings.view"},
    "/api/admin/basic-settings/email-service": {"basic-settings.view"},
    "/api/admin/basic-settings/approval-email": {"basic-settings.view"},
    "/api/admin/report-email-settings": {"report-email-settings.view"},
    "/api/admin/archive-email": {"report-email-settings.manage"},
    "/api/admin/quantity-rules": {"quantity-rules.view"},
    "/api/admin/production-scheduling": {"production-scheduling.view"},
    "/api/admin/config-approvals": {
        "approval.mine", "process.approve", "workstation.approve",
        "category.approve", "route.approve",
    },
    "/api/admin/config-approvals/notifications": {
        "approval.mine", "process.approve", "workstation.approve",
        "category.approve", "route.approve",
    },
}
for _name in ("gantt-data", "process-gantt", "summary", "capacity", "wip", "anomalies"):
    READ_RULES[f"/api/mo/dashboard/{_name}"] = {"reports.view"}
for _name in ("options", "list", "detail", "approval"):
    READ_RULES[f"/api/mo/equipment/{_name}"] = {"equipment.view"}
for _name in ("calculate", "preview"):
    READ_RULES[f"/api/mo/equipment/{_name}"] = {"equipment-capacity.view"}
for _path in ("/api/admin/config-approvals", "/api/admin/config-approvals/notifications"):
    READ_RULES[_path].update({"equipment.approve", "equipment-capacity.approve"})

WRITE_RULES = {
    "/api/nonorder/command": {"nonorder.manage", "nonorder.publish", "nonorder.review", "nonorder.transfer"},
    "/api/nonorder/attachment": {"nonorder.manage", "nonorder.review"},
    "/api/admin/accounts/staff-binding": {"accounts.manage"},
    "/api/mo/production-label/print-log": {"production-label.print"},
    "/api/mo/completion-flow-report/print-authorize": {"completion-flow-report.print"},
    "/api/mo/daily-tasks/save": {"daily-tasks.manage"},
    "/api/outsource/document-print/print-log": {"outsource.print"},
    "/api/mo/worker-department-scope": {"worker-department.edit"},
    "/api/mo/route/set-categories": {"route.edit"},
    "/api/mo/route/set-processes": {"route.edit"},
    "/api/mo/route/version/create": {"route.edit"},
    "/api/mo/route/version/restore": {"route.restore"},
    "/api/mo/route/admin-authorize": {"route.edit"},
    "/api/mo/wo-route/set": {"workorder.edit"},
    "/api/mo/wo-route/set-batch": {"workorder.edit"},
    "/api/mo/wo-route/remove": {"workorder.remove"},
    "/api/admin/accounts/save": {"accounts.manage"},
    "/api/admin/accounts/password": {"accounts.manage"},
    "/api/admin/roles/save": {"roles.manage"},
    "/api/admin/station-permissions/save": {"station-permissions.manage"},
    "/api/admin/station-permissions/settings/save": {"station-permissions.manage"},
    "/api/admin/station-permissions/exemptions/save": {"station-permissions.manage"},
    "/api/admin/station-permissions/proxies/save": {"station-permissions.manage"},
    "/api/admin/page-settings/save": {"page-settings.manage"},
    "/api/admin/basic-settings/email-service/save": {"basic-settings.manage"},
    "/api/admin/material-coding/cover/save": {"material-coding.edit"},
    "/api/admin/material-coding/category/save": {"material-coding.edit"},
    "/api/admin/material-coding/product-image/upload": {"material-coding.edit"},
    "/api/admin/material-coding/veneer-image/upload": {"material-coding.edit"},
    "/api/admin/material-coding/accessory-drawing/upload": {"material-coding.edit"},
    "/api/admin/basic-settings/email-service/test": {"basic-settings.manage"},
    "/api/admin/basic-settings/approval-email/save": {"basic-settings.manage"},
    "/api/admin/basic-settings/approval-email/send-latest": {"basic-settings.manage"},
    "/api/admin/basic-settings/approval-email/send-weekly": {"basic-settings.manage"},
    "/api/admin/report-email-settings/smtp/save": {"basic-settings.manage"},
    "/api/admin/report-email-settings/smtp/test": {"basic-settings.manage"},
    "/api/admin/report-email-settings/report/save": {"report-email-settings.manage"},
    "/api/admin/report-email-settings/send": {"report-email-settings.manage"},
    "/api/admin/archive-email/save": {"report-email-settings.manage"},
    "/api/admin/archive-email/send": {"report-email-settings.manage"},
    "/api/admin/quantity-rules/setting/save": {"quantity-rules.manage"},
    "/api/admin/production-scheduling/calendar/save": {"production-scheduling.manage"},
    "/api/admin/production-scheduling/calendar/import-holidays": {"production-scheduling.manage"},
    "/api/admin/production-scheduling/policy/save": {"production-scheduling.manage"},
    "/api/admin/production-scheduling/handover/save": {"production-scheduling.manage"},
    "/api/admin/config-approvals/submit": {
        "process.add", "process.edit", "process.toggle",
        "workstation.add", "workstation.edit", "workstation.toggle",
        "category.add", "category.edit", "category.toggle",
        "route.add", "route.edit", "route.toggle", "route.restore",
    },
    "/api/admin/config-approvals/review": {
        "process.approve", "workstation.approve", "category.approve", "route.approve",
    },
    "/api/admin/config-approvals/update": {
        "process.add", "process.edit", "process.toggle",
        "workstation.add", "workstation.edit", "workstation.toggle",
        "category.add", "category.edit", "category.toggle",
        "route.add", "route.edit", "route.toggle", "route.restore",
    },
    "/api/admin/config-approvals/notifications/read": {"approval.mine"},
}
for _path, _module in (("process", "process"), ("workstation", "workstation"), ("product-category", "category"), ("route", "route")):
    for _action, _permission in (("add", "add"), ("update", "edit"), ("toggle", "toggle")):
        WRITE_RULES[f"/api/mo/{_path}/{_action}"] = {f"{_module}.{_permission}"}
WRITE_RULES["/api/mo/route/delete"] = {"route.edit"}
for _path in ("/api/admin/config-approvals/submit", "/api/admin/config-approvals/update"):
    WRITE_RULES[_path].update({"equipment.add", "equipment.edit", "equipment-capacity.edit"})
WRITE_RULES["/api/admin/config-approvals/review"].update({"equipment.approve", "equipment-capacity.approve"})


def permits(permissions, path, method):
    rules = READ_RULES if method in {"GET", "HEAD", "OPTIONS"} else WRITE_RULES
    required = rules.get(path, set())
    return bool(set(permissions) & required)


def page_keys_for_request(path, method, body=None):
    """Return pages that may legitimately consume an API endpoint."""
    if path == "/api/admin/config-approvals/submit" and isinstance(body, dict):
        module = body.get("module_type")
        return {PERMISSION_PAGE_KEYS[module]} if module in PERMISSION_PAGE_KEYS else set()
    if path.startswith("/api/admin/config-approvals"):
        return {"approval"}
    rules = READ_RULES if method in {"GET", "HEAD", "OPTIONS"} else WRITE_RULES
    return {
        PERMISSION_PAGE_KEYS[module]
        for permission in rules.get(path, set())
        for module in [permission.split(".", 1)[0]]
        if module in PERMISSION_PAGE_KEYS
    }


def page_request_enabled(disabled_pages, path, method, body=None):
    page_keys = page_keys_for_request(path, method, body)
    if page_keys == {"page-settings"}:
        return True
    return not page_keys or bool(page_keys - set(disabled_pages))


def load_account(cur, source, identifier, issuer="", username="", display_name="", default_role="viewer"):
    """Register authenticated identities only; never link accounts by display name."""
    key = identity_key(source, identifier, issuer)
    cur.execute("SELECT * FROM mo_admin_account_yx WHERE identity_key=%s", (key,))
    account = cur.fetchone()
    if not account:
        cur.execute("""INSERT IGNORE INTO mo_admin_account_yx
            (identity_key,auth_source,local_user_id,issuer,subject,username,display_name)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""", (
            key, source, identifier if source == "session" else None,
            issuer, str(identifier), username, display_name,
        ))
        if cur.rowcount:
            account_id = cur.lastrowid
            cur.execute("""INSERT INTO mo_admin_account_role_yx (account_id,role_id)
                SELECT %s,id FROM mo_admin_role_yx WHERE code=%s""", (account_id, default_role))
        cur.execute("SELECT * FROM mo_admin_account_yx WHERE identity_key=%s", (key,))
        account = cur.fetchone()
    if not account:
        raise RuntimeError("权限账号初始化失败")
    return account


def account_permissions(cur, account, platform_roles=(), platform_can_write=True):
    if not account["is_active"]:
        return set(), []
    cur.execute("""SELECT r.code,r.permissions FROM mo_admin_role_yx r
        JOIN mo_admin_account_role_yx ar ON ar.role_id=r.id
        WHERE ar.account_id=%s AND r.is_active=1""", (account["id"],))
    rows = cur.fetchall()
    permissions = set()
    for role in rows:
        values = json.loads(role["permissions"]) if isinstance(role["permissions"], str) else role["permissions"]
        permissions.update(set(values) & ALL_PERMISSIONS)
    if "suite-admin" in platform_roles:
        permissions.update(DEFAULT_PERMISSIONS)
    if not platform_can_write:
        permissions &= VIEW_PERMISSIONS
    return permissions, [row["code"] for row in rows]
