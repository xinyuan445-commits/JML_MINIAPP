import { PageContainer } from '@ant-design/pro-components';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Input,
  Statistic,
  Table,
  Tabs,
  Tag,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useState } from 'react';
import styles from './index.less';
import {
  type CalculationException,
  type CapacityTask,
  calculateDemand,
  type DemandCalculation,
  type DemandSalesLine,
  getSalesOrders,
  type MaterialRequirement,
  type SalesOrderLine,
  type StationLoad,
  type SupplyDemandRelation,
} from './service';

const numberText = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });

const dateText = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD') : '—';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请重试';

const coreSalesColumns = <T extends SalesOrderLine>(): TableColumnsType<T> => [
  {
    title: '销售订单 / 行号',
    key: 'order',
    width: 180,
    fixed: 'left',
    render: (_, row) => `${row.so_code} · ${row.line_no}`,
  },
  { title: '客户', dataIndex: 'customer_name', width: 180, ellipsis: true },
  {
    title: '产品',
    key: 'product',
    width: 260,
    render: (_, row) => (
      <div>
        <strong>{row.inv_name || row.inv_code}</strong>
        <div className={styles.secondary}>{row.inv_code}</div>
      </div>
    ),
  },
  { title: '订单日期', dataIndex: 'order_date', width: 110, render: dateText },
  { title: '交期', dataIndex: 'due_date', width: 110, render: dateText },
  {
    title: '未交数量',
    dataIndex: 'open_qty',
    width: 110,
    render: (value, row) => `${numberText(value)} ${row.unit_name || ''}`,
  },
  {
    title: '已排生产',
    dataIndex: 'linked_mo_qty',
    width: 110,
    render: numberText,
  },
  { title: '产品类别', dataIndex: 'category_name', width: 210, ellipsis: true },
];

const salesColumns = coreSalesColumns<SalesOrderLine>();

const demandColumns: TableColumnsType<DemandSalesLine> = [
  ...coreSalesColumns<DemandSalesLine>().slice(0, 5),
  { title: '未交数量', dataIndex: 'open_qty', width: 100, render: numberText },
  {
    title: '成品库存抵扣',
    dataIndex: 'stock_allocated',
    width: 115,
    render: numberText,
  },
  {
    title: '生产供应抵扣',
    dataIndex: 'linked_mo_allocated',
    width: 115,
    render: numberText,
  },
  {
    title: '建议生产',
    dataIndex: 'net_production_qty',
    width: 110,
    render: (value) => <strong>{numberText(value)}</strong>,
  },
  {
    title: '试算工单',
    dataIndex: 'suggested_order_no',
    width: 170,
    render: (value) => (value ? <Tag color="blue">{value}</Tag> : '—'),
  },
];

const materialColumns: TableColumnsType<MaterialRequirement> = [
  {
    title: '物料',
    key: 'material',
    width: 280,
    fixed: 'left',
    render: (_, row) => (
      <div>
        <strong>{row.material_name || row.material_code}</strong>
        <div className={styles.secondary}>{row.material_code}</div>
      </div>
    ),
  },
  { title: '需求日期', dataIndex: 'need_date', width: 110 },
  { title: '层级', dataIndex: 'level', width: 70 },
  { title: '毛需求', dataIndex: 'gross_qty', width: 100, render: numberText },
  { title: '安全库存', dataIndex: 'safe_qty', width: 100, render: numberText },
  {
    title: '库存及供应抵扣',
    dataIndex: 'supply_allocated',
    width: 110,
    render: numberText,
  },
  {
    title: '净需求',
    dataIndex: 'net_requirement',
    width: 100,
    render: (value) =>
      value > 0 ? <Tag color="error">{numberText(value)}</Tag> : '0',
  },
  {
    title: '建议数量',
    dataIndex: 'suggested_qty',
    width: 100,
    render: numberText,
  },
  {
    title: '试算单号',
    dataIndex: 'suggested_order_no',
    width: 170,
    render: (value) => (value ? <Tag color="blue">{value}</Tag> : '—'),
  },
  {
    title: '最终结果',
    dataIndex: 'suggestion',
    width: 100,
    render: (value) => (
      <Tag
        color={
          value === '无需下单'
            ? 'green'
            : value === '采购'
              ? 'orange'
              : value === '生产'
                ? 'blue'
                : 'default'
        }
      >
        {value}
      </Tag>
    ),
  },
  { title: '建议下达', dataIndex: 'suggested_release_date', width: 110 },
  {
    title: '来源',
    dataIndex: 'sources',
    width: 180,
    ellipsis: true,
    render: (value: string[]) => value.join('、'),
  },
];

