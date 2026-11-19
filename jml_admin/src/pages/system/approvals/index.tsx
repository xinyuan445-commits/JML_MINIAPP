import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useAccess, useModel } from '@umijs/max';
import { App, Button, Image, Input, Modal, Select, Space, Table, Tabs, Tag } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import {
  type ApprovalApplicant,
  type ApprovalItem,
  type ApprovalModule,
  getConfigApprovals,
  markApprovalResultsRead,
  reviewConfigApproval,
} from './service';

const MODULE_NAMES: Record<ApprovalModule, string> = {
  equipment: '设备档案',
  'equipment-capacity': '标准产能',
  process: '工序管理',
  workstation: '工站管理',
  category: '报工类别',
  route: '工艺路线',
};
const MODULE_PATHS: Record<ApprovalModule, string> = {
  equipment: '/mo/equipment',
  'equipment-capacity': '/mo/equipment',
  process: '/mo/process',
  workstation: '/mo/workstation',
  category: '/mo/product-category',
  route: '/mo/route',
};
const ACTION_NAMES: Record<ApprovalItem['action_type'], string> = {
  create: '新增',
  edit: '编辑',
  status: '状态调整',
  version: '新版本',
  restore: '设为默认版本',
};
const ACTION_COLORS: Record<ApprovalItem['action_type'], string> = {
  create: 'green',
  edit: 'blue',
  status: 'orange',
  version: 'purple',
  restore: 'cyan',
};
const FIELD_NAMES: Record<string, string> = {
  device_id: '设备标识',
  device_code: '设备编号',
  device_enabled: '设备状态',
  device_name: '设备名称',
  station_id: '工站标识',
  process_id: '工序标识',
  category_name: '适用类别',
  category_code: '类别编码',
  device_type: '设备类型',
  workshop: '车间',
  location: '位置',
  brand: '品牌',
  model: '型号',
  serial_no: '出厂编号',
  commissioned_on: '投用日期',
  photo: '设备照片',
  capacity_mode: '产能模式',
  quantity: '标准数量',
  unit: '计量单位',
  period: '时间周期',
  effective_hours: '周期有效工时',
  staffing: '标准配员',
  setup_minutes: '换型准备时间（分钟）',
  basis: '标准依据',
  measured_on: '测定日期',
  specification: '规格说明',
  remark: '备注',
  process_code: '工序编码',
  process_name: '工序名称',
  station_code: '工站编码',
  station_name: '工站名称',
  code: '类别编码',
  name: '类别名称',
  route_code: '路线编码',
  route_name: '路线名称',
  dept_code: '部门代码',
  description: '描述',
  sort: '排序',
  is_active: '状态',
  is_enabled: '状态',
  is_default: '默认路线',
  set_default: '设为默认版本',
  product_codes: '适用产品类别',
  steps: '工序步骤',
  version_note: '版本说明',
};
const HIDDEN_FIELDS = new Set([
  'id',
  'route_id',
  'mode',
  'version_group',
  'version_no',
  'parent_route_id',
  'is_current',
  'current_route_id',
  'dept_name',
]);

function displayValue(field: string, value: any, categoryNames: Record<string, string> = {}) {
  if (value === undefined || value === null || value === '') return '-';
  if (field === 'photo') return '已上传照片';
  const labels: Record<string, Record<string, string>> = {
    capacity_mode: { finite: '有限产能', unlimited: '无限产能' },
    period: { minute: '每分钟', hour: '每小时', day: '每天', shift: '每班' },
    basis: { experience: '经验估算', measured: '现场实测', manufacturer: '厂家参数' },
  };
  if (labels[field]?.[value]) return labels[field][value];
  if (field === 'device_enabled') return value ? '启用' : '停用';
  if (field === 'is_active' || field === 'is_enabled') return value ? '启用' : '禁用';
  if (field === 'is_default' || field === 'set_default') return value ? '是' : '否';
  if (field === 'steps' && Array.isArray(value)) {
    return value.map((step, index) =>
      `${index + 1}. ${step.process_name || `工序#${step.process_id}`} / ${step.station_name || `工站#${step.station_id}`}`,
    ).join('；');
  }
  if (field === 'product_codes' && Array.isArray(value)) {
    return value.map((code) => categoryNames[String(code)]
      ? `${categoryNames[String(code)]}（${code}）`
      : `类别名称未找到（${code}）`).join('、') || '-';
  }
  if (Array.isArray(value)) return value.join('、') || '-';
  return String(value);
}

