import json
from datetime import date

from flask import Blueprint, g, jsonify, request

from admin_permissions import can_view_material_coding


FIELDS = {"title": ("标题", 240), "created_by": ("创建人", 120), "modified_by": ("修改人", 120)}
MAX_DESCRIPTION = 8000


def normalize_cover(body):
    if not isinstance(body, dict):
        raise ValueError("封面资料格式有误")
    cover = {}
    for field, (label, limit) in FIELDS.items():
        value = body.get(field)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
            raise ValueError(f"{label}须填写，最多 {limit} 字")
        cover[field] = value.strip()
    changes = body.get("changes")
    if not isinstance(changes, list):
        raise ValueError("请填写变更记录")
    normalized = []
    for change in changes:
        if not isinstance(change, dict):
            raise ValueError("变更记录格式有误")
        raw_date = change.get("date")
        try:
            parsed_date = date.fromisoformat(raw_date) if isinstance(raw_date, str) else None
        except ValueError as error:
            raise ValueError("请填写有效的变更日期") from error
        if parsed_date is None or parsed_date.isoformat() != raw_date:
            raise ValueError("请填写有效的变更日期")
        description = change.get("description")
        if not isinstance(description, str) or not description.strip() or len(description.strip()) > MAX_DESCRIPTION:
            raise ValueError(f"变更说明须填写，最多 {MAX_DESCRIPTION} 字")
        normalized.append({"date": raw_date, "description": description.strip()})
    cover["changes"] = sorted(normalized, key=lambda entry: entry["date"], reverse=True)
    return cover


def material_coding_cover_blueprint(db):
    bp = Blueprint("material_coding_cover", __name__)

    @bp.get("/api/admin/material-coding/cover")
    def get_cover():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({"success": False, "message": "当前账号无法查看物料编码规则"}), 403
        with db() as conn, conn.cursor(dictionary=True) as cur:
            cur.execute("""SELECT title,created_by,modified_by,change_history,revision
                FROM mo_material_coding_cover_yx WHERE id=1""")
            row = cur.fetchone()
        if row is None:
            return jsonify({"success": False, "message": "封面资料尚未初始化"}), 503
        history = row.pop("change_history")
        row["changes"] = json.loads(history) if isinstance(history, str) else history
        return jsonify({"success": True, "data": row})

    @bp.post("/api/admin/material-coding/cover/save")
    def save_cover():
        body = request.get_json(silent=True)
        try:
            cover = normalize_cover(body)
            revision = body.get("revision")
            if type(revision) is not int or revision < 1:
                raise ValueError("请重新读取封面后再保存")
        except ValueError as error:
            return jsonify({"success": False, "message": str(error)}), 400

        with db() as conn, conn.cursor() as cur:
            cur.execute("""UPDATE mo_material_coding_cover_yx
                SET title=%s,created_by=%s,modified_by=%s,change_history=%s,updated_by=%s,revision=revision+1
                WHERE id=1 AND revision=%s""",
                        (cover["title"], cover["created_by"], cover["modified_by"],
                         json.dumps(cover["changes"], ensure_ascii=False), g.audit_username, revision))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({"success": False, "message": "封面已被修改，请重新读取后再编辑"}), 409
            conn.commit()
        return jsonify({"success": True, "data": {**cover, "revision": revision + 1}})

    return bp
