export const periods = {
  minute: '每分钟',
  hour: '每小时',
  day: '每天',
  shift: '每班',
};
export const bases = {
  experience: '经验估算',
  measured: '现场实测',
  manufacturer: '厂家参数',
};
export const profileFields = [
  'device_type',
  'workshop',
  'location',
  'brand',
  'model',
  'serial_no',
  'commissioned_on',
  'photo',
  'remark',
] as const;

// The backend keeps Decimal precision; this function only formats the returned string.
export function displayDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  if (numeric > 0 && numeric < 0.0001) return '<0.0001';
  return numeric.toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
    useGrouping: false,
  });
}

export function capacityLabel(row: Record<string, any>) {
  if (row.capacity_mode === 'unlimited') return '无限产能';
  if (
    !row.quantity ||
    !row.unit ||
    !(row.period in periods) ||
    (['day', 'shift'].includes(row.period) && !Number(row.effective_hours))
  )
    return '待补';
  return `${displayDecimal(row.quantity)}${row.unit}/${{ minute: '分钟', hour: '小时', day: '天', shift: '班' }[row.period as keyof typeof periods]}`;
}
