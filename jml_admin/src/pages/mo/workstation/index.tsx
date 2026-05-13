import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormTextArea, ProTable } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { addWorkstation, getWorkstationList, toggleWorkstation, updateWorkstation } from '../service';

type StationItem = {
  id: number;
  station_code: string;
  station_name: string;
  description: string;
  is_active: number;
};

const WorkstationPage: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [editRow, setEditRow] = useState<StationItem | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  const columns: ProColumns<StationItem>[] = [
    { title: '工站编码', dataIndex: 'station_code', width: 140 },
    { title: '工站名称', dataIndex: 'station_name', width: 160 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
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
            const res = await toggleWorkstation({ id: r.id, is_active: r.is_active ? 0 : 1 });
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
      <ProTable<StationItem>
        headerTitle="工站管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        request={async () => {
          const res = await getWorkstationList();
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
        title={editRow ? '编辑工站' : '新增工站'}
        open={modalOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(v) => { if (!v) { setModalOpen(false); setEditRow(undefined); } }}
        initialValues={editRow}
        onFinish={async (values) => {
          const fn = editRow ? updateWorkstation : addWorkstation;
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
        <ProFormText name="station_code" label="工站编码" rules={[{ required: true }]} disabled={!!editRow} />
        <ProFormText name="station_name" label="工站名称" rules={[{ required: true }]} />
        <ProFormTextArea name="description" label="描述" />
      </ModalForm>
    </>
  );
};

export default WorkstationPage;
