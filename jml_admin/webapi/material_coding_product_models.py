import os
import re
import shutil
from functools import lru_cache
from io import BytesIO
from pathlib import Path, PureWindowsPath
from tempfile import NamedTemporaryFile

from flask import Blueprint, current_app, g, jsonify, request, send_file
from PIL import Image, ImageOps
from werkzeug.exceptions import RequestEntityTooLarge

from admin_permissions import can_view_material_coding

PRODUCT_COLLECTIONS = {
    "skin-feel": "金米龙肤感产品大图",
    "refined-synchronized": "精板+同步肤感",
}
VENEER_COLLECTIONS = {
    "veneer-ao": "金米龙臻木饰面产品大图/臻木系列/奥系列",
    "veneer-jin": "金米龙臻木饰面产品大图/臻木系列/金系列",
    "veneer-mi": "金米龙臻木饰面产品大图/臻木系列/米系列",
    "veneer-art": "金米龙臻木饰面产品大图/艺术木皮/创意背板",
}
IMAGE_COLLECTIONS = {**PRODUCT_COLLECTIONS, **VENEER_COLLECTIONS}
ASSETS_DIR = Path(__file__).resolve().parent / "assets" / "material-coding"
PRODUCT_IMAGE_DIR = ASSETS_DIR / "product-images"
IMAGE_FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}
MAX_IMAGE_BYTES = 32 * 1024 * 1024
MODEL_NAME = re.compile(r"([A-Za-z]+[0-9]+)[\s_\-－—]*(.*)")
THUMBNAIL_SIZE = (560, 400)


def valid_image_filename(filename):
    return (
        isinstance(filename, str) and 0 < len(filename) <= 180 and filename == filename.strip()
        and not re.search(r'[<>:"/\\|?*\x00-\x1f]', filename)
        and not PureWindowsPath(filename).is_reserved() and Path(filename).suffix.lower() in IMAGE_FORMATS
    )


def _is_product_image(path):
    return valid_image_filename(path.name) and path.is_file() and not path.is_symlink()


class ImageUploadError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def image_upload_error(error):
    return jsonify({"success": False, "message": str(error)}), error.status


def uploaded_image():
    request.max_content_length = MAX_IMAGE_BYTES + 64 * 1024
    try:
        file = request.files.get("image")
    except RequestEntityTooLarge as error:
        raise ImageUploadError("单张图片不能超过 32 MB", 413) from error
    if not file or not valid_image_filename(file.filename):
        raise ImageUploadError("请上传 JPG、PNG 或 WEBP 图片，文件名须有效")
    if file.stream.seek(0, os.SEEK_END) > MAX_IMAGE_BYTES:
        raise ImageUploadError("单张图片不能超过 32 MB", 413)
    file.stream.seek(0)
    return file


