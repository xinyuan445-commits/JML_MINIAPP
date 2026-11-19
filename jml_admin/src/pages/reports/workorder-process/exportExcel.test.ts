import { Workbook } from 'exceljs';
import { buildWorkorderProcessWorkbook } from './exportExcel';
import type { WorkorderProcessRow } from './service';

it('exports all 24 workorder process columns', async () => {
  const row: WorkorderProcessRow = {
    mo_code: 'SCDD26103080',
    sort_seq: 2,
    customer_name: '测试客户',
    inv_code: 'TEST-001',
    inv_name: '测试产品',
    inv_std: '1000*500',
    route_name: '测试路线',
    process_seq: 1,
    process_name: '倒角',
    station_name: '倒角',
    process_status: '已完成',
    worker_names: '张三',
    start_time: '2026-10-20 08:00:00',
    end_time: '2026-10-20 09:30:00',
    duration_text: '1小时30分钟',
    plan_qty: 9,
    qty_done: 0.5,
    qty_a: 0.5,
    qty_a1: 0,
    qty_a2: 0,
    qty_c: 0,
    label_printed: true,
    print_count: 1,
    remaining_processes: '无',
  };
  const workbook = buildWorkorderProcessWorkbook([row]);
  const restored = new Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.worksheets[0];

  expect(sheet.columnCount).toBe(24);
  expect(sheet.getCell('A1').value).toBe('生产订单号');
  expect(sheet.getCell('X1').value).toBe('剩余未完成工序');
  expect(sheet.getCell('A2').value).toBe('SCDD26103080');
  expect(sheet.getCell('P2').value).toBe(9);
  expect(sheet.getCell('V2').value).toBe('是');
  expect(sheet.getCell('A1').fill).toMatchObject({
    fgColor: { argb: 'FFD9EAF7' },
  });
  expect(sheet.getCell('A1').font).toMatchObject({
    bold: true,
    color: { argb: 'FF17365D' },
  });
});