type MaterialSupplyDetail = {
  key: string;
  type: 'inventory' | 'purchase';
  source: string;
  code: string;
  orderDate: string | null;
  supplyDate: string | null;
  quantity: number;
  allocated: number;
  remaining: number;
  unit: string;
  status: string;
  eligible: boolean;
};

const materialSupplyRows = (
  row: MaterialRequirement,
): MaterialSupplyDetail[] => [
  ...row.inventory_details.map((item) => ({
    key: `inventory-${item.warehouse_code}`,
    type: 'inventory' as const,
    source: item.warehouse_name,
    code: item.warehouse_code,
    orderDate: null,
    supplyDate: null,
    quantity: item.on_hand_qty,
    allocated: item.allocated_qty,
    remaining: item.remaining_qty,
    unit: row.unit_name,
    status: '按现存抵扣',
    eligible: true,
  })),
  ...row.open_purchase_orders.map((item) => ({
    key: `purchase-${item.order_no}-${item.line_no}`,
    type: 'purchase' as const,
    source: item.order_no,
    code: `明细 ${item.line_no}`,
    orderDate: item.order_date,
    supplyDate: item.supply_date,
    quantity: item.remaining_qty,
    allocated: item.allocated_qty,
    remaining: item.remaining_after,
    unit: row.unit_name,
    status: item.eligible ? '需求日前到货' : '晚于需求日期',
    eligible: item.eligible,
  })),
];

const materialSupplyColumns: TableColumnsType<MaterialSupplyDetail> = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 100,
    render: (value) =>
      value === 'inventory' ? (
        <Tag color="green">库存</Tag>
      ) : (
        <Tag color="cyan">未收采购单</Tag>
      ),
  },
  {
    title: '仓库 / 采购单',
    key: 'source',
    width: 220,
    render: (_, row) => (
      <div>
        <strong>{row.source}</strong>
        <div className={styles.secondary}>{row.code}</div>
      </div>
    ),
  },
  { title: '单据日期', dataIndex: 'orderDate', width: 110, render: dateText },
  { title: '预计到货', dataIndex: 'supplyDate', width: 110, render: dateText },
  {
    title: '现存 / 未收',
    dataIndex: 'quantity',
    width: 130,
    render: (value, row) => `${numberText(value)} ${row.unit}`,
  },
  {
    title: '本行抵扣',
    dataIndex: 'allocated',
    width: 130,
    render: (value, row) => `${numberText(value)} ${row.unit}`,
  },
  {
    title: '抵扣后余额',
    dataIndex: 'remaining',
    width: 130,
    render: (value, row) => `${numberText(value)} ${row.unit}`,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 190,
    render: (value, row) =>
      row.type === 'purchase' && !row.eligible ? (
        <Tag color="warning">{value}</Tag>
      ) : (
        value
      ),
  },
];

const MaterialRequirementTable: React.FC<{
  rows: MaterialRequirement[];
}> = ({ rows }) => (
  <Table<MaterialRequirement>
    size="small"
    rowKey={(row) => `${row.material_code}-${row.need_date}`}
    columns={materialColumns}
    dataSource={rows}
    scroll={{ x: 1630 }}
    pagination={false}
    expandable={{
      rowExpandable: (row) =>
        row.inventory_details.length > 0 || row.open_purchase_orders.length > 0,
      expandedRowRender: (row) => (
        <Table
          size="small"
          rowKey="key"
          columns={materialSupplyColumns}
          dataSource={materialSupplyRows(row)}
          pagination={false}
          scroll={{ x: 1120 }}
        />
      ),
    }}
  />
);

const capacityLabels: Record<string, { text: string; color?: string }> = {
  finite: { text: '有限产能', color: 'blue' },
  unlimited: { text: '无限产能', color: 'green' },
  unconfigured: { text: '未配置', color: 'default' },
  incomplete: { text: '资料不完整', color: 'warning' },
  unit_mismatch: { text: '单位不一致', color: 'error' },
};

