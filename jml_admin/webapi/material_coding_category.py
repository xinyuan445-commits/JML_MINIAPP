import json
import re
from pathlib import Path
from uuid import uuid4

from flask import Blueprint, g, jsonify, request, send_from_directory

from admin_permissions import can_view_material_coding
import material_coding_product_models as images

ACCESSORY_PRODUCTS = "accessory-products"
SUPPLIER_ABBREVIATIONS = "supplier-abbreviations"
VENEER_DESIGN = "veneer-design"
VENEER_CODE_GROUP = "花色编码对照"
DRAWING_DIR = images.ASSETS_DIR / ACCESSORY_PRODUCTS
DRAWING_ID = re.compile(r"[0-9]{3}")


def _list(value, label):
    if not isinstance(value, list):
        raise ValueError(f"{label}格式有误")
    return value


def _text(value, label, limit, *, allow_empty=False):
    if not isinstance(value, str) or (not allow_empty and not value.strip()) or len(value.strip()) > limit:
        raise ValueError(f"{label}须填写，最多 {limit} 字")
    return value.strip()


def _examples(section):
    # Older pages saved a single example object.
    examples = section.get("examples", [section.get("example")])
    if not isinstance(examples, list) or any(not isinstance(item, dict) for item in examples):
        raise ValueError("分类示例格式有误")
    return [{
        "code": _text(item.get("code"), "示例编码", 240),
        "description": _text(item.get("description"), "示例说明", 2000),
    } for item in examples]


def _normalize_accessory_products(body):
    products = []
    seen = set()
    for item in _list(body.get("products"), "辅料产品明细"):
        if not isinstance(item, dict):
            raise ValueError("辅料产品明细格式有误")
        code = _text(item.get("code"), "序号", 3)
        drawing = _text(item.get("drawing"), "图纸编号", 3)
        if not DRAWING_ID.fullmatch(code) or code in seen:
            raise ValueError("序号须为三位数字且不能重复")
        if not DRAWING_ID.fullmatch(drawing):
            raise ValueError("图纸编号须为三位数字")
        seen.add(code)
        products.append({
            "code": code,
            "name": _text(item.get("name"), "名称", 240),
            "drawing": drawing,
            "process": _text(item.get("process"), "工艺", 120),
            "customer_material": _text(item.get("customer_material"), "客供材料", 2000),
        })
    return {"products": products}


def _normalize_suppliers(body):
    suppliers = []
    codes = set()
    for row in _list(body.get("suppliers"), "供应商简称明细"):
        if not isinstance(row, dict):
            raise ValueError("供应商简称明细格式有误")
        code = _text(row.get("code"), "供应商简称", 40)
        if code.casefold() in codes:
            raise ValueError(f"供应商简称 {code} 已存在")
        codes.add(code.casefold())
        suppliers.append({
            "name": _text(row.get("name"), "供应商", 240),
            "kind": _text(row.get("kind"), "供应商属性", 120, allow_empty=True),
            "products": _text(row.get("products"), "所售产品", 240),
            "code": code,
            "remark": _text(row.get("remark"), "备注", 2000, allow_empty=True),
        })
    return {"suppliers": suppliers}


def normalize_category(body, page_key):
    if not isinstance(body, dict):
        raise ValueError("分类内容格式有误")
    if page_key == ACCESSORY_PRODUCTS:
        return _normalize_accessory_products(body)
    if page_key == SUPPLIER_ABBREVIATIONS:
        return _normalize_suppliers(body)
    sections = []
    code_group_seen = False
    for section in _list(body.get("sections"), "分类内容"):
        if not isinstance(section, dict):
            raise ValueError("分类内容格式有误")
        groups = []
        for group in _list(section.get("groups"), "编码分组"):
            if not isinstance(group, dict):
                raise ValueError("编码分组格式有误")
            title = _text(group.get("title"), "分组名称", 120)
            code_changes = page_key == VENEER_DESIGN and title == VENEER_CODE_GROUP
            if code_changes:
                if code_group_seen:
                    raise ValueError("花色编码对照重复")
                code_group_seen = True
            collection = group.get("image_collection")
            if collection is not None and (
                code_changes or page_key != VENEER_DESIGN or not isinstance(collection, str)
                or collection not in images.VENEER_COLLECTIONS
            ):
                raise ValueError(f"{title}的图片目录有误")
            rows = []
            previous_codes = set()
            for row in _list(group.get("rows"), title):
                if not isinstance(row, list) or len(row) not in ((2, 3, 4) if collection else (2, 3)):
                    raise ValueError(f"{title}的编码和说明格式有误")
                code = _text(row[0], "前款号" if code_changes else "编码", 240)
                description = _text(row[1], "新编码" if code_changes else "说明", 2000,
                                    allow_empty=code_changes or page_key == "primary-materials")
                if code_changes:
                    if code in previous_codes:
                        raise ValueError(f"前款号 {code} 重复")
                    previous_codes.add(code)
                # Older archive rows recorded retirement in the description.
                retired = row[2] if len(row) >= 3 else description.endswith("（历史使用）")
                if not isinstance(retired, bool):
                    raise ValueError(f"{title}的废弃状态有误")
                record = [code, description, retired]
                if len(row) == 4:
                    files = _list(row[3], "产品图片")
                    if any(not images.valid_image_filename(name) for name in files):
                        raise ValueError(f"{title}的图片文件名有误")
                    record.append(files)
                rows.append(record)
            entry = {"title": title, "rows": rows}
            if collection:
                entry["image_collection"] = collection
            if "heading" in group:
                entry["heading"] = _text(group["heading"], "分组标题", 120)
            if "note" in group:
                entry["note"] = _text(group["note"], "分组备注", 2000)
            groups.append(entry)
        sections.append({
            "title": _text(section.get("title"), "规则名称", 120),
            "examples": _examples(section),
            "groups": groups,
        })
    if not sections:
        raise ValueError("请填写至少一组规则")
    return {"sections": sections}


