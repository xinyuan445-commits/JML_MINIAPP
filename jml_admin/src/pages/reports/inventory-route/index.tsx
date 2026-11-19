import { PageContainer } from '@ant-design/pro-components';
import { request } from '@umijs/max';
import { Alert, App, Button, Input, Switch, Table, Tabs, type TableColumnsType } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

type InventoryMaterial = {
  code: string;
  prefix: string;
  name: string;
  spec: string;
  product_type: string;
};

type RouteGroup = {
  product_type: string;
  total: number;
  route_name: string;
  route_steps: string[];
};

type RouteVersion = {
  id: number;
  name: string;
  active: boolean;
  steps: string[];
};

type MaterialPage = {
  rows: InventoryMaterial[];
  total: number;
  page: number;
  summaries?: Record<string, { total: number; routes: RouteVersion[] }>;
};

const groupColumns: TableColumnsType<RouteGroup> = [
  { title: '产品类型', dataIndex: 'product_type', width: 260 },
  { title: '料号数', dataIndex: 'total', width: 100, align: 'right', render: (total: number) => total.toLocaleString('zh-CN') },
  { title: '路线名称', dataIndex: 'route_name', width: 300 },
  { title: '路线内容', dataIndex: 'route_steps', render: (steps: string[]) => steps.join(' → ') || '—' },
];

function renderRouteVersions(routes: RouteVersion[]) {
  if (!routes.length) return '未配置';
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
      {routes.map((route) => {
        const content = <>
          <strong>{route.name}</strong>
          {route.steps.length > 0 && <span style={{ marginInlineStart: 12 }}>{route.steps.join(' → ')}</span>}
        </>;
        return <li key={route.id}>{route.active ? content : <><del>{content}</del>（停用）</>}</li>;
      })}
    </ul>
  );
}

const materialColumns: TableColumnsType<InventoryMaterial> = [
  { title: '料号', dataIndex: 'code', width: 215 },
  { title: '料号前两位', dataIndex: 'prefix', width: 100 },
  { title: '物料名称', dataIndex: 'name', width: 245 },
  { title: '规格型号', dataIndex: 'spec', width: 160, render: (value: string) => value || '—' },
];

