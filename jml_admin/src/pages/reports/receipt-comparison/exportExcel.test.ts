import { Workbook } from 'exceljs';
import { buildReceiptComparisonWorkbook } from './exportExcel';
import type { ReceiptComparisonRow } from './service';

it('exports the filtered reconciliation rows with the standard header style', async () => {
  const row: ReceiptComparisonRow = {
    mo_code: 'SCDD26103080',
    sort_seq: 2,
    workorder_status: 'done',
    workorder_close_reason: '完工关闭',
    inv_code: 'TEST-001',
    inv_name: '测试产品',
    inv_std: '1000*500',
    plan_qty: 9,
    last_process_name: '倒角',
    final_process_end_time: '2026-10-25 16:30:00',
    has_final_execution: true,
    final_process_qty: 0.5,
    erp_in_qty: 0,
    difference: 0.5,
    is_consistent: false,
    compare_result: '不一致',
  };
  const workbook = buildReceiptComparisonWorkbook([row]);
  const restored = new Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.worksheets[0];

  expect(sheet.rowCount).toBe(2);
  expect(sheet.getCell('A2').value).toBe('SCDD26103080');
  expect(sheet.getCell('C2').value).toBe('TEST-001');
  expect(sheet.getCell('D2').value).toBe('测试产品');
  expect(sheet.getCell('E2').value).toBe('1000*500');
  expect(sheet.getCell('F2').value).toBe(9);
  expect(sheet.getCell('H1').value).toBe('工单关闭原因');
  expect(sheet.getCell('H2').value).toBe('完工关闭');
  expect(sheet.getCell('J2').value).toBe('2026-10-25 16:30:00');
  expect(sheet.getCell('K2').value).toBe(0.5);
  expect(sheet.getCell('K2').numFmt).toBe('#,##0.####');
  expect(sheet.getCell('L2').value).toBe(0);
  expect(sheet.getCell('N2').value).toBe('不一致');
  expect(sheet.getCell('A1').fill).toMatchObject({
    fgColor: { argb: 'FFD9EAF7' },
  });
  expect(sheet.getCell('A1').font).toMatchObject({
    bold: true,
    color: { argb: 'FF17365D' },
  });
});