function statusTag(status: ApprovalItem['status']) {
  if (status === 'approved') return <Tag color="success">已通过</Tag>;
  if (status === 'rejected') return <Tag color="error">已驳回</Tag>;
  return <Tag color="processing">待审批</Tag>;
}

function actionTag(action: ApprovalItem['action_type']) {
  return <Tag color={ACTION_COLORS[action]} style={{ marginInlineEnd: 0 }}>{ACTION_NAMES[action]}</Tag>;
}

const SUBJECT_FIELDS: Record<ApprovalModule, [string, string]> = {
  equipment: ['device_name', 'station_name'],
  'equipment-capacity': ['device_name', 'process_name'],
  process: ['process_name', 'process_code'],
  workstation: ['station_name', 'station_code'],
  category: ['name', 'code'],
  route: ['route_name', 'route_code'],
};

function approvalSubject(row: ApprovalItem) {
  const [nameField, codeField] = SUBJECT_FIELDS[row.module_type];
  const data = { ...row.before_data, ...row.after_data };
  return {
    name: String(data[nameField] || data[codeField] || row.target_key),
    code: data[codeField] ? String(data[codeField]) : '',
  };
}

function changedFields(row: ApprovalItem) {
  const before = row.before_data || {};
  const after = { ...before, ...row.after_data };
  return Object.keys(FIELD_NAMES).filter((field) =>
    field in after && !HIDDEN_FIELDS.has(field) &&
    (row.action_type === 'create' || JSON.stringify(before[field]) !== JSON.stringify(after[field])),
  );
}

function ApprovalChangeFields({ row }: { row: ApprovalItem }) {
  const before = row.before_data || {};
  const after = { ...before, ...row.after_data };
  const [nameField, codeField] = SUBJECT_FIELDS[row.module_type];
  const fields = changedFields(row).filter((field) =>
    row.action_type !== 'create' ||
    (field !== nameField && field !== codeField && displayValue(field, after[field]) !== '-'),
  );
  const statusField = row.action_type === 'status'
    ? fields.find((field) => field === 'is_active' || field === 'is_enabled')
    : undefined;
  if (statusField) {
    return <Tag style={{ marginInlineEnd: 0 }}>
      {displayValue(statusField, before[statusField])} → {displayValue(statusField, after[statusField])}
    </Tag>;
  }
  if (!fields.length) return <span style={{ color: '#8c8c8c' }}>基础信息</span>;
  return (
    <Space size={[4, 4]} wrap>
      {fields.slice(0, 3).map((field) => (
        <Tag key={field} style={{ marginInlineEnd: 0 }}>{FIELD_NAMES[field]}</Tag>
      ))}
      {fields.length > 3 && <span style={{ color: '#8c8c8c' }}>+{fields.length - 3} 项</span>}
    </Space>
  );
}

