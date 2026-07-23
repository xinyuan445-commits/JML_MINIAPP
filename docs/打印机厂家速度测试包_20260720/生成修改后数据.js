const fs = require('fs');
const path = require('path');

global.wx = {};
global.Page = config => {
  global.labelPrintPage = config;
};

const workspace = path.resolve(__dirname, '..', '..', '..');
require(path.join(workspace, 'JML_WX_miniapp', 'Mo', 'ProcessMgmt', 'LabelPrint.js'));

const label = {
  id: 321,
  mo_code: 'SCDD26062742',
  sort_seq: 1,
  step_index: 1,
  step_total: 3,
  process_name: '水性',
  next_process_name: '修色',
  qty_done: 100,
  qty_a: 96,
  qty_a1: 2,
  qty_a2: 1,
  qty_c: 1,
  station_name: '水性',
  end_time: '2026-07-20 14:30:00'
};
const header = {
  InvCode_b: '31-MDF-P2-1116*1220*08-WW',
  cInvName: 'P2 760高密度纤维板1116*1220*08（成型）'
};
const routeSteps = [
  { process_name: '水性', state: 'current' },
  { process_name: '修色', state: 'next' },
  { process_name: '木皮打印（含覆膜）', state: '' }
];

const data = Buffer.from(global.labelPrintPage.buildPrintData(label, header, routeSteps));
const basename = '02_修改后_原生CPCL_GBK_100字节分包';
fs.writeFileSync(path.join(__dirname, `${basename}.bin`), data);
fs.writeFileSync(path.join(__dirname, `${basename}.hex.txt`), data.toString('hex').match(/.{1,200}/g).join('\n'));
fs.writeFileSync(path.join(__dirname, `${basename}.base64.txt`), data.toString('base64'));

console.log(JSON.stringify({
  file: `${basename}.bin`,
  byteLength: data.length,
  packetsAt100Bytes: Math.ceil(data.length / 100)
}));

