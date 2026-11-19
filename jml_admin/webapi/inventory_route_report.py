from contextlib import closing
from io import BytesIO
from itertools import groupby

from flask import Blueprint, current_app, jsonify, request, send_file
from openpyxl import Workbook
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment

from material_coding_export import _setup, _write


def _inventory_filter(keyword, product_type=''):
    from_u8 = """FROM dbo.Inventory AS item
        WHERE NULLIF(LTRIM(RTRIM(item.cInvDefine7)), N'') IS NOT NULL"""
    params = ()
    if keyword:
        from_u8 += """ AND (CHARINDEX(?, item.cInvCode) > 0 OR CHARINDEX(?, item.cInvName) > 0
            OR CHARINDEX(?, item.cInvDefine7) > 0)"""
        params = (keyword,) * 3
    if product_type:
        from_u8 += ' AND LTRIM(RTRIM(item.cInvDefine7)) = ?'
        params += (product_type,)
    return from_u8, params


def _inventory_page(u8_db, keyword, product_type, page, page_size, with_routes=False):
    from_u8, params = _inventory_filter(keyword, product_type)
    type_column = 'LTRIM(RTRIM(item.cInvDefine7))'
    group_count = f', COUNT_BIG(*) OVER (PARTITION BY {type_column})' if with_routes else ''
    order_by = 'product_type, item.cInvCode' if with_routes else 'item.cInvCode'
    inventory_sql = f"""SELECT item.cInvCode, LEFT(item.cInvCode, 2), item.cInvName,
        item.cInvStd, {type_column} AS product_type{group_count}
        {from_u8} ORDER BY {order_by}"""
    with closing(u8_db()) as conn, closing(conn.cursor()) as cur:
        if page_size is None:
            cur.execute(inventory_sql, params)
            rows = cur.fetchall()
            return rows, len(rows), 1
        cur.execute('SELECT COUNT_BIG(*) ' + from_u8, params)
        total = cur.fetchone()[0]
        if not total:
            return [], 0, 1
        page = min(page, (total - 1) // page_size + 1)
        cur.execute(inventory_sql + ' OFFSET ? ROWS FETCH NEXT ? ROWS ONLY',
                    (*params, (page - 1) * page_size, page_size))
        return cur.fetchall(), total, page


def _inventory_groups(u8_db, keyword):
    from_u8, params = _inventory_filter(keyword)
    with closing(u8_db()) as conn, closing(conn.cursor()) as cur:
        cur.execute("""SELECT LTRIM(RTRIM(item.cInvDefine7)) AS product_type, COUNT_BIG(*) """
                    + from_u8 + """
            GROUP BY LTRIM(RTRIM(item.cInvDefine7)) ORDER BY product_type""", params)
        return cur.fetchall()


def _default_routes(db, categories):
    with db() as conn, conn.cursor(dictionary=True) as cur:
        marks = ','.join(['%s'] * len(categories))
        cur.execute(f"""SELECT TRIM(category.name) AS product_type, route.route_name, process.process_name
            FROM mo_product_route_yx AS mapping
            JOIN bj_product_cost_yx AS category ON category.code=mapping.product_code
            JOIN mo_route_yx AS route ON route.id=mapping.route_id
            LEFT JOIN mo_route_step_yx AS step ON step.route_id=route.id
            LEFT JOIN mo_process_yx AS process ON process.id=step.process_id
            WHERE category.is_enabled=1 AND route.is_active=1 AND route.is_current=1
                AND TRIM(category.name) IN ({marks})
            ORDER BY category.code, step.seq, step.id""", tuple(categories))
        routes = {}
        for row in cur.fetchall():
            route = routes.setdefault(row['product_type'], {'name': row['route_name'], 'steps': []})
            if row['process_name']:
                route['steps'].append(row['process_name'])
        return routes


def _all_routes(db, categories):
    with db() as conn, conn.cursor(dictionary=True) as cur:
        marks = ','.join(['%s'] * len(categories))
        cur.execute(f"""WITH category_routes AS (
                SELECT product_code, route_id FROM mo_route_version_category_yx
                UNION
                SELECT product_code, route_id FROM mo_product_route_yx
            )
            SELECT TRIM(category.name) AS product_type, route.id, route.route_name,
                route.is_active, process.process_name
            FROM category_routes AS links
            JOIN bj_product_cost_yx AS category ON category.code=links.product_code
            JOIN mo_route_yx AS route ON route.id=links.route_id
            LEFT JOIN mo_route_step_yx AS step ON step.route_id=route.id
            LEFT JOIN mo_process_yx AS process ON process.id=step.process_id
            WHERE TRIM(category.name) IN ({marks})
            ORDER BY route.is_active DESC, route.version_group, route.version_no DESC,
                route.id, step.seq, step.id""", tuple(categories))
        routes = {}
        for row in cur.fetchall():
            versions = routes.setdefault(row['product_type'], {})
            route = versions.setdefault(row['id'], {
                'id': row['id'], 'name': row['route_name'], 'active': bool(row['is_active']), 'steps': [],
            })
            if row['process_name']:
                route['steps'].append(row['process_name'])
        return {category: list(versions.values()) for category, versions in routes.items()}


def _route_cell_text(routes):
    if not routes:
        return '未配置'
    text = CellRichText()
    for route in routes:
        if text:
            text.append('\n')
        disabled = not route['active']
        text.append(TextBlock(InlineFont(rFont='微软雅黑', b=True, strike=disabled), route['name']))
        if route['steps']:
            steps = ' → '.join(route['steps'])
            text.append(TextBlock(InlineFont(rFont='微软雅黑', strike=disabled), f'  {steps}'))
        if disabled:
            text.append('（停用）')
    return text


def _report_excel(rows, summaries=None):
    workbook = Workbook()
    sheet = workbook.active
    sheet.freeze_panes = 'A2'
    if summaries is None:
        edition = '第一版'
        _setup(sheet, [44, 13, 52, 63])
        _write(sheet, 1, 1, ['产品类型', '料号数', '路线名称', '路线内容'], header=True)
        count_alignment = Alignment(horizontal='right', vertical='center', indent=1)
        for index, row in enumerate(rows, 2):
            _write(sheet, index, 1, [
                row['product_type'], row['total'], row['route_name'], ' → '.join(row['route_steps']) or '—',
            ])
            count_cell = sheet.cell(index, 2)
            count_cell.number_format = '#,##0'
            count_cell.alignment = count_alignment
    else:
        edition = '第二版'
        widths = [37, 14, 36, 25, 43, 13, 101]
        _setup(sheet, widths)
        _write(sheet, 1, 1, ['料号', '料号前两位', '物料名称', '规格型号', '产品类型', '料号数', '工艺路线（含停用）'], header=True)
        top_aligned = Alignment(vertical='top', wrap_text=True)
        count_alignment = Alignment(horizontal='right', vertical='top', indent=1)
        index = 2
        for group_type, materials in groupby(rows, key=lambda row: row['product_type']):
            start = index
            for row in materials:
                _write(sheet, index, 1, [row['code'], row['prefix'], row['name'], row['spec'] or '—', row['product_type']])
                index += 1
            summary = summaries[group_type]
            original_height = sheet.row_dimensions[start].height
            _write(sheet, start, 6, [summary['total'], _route_cell_text(summary['routes'])])
            remaining_height = sum(sheet.row_dimensions[row].height for row in range(start + 1, index))
            sheet.row_dimensions[start].height = max(original_height, sheet.row_dimensions[start].height - remaining_height)
            sheet.cell(start, 6).number_format = '#,##0'
            sheet.cell(start, 6).alignment = count_alignment
            sheet.cell(start, 7).alignment = top_aligned
            if index > start + 1:
                for column in (6, 7):
                    sheet.merge_cells(start_row=start, end_row=index - 1, start_column=column, end_column=column)

    sheet.title = edition
    sheet.sheet_view.showGridLines = True
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return send_file(output, as_attachment=True, download_name=f'料号工艺路线_{edition}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


def inventory_route_report_blueprint(db, u8_db):
    bp = Blueprint('inventory_route_report', __name__)

    @bp.get('/api/mo/inventory-route-report')
    def inventory_route_report():
        keyword = request.args.get('keyword', '').strip()[:120]
        product_type = request.args.get('product_type', '').strip()
        page = max(1, request.args.get('page', 1, type=int))
        page_size = min(100, max(1, request.args.get('page_size', 50, type=int)))
        try:
            view = request.args.get('view')
            export_excel = request.args.get('format') == 'xlsx'
            if view == 'groups':
                groups = _inventory_groups(u8_db, keyword)
                routes = _default_routes(db, [row[0] for row in groups]) if groups else {}
                only_unconfigured = request.args.get('only_unconfigured') == '1'
                rows = []
                for group_type, count in groups:
                    route = routes.get(group_type)
                    if only_unconfigured and route:
                        continue
                    rows.append({
                        'product_type': group_type, 'total': count,
                        'route_name': route['name'] if route else '未配置',
                        'route_steps': route['steps'] if route else [],
                    })
                if export_excel:
                    return _report_excel(rows)
                return jsonify({'success': True, 'data': {'rows': rows}})

            with_routes = view == 'materials-with-routes'
            if export_excel:
                if not with_routes:
                    return jsonify({'success': False, 'msg': '请选择要导出的报表版本'}), 400
                page_size = None
            inventory, total, page = _inventory_page(u8_db, keyword, product_type, page, page_size, with_routes)
            categories = sorted({row[4] for row in inventory})
            load_routes = _all_routes if with_routes else _default_routes
            routes = load_routes(db, categories) if categories else {}
            rows = []
            summaries = {}
            for code, prefix, name, spec, group_type, *counts in inventory:
                row = {
                    'code': code, 'prefix': prefix, 'name': name or '', 'spec': spec or '',
                    'product_type': group_type,
                }
                if with_routes:
                    summaries.setdefault(group_type, {'total': counts[0], 'routes': routes.get(group_type, [])})
                else:
                    route = routes.get(group_type)
                    row['route_name'] = route['name'] if route else '未配置'
                    row['route_steps'] = route['steps'] if route else []
                rows.append(row)
            if export_excel:
                return _report_excel(rows, summaries)
            data = {'rows': rows, 'total': total, 'page': page}
            if with_routes:
                data['summaries'] = summaries
            return jsonify({'success': True, 'data': data})
        except Exception:
            current_app.logger.exception('Failed to read inventory route report')
            return jsonify({'success': False, 'msg': '料号工艺路线读取失败，请重试'}), 503

    return bp
