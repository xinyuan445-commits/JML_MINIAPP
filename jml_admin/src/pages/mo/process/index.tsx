import { PlusOutlined } from '@ant-design/icons';
import { history, useAccess, useLocation } from '@umijs/max';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormTextArea, ProFormDigit, ProTable } from '@ant-design/pro-components';
import { App, Button, Input, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import { addProcess, getProcessList, toggleProcess, updateConfigApproval, updateProcess } from '../service';

type ProcessItem = {
  id: number;
  process_code: string;
  process_name: string;
  description: string;
  sort: number;
  is_active: number;
  approval_status?: 'pending' | 'rejected';
  approval_id?: number;
  approval_action?: string;
  approval_payload?: Record<string, any>;
  approval_revision?: number;
  approval_can_edit?: boolean;
};

const ProcessPage: React.FC = () => {
  const access = useAccess();
  const { search } = useLocation();
  const requestedApprovalId = Number(new URLSearchParams(search).get('approval_id'));
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [editRow, setEditRow] = useState<ProcessItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const columns: ProColumns<ProcessItem>[] = [
    { title: '工序编码', dataIndex: 'process_code', width: 140 },
    { title: '工序名称', dataIndex: 'process_name', width: 160 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态', dataIndex: 'is_active', width: 90,
      render: (_, r) => r.approval_status
        ? <Tag color={r.approval_status === 'pending' ? 'processing' : 'error'}>{r.approval_status === 'pending' ? '待审批' : '已驳回'}</Tag>
        : <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', width: 160, valueType: 'option',
      render: (_, r) => r.approval_status ? [
        r.approval_can_edit && ['create', 'edit'].includes(r.approval_action || '')
          ? <a key="edit-request" onClick={() => { setEditRow(r); setModalOpen(true); }}>{r.approval_status === 'rejected' ? '修改并重新提交' : '修改申请'}</a>
          : <span key="pending">审批中</span>,
      ] : [
        access.can('process.edit') && <a key="edit" onClick={() => { setEditRow(r); setModalOpen(true); }}>编辑</a>,
        access.can('process.toggle') && <Popconfirm
          key="toggle"
          title={r.is_active ? '确认提交禁用申请？' : '确认提交启用申请？'}
          onConfirm={async () => {
            const res = await toggleProcess({ id: r.id, is_active: r.is_active ? 0 : 1 });
            if (res.code === 0) { message.success('申请已提交'); announceApprovalChange(); actionRef.current?.reload(); }
            else message.error(res.msg || '提交失败');
          }}
        >
          <a>{r.is_active ? '禁用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <div ref={scrollRef}>
      <ProTable<ProcessItem>
        headerTitle="工序管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        params={{ keyword }}
        request={async ({ keyword: searchKeyword }) => {
          const res = await getProcessList(true);
          const data = res.code === 0 ? res.data : [];
          const requested = data.find((row) => row.approval_id === requestedApprovalId);
          if (requested) {
            setEditRow(requested);
            setModalOpen(true);
            history.replace('/mo/process');
          }
          const query = (searchKeyword || '').trim().toLowerCase();
          const filtered = data.filter((row) => [row.process_code, row.process_name]
            .some((value) => String(value || '').toLowerCase().includes(query)));
          return { data: filtered, success: true };
        }}
        columns={columns}
        toolBarRender={() => [
          <Input.Search key="search" allowClear style={{ width: 280 }}
            placeholder="搜索工序编码或名称"
            onSearch={(value) => {
              actionRef.current?.setPageInfo?.({ current: 1 });
              setKeyword(value);
            }} />,
          access.can('process.add') && <Button key="add" type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditRow(undefined); setModalOpen(true); }}>
            新增
          </Button>,
        ]}
        scroll={{ y: scrollHeight }}
      />
      </div>

      <ModalForm
        title={editRow?.approval_status === 'rejected' ? '修改并重新提交工序申请' : editRow?.approval_status ? '修改工序申请' : editRow ? '编辑工序申请' : '新增工序申请'}
        open={modalOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditRow(undefined); } }}
        initialValues={editRow ? { ...editRow, ...editRow.approval_payload } : undefined}
        onFinish={async (values) => {
          if (editRow?.approval_status) {
            const permission = editRow.approval_action === 'create' ? 'process.add' : 'process.edit';
            if (!access.can(permission) || !editRow.approval_id || !editRow.approval_revision) return false;
            const res = await updateConfigApproval(
              editRow.approval_id,
              editRow.approval_revision,
              { ...editRow.approval_payload, ...values },
            );
            if (res.code === 0) {
              message.success(editRow.approval_status === 'rejected' ? '申请已重新提交' : '申请已修改');
              announceApprovalChange();
              actionRef.current?.reload();
              return true;
            }
            message.error(res.msg || '修改失败');
            return false;
          }
          if (!access.can(editRow ? 'process.edit' : 'process.add')) return false;
          const fn = editRow ? updateProcess : addProcess;
          const res = await fn(editRow ? { ...values, id: editRow.id } : values);
          if (res.code === 0) {
            message.success('申请已提交');
            announceApprovalChange();
            actionRef.current?.reload();
            return true;
          }
          message.error(res.msg || '提交失败');
          return false;
        }}
      >
        <ProFormText name="process_code" label="工序编码" rules={[{ required: true }]} disabled={!!editRow && editRow.approval_action !== 'create'} />
        <ProFormText name="process_name" label="工序名称" rules={[{ required: true }]} />
        <ProFormTextArea name="description" label="描述" />
        <ProFormDigit name="sort" label="排序" initialValue={0} />
      </ModalForm>
    </>
  );
};

export default ProcessPage;
