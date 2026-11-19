import {
  Button,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { filterRouteOptions, groupRouteOptions, type RouteOption, type RouteVersionOption } from './routePickerModel';

type ProductCategory = { code: string; name: string };

export default function RoutePickerDrawer({
  open,
  routes,
  productCategories,
  initialRouteId,
  preferredDeptCode,
  preferredCategoryCode,
  contextText,
  confirmLoading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  routes: RouteOption[];
  productCategories: ProductCategory[];
  initialRouteId?: number;
  preferredDeptCode?: string;
  preferredCategoryCode?: string;
  contextText: string;
  confirmLoading: boolean;
  onClose: () => void;
  onConfirm: (routeId: number) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [deptCode, setDeptCode] = useState<string>();
  const [categoryCode, setCategoryCode] = useState<string>();
  const [selectedRouteId, setSelectedRouteId] = useState<number>();
  const [versionChoices, setVersionChoices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setDeptCode(undefined);
    setCategoryCode(undefined);
    setSelectedRouteId(initialRouteId);
    setVersionChoices({});
  }, [initialRouteId, open]);

  const departmentOptions = useMemo(() => {
    const departments = new Map<string, string>();
    for (const route of routes) {
      if (route.dept_code) {
        departments.set(
          route.dept_code,
          route.dept_name
            ? `${route.dept_code} — ${route.dept_name}`
            : route.dept_code,
        );
      }
    }
    return [...departments.entries()].map(([value, label]) => ({
      value,
      label,
    }));
  }, [routes]);

  const visibleRoutes = useMemo(
    () =>
      filterRouteOptions(
        routes,
        { keyword, deptCode, categoryCode },
        { deptCode: preferredDeptCode, categoryCode: preferredCategoryCode },
      ),
    [
      categoryCode,
      deptCode,
      keyword,
      preferredCategoryCode,
      preferredDeptCode,
      routes,
    ],
  );

  const visibleGroups = useMemo(
    () => groupRouteOptions(routes, versionChoices, initialRouteId, preferredCategoryCode, visibleRoutes),
    [routes, visibleRoutes, versionChoices, initialRouteId, preferredCategoryCode],
  );
  const selectedGroup = visibleGroups.find(group =>
    group.versions.some(version => version.id === selectedRouteId));
  const selectedRoute = routes.find((route) => route.id === selectedRouteId);
  const isRecommended = (route: RouteOption) =>
    Boolean(preferredDeptCode || preferredCategoryCode) &&
    (!preferredDeptCode || route.dept_code === preferredDeptCode) &&
    (!preferredCategoryCode ||
      route.product_codes?.includes(preferredCategoryCode));

  return (
    <Drawer
      title="选择工艺路线"
      width="min(980px, 94vw)"
      open={open}
      destroyOnHidden
      maskClosable={!confirmLoading}
      closable={!confirmLoading}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {selectedRoute
              ? `已选择：${selectedRoute.route_name}（${selectedRoute.route_code}）`
              : '请选择一条路线'}
          </span>
          <Button onClick={onClose} disabled={confirmLoading}>
            取消
          </Button>
          <Button
            type="primary"
            loading={confirmLoading}
            disabled={!selectedRouteId}
            onClick={() => selectedRouteId && onConfirm(selectedRouteId)}
          >
            确认指定
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 12, color: '#595959' }}>{contextText}</div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          aria-label="搜索工艺路线"
          placeholder="搜索路线名称、编码、部门或产品类别"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 330 }}
        />
        <Select
          aria-label="按部门筛选路线"
          placeholder="全部部门"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          value={deptCode}
          onChange={setDeptCode}
          options={departmentOptions}
          style={{ width: 230 }}
        />
        <Select
          aria-label="按产品类别筛选路线"
          placeholder="全部产品类别"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          value={categoryCode}
          onChange={setCategoryCode}
          options={productCategories.map((category) => ({
            value: category.code,
            label: `${category.code} — ${category.name}`,
          }))}
          style={{ width: 230 }}
        />
        <Button
          onClick={() => {
            setKeyword('');
            setDeptCode(undefined);
            setCategoryCode(undefined);
          }}
        >
          重置
        </Button>
      </Space>
      <Table<RouteVersionOption>
        rowKey="group_key"
        size="middle"
        dataSource={visibleGroups}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条路线`,
        }}
        rowSelection={{
          type: 'radio',
          selectedRowKeys: selectedGroup ? [selectedGroup.group_key] : [],
          onChange: (_, selectedRows) => setSelectedRouteId(selectedRows[0]?.id),
        }}
        onRow={(route) => ({
          onClick: () => setSelectedRouteId(route.id),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: '路线',
            width: 240,
            render: (_, route) => (
              <div>
                <div style={{ fontWeight: 600 }}>{route.route_name}</div>
                <Space size={4} wrap>
                  <span style={{ color: '#8c8c8c' }}>{route.group_key}</span>
                  {isRecommended(route) ? <Tag color="gold">推荐</Tag> : null}
                  {(preferredCategoryCode
                    ? route.default_product_codes?.includes(preferredCategoryCode)
                    : route.is_current) ? <Tag color="green">默认版本</Tag> : null}
                </Space>
              </div>
            ),
          },
          {
            title: '版本',
            width: 150,
            render: (_, route) => (
              <div onClick={(event) => event.stopPropagation()}>
                <Select
                  aria-label={`选择${route.version_group || route.route_name}的版本`}
                  value={route.id}
                  disabled={confirmLoading}
                  style={{ width: '100%' }}
                  popupMatchSelectWidth={300}
                  options={route.versions.map(version => ({
                    value: version.id,
                    label: `V${version.version_no || 1}${version.is_current ? '（默认）' : ''}`,
                    routeCode: version.route_code,
                  }))}
                  optionRender={(option) => (
                    <div>
                      <div>{option.label}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{option.data.routeCode}</div>
                    </div>
                  )}
                  onChange={(id) => {
                    setVersionChoices(previous => ({ ...previous, [route.group_key]: id }));
                    setSelectedRouteId(id);
                  }}
                />
                <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>{route.route_code}</div>
              </div>
            ),
          },
          {
            title: '部门',
            width: 140,
            render: (_, route) => (
              <div>
                <div>{route.dept_name || '—'}</div>
                <span style={{ color: '#8c8c8c' }}>
                  {route.dept_code || '未设置部门'}
                </span>
              </div>
            ),
          },
          {
            title: '适用产品类别',
            dataIndex: 'product_names',
            width: 200,
            render: (value) => (
              <Tooltip title={value || '未限制产品类别'}>
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value || '未限制产品类别'}
                </div>
              </Tooltip>
            ),
          },
          {
            title: '说明',
            dataIndex: 'description',
            ellipsis: true,
            render: (value) => value || '—',
          },
        ]}
      />
    </Drawer>
  );
}
