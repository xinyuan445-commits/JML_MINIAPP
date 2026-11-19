import { PlusOutlined } from '@ant-design/icons';
import { history, useAccess, useLocation } from '@umijs/max';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import { announceApprovalChange } from '@/utils/approvalNotifications';
import {
  addProductCategory,
  getProductCategoryManageList,
  toggleProductCategory,
  updateConfigApproval,
  updateProductCategory,
} from '../service';

type ProductCategoryItem = {
  code: string;
  name: string;
  is_enabled: number;
  created_at?: string;
  updated_at?: string;
  approval_status?: 'pending' | 'rejected';
  approval_id?: number;
  approval_action?: string;
  approval_payload?: Record<string, any>;
  approval_revision?: number;
  approval_can_edit?: boolean;
};

const ProductCategoryPage: React.FC = () => {
  const access = useAccess();
  const { search } = useLocation();
  const requestedApprovalId = Number(new URLSearchParams(search).get('approval_id'));
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [editRow, setEditRow] = useState<ProductCategoryItem>();
  const [modalOpen, setModalOpen] = useState(false);

  const columns: ProColumns<ProductCategoryItem>[] = [
    { title: '类别编码', dataIndex: 'code', width: 110 },
    { title: '产品类别名称', dataIndex: 'name' },
    {
      title: '状态', dataIndex: 'is_enabled', width: 100,
      render: (_, row) => row.approval_status
        ? <Tag color={row.approval_status === 'pending' ? 'processing' : 'error'}>{row.approval_status === 'pending' ? '待审批' : '已驳回'}</Tag>
        : <Tag color={row.is_enabled ? 'green' : 'default'}>{row.is_enabled ? '启用' : '停用'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', width: 180 },
    {
      title: '操作', valueType: 'option', width: 150,
      render: (_, row) => row.approval_status ? [
        row.approval_can_edit && ['create', 'edit'].includes(row.approval_action || '')
          ? <a key="edit-request" onClick={() => { setEditRow(row); setModalOpen(true); }}>{row.approval_status === 'rejected' ? '修改并重新提交' : '修改申请'}</a>
          : <span key="pending">审批中</span>,
      ] : [
        access.can('category.edit') && <a key="edit" onClick={() => { setEditRow(row); setModalOpen(true); }}>编辑</a>,
        access.can('category.toggle') && <Popconfirm
          key="toggle"
          title={row.is_enabled ? '确认提交停用申请？' : '确认提交启用申请？'}
          onConfirm={async () => {
            const res = await toggleProductCategory({
              code: row.code,
              is_enabled: row.is_enabled ? 0 : 1,
            });
            if (res.code === 0) {
              message.success('申请已提交');
              announceApprovalChange();
              actionRef.current?.reload();
            } else {
              message.error(res.msg || '提交失败');
            }
          }}
        >
          <a>{row.is_enabled ? '停用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <div ref={scrollRef}>
      <ProTable<ProductCategoryItem>
        headerTitle="报工产品类别"
        actionRef={actionRef}
        rowKey={(row) => row.approval_id ? `approval-${row.approval_id}` : row.code}
        search={false}
        request={async () => {
          const res = await getProductCategoryManageList();
          const data = res.code === 0 ? res.data : [];
          const requested = data.find((row) => row.approval_id === requestedApprovalId);
          if (requested) {
            setEditRow(requested);
            setModalOpen(true);
            history.replace('/mo/product-category');
          }
          return { data, success: res.code === 0 };
        }}
        columns={columns}
        toolBarRender={() => access.can('category.add') ? [
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditRow(undefined); setModalOpen(true); }}
          >
            新增产品类别
          </Button>,
        ] : []}
        scroll={{ y: scrollHeight }}
      />
      </div>

      <ModalForm
        title={editRow?.approval_status === 'rejected' ? '修改并重新提交产品类别申请' : editRow?.approval_status ? '修改产品类别申请' : editRow ? '编辑产品类别申请' : '新增产品类别申请'}
        open={modalOpen}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) {
            setModalOpen(false);
            setEditRow(undefined);
          }
        }}
        initialValues={editRow ? { ...editRow, ...editRow.approval_payload } : undefined}
        onFinish={async (values) => {
          if (editRow?.approval_status) {
            const permission = editRow.approval_action === 'create' ? 'category.add' : 'category.edit';
            if (!access.can(permission) || !editRow.approval_id || !editRow.approval_revision) return false;
            const res = await updateConfigApproval(
              editRow.approval_id,
              editRow.approval_revision,
              { ...editRow.approval_payload, name: values.name },
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
          if (!access.can(editRow ? 'category.edit' : 'category.add')) return false;
          const res = editRow
            ? await updateProductCategory({ code: editRow.code, name: values.name })
            : await addProductCategory({ name: values.name });
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
        {editRow && editRow.approval_action !== 'create' && <ProFormText name="code" label="类别编码" disabled />}
        <ProFormText
          name="name"
          label="产品类别名称"
          placeholder="请输入产品类别名称"
          rules={[
            { required: true, message: '请输入产品类别名称' },
            { max: 100, message: '最多输入100个字符' },
          ]}
        />
      </ModalForm>
    </>
  );
};

export default ProductCategoryPage;
