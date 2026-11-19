import { request } from '@umijs/max';

export type SectionKey = 'route' | 'workstation' | 'process';

type ArchiveItem = { id: number; name: string; active: boolean | number };
type NumberedArchiveItem = ArchiveItem & { sequence: number };
type Approval = {
  request_no: string;
  module_type: SectionKey;
  action_type: string;
  target_name: string;
  target_active: string | null;
  applicant_name: string;
  reviewer_name: string | null;
  review_time: string;
};

export type ArchiveSnapshot = {
  last_modified_date: string;
  approvals: Approval[] | null;
  route?: {
    code: string | null;
    name: string;
    active: boolean | number;
    versions: (ArchiveItem & { version_no: number; is_default: boolean | number; steps: string[] })[];
  }[];
  workstation?: NumberedArchiveItem[];
  process?: (NumberedArchiveItem & { description: string | null })[];
};

export type ArchiveTable = {
  title: string;
  columns: { label: string; width: number }[];
  rows: { key: string | number; values: (string | number)[]; inactive?: boolean; kind?: 'group' | 'version' }[];
};

export const archiveTitle = '工艺路线';
export const coverCredits = (date: string) => [
  ['Create By', 'Lancer Zhang'],
  ['Modified By', 'Yuanxin'],
  ['Last Modified Date', date],
];

export const archiveContents = (tables: ReturnType<typeof archiveTables>) =>
  `1. ${[tables.route && '工艺路线', tables.workstation && '工站', tables.process && '工序'].filter(Boolean).join('，')}记录`;

export function getArchiveSnapshot() {
  return request<{ code: number; data: ArchiveSnapshot }>('/api/mo/process-archive');
}

export function archiveTables(data: ArchiveSnapshot): Partial<Record<SectionKey, ArchiveTable>> {
  return {
    route: data.route && {
      title: '工艺路线',
      columns: [{ label: '编码', width: 10 }, { label: '产品类别 / 路线版本', width: 52 }, { label: '路线', width: 74 }],
      rows: data.route.flatMap<ArchiveTable['rows'][number]>((category) => {
        const group = category.code ?? 'unlinked';
        return [
          { key: group, kind: 'group', inactive: !category.active,
            values: [category.code ?? '', category.name, category.versions.length ? '' : '未配置'] },
          ...category.versions.map((version) => ({ key: `${group}:${version.id}`, kind: 'version' as const,
            inactive: !category.active || !version.active,
            values: ['', `V${version.version_no} · ${version.name}${version.is_default ? '（默认）' : ''}`,
              version.steps.join(' → ') || '未配置'] })),
        ];
      }),
    },
    workstation: data.workstation && {
      title: '工站清单',
      columns: [{ label: '序号', width: 10 }, { label: '工站名称', width: 38 }],
      rows: data.workstation.map((row) => ({ key: row.id, inactive: !row.active, values: [row.sequence, row.name] })),
    },
    process: data.process && {
      title: '工序清单',
      columns: [{ label: '序号', width: 10 }, { label: '工序名称', width: 32 },
        { label: '状态', width: 12 }, { label: '说明', width: 65 }],
      rows: data.process.map((row) => ({ key: row.id, inactive: !row.active,
        values: [row.sequence, row.name, row.active ? '启用' : '停用', row.description || ''] })),
    },
  };
}

const modules = { route: '工艺路线', workstation: '工站', process: '工序' };
const actions: Record<string, string> = { create: '新增', edit: '修改', version: '新版本', restore: '设为默认' };

export function approvalTable(approvals: Approval[]): ArchiveTable {
  return {
    title: '已生效审批记录',
    columns: [{ label: '生效日期', width: 23 }, { label: '变更对象', width: 51 },
      { label: '动作', width: 14 }, { label: '修改人', width: 17 }, { label: '审批人', width: 17 }],
    rows: approvals.map((row) => ({ key: row.request_no,
      values: [row.review_time, `${modules[row.module_type]} · ${row.target_name}`,
        row.action_type === 'status' ? (['1', 'true'].includes(row.target_active || '') ? '启用' : '停用')
          : actions[row.action_type] || row.action_type,
        row.applicant_name, row.reviewer_name || ''] })),
  };
}
