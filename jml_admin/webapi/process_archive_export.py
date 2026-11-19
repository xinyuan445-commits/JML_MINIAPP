from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from material_coding_export import _setup, _write

MODULE_NAMES = {'route': '工艺路线', 'workstation': '工站', 'process': '工序'}
APPROVAL_ACTIONS = {'create': '新增', 'edit': '修改', 'version': '新版本', 'restore': '设为默认'}
GROUP_FILL = PatternFill('solid', fgColor='FFF0F5FA')


def _title(sheet, text, width):
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=width)
    cell = sheet.cell(1, 1, text)
    cell.data_type = 's'
    cell.font = Font(name='微软雅黑', size=20, bold=True, color='FF17365D')
    cell.alignment = Alignment(vertical='center')
    sheet.row_dimensions[1].height = 34


def _approval_rows(approvals):
    for row in approvals:
        action = row['action_type']
        if action == 'status':
            action = '启用' if row['target_active'] in ('1', 'true') else '停用'
        else:
            action = APPROVAL_ACTIONS.get(action, action)
        yield [row['review_time'], f"{MODULE_NAMES[row['module_type']]} · {row['target_name']}",
               action, row['applicant_name'], row['reviewer_name'] or '']


def process_archive_attachment(snapshot):
    workbook = Workbook()
    cover = workbook.active
    cover.title = '封面'
    _setup(cover, [23, 51, 14, 17, 17])
    _title(cover, '工艺路线', 5)
    last_modified = snapshot['last_modified_date']
    for row, (label, value) in enumerate([
        ('Create By', 'Lancer Zhang'), ('Modified By', 'Yuanxin'), ('Last Modified Date', last_modified),
    ], 3):
        _write(cover, row, 1, [f'{label}：', value])
    cover.merge_cells('A7:E7')
    includes = '，'.join(name for key, name in MODULE_NAMES.items() if key in snapshot)
    _write(cover, 7, 1, [f'1. {includes}记录'])
    if snapshot['approvals'] is not None:
        _write(cover, 9, 1, ['已生效审批记录'])
        _write(cover, 10, 1, ['生效日期', '变更对象', '动作', '修改人', '审批人'], header=True)
        for row, values in enumerate(_approval_rows(snapshot['approvals']), 11):
            _write(cover, row, 1, values)

    for key, title, headers, widths in (
        ('route', '工艺路线', ['编码', '产品类别 / 路线版本', '路线'], [10, 52, 74]),
        ('workstation', '工站清单', ['序号', '工站名称'], [10, 38]),
        ('process', '工序清单', ['序号', '工序名称', '状态', '说明'], [10, 32, 12, 65]),
    ):
        if key not in snapshot:
            continue
        sheet = workbook.create_sheet(title)
        _setup(sheet, widths)
        _title(sheet, title, len(headers))
        _write(sheet, 5, 1, headers, header=True)
        sheet.freeze_panes = 'A6'
        row = 6
        for item in snapshot[key]:
            if key == 'route':
                _write(sheet, row, 1, [item['code'] or '', item['name'], '' if item['versions'] else '未配置'],
                       retired=not item['active'])
                for cell in sheet[row][:3]:
                    cell.fill = GROUP_FILL
                    cell.font = Font(name='微软雅黑', bold=True, strike=not item['active'],
                                     color='FF18283B' if item['active'] else 'FF64748B')
                row += 1
                for version in item['versions']:
                    default = '（默认）' if version['is_default'] else ''
                    name = f"V{version['version_no']} · {version['name']}{default}"
                    _write(sheet, row, 1, ['', name, ' → '.join(version['steps']) or '未配置'],
                           retired=not item['active'] or not version['active'])
                    sheet.cell(row, 2).alignment = Alignment(vertical='center', wrap_text=True, indent=1)
                    row += 1
            else:
                values = [item['sequence'], item['name']]
                if key == 'process':
                    values.extend(['启用' if item['active'] else '停用', item['description'] or ''])
                _write(sheet, row, 1, values, retired=not item['active'])
                row += 1
    output = BytesIO()
    workbook.save(output)
    return f'工艺档案_{last_modified}.xlsx', output.getvalue()
