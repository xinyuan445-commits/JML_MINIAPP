import json
from datetime import date
from io import BytesIO
from itertools import groupby
from unicodedata import east_asian_width

from flask import Blueprint, g, jsonify, send_file
from openpyxl import Workbook
from openpyxl.drawing.image import Image as ExcelImage
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from PIL import Image, ImageOps

from admin_permissions import can_view_material_coding
from material_coding_category import ACCESSORY_PRODUCTS, DRAWING_DIR, SUPPLIER_ABBREVIATIONS, VENEER_CODE_GROUP, VENEER_DESIGN, normalize_category
from material_coding_cover import normalize_cover
from material_coding_product_models import IMAGE_COLLECTIONS, PRODUCT_COLLECTIONS, PRODUCT_IMAGE_DIR, _image_path, _product_models

SHEETS = (
    ('samples', '打样成品及半成品'), ('finished-accessories', '成品（配套辅料）'),
    ('finished', '成品'), ('veneer-finished', '木皮成品'), ('grooved-finished', '开槽成品'),
    ('semi-finished', '半成品'), ('semi-finished-accessories', '半成品（配套辅料）'),
    ('veneer-semi-finished', '木皮半成品'), ('balancing-veneer', '平衡皮'),
    ('primary-materials', '一阶原材料'), ('secondary-materials', '二阶原材料'),
    ('fixed-assets', '固定资产'), ('product-models', '产品型号明细'),
    (SUPPLIER_ABBREVIATIONS, '供应商简称明细'), (VENEER_DESIGN, '木皮饰板设计部编码规则'),
    (ACCESSORY_PRODUCTS, '辅料产品明细'),
)
HEADER_FILL = PatternFill('solid', fgColor='FFD9EAF7')
HEADER_FONT = Font(name='微软雅黑', bold=True, color='FF17365D')
BODY_FONT = Font(name='微软雅黑', color='FF18283B')
RETIRED_FONT = Font(name='微软雅黑', color='FF64748B', strike=True)
BODY_ALIGNMENT = Alignment(vertical='center', wrap_text=True)


def _setup(sheet, widths):
    sheet.sheet_view.showGridLines = False
    for col, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(col)].width = width


def _raise_height(sheet, row, height):
    sheet.row_dimensions[row].height = min(409, max(height, sheet.row_dimensions[row].height or 0))