def material_coding_category_blueprint(db):
    bp = Blueprint("material_coding_category", __name__)
    bp.register_error_handler(images.ImageUploadError, images.image_upload_error)

    @bp.get("/api/admin/material-coding/category")
    def get_category():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({"success": False, "message": "当前账号无法查看物料编码规则"}), 403
        page_key = request.args.get("key", "").strip().lower()
        with db() as conn, conn.cursor(dictionary=True) as cur:
            cur.execute("""SELECT content,revision FROM mo_material_coding_category_yx WHERE page_key=%s""",
                        (page_key,))
            row = cur.fetchone()
        if row is None:
            return jsonify({"success": False, "message": "该分类尚未维护"}), 404
        content = row["content"]
        if isinstance(content, str):
            content = json.loads(content)
        return jsonify({"success": True, "data": {**normalize_category(content, page_key), "revision": row["revision"]}})

    @bp.get("/api/admin/material-coding/accessory-drawing")
    def accessory_drawing():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({"success": False, "message": "当前账号无法查看物料编码规则"}), 403
        drawing = request.args.get("id", "")
        if not DRAWING_ID.fullmatch(drawing):
            return jsonify({"success": False, "message": "找不到图纸"}), 404
        response = send_from_directory(DRAWING_DIR, f"{drawing}.png", mimetype="image/png", max_age=0)
        response.cache_control.private = True
        return response

    @bp.post("/api/admin/material-coding/accessory-drawing/upload")
    def upload_accessory_drawing():
        file = images.uploaded_image()
        drawing = request.form.get("id", "")
        if not DRAWING_ID.fullmatch(drawing):
            raise images.ImageUploadError("图纸编号须为三位数字")
        images.store_image(DRAWING_DIR, file, f"{drawing}.png", replace=True)
        return jsonify({"success": True})

    @bp.post("/api/admin/material-coding/veneer-image/upload")
    def upload_veneer_image():
        file = images.uploaded_image()
        collection = request.form.get("collection")
        folder_name = images.VENEER_COLLECTIONS.get(collection)
        row_index = request.form.get("row", type=int)
        revision = request.form.get("revision", type=int)
        if folder_name is None or row_index is None or row_index < 0 or revision is None:
            raise images.ImageUploadError("请选择要维护图片的编码")
        with db() as conn, conn.cursor(dictionary=True) as cur:
            cur.execute("""SELECT content,revision FROM mo_material_coding_category_yx
                WHERE page_key=%s FOR UPDATE""", (VENEER_DESIGN,))
            saved = cur.fetchone()
            if saved is None or saved["revision"] != revision:
                raise images.ImageUploadError("编码清单已变更，请刷新后重试", 409)
            raw = saved["content"]
            content = normalize_category(json.loads(raw) if isinstance(raw, str) else raw, VENEER_DESIGN)
            rows = next((group["rows"] for section in content["sections"] for group in section["groups"]
                         if group.get("image_collection") == collection), [])
            if row_index >= len(rows):
                raise images.ImageUploadError("找不到要维护图片的编码", 404)
            row = rows[row_index]
            files = row[3] if len(row) == 4 else []
            existing = request.form.get("replace")
            if existing is not None:
                if existing not in files:
                    raise images.ImageUploadError("找不到要更换的图片", 404)
                images.store_image(images.PRODUCT_IMAGE_DIR / folder_name, file, existing, replace=True)
            else:
                filename = f"{uuid4().hex}{Path(file.filename).suffix.lower()}"
                rows[row_index] = row[:3] + [[*files, filename]]
                cur.execute("""UPDATE mo_material_coding_category_yx
                    SET content=%s,updated_by=%s,revision=revision+1 WHERE page_key=%s""",
                            (json.dumps(content, ensure_ascii=False), g.audit_username, VENEER_DESIGN))
                images.store_image(images.PRODUCT_IMAGE_DIR / folder_name, file, filename)
                revision += 1
            conn.commit()
        return jsonify({"success": True, "data": {**content, "revision": revision}})

    @bp.post("/api/admin/material-coding/category/save")
    def save_category():
        body = request.get_json(silent=True)
        try:
            if not isinstance(body, dict):
                raise ValueError("分类内容格式有误")
            key = _text(body.get("key"), "分类", 64).lower()
            content = normalize_category(body, key)
            revision = body.get("revision")
            if type(revision) is not int or revision < 1:
                raise ValueError("请重新读取分类后再保存")
        except ValueError as error:
            return jsonify({"success": False, "message": str(error)}), 400
        with db() as conn, conn.cursor() as cur:
            cur.execute("""UPDATE mo_material_coding_category_yx
                SET content=%s,updated_by=%s,revision=revision+1 WHERE page_key=%s AND revision=%s""",
                        (json.dumps(content, ensure_ascii=False), g.audit_username, key, revision))
            if cur.rowcount != 1:
                conn.rollback()
                return jsonify({"success": False, "message": "分类内容已变更，请刷新后再编辑"}), 409
            conn.commit()
        return jsonify({"success": True, "data": {**content, "revision": revision + 1}})

    return bp