function useInventoryReport<T>(query: Record<string, string | number>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    request<{ data: T }>('/api/mo/inventory-route-report', {
      params: query, signal: controller.signal, skipErrorHandler: true,
    }).then(({ data: result }) => {
      if (!controller.signal.aborted) setData(result);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setData(undefined);
        setError('料号工艺路线读取失败，请重试');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [query]);

  return { data, loading, error };
}

function ExportExcelButton({ edition, keyword, onlyUnconfigured = false }: {
  edition: 1 | 2;
  keyword: string;
  onlyUnconfigured?: boolean;
}) {
  const { message } = App.useApp();
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const params: Record<string, string | number> = {
        format: 'xlsx', view: edition === 1 ? 'groups' : 'materials-with-routes', keyword,
      };
      if (edition === 1) params.only_unconfigured = onlyUnconfigured ? 1 : 0;
      const blob = await request<Blob>('/api/mo/inventory-route-report', {
        params, responseType: 'blob', timeout: 90000, skipErrorHandler: true,
      });
      if (blob.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error('Excel 下载响应无效');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = edition === 1 ? '料号工艺路线_第一版.xlsx' : '料号工艺路线_第二版.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      message.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  }

  return <Button loading={exporting} onClick={exportExcel}>导出 Excel</Button>;
}

function MaterialDetails({ productType, keyword }: { productType?: string; keyword: string }) {
  const showRoutes = productType === undefined;
  const [pagination, setPagination] = useState({ page: 1, page_size: 20 });
  const query = useMemo(() => {
    const params: Record<string, string | number> = { keyword, ...pagination };
    if (productType === undefined) params.view = 'materials-with-routes';
    else params.product_type = productType;
    return params;
  }, [keyword, productType, pagination]);
  const { data, loading, error } = useInventoryReport<MaterialPage>(query);
  const rows = data?.rows ?? [];
  const summaryCell = (row: InventoryMaterial, index = 0) => {
    if (rows[index - 1]?.product_type === row.product_type) return { rowSpan: 0 };
    let end = index + 1;
    while (rows[end]?.product_type === row.product_type) end += 1;
    return { rowSpan: end - index, style: { verticalAlign: 'top' } };
  };
  const columns: TableColumnsType<InventoryMaterial> = showRoutes ? [
    ...materialColumns,
    { title: '产品类型', dataIndex: 'product_type', width: 210 },
    {
      title: '料号数', width: 100, align: 'right', onCell: summaryCell,
      render: (_, row) => data?.summaries?.[row.product_type]?.total.toLocaleString('zh-CN'),
    },
    {
      title: '工艺路线（含停用）', onCell: summaryCell,
      render: (_, row) => renderRouteVersions(data?.summaries?.[row.product_type]?.routes ?? []),
    },
  ] : materialColumns;

  return <>
    {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
    <Table rowKey="code" size="small" columns={columns} dataSource={rows} loading={loading}
      scroll={{ x: showRoutes ? 1390 : 720 }} sticky={showRoutes}
      pagination={{
        current: data?.page ?? pagination.page, pageSize: pagination.page_size, total: data?.total ?? 0,
        showSizeChanger: true, pageSizeOptions: [20, 50, 100],
        showTotal: (total) => `共 ${total.toLocaleString('zh-CN')} 个料号`,
        onChange: (page, size) => setPagination((current) => ({
          page: size === current.page_size ? page : 1, page_size: size,
        })),
      }} />
  </>;
}

function RouteGroups() {
  const [keyword, setKeyword] = useState('');
  const [onlyUnconfigured, setOnlyUnconfigured] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<readonly React.Key[]>([]);
  const query = useMemo(() => ({
    view: 'groups', keyword, only_unconfigured: onlyUnconfigured ? 1 : 0,
  }), [keyword, onlyUnconfigured]);
  const { data, loading, error } = useInventoryReport<{ rows: RouteGroup[] }>(query);
  const rows = data?.rows ?? [];
  const total = rows.reduce((count, row) => count + row.total, 0);

  return <>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12 }}>
      <Input.Search aria-label="搜索料号工艺路线" placeholder="料号、物料名称或产品类型" enterButton="查询" allowClear
        onSearch={(value) => {
          setKeyword(value.trim());
          setExpandedTypes([]);
        }}
        style={{ width: 'min(100%, 380px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch id="inventory-route-unconfigured" checked={onlyUnconfigured} onChange={(checked) => {
          setOnlyUnconfigured(checked);
          setExpandedTypes([]);
        }} />
        <label htmlFor="inventory-route-unconfigured">只看未配置</label>
      </div>
      <ExportExcelButton edition={1} keyword={keyword} onlyUnconfigured={onlyUnconfigured} />
    </div>
    {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
    <Table rowKey="product_type" size="small" columns={groupColumns} dataSource={rows} loading={loading}
      scroll={{ x: 950 }} sticky pagination={false}
      footer={data && (() => `共 ${rows.length} 种产品类型，${total.toLocaleString('zh-CN')} 个料号`)}
      expandable={{
        expandedRowKeys: expandedTypes,
        onExpandedRowsChange: setExpandedTypes,
        expandedRowRender: (row, _index, _indent, expanded) => expanded
          ? <MaterialDetails productType={row.product_type} keyword={keyword} />
          : null,
      }} />
  </>;
}

function RoutesByMaterial() {
  const [keyword, setKeyword] = useState('');
  return <>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 12 }}>
      <Input.Search aria-label="搜索料号工艺路线" placeholder="料号、物料名称或产品类型" enterButton="查询" allowClear
        onSearch={(value) => setKeyword(value.trim())}
        style={{ width: 'min(100%, 380px)' }} />
      <ExportExcelButton edition={2} keyword={keyword} />
    </div>
    <MaterialDetails key={keyword} keyword={keyword} />
  </>;
}

export default function InventoryRouteReport() {
  return <PageContainer title="料号工艺路线">
    <Tabs items={[
      { key: 'default', label: '第一版', children: <RouteGroups /> },
      { key: 'all', label: '第二版', children: <RoutesByMaterial /> },
    ]} />
  </PageContainer>;
}
