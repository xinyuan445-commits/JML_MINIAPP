import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, App, Button, Card, Space, Spin, Tree, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import {
  getWorkerDepartmentScope,
  saveWorkerDepartmentScope,
  type WorkerDepartment,
} from '../service';

type DepartmentNode = {
  key: string;
  title: string;
  disableCheckbox?: boolean;
  children: DepartmentNode[];
};

function buildDepartmentTree(departments: WorkerDepartment[]) {
  const nodes = new Map<number, DepartmentNode>();
  for (const department of departments) {
    nodes.set(department.dept_id, {
      key: String(department.dept_id),
      title: department.dept_name,
      disableCheckbox: department.dept_id === 1,
      children: [],
    });
  }
  const roots: DepartmentNode[] = [];
  for (const department of departments) {
    const node = nodes.get(department.dept_id);
    const parent = department.parent_dept_id
      ? nodes.get(department.parent_dept_id)
      : undefined;
    if (!node) continue;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

const WorkerDepartmentPage: React.FC = () => {
  const { scrollRef, scrollHeight } = useViewportScrollHeight(48, 'container');
  const canEdit = useAccess().can('worker-department.edit');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<WorkerDepartment[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [configured, setConfigured] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getWorkerDepartmentScope();
      if (response.code !== 0) {
        message.error(response.msg || '部门范围加载失败');
        return;
      }
      setDepartments(response.data.departments || []);
      setCheckedIds(response.data.selected_dept_ids || []);
      setConfigured(Boolean(response.data.configured));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const treeData = useMemo(
    () => buildDepartmentTree(departments),
    [departments],
  );

  const save = async () => {
    if (!canEdit) return;
    if (!checkedIds.length) {
      message.warning('请至少选择一个部门');
      return;
    }
    setSaving(true);
    try {
      const response = await saveWorkerDepartmentScope(checkedIds);
      if (response.code !== 0) {
        message.error(response.msg || '保存失败');
        return;
      }
      setConfigured(true);
      message.success('保存成功，小程序重新进入人员选择后生效');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="报工人员部门"
      content="控制微信小程序开工、追加接收和返工时可以选择的人员部门。"
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type={configured ? 'info' : 'warning'}
          showIcon
          message={
            configured ? '当前使用后台配置范围' : '当前仍使用原有默认范围'
          }
          description="只需勾选需要保留的部门。被选部门的所有下级部门会自动包含，上级部门仅用于目录导航。"
        />
        <Card
          title={`选择部门（已选 ${checkedIds.length} 个）`}
          extra={
            canEdit && (
              <Button type="primary" loading={saving} onClick={save}>
                保存设置
              </Button>
            )
          }
        >
          <Spin spinning={loading}>
            <div
              ref={scrollRef}
              style={{ maxHeight: scrollHeight, overflowY: 'auto' }}
            >
              {departments.length ? (
                <Tree
                  disabled={!canEdit}
                  checkable
                  checkStrictly
                  showLine
                  defaultExpandAll
                  checkedKeys={checkedIds.map(String)}
                  treeData={treeData}
                  onCheck={(value) => {
                    const keys = Array.isArray(value) ? value : value.checked;
                    setCheckedIds(
                      keys
                        .map((key) => Number(key))
                        .filter((key) => Number.isFinite(key) && key > 1),
                    );
                  }}
                />
              ) : (
                !loading && (
                  <Typography.Text type="secondary">
                    暂无部门数据，请先完成钉钉通讯录同步。
                  </Typography.Text>
                )
              )}
            </div>
          </Spin>
        </Card>
      </Space>
    </PageContainer>
  );
};

export default WorkerDepartmentPage;
