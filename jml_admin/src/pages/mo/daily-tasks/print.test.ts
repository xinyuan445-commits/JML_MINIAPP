import { printTasks } from './print';
import type { PrintTaskTable } from './service';

it('prints the daily sheet with one header and nonorder rows directly below workorders', async () => {
  const popupDocument = document.implementation.createHTMLDocument();
  const print = jest.fn();
  const open = jest.spyOn(window, 'open').mockReturnValue({
    document: popupDocument,
    print,
  } as unknown as Window);
  const data: PrintTaskTable = {
    title: '当日任务安排 · 2026-11-16',
    headers: [
      '生产线名称',
      '开线状态',
      '计划数量',
      '备注',
      '工单号',
      '派单类型',
    ],
    rows: [
      {
        values: [
          '修色\n员工A',
          '未开工',
          0.5,
          '<script>核对</script>\n安排备注',
          'MO1 · 第1行\n料号：INV-001\n描述：产品描述<特殊字符>',
          '任务派单\n主单',
        ],
        station_span: 2,
        unit: '张',
        status_color: '666666',
      },
      {
        values: [
          '修色\n员工A',
          '已完成',
          2,
          '',
          'MO1 · 第2行',
          '任务派单\n主单',
        ],
        station_span: 0,
        unit: '张',
        status_color: '237804',
      },
      {
        values: [
          '无工站\n张线长',
          '已发布',
          null,
          '执行人：李甲\n个人职责：核对存量',
          '盘点 A 区',
          '无工单排单\n补充安排 #9',
        ],
        station_span: 1,
        unit: '',
        status_color: '237804',
      },
    ],
  };
  try {
    expect(
      await printTasks(async () => {
        expect(open).toHaveBeenCalledTimes(1);
        return data;
      }),
    ).toBe(true);
    expect(
      [...popupDocument.querySelectorAll('th')].map((c) => c.textContent),
    ).toEqual(data.headers);
    expect(popupDocument.querySelectorAll('thead tr')).toHaveLength(1);
    expect(popupDocument.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(popupDocument.querySelector('.station')?.textContent).toBe(
      '修色\n员工A',
    );
    expect(
      popupDocument.querySelector('.station')?.getAttribute('rowspan'),
    ).toBe('2');
    expect(
      [...popupDocument.querySelectorAll('.status')].map((c) => c.textContent),
    ).toEqual(['未开工', '已完成', '已发布']);
    expect(popupDocument.querySelector('.quantity')?.textContent).toBe(
      '0.5 张',
    );
    expect(
      popupDocument.querySelector('tbody tr td:nth-child(4)')?.textContent,
    ).toBe('<script>核对</script>\n安排备注');
    expect(popupDocument.querySelector('script')).toBeNull();
    expect(popupDocument.body.textContent).toContain('MO1 · 第2行');
    expect(popupDocument.body.textContent).toContain('料号：INV-001');
    expect(popupDocument.body.textContent).toContain(
      '描述：产品描述<特殊字符>',
    );
    expect(
      [...popupDocument.querySelectorAll('tbody tr:last-child td')].map(
        (cell) => cell.textContent,
      ),
    ).toEqual([
      '无工站\n张线长',
      '已发布',
      '',
      '执行人：李甲\n个人职责：核对存量',
      '盘点 A 区',
      '无工单排单\n补充安排 #9',
    ]);
    popupDocument.getElementById('print')?.click();
    expect(print).toHaveBeenCalledTimes(1);
  } finally {
    open.mockRestore();
  }
});
