import { Workbook } from 'exceljs';
import { buildDashboardWorkbook } from './exportExcel';
import type { DashboardOrder } from './service';

it('writes a readable Excel workbook with numeric quantities, dates and anomaly colors', async () => {
  const order = {
    mo_code: 'SCDD-001', sort_seq: 1, customer_name: '=客户名称',
    inv_code: '001-ABC', inv_name: '测试产品', inv_std: '1220*2440',
    plan_qty: 20, unit_name: '张', plan_start_date: '2026-10-20', plan_due_date: '2026-10-21 00:00:00',
    erp_deleted: true, is_overdue: true,
    steps: [{
      seq: 1, process_name: '压贴', station_name: '不显示工站',
      normal_received_qty: 10, normal_done_qty: 10,
      normal_remaining_qty: 0, receive_available_qty: 0,
      rework_remaining_qty: 0, status: 'received_done',
      first_start_time: '2026-10-20 08:00:00',
      last_end_time: '2026-10-21 14:30:00',
    }],
  } as DashboardOrder;
  const workbook = buildDashboardWorkbook([
    order,
    { ...order, mo_code: 'SCDD-002', original_start_date: '2026-10-19 00:00:00',
      original_due_date: '2026-10-20 00:00:00', steps: [...order.steps, { ...order.steps[0], seq: 2 }] },
    { ...order, mo_code: 'SCDD-003', erp_deleted: false, is_overdue: false,
      has_reporting: false, original_start_date: '2026-10-20 00:00:00', steps: [] },
    { ...order, mo_code: 'SCDD-004', is_closed: true, erp_deleted: false,
      is_overdue: true, has_reporting: false, original_due_date: '2026-10-20 00:00:00' },
  ]);
  const restored = new Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.worksheets[0];
  expect(sheet.rowCount).toBe(6);
  expect(sheet.getCell('A1').value).toBe('图例');
  expect(sheet.getCell('B1').value).toBe('已完成');
  expect(sheet.getCell('B1').fill).toMatchObject({ fgColor: { argb: 'FFCFEADE' } });
  expect(sheet.getCell('J1').value).toBe('数量异常');
  expect(sheet.getCell('K1').value).toBe('逾期');
  expect(sheet.getCell('M2').value).toBe('工序2');
  expect(sheet.getCell('C3').value).toBe('=客户名称');
  expect(sheet.getCell('E3').value).toBe('001-ABC');
  expect(sheet.getCell('G3').value).toBe(20);
  expect(sheet.getCell('I3').value).toEqual(new Date('2026-10-20T00:00:00.000Z'));
  expect(sheet.getCell('J3').value).toEqual(new Date('2026-10-21T00:00:00.000Z'));
  expect(sheet.getCell('J3').font).toMatchObject({ bold: true, color: { argb: 'FFC22F3F' } });
  expect(sheet.getCell('K3').value).toBe('系统已删除、逾期');
  expect(sheet.getCell('K3').font).toMatchObject({ bold: true, color: { argb: 'FFC22F3F' } });
  expect(sheet.getCell('L3').value).toContain('完工数量不足');
  expect(sheet.getCell('L3').value).toContain('始 2026-10-20 08:00');
  expect(sheet.getCell('L3').value).toContain('终 2026-10-21 14:30');
  expect(sheet.getCell('L3').value).not.toContain('不显示工站');
  expect(sheet.getCell('L3').fill).toMatchObject({ fgColor: { argb: 'FFF6CBD0' } });
  expect(sheet.getCell('I4').value).toMatchObject({
    richText: [
      { text: '2026-10-20\n', font: { size: 11 } },
      { text: '原 2026-10-19', font: { size: 9, color: { argb: 'FF64748B' } } },
    ],
  });
  expect(sheet.getCell('J4').value).toMatchObject({
    richText: [
      { text: '2026-10-21\n', font: { bold: true, color: { argb: 'FFC22F3F' } } },
      { text: '原 2026-10-20', font: { size: 9, color: { argb: 'FF64748B' } } },
    ],
  });
  expect(sheet.getCell('J4').alignment).toMatchObject({ wrapText: true });
  expect(sheet.getCell('I5').value).toEqual(new Date('2026-10-20T00:00:00.000Z'));
  expect(sheet.getCell('K5').value).toBe('未报工');
  expect(sheet.getCell('K6').value).toBe('已关闭');
  expect(sheet.getCell('J6').font).toMatchObject({ color: { argb: 'FF18283B' } });
  expect(sheet.getCell('J6').value).toMatchObject({
    richText: [
      { text: '2026-10-21\n', font: { color: { argb: 'FF18283B' } } },
      { text: '原 2026-10-20', font: { size: 9, color: { argb: 'FF64748B' } } },
    ],
  });
  expect(sheet.getCell('K6').font).toMatchObject({ color: { argb: 'FF18283B' } });
  expect(sheet.getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFD9EAF7' } });
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 2 });

  const sales = buildDashboardWorkbook([{ ...order, so_code_008: 'XSDD-008', so_row_008: 12 }], true).worksheets[0];
  expect(sales.getRow(2).values).toEqual(expect.arrayContaining(['销售订单号', '销售行号', '工单号']));
  expect(sales.getCell('A3').value).toBe('XSDD-008');
  expect(sales.getCell('B3').value).toBe(12);
  expect(sales.getCell('L3').value).toEqual(new Date('2026-10-21T00:00:00.000Z'));
  expect(sales.getCell('N3').value).toContain('压贴');

});
