import type { PrintTaskTable } from './service';

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] || char,
  );

export async function printTasks(load: () => Promise<PrintTaskTable>) {
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.opener = null;
  popup.document.body.textContent = '正在读取任务安排…';
  try {
    const data = await load();
    if (popup.closed) return true;
    if (!data.rows.length) throw new Error('该执行日期没有可打印的安排');
    const rows = data.rows.map(
      ({ values, station_span, unit, status_color }) => {
        const [line, status, quantity, remark, work, source] = values;
        const amount =
          quantity === null
            ? ''
            : [
                quantity.toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                }),
                unit,
              ]
                .filter(Boolean)
                .join(' ');
        const station = station_span
          ? `<td rowspan="${escapeHtml(station_span)}" class="station">${escapeHtml(line)}</td>`
          : '';
        return `<tr>${station}<td class="status" style="color:#${escapeHtml(status_color)}">${escapeHtml(status)}</td><td class="quantity">${escapeHtml(amount)}</td><td>${escapeHtml(remark)}</td><td>${escapeHtml(work)}</td><td>${escapeHtml(source)}</td></tr>`;
      },
    );
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>工站每日任务</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,"Microsoft YaHei",sans-serif;color:#172b4d}h2{font-size:19px;color:#17365d}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px;line-height:1.6}th,td{border:1px solid #bac7d5;padding:10px 8px;overflow-wrap:anywhere;vertical-align:middle}td{white-space:pre-wrap}th{background:#d9eaf7;color:#17365d;font-weight:bold}thead{display:table-header-group}tr{break-inside:avoid}.station,.status,.quantity{text-align:center}.status{font-weight:bold}button{padding:8px 20px}@media print{button{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head>
      <body><button id="print">打印</button><h2>${escapeHtml(data.title)}</h2>
      <table><colgroup>${[15, 10, 11, 26, 26, 12].map((width) => `<col style="width:${width}%">`).join('')}</colgroup><thead><tr>${data.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
      </body></html>`);
    popup.document.close();
    const button = popup.document.getElementById('print');
    if (button) button.onclick = () => popup.print();
    return true;
  } catch (error) {
    popup.close();
    throw error;
  }
}
