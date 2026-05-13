import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormTextArea, ProFormDigit, ProTable } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { addProcess, getProcessList, toggleProcess, updateProcess } from '../service';

type ProcessItem = {
  id: number;
  process_code: string;
  process_name: string;
  description: string;
  sort: number;
  is_active: number;
};

const ProcessPage: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [editRow, setEditRow] = useState<ProcessItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  const columns: ProColumns<ProcessItem>[] = [
    { title: '工序编码', dataIndex: 'process_code', width: 140 },
    { title: '工序名称', dataIndex: 'process_name', width: 160 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态', dataIndex: 'is_active', width: 90,
      render: (_, r) => <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', width: 160, valueType: 'option',
      render: (_, r) => [
        <a key="edit" onClick={() => { setEditRow(r); setModalOpen(true); }}>编辑</a>,
        <Popconfirm
          key="toggle"
          title={r.is_active ? '确认禁用？' : '确认启用？'}
          onConfirm={async () => {
            const res = await toggleProcess({ id: r.id, is_active: r.is_active ? 0 : 1 });
            if (res.code === 0) { message.success('操作成功'); actionRef.current?.reload(); }
            else message.error(res.msg || '操作失败');
          }}
        >
          <a>{r.is_active ? '禁用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<ProcessItem>
        headerTitle="工序管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => {
          const res = await getProcessList();
          return { data: res.code === 0 ? res.data : [], success: true };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditRow(undefined); setModalOpen(true); }}>
            新增
          </Button>,
        ]}
      />

      <ModalForm
        title={editRow ? '编辑工序' : '新增工序'}
        open={modalOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditRow(undefined); } }}
        initialValues={editRow}
        onFinish={async (values) => {
          const fn = editRow ? updateProcess : addProcess;
          const res = await fn(editRow ? { ...values, id: editRow.id } : values);
          if (res.code === 0) {
            message.success('保存成功');
            actionRef.current?.reload();
            return true;
          }
          message.error(res.msg || '保存失败');
          return false;
        }}
      >
        <ProFormText name="process_code" label="工序编码" rules={[{ required: true }]} disabled={!!editRow} />
        <ProFormText name="process_name" label="工序名称" rules={[{ required: true }]} />
        <ProFormTextArea name="description" label="描述" />
        <ProFormDigit name="sort" label="排序" initialValue={0} />
      </ModalForm>
    </>
  );
};

export default ProcessPage;