const ApprovalCenter: React.FC = () => {
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const approvableModules = (Object.keys(MODULE_NAMES) as ApprovalModule[]).filter(
    (module) => access.can(`${module}.approve`),
  );
  const canApprove = approvableModules.length > 0;
  const canViewMine = access.can('approval.mine');
  const [scope, setScope] = useState<'pending' | 'mine' | 'history'>(
    canApprove ? 'pending' : 'mine',
  );
  const [moduleFilter, setModuleFilter] = useState<string>();
  const [applicantFilter, setApplicantFilter] = useState<number>();
  const [applicants, setApplicants] = useState<ApprovalApplicant[]>([]);
  const [selectedItems, setSelectedItems] = useState<ApprovalItem[]>([]);
  const [detail, setDetail] = useState<ApprovalItem>();
  const [review, setReview] = useState<{
    items: ApprovalItem[];
    decision: 'approve' | 'reject';
    batch: boolean;
  }>();
  const [comment, setComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const reviewingRef = useRef(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [batchFailures, setBatchFailures] = useState<{
    id: number;
    request_no: string;
    name: string;
    reason: string;
  }[]>([]);

  useEffect(() => {
    if (scope === 'mine') {
      markApprovalResultsRead().then((response) => {
        if (response.code === 0) announceApprovalChange();
      });
    }
  }, [scope]);

  const detailRows = useMemo(() => {
    if (!detail) return [];
    const before = detail.before_data || {};
    const after = detail.action_type === 'create'
      ? detail.after_data
      : { ...before, ...detail.after_data };
    return changedFields(detail)
      .map((field) => ({
        field,
        label: FIELD_NAMES[field],
        before: detail.action_type === 'create' ? '-' : displayValue(field, before[field], detail.product_category_names),
        after: displayValue(field, after[field], detail.product_category_names),
      }));
  }, [detail]);

  const startReview = (item: ApprovalItem | ApprovalItem[], decision: 'approve' | 'reject') => {
    setDetail(undefined);
    setComment('');
    setReviewedCount(0);
    setReview({ items: Array.isArray(item) ? [...item] : [item], decision, batch: Array.isArray(item) });
  };

  const submitReview = async () => {
    if (!review || reviewingRef.current) return;
    if (review.decision === 'reject' && !comment.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    reviewingRef.current = true;
    setReviewing(true);
    const failures: typeof batchFailures = [];
    try {
      for (const [index, item] of review.items.entries()) {
        const res = await reviewConfigApproval({
          id: item.id,
          revision: item.revision,
          decision: review.decision,
          comment: comment.trim(),
        });
        if (res.code !== 0) {
          failures.push({
            id: item.id,
            request_no: item.request_no,
            name: approvalSubject(item).name,
            reason: res.msg || '审批失败',
          });
        }
        setReviewedCount(index + 1);
      }
      actionRef.current?.reload();
      const succeeded = review.items.length - failures.length;
      if (succeeded > 0) announceApprovalChange();
      if (!review.batch && failures.length) {
        message.error(failures[0].reason);
        return;
      }
      if (review.batch) {
        setSelectedItems([]);
        if (failures.length) {
          message.warning(`成功 ${succeeded} 条，失败 ${failures.length} 条`);
          setBatchFailures(failures);
        } else {
          message.success(`已${review.decision === 'approve' ? '通过' : '驳回'} ${succeeded} 条申请`);
        }
      } else {
        message.success(review.decision === 'approve' ? '已通过' : '已驳回');
        setSelectedItems((items) => items.filter((item) => item.id !== review.items[0].id));
      }
      setReview(undefined);
    } finally {
      reviewingRef.current = false;
      setReviewing(false);
    }
  };

  const columns: ProColumns<ApprovalItem>[] = [
    {
      title: '申请单号', dataIndex: 'request_no', width: 150,
      render: (_, row) => scope === 'pending'
        ? <span style={{ color: '#1677ff' }}>{row.request_no}</span>
        : row.request_no,
    },
    {
      title: '申请内容', dataIndex: 'subject', width: 280,
      hideInTable: scope !== 'pending',
      render: (_, row) => {
        const subject = approvalSubject(row);
        return (
          <div>
            <strong>{subject.name}</strong>
            {subject.code && subject.code !== subject.name && (
              <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>{subject.code}</div>
            )}
          </div>
        );
      },
    },
    {
      title: '功能模块',
      dataIndex: 'module_type',
      width: 120,
      render: (_, row) => MODULE_NAMES[row.module_type],
    },
    {
      title: '操作类型',
      dataIndex: 'action_type',
      width: 105,
      render: (_, row) => actionTag(row.action_type),
    },
    {
      title: '变更项', dataIndex: 'change_summary', width: 280,
      hideInTable: scope !== 'pending',
      render: (_, row) => <ApprovalChangeFields row={row} />,
    },
    {
      title: '提交信息', dataIndex: 'submitted', width: 190,
      hideInTable: scope !== 'pending',
      render: (_, row) => (
        <div>
          <div>{row.applicant_name}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{row.apply_time}</div>
        </div>
      ),
    },
    { title: '申请人', dataIndex: 'applicant_name', width: 110, hideInTable: scope === 'pending' },
    { title: '申请时间', dataIndex: 'apply_time', valueType: 'dateTime', width: 170, hideInTable: scope === 'pending' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      hideInTable: scope === 'pending',
      render: (_, row) => statusTag(row.status),
    },
    { title: '审批人', dataIndex: 'reviewer_name', width: 110, hideInTable: scope === 'pending', renderText: (value) => value || '-' },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      hideInTable: scope === 'pending',
      render: (_, row) => [
        <a key="detail" onClick={() => setDetail(row)}>查看</a>,
        row.status === 'pending' && access.can(`${row.module_type}.approve`) && (
          <a key="approve" onClick={() => startReview(row, 'approve')}>
            通过
          </a>
        ),
        row.status === 'pending' && access.can(`${row.module_type}.approve`) && (
          <a key="reject" onClick={() => startReview(row, 'reject')}>
            驳回
          </a>
        ),
        row.status === 'rejected' &&
        row.applicant_account_id === initialState?.currentUser?.adminAccountId &&
        ['create', 'edit'].includes(row.action_type) && (
          <a
            key="resubmit"
            onClick={() => history.push(`${MODULE_PATHS[row.module_type]}?approval_id=${row.id}`)}
          >
            修改并重新提交
          </a>
        ),
      ],
    },
  ];

  const tabs = [
    canApprove ? { key: 'pending', label: '待我审批' } : null,
    canViewMine ? { key: 'mine', label: '我的申请' } : null,
    canApprove ? { key: 'history', label: '审批记录' } : null,
  ].filter(Boolean) as { key: 'pending' | 'mine' | 'history'; label: string }[];

  return (
    <PageContainer title="审批中心">
      <Tabs
        activeKey={scope}
        items={tabs}
        onChange={(key) => {
          setSelectedItems([]);
          setApplicantFilter(undefined);
          setScope(key as typeof scope);
          setTimeout(() => actionRef.current?.reload(), 0);
        }}
      />
      <div ref={scrollRef}>
      <ProTable<ApprovalItem>
        actionRef={actionRef}
        rowKey="id"
        onRow={(row) => scope === 'pending'
          ? {
            onClick: (event) => {
              if ((event.target as HTMLElement).closest('.ant-table-selection-column')) return;
              setDetail(row);
            },
            style: { cursor: 'pointer' },
          }
          : {}}
        rowSelection={scope === 'pending' ? {
          selectedRowKeys: selectedItems.map((item) => item.id),
          preserveSelectedRowKeys: true,
          onChange: (_, rows) => setSelectedItems(rows),
          getCheckboxProps: (row) => ({
            disabled: reviewing || row.status !== 'pending' || !access.can(`${row.module_type}.approve`),
          }),
          columnWidth: 48,
        } : false}
        tableAlertRender={false}
        tableAlertOptionRender={false}
        search={false}
        options={{ reload: true, density: false, setting: false }}
        params={{ scope, module_type: moduleFilter, applicant_account_id: applicantFilter }}
        request={async (params) => {
          const res = await getConfigApprovals({
            current: params.current,
            pageSize: params.pageSize,
            scope: params.scope,
            module_type: params.module_type,
            applicant_account_id: params.scope === 'pending' ? params.applicant_account_id : undefined,
          });
          if (res.code !== 0) message.error(res.msg || '加载失败');
          else if (params.scope === 'pending') setApplicants(res.applicants || []);
          return { data: res.data || [], total: res.total || 0, success: res.code === 0 };
        }}
        columns={columns}
        toolBarRender={() => [
          ...(scope === 'pending' ? [
            <Space key="batch">
              <span>已选 {selectedItems.length} 条</span>
              <Button
                type="primary"
                disabled={!selectedItems.length || reviewing}
                onClick={() => startReview(selectedItems, 'approve')}
              >批量通过</Button>
              <Button
                danger
                disabled={!selectedItems.length || reviewing}
                onClick={() => startReview(selectedItems, 'reject')}
              >批量驳回</Button>
              {selectedItems.length > 0 && (
                <Button type="link" disabled={reviewing} onClick={() => setSelectedItems([])}>清空选择</Button>
              )}
            </Space>,
            <Select
              key="applicant"
              aria-label="筛选申请人"
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              style={{ width: 160 }}
              placeholder="全部申请人"
              value={applicantFilter}
              options={applicants.map((applicant) => ({
                value: applicant.applicant_account_id,
                label: applicant.applicant_name,
              }))}
              onChange={(value) => {
                setSelectedItems([]);
                setApplicantFilter(value);
              }}
            />,
          ] : []),
          <Select
            key="module"
            allowClear
            style={{ width: 150 }}
            placeholder="全部功能"
            value={moduleFilter}
            options={(scope === 'mine' ? Object.keys(MODULE_NAMES) : approvableModules).map((module) => ({
              value: module,
              label: MODULE_NAMES[module as ApprovalModule],
            }))}
            onChange={(value) => {
              setSelectedItems([]);
              setApplicantFilter(undefined);
              setModuleFilter(value);
            }}
          />,
        ]}
        scroll={{ y: scrollHeight }}
      />
      </div>

      <Modal
        title={`${detail?.request_no || ''} 申请详情`}
        open={!!detail}
        width={820}
        footer={detail?.status === 'pending' && access.can(`${detail.module_type}.approve`) ? (
          <Space>
            <Button onClick={() => setDetail(undefined)}>关闭</Button>
            <Button danger onClick={() => startReview(detail, 'reject')}>驳回</Button>
            <Button type="primary" onClick={() => startReview(detail, 'approve')}>通过</Button>
          </Space>
        ) : null}
        onCancel={() => setDetail(undefined)}
      >
        {detail && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Tag>{MODULE_NAMES[detail.module_type]}</Tag>
              {actionTag(detail.action_type)}
              {statusTag(detail.status)}
              <strong>{approvalSubject(detail).name}</strong>
              <span>申请人：{detail.applicant_name}</span>
            </Space>
            <Table
              rowKey="field"
              size="small"
              pagination={false}
              dataSource={detailRows}
              locale={{ emptyText: '无字段变化' }}
              columns={[
                { title: '项目', dataIndex: 'label', width: 140 },
                { title: '变更前', dataIndex: 'before', render: (value, row) => row.field === 'photo' && detail.before_data?.photo ? <Image width={100} src={detail.before_data.photo} alt="变更前设备照片" /> : value },
                { title: '变更后', dataIndex: 'after', render: (value, row) => row.field === 'photo' && detail.after_data.photo ? <Image width={100} src={detail.after_data.photo} alt="变更后设备照片" /> : value },
              ]}
            />
            {detail.review_comment && <div>审批意见：{detail.review_comment}</div>}
          </Space>
        )}
      </Modal>

      <Modal
        title={`${review?.batch ? '批量' : ''}${review?.decision === 'approve' ? '通过申请' : '驳回申请'} · ${review?.batch ? `${review.items.length} 条` : review?.items[0].request_no || ''}`}
        open={!!review}
        width={review?.batch ? 760 : 520}
        okText={review?.decision === 'approve' ? '确认通过' : '确认驳回'}
        cancelText="取消"
        confirmLoading={reviewing}
        closable={!reviewing}
        keyboard={!reviewing}
        mask={{ closable: !reviewing }}
        cancelButtonProps={{ disabled: reviewing }}
        onCancel={() => setReview(undefined)}
        onOk={submitReview}
      >
        {review?.batch ? (
          <Table<ApprovalItem>
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 240 }}
            style={{ marginBottom: 12 }}
            dataSource={review.items}
            columns={[
              { title: '申请单号', dataIndex: 'request_no', width: 150 },
              { title: '申请内容', render: (_, row) => approvalSubject(row).name },
              { title: '功能模块', width: 110, render: (_, row) => MODULE_NAMES[row.module_type] },
              { title: '操作类型', width: 100, render: (_, row) => actionTag(row.action_type) },
              { title: '申请人', dataIndex: 'applicant_name', width: 100 },
            ]}
          />
        ) : review && (
          <div style={{ marginBottom: 12 }}>
            <strong>{approvalSubject(review.items[0]).name}</strong>
            <div style={{ marginTop: 8 }}><ApprovalChangeFields row={review.items[0]} /></div>
          </div>
        )}
        {reviewing && review?.batch && <div style={{ marginBottom: 8 }}>正在审核 {reviewedCount}/{review.items.length}</div>}
        <Input.TextArea
          disabled={reviewing}
          value={comment}
          maxLength={500}
          rows={4}
          placeholder={review?.decision === 'reject' ? '请填写驳回原因' : '审批意见（选填）'}
          onChange={(event) => setComment(event.target.value)}
        />
      </Modal>
      <Modal
        title="未完成的审核"
        open={batchFailures.length > 0}
        width={760}
        footer={<Button onClick={() => setBatchFailures([])}>关闭</Button>}
        onCancel={() => setBatchFailures([])}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 300 }}
          dataSource={batchFailures}
          columns={[
            { title: '申请单号', dataIndex: 'request_no', width: 150 },
            { title: '申请内容', dataIndex: 'name', width: 180 },
            { title: '原因', dataIndex: 'reason' },
          ]}
        />
      </Modal>
    </PageContainer>
  );
};

export default ApprovalCenter;