def store_image(folder, file, filename, *, replace=False):
    image_format = IMAGE_FORMATS[Path(file.filename).suffix.lower()]
    target_format = IMAGE_FORMATS[Path(filename).suffix.lower()]
    temporary = None
    converted = None
    try:
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / filename
        with NamedTemporaryFile(dir=folder, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            shutil.copyfileobj(file.stream, stream)
        photo = None
        try:
            with Image.open(temporary) as image:
                if image.format != image_format:
                    raise ImageUploadError("图片内容与文件扩展名不一致")
                if image.width * image.height > 60_000_000:
                    raise ImageUploadError("图片不能超过 6000 万像素")
                image.load()
                if target_format != image_format:
                    photo = ImageOps.exif_transpose(image).convert("RGBA")
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            raise ImageUploadError("无法读取该图片") from error
        if photo is not None:
            with photo, NamedTemporaryFile(dir=folder, suffix=".tmp", delete=False) as stream:
                converted = Path(stream.name)
                if target_format == "JPEG":
                    with Image.new("RGB", photo.size, "white") as background:
                        background.paste(photo, mask=photo.getchannel("A"))
                        background.save(stream, "JPEG", quality=95)
                else:
                    photo.save(stream, target_format)
        ready = converted or temporary
        if replace:
            os.replace(ready, target)
        else:
            os.link(ready, target)
    except FileExistsError as error:
        raise ImageUploadError("同名图片已存在，请使用更换图片", 409) from error
    except OSError as error:
        current_app.logger.exception("Cannot store material coding image in %s", folder)
        raise ImageUploadError("图片保存失败，请检查项目存储后重试", 500) from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        if converted is not None:
            converted.unlink(missing_ok=True)


def _product_models(folder):
    models = []
    for path in sorted(folder.iterdir(), key=lambda item: item.name.casefold()):
        if not _is_product_image(path):
            continue
        match = MODEL_NAME.fullmatch(path.stem)
        code, name = match.groups() if match else ("", path.stem)
        models.append({"code": code, "name": name.strip(), "filename": path.name})
    return models


def _image_path(folder, filename):
    if not valid_image_filename(filename):
        return None
    try:
        candidate = folder / filename
        if _is_product_image(candidate) and candidate.resolve().parent == folder.resolve():
            return candidate.resolve()
    except (OSError, RuntimeError, ValueError):
        return None
    return None


@lru_cache(maxsize=96)
def _thumbnail(path, _modified_ns, _file_size):
    with Image.open(path) as image:
        image.draft("RGB", THUMBNAIL_SIZE)
        preview = ImageOps.exif_transpose(image)
        preview.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        if preview.mode not in {"RGB", "RGBA"}:
            preview = preview.convert("RGBA" if "transparency" in preview.info else "RGB")
        buffer = BytesIO()
        profile = preview.info.get("icc_profile")
        preview.save(buffer, "WEBP", quality=80, **({"icc_profile": profile} if profile else {}))
        return buffer.getvalue()


def product_models_blueprint():
    bp = Blueprint("material_coding_product_models", __name__)
    bp.register_error_handler(ImageUploadError, image_upload_error)

    @bp.get("/api/admin/material-coding/product-models")
    def product_models():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({"success": False, "message": "当前账号无法查看物料编码规则"}), 403
        collections = []
        for key, title in PRODUCT_COLLECTIONS.items():
            try:
                models = _product_models(PRODUCT_IMAGE_DIR / title)
                available = True
            except OSError:
                models, available = [], False
            collections.append({"key": key, "title": title, "models": models, "available": available})
        return jsonify({"success": True, "data": collections})

    @bp.get("/api/admin/material-coding/product-image")
    def product_image():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({"success": False, "message": "当前账号无法查看物料编码规则"}), 403
        collection = IMAGE_COLLECTIONS.get(request.args.get("collection"))
        path = _image_path(PRODUCT_IMAGE_DIR / collection, request.args.get("file", "")) if collection else None
        if path is None:
            return jsonify({"success": False, "message": "找不到产品图片"}), 404
        try:
            if request.args.get("size") == "thumbnail":
                stat = path.stat()
                preview = _thumbnail(path, stat.st_mtime_ns, stat.st_size)
                response = send_file(
                    BytesIO(preview), mimetype="image/webp", max_age=0,
                    etag=f"{stat.st_mtime_ns}-{stat.st_size}", last_modified=stat.st_mtime,
                )
            else:
                response = send_file(path, max_age=0)
        except FileNotFoundError:
            return jsonify({"success": False, "message": "找不到产品图片"}), 404
        except (OSError, Image.DecompressionBombError):
            return jsonify({"success": False, "message": "图片无法预览"}), 422
        response.cache_control.private = True
        return response

    @bp.post("/api/admin/material-coding/product-image/upload")
    def upload_product_image():
        file = uploaded_image()
        collection = PRODUCT_COLLECTIONS.get(request.form.get("collection"))
        if collection is None:
            raise ImageUploadError("请选择产品图片分类")
        folder = PRODUCT_IMAGE_DIR / collection
        existing = request.form.get("replace")
        if existing is not None and _image_path(folder, existing) is None:
            raise ImageUploadError("找不到要更换的图片", 404)
        filename = existing if existing is not None else file.filename
        store_image(folder, file, filename, replace=existing is not None)
        return jsonify({"success": True})

    return bp