const taskColumns: TableColumnsType<CapacityTask> = [
  {
    title: '计划日期',
    key: 'schedule',
    width: 180,
    fixed: 'left',
    render: (_, row) =>
      row.schedule_start
        ? row.schedule_start === row.schedule_end
          ? row.schedule_start
          : `${row.schedule_start} 至 ${row.schedule_end}`
        : '未排入',
  },
  {
    title: '试算工单',
    dataIndex: 'planned_order_no',
    width: 170,
    render: (value) => (value ? <Tag color="blue">{value}</Tag> : '—'),
  },
  {
    title: '销售订单 / 行号',
    key: 'order',
    width: 180,
    render: (_, row) => `${row.so_code} · ${row.line_no}`,
  },
  { title: '工序', dataIndex: 'process_name', width: 130 },
  { title: '工站', dataIndex: 'station_name', width: 130 },
  { title: '设备', dataIndex: 'device_name', width: 130 },
  {
    title: '任务数量',
    key: 'quantity',
    width: 110,
    render: (_, row) => `${numberText(row.quantity)} ${row.task_unit}`,
  },
  {
    title: '标准产能',
    key: 'capacity',
    width: 140,
    render: (_, row) => {
      const label = capacityLabels[row.capacity_state] || {
        text: row.capacity_state,
      };
      return <Tag color={label.color}>{label.text}</Tag>;
    },
  },
  {
    title: '标准工时',
    dataIndex: 'duration_minutes',
    width: 100,
    render: (value) => (value == null ? '—' : `${numberText(value / 60)}小时`),
  },
  { title: '标准配员', dataIndex: 'staffing', width: 90, render: numberText },
  { title: '交期', dataIndex: 'due_date', width: 110 },
];

const supplyLabels: Record<string, { text: string; color?: string }> = {
  inventory: { text: '现有库存', color: 'green' },
  existing_purchase: { text: '未收采购单', color: 'cyan' },
  existing_production: { text: '现有工单', color: 'geekblue' },
  planned_purchase: { text: '试算采购单', color: 'orange' },
  planned_production: { text: '试算工单', color: 'blue' },
  unresolved: { text: '待确认', color: 'default' },
};

