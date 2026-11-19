import type { TaskSheet } from './service';

export const businessTime = (value?: string) =>
  value ? Date.parse(`${value.replace(' ', 'T')}+08:00`) : Number.NaN;

export function sheetLocks(sheet: TaskSheet, now = Date.now()) {
  return {
    plan: !!sheet.arrangement_locked || now >= businessTime(sheet.plan_cutoff),
    result: !!sheet.result_locked || now >= businessTime(sheet.result_cutoff),
  };
}

export const sheetLabel = (sheet: TaskSheet) =>
  sheet.sheet_kind === 'supplement' ? `补充安排 #${sheet.id}` : '任务安排单';
