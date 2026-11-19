export async function exportArchive() {
  const response = await fetch('/api/mo/process-archive/export');
  if (!response.ok) throw new Error('工艺档案导出失败');
  const disposition = response.headers.get('Content-Disposition');
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = encodedName ? decodeURIComponent(encodedName) : '工艺档案.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