const relationColumns: TableColumnsType<SupplyDemandRelation> = [
  {
    title: '需求',
    key: 'demand',
    width: 230,
    fixed: 'left',
    render: (_, row) => (
      <div>
        <strong>
          {row.demand_order_no}
          {row.demand_line_no ? ` · ${row.demand_line_no}` : ''}
        </strong>
        <div className={styles.secondary}>
          {row.demand_type === 'sales' ? '销售订单' : '生产需求'}
          {row.demand_type !== 'sales' && row.root_sales_order
            ? ` · 来源 ${row.root_sales_order}`
            : ''}
        </div>
      </div>
    ),
  },
  {
    title: '物料',
    key: 'item',
    width: 260,
    render: (_, row) => (
      <div>
        <strong>{row.item_name || row.item_code}</strong>
        <div className={styles.secondary}>{row.item_code}</div>
      </div>
    ),
  },
  { title: '需求日期', dataIndex: 'demand_date', width: 110, render: dateText },
  {
    title: '供应',
    key: 'supply',
    width: 310,
    render: (_, row) => (
      <div>
        <Tag color={supplyLabels[row.supply_type]?.color}>
          {supplyLabels[row.supply_type]?.text || row.supply_type}
        </Tag>
        <strong>{row.supply_order_no}</strong>
        {row.supply_line_no ? ` · ${row.supply_line_no}` : ''}
        {row.supply_location ? (
          <div className={styles.secondary}>{row.supply_location}</div>
        ) : null}
      </div>
    ),
  },
  {
    title: '供应日期',
    key: 'dates',
    width: 180,
    render: (_, row) => (
      <div>
        <span>{dateText(row.supply_date)}</span>
        {row.supply_order_date ? (
          <div className={styles.secondary}>
            单据 {dateText(row.supply_order_date)}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    title: '分配数量',
    key: 'quantity',
    width: 130,
    render: (_, row) => `${numberText(row.quantity)} ${row.unit_name}`,
  },
];

const loadColumns: TableColumnsType<StationLoad> = [
  { title: '日期', dataIndex: 'date', width: 110 },
  { title: '工站', dataIndex: 'station_name', width: 160 },
  {
    title: '需求工时',
    dataIndex: 'used_minutes',
    width: 110,
    render: (value) => `${numberText(value / 60)}小时`,
  },
  {
    title: '可用工时',
    dataIndex: 'available_minutes',
    width: 110,
    render: (value) => `${numberText(value / 60)}小时`,
  },
  {
    title: '负荷率',
    dataIndex: 'load_percent',
    width: 100,
    render: (value) => `${numberText(value)}%`,
  },
];

const exceptionColumns: TableColumnsType<CalculationException> = [
  { title: '类型', dataIndex: 'type', width: 100 },
  { title: '来源', dataIndex: 'source', width: 220 },
  { title: '说明', dataIndex: 'message' },
];

const DemandCalculationPage: React.FC = () => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<SalesOrderLine[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DemandCalculation>();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSalesOrders({
        start_date: range[0].format('YYYY-MM-DD'),
        end_date: range[1].format('YYYY-MM-DD'),
        keyword: keyword.trim() || undefined,
      });
      setRows(data);
      setResult(undefined);
      setSelectedKeys((keys) =>
        keys.filter((key) => data.some((row) => row.line_id === key)),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const calculate = async () => {
    setCalculating(true);
    setError('');
    try {
      setResult(
        await calculateDemand(
          selectedKeys.map(Number),
          dayjs().format('YYYY-MM-DD'),
        ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <PageContainer title="需求计算">
      <Alert
        className={styles.notice}
        type="info"
        showIcon
        title="本页只做试算，不保存或回写ERP。"
      />
      {error && <Alert className={styles.notice} type="error" title={error} />}
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <span className={styles.fieldLabel}>订单日期</span>
          <DatePicker.RangePicker
            value={range}
            allowClear={false}
            onChange={(dates) => dates && setRange(dates as [Dayjs, Dayjs])}
          />
          <Input.Search
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void load()}
            placeholder="订单号、客户或产品"
            allowClear
            className={styles.search}
          />
          <Button onClick={() => void load()} loading={loading}>
            查询
          </Button>
          <Button
            type="primary"
            disabled={!selectedKeys.length}
            loading={calculating}
            onClick={() => void calculate()}
          >
            试算选中（{selectedKeys.length}）
          </Button>
        </div>
        <Table<SalesOrderLine>
          size="small"
          rowKey="line_id"
          columns={salesColumns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1370, y: 430 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            preserveSelectedRowKeys: false,
            onChange: (keys) => {
              setSelectedKeys(keys);
              setResult(undefined);
            },
          }}
          pagination={false}
        />
      </section>

      {result && (
        <section className={styles.results}>
          <div className={styles.summary}>
            <Statistic title="销售订单行" value={result.summary.sales_lines} />
            <Statistic
              title="需生产订单行"
              value={result.summary.production_lines}
              suffix="行"
            />
            <Statistic
              title="物料缺口"
              value={result.summary.material_shortages}
              suffix="项"
            />
            <Statistic
              title="已排工序"
              value={result.summary.scheduled_tasks}
              suffix="项"
            />
            <Statistic
              title="待处理异常"
              value={result.summary.exceptions}
              suffix="项"
            />
          </div>
          <Tabs
            items={[
              {
                key: 'sales',
                label: `生产需求 ${result.sales.length}`,
                children: (
                  <Table
                    size="small"
                    rowKey="line_id"
                    columns={demandColumns}
                    dataSource={result.sales}
                    scroll={{ x: 1420 }}
                    pagination={false}
                  />
                ),
              },
              {
                key: 'materials',
                label: `物料需求 ${result.materials.length}`,
                children: (
                  <div className={styles.tables}>
                    <MaterialRequirementTable
                      rows={result.materials.filter(
                        (row) => row.suggestion !== '无需下单',
                      )}
                    />
                    {result.materials.some(
                      (row) => row.suggestion === '无需下单',
                    ) && (
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: 'no-order',
                            label: `无需下单 ${result.materials.filter((row) => row.suggestion === '无需下单').length} 项`,
                            children: (
                              <MaterialRequirementTable
                                rows={result.materials.filter(
                                  (row) => row.suggestion === '无需下单',
                                )}
                              />
                            ),
                          },
                        ]}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'relations',
                label: `供需关系 ${result.relations.length}`,
                children: (
                  <Table
                    size="small"
                    rowKey="key"
                    columns={relationColumns}
                    dataSource={result.relations}
                    scroll={{ x: 1220 }}
                    pagination={false}
                  />
                ),
              },
              {
                key: 'schedule',
                label: `设备排程 ${result.tasks.length}`,
                children: (
                  <div className={styles.tables}>
                    <Table
                      size="small"
                      rowKey="key"
                      columns={loadColumns}
                      dataSource={result.station_loads}
                      pagination={false}
                    />
                    <Table
                      size="small"
                      rowKey="key"
                      columns={taskColumns}
                      dataSource={result.tasks}
                      scroll={{ x: 1520 }}
                      pagination={false}
                    />
                  </div>
                ),
              },
              {
                key: 'exceptions',
                label: `异常 ${result.exceptions.length}`,
                children: (
                  <Table
                    size="small"
                    rowKey={(row) => `${row.type}-${row.source}-${row.message}`}
                    columns={exceptionColumns}
                    dataSource={result.exceptions}
                    pagination={false}
                  />
                ),
              },
            ]}
          />
        </section>
      )}
    </PageContainer>
  );
};

export default DemandCalculationPage;