def _write(sheet, row, start_col, values, *, header=False, retired=False):
    for col, value in enumerate(values, start_col):
        cell = sheet.cell(row, col, value)
        if isinstance(value, str):
            cell.data_type = 's'
        elif isinstance(value, date):
            cell.number_format = 'yyyy-mm-dd'
        cell.font = HEADER_FONT if header else RETIRED_FONT if retired else BODY_FONT
        cell.alignment = BODY_ALIGNMENT
        if header:
            cell.fill = HEADER_FILL
        width = max(1, int(sheet.column_dimensions[cell.column_letter].width) - 1)
        lines = sum(max(1, (sum(2 if east_asian_width(char) in 'WF' else 1 for char in line) + width - 1) // width)
                    for line in str(value or '').split('\n'))
        _raise_height(sheet, row, 16 * lines + 5)


def _band(sheet, row, start, end, title):
    _write(sheet, row, start, [title] + [''] * (end - start), header=True)
    if end > start:
        sheet.merge_cells(start_row=row, start_column=start, end_row=row, end_column=end)
        for col in range(start, end + 1):
            sheet.cell(row, col).fill = HEADER_FILL
    _raise_height(sheet, row, 24)


def _picture(sheet, row, col, path, cad=False):
    try:
        if path is None:
            raise FileNotFoundError
        size = (840, 560) if cad else (440, 300)
        with Image.open(path) as original:
            original.draft('RGB', size)
            preview = ImageOps.exif_transpose(original)
            preview.thumbnail(size, Image.Resampling.LANCZOS)
            data = BytesIO()
            if cad:
                preview.save(data, 'PNG', optimize=True)
            else:
                preview.convert('RGB').save(data, 'JPEG', quality=85)
        data.seek(0)
        drawing = ExcelImage(data)
        scale = min(1, (250 if cad else 180) / drawing.width, (175 if cad else 126) / drawing.height)
        drawing.width = int(drawing.width * scale)
        drawing.height = int(drawing.height * scale)
    except (OSError, Image.DecompressionBombError):
        _write(sheet, row, col, ['图片暂不可用'])
        return
    sheet.add_image(drawing, sheet.cell(row, col).coordinate)
    _raise_height(sheet, row, drawing.height * 0.75 + 5)


def _cover(sheet, cover):
    _setup(sheet, [27, 100])
    _band(sheet, 1, 1, 2, cover['title'])
    for row, label, value in (
        (3, 'Create By', cover['created_by']), (4, 'Modified By', cover['modified_by']),
        (5, 'Last Modified Date', date.fromisoformat(cover['changes'][0]['date']) if cover['changes'] else '—'),
    ):
        _write(sheet, row, 1, [label, value])
    _write(sheet, 7, 1, ['日期', '变更说明'], header=True)
    sheet.freeze_panes = 'A8'
    for row, change in enumerate(cover['changes'], 8):
        _write(sheet, row, 1, [date.fromisoformat(change['date']), change['description']])


def _rules(sheet, sections):
    max_groups = max(1, max((len(section['groups']) for section in sections), default=0))
    _setup(sheet, [22, 36] * max_groups)
    _band(sheet, 1, 1, max_groups * 2, sheet.title)
    row = 3
    for section in sections:
        groups = section['groups']
        _band(sheet, row, 1, max(2, len(groups) * 2), section['title'])
        row += 1
        if section['examples']:
            _write(sheet, row, 1, ['编码示例', '说明'], header=True)
            row += 1
            for example in section['examples']:
                _write(sheet, row, 1, [example['code'], example['description']])
                row += 1
        if any(group.get('heading') for group in groups):
            start = 1
            for heading, group_run in groupby(groups, key=lambda group: group.get('heading')):
                end = start + 2 * sum(1 for _ in group_run)
                if heading:
                    _band(sheet, row, start, end - 1, heading)
                start = end
            row += 1
        next_section = row + 1
        for index, group in enumerate(groups):
            col = index * 2 + 1
            _band(sheet, row, col, col + 1, group['title'])
            _write(sheet, row + 1, col, ['编码', '说明'], header=True)
            next_row = row + 2
            for code, description, retired, *_ in group['rows']:
                _write(sheet, next_row, col, [code, description], retired=retired)
                next_row += 1
            if group.get('note'):
                _write(sheet, next_row, col + 1, [group['note']])
                next_row += 1
            next_section = max(next_section, next_row)
        row = next_section + 2


def _veneer(sheet, sections):
    groups = [group for section in sections for group in section['groups']]
    changes = next((group for group in groups if group['title'] == VENEER_CODE_GROUP), None)
    if changes is not None:
        groups = [group for group in groups if group is not changes]
    new_codes = {code: new for code, new, retired in changes['rows'] if not retired} if changes else {}
    model_codes = {item[0] for group in groups if group.get('image_collection') for item in group['rows']}
    pictures = max(1, max((len(row[3]) for group in groups for row in group['rows'] if len(row) > 3), default=0))
    text_widths = [17, 21, 28] if changes else [17, 28]
    last_column = len(text_widths) + pictures
    _setup(sheet, text_widths + [28] * pictures)
    _band(sheet, 1, 1, last_column, sheet.title)
    row = 3
    for group in groups:
        title = ' / '.join(value for value in [group.get('heading'), group['title']] if value)
        _band(sheet, row, 1, last_column, title)
        fields = ['前款号', '新编码', '说明'] if changes else ['编码', '说明']
        _write(sheet, row + 1, 1, fields + [f'图片 {number}' for number in range(1, pictures + 1)], header=True)
        row += 2
        collection = IMAGE_COLLECTIONS.get(group.get('image_collection'))
        for code, description, retired, *files in group['rows']:
            values = [code, new_codes.get(code, ''), description] if changes else [code, description]
            _write(sheet, row, 1, values, retired=retired)
            for col, filename in enumerate(files[0] if files else [], len(text_widths) + 1):
                path = _image_path(PRODUCT_IMAGE_DIR / collection, filename) if collection else None
                _picture(sheet, row, col, path)
            row += 1
        row += 1
    if changes:
        _band(sheet, row, 1, 3, changes['title'])
        _write(sheet, row + 1, 1, ['前款号', '新编码', '档案关联'], header=True)
        for index, (old, new, retired) in enumerate(changes['rows'], row + 2):
            _write(sheet, index, 1, [old, new, '已关联' if old in model_codes else '未关联'], retired=retired)


def _product_sheet(sheet):
    _setup(sheet, [18, 35, 28])
    _band(sheet, 1, 1, 3, sheet.title)
    row = 3
    for folder in PRODUCT_COLLECTIONS.values():
        _band(sheet, row, 1, 3, folder)
        _write(sheet, row + 1, 1, ['型号', '名称', '图片'], header=True)
        row += 2
        path = PRODUCT_IMAGE_DIR / folder
        if not path.is_dir():
            _write(sheet, row, 1, ['图片目录暂不可用'])
            row += 1
        else:
            for model in _product_models(path):
                _write(sheet, row, 1, [model['code'], model['name']])
                _picture(sheet, row, 3, _image_path(path, model['filename']))
                row += 1
        row += 1


def _details(sheet, rows, columns, drawing=False):
    _setup(sheet, [width for _, _, width in columns])
    _band(sheet, 1, 1, len(columns), sheet.title)
    _write(sheet, 3, 1, [label for _, label, _ in columns], header=True)
    sheet.freeze_panes = 'A4'
    for row, item in enumerate(rows, 4):
        _write(sheet, row, 1, ['' if drawing and key == 'drawing' else item[key] for key, _, _ in columns])
        if drawing:
            _picture(sheet, row, 3, _image_path(DRAWING_DIR, f"{item['drawing']}.png"), cad=True)


def build_material_coding_workbook(cover, categories):
    book = Workbook()
    book.active.title = 'Cover Page'
    _cover(book.active, cover)
    for key, title in SHEETS:
        sheet = book.create_sheet(title)
        content = categories.get(key)
        if key == 'product-models':
            _product_sheet(sheet)
        elif content is None:
            _write(sheet, 1, 1, ['暂无内容'])
        elif key == ACCESSORY_PRODUCTS:
            _details(sheet, content['products'], [('code', '序号', 13), ('name', '名称', 35), ('drawing', 'CAD', 39),
                                                  ('process', '工艺', 20), ('customer_material', '客供材料', 31)], drawing=True)
        elif key == SUPPLIER_ABBREVIATIONS:
            _details(sheet, content['suppliers'], [('name', '供应商', 43), ('kind', '供应商属性', 20),
                                                  ('products', '所售产品', 29), ('code', '供应商简称', 17), ('remark', '备注', 30)])
        elif key == VENEER_DESIGN:
            _veneer(sheet, content['sections'])
        else:
            _rules(sheet, content['sections'])
    return book


def material_coding_attachment(db):
    with db() as conn, conn.cursor(dictionary=True) as cur:
        cur.execute('SELECT title,created_by,modified_by,change_history FROM mo_material_coding_cover_yx WHERE id=1')
        cover = cur.fetchone()
        if cover is None:
            raise ValueError('封面资料尚未初始化')
        cur.execute('SELECT page_key,content FROM mo_material_coding_category_yx')
        rows = cur.fetchall()
    raw = cover.pop('change_history')
    cover['changes'] = json.loads(raw) if isinstance(raw, str) else raw
    sheet_keys = {key for key, _ in SHEETS}
    categories = {
        row['page_key']: normalize_category(json.loads(row['content']) if isinstance(row['content'], str) else row['content'],
                                            row['page_key'])
        for row in rows if row['page_key'] in sheet_keys
    }
    output = BytesIO()
    build_material_coding_workbook(normalize_cover(cover), categories).save(output)
    return '物料编码规则.xlsx', output.getvalue()


def material_coding_export_blueprint(db):
    bp = Blueprint('material_coding_export', __name__)

    @bp.get('/api/admin/material-coding/export')
    def export_archive():
        if not can_view_material_coding(g.admin_permissions, g.disabled_pages):
            return jsonify({'success': False, 'message': '当前账号无法查看物料编码规则'}), 403
        try:
            filename, content = material_coding_attachment(db)
        except ValueError as error:
            return jsonify({'success': False, 'message': str(error)}), 503
        response = send_file(BytesIO(content), as_attachment=True, download_name=filename,
                             mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', max_age=0)
        response.cache_control.private = True
        return response

    return bp
