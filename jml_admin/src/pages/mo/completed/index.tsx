import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  PictureOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useLocation } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Image,
  Space,
  Spin,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import {
  getCompletedQrCode,
  getCompletedWorkorderDetail,
  getCompletedWorkorderList,
  getRouteList,
} from '../service';
import styles from './index.less';

const { Paragraph, Text, Title } = Typography;

type Worker = {
  user_id?: string;
  user_name: string;
  dept_path?: string;
};

type CompletionRecord = {
  id: number;
  qty_done: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  reason?: string;
  remark?: string;
  operator_name?: string;
  complete_time?: string;
  is_final?: number;
  photos?: string[];
  quality_report_photos?: string[];
};

type WorkRecord = {
  id: number | string;
  status: string;
  is_initial?: boolean;
  operator_name?: string;
  workers?: Worker[];
  qty_input?: number;
  qty_input_a?: number;
  qty_input_a1?: number;
  qty_input_a2?: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  reason?: string;
  complete_remark?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number | null;
  photos?: string[];
  complete_photos?: string[];
  completion_records?: CompletionRecord[];
};

type ProcessRecord = {
  id: number;
  seq: number;
  process_name: string;
  station_name?: string;
  operator_name?: string;
  complete_operator_name?: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number | null;
  qty_done: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  complete_reason?: string;
  print_count: number;
  workers?: Worker[];
  start_photos?: string[];
  complete_photos?: string[];
  completion_records?: CompletionRecord[];
  receive_records?: WorkRecord[];
  rework_records?: WorkRecord[];
};

type CompletedWorkorder = {
  mo_code: string;
  sort_seq: number;
  route_id: number;
  route_name: string;
  workorder_status: string;
  dept_name?: string;
  inv_code?: string;
  inv_name?: string;
  inv_std?: string;
  plan_qty?: number | null;
  unit_name?: string;
  product_category?: string;
  production_department?: string;
  so_code_008?: string;
  so_row_008?: number | null;
  source_account?: string;
  source_so_code?: string;
  customer_code?: string;
  customer_name?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number | null;
  process_count: number;
  done_process_count: number;
  operator_names?: string;
  final_process_name?: string;
  qty_done: number;
  qty_a: number;
  qty_a1: number;
  qty_a2: number;
  qty_c: number;
  print_count: number;
  processes?: ProcessRecord[];
};

const numberText = (value?: number | null) =>
  Number(value || 0).toLocaleString('zh-CN');

const formatDuration = (seconds?: number | null) => {
  if (seconds == null) return '—';
  if (seconds < 60) return '不足1分钟';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}天`);
  if (hours) parts.push(`${hours}小时`);
  if (minutes || parts.length === 0) parts.push(`${minutes}分钟`);
  return parts.join('');
};

const workerText = (workers?: Worker[], fallback?: string) => {
  const names = (workers || [])
    .map((worker) => worker.user_name)
    .filter(Boolean);
  return names.length ? names.join('、') : fallback || '—';
};

const QuantityGrid: React.FC<{
  title?: string;
  total?: number;
  qtyA: number;
  qtyA1: number;
  qtyA2: number;
  qtyC: number;
}> = ({ title, total, qtyA, qtyA1, qtyA2, qtyC }) => (
  <div className={styles.quantityBlock}>
    {title && <Text strong>{title}</Text>}
    <div className={styles.quantityGrid}>
      {total != null && (
        <div className={styles.quantityItem}>
          <span>合计</span>
          <strong>{numberText(total)}</strong>
        </div>
      )}
      {[
        ['A', qtyA],
        ['A1', qtyA1],
        ['A2', qtyA2],
        ['C', qtyC],
      ].map(([label, value]) => (
        <div
          key={label}
          className={`${styles.quantityItem} ${
            label === 'C' && Number(value) > 0 ? styles.gradeC : ''
          }`}
        >
          <span>{label}</span>
          <strong>{numberText(Number(value))}</strong>
        </div>
      ))}
    </div>
  </div>
);

const TimeRow: React.FC<{
  start?: string;
  end?: string;
  duration?: number | null;
}> = ({ start, end, duration }) => (
  <div className={styles.timeRow}>
    <div>
      <span>开始时间</span>
      <strong>{start || '—'}</strong>
    </div>
    <div>
      <span>结束时间</span>
      <strong>{end || '—'}</strong>
    </div>
    <div>
      <span>用时</span>
      <strong>{formatDuration(duration)}</strong>
    </div>
  </div>
);

const PhotoGroup: React.FC<{ title: string; urls?: string[] }> = ({
  title,
  urls,
}) => {
  if (!urls?.length) return null;
  return (
    <div className={styles.photoBlock}>
      <Text type="secondary">{title}</Text>
      <Image.PreviewGroup>
        <div className={styles.photoList}>
          {urls.map((url) => (
            <Image
              key={url}
              alt={title}
              src={url}
              width={88}
              height={66}
              styles={{ image: { objectFit: 'cover' } }}
            />
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  );
};

const CompletionBatch: React.FC<{
  title: string;
  record: CompletionRecord;
}> = ({ title, record }) => (
  <div className={styles.subRecord}>
    <div className={styles.subRecordHeader}>
      <Text strong>{title}</Text>
      <Tag color={record.is_final ? 'success' : 'processing'}>
        {record.is_final ? '全部完工' : '部分完工'}
      </Tag>
    </div>
    <div className={styles.subRecordMeta}>
      <span>完工人员：{record.operator_name || '历史未记录'}</span>
      <span>完工时间：{record.complete_time || '—'}</span>
    </div>
    <QuantityGrid
      title="本批完工"
      total={record.qty_done}
      qtyA={record.qty_a}
      qtyA1={record.qty_a1}
      qtyA2={record.qty_a2}
      qtyC={record.qty_c}
    />
    {(record.reason || record.remark) && (
      <div className={styles.reason}>
        说明：{record.reason || record.remark}
      </div>
    )}
    <div className={styles.photoRow}>
      <PhotoGroup title="质量报告单" urls={record.quality_report_photos} />
      <PhotoGroup title="原完工照片" urls={record.photos} />
    </div>
  </div>
);

const SubRecord: React.FC<{
  title: string;
  tone: 'receive' | 'rework';
  record: WorkRecord;
}> = ({ title, tone, record }) => {
  const statusText = record.is_initial
    ? '已接收'
    : record.status === 'done'
      ? '已完成'
      : '进行中';
  const statusColor = record.is_initial
    ? 'blue'
    : record.status === 'done'
      ? 'success'
      : 'processing';

  return (
    <div className={`${styles.subRecord} ${styles[tone]}`}>
      <div className={styles.subRecordHeader}>
        <Text strong>{title}</Text>
        <Tag color={statusColor}>{statusText}</Tag>
      </div>
      <div className={styles.subRecordMeta}>
        <span>开工人员：{workerText(record.workers)}</span>
      </div>
      <TimeRow
        start={record.start_time}
        end={record.end_time}
        duration={record.duration_seconds}
      />
      {record.qty_input != null && record.qty_input_a != null ? (
        <QuantityGrid
          title={tone === 'receive' ? '接收登记' : '投入登记'}
          total={record.qty_input}
          qtyA={record.qty_input_a}
          qtyA1={record.qty_input_a1 || 0}
          qtyA2={record.qty_input_a2 || 0}
          qtyC={0}
        />
      ) : (
        record.qty_input != null && (
          <div className={styles.singleQuantity}>
            <span>投入数量</span>
            <strong>{numberText(record.qty_input)}</strong>
          </div>
        )
      )}
      {!record.is_initial && (
        <QuantityGrid
          title="完工登记"
          total={record.qty_a + record.qty_a1 + record.qty_a2 + record.qty_c}
          qtyA={record.qty_a}
          qtyA1={record.qty_a1}
          qtyA2={record.qty_a2}
          qtyC={record.qty_c}
        />
      )}
      {(record.reason || record.complete_remark) && (
        <div className={styles.reason}>
          说明：{record.reason || record.complete_remark}
        </div>
      )}
      <div className={styles.photoRow}>
        <PhotoGroup title="作业照片" urls={record.photos} />
        <PhotoGroup
          title="完工照片"
          urls={
            record.completion_records?.length
              ? undefined
              : record.complete_photos
          }
        />
      </div>
      {!!record.completion_records?.length && (
        <div className={styles.subRecordList}>
          {record.completion_records.map((completion, index) => (
            <CompletionBatch
              key={completion.id}
              title={`第 ${index + 1} 批返工完工`}
              record={completion}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProcessCard: React.FC<{
  process: ProcessRecord;
  includeActive?: boolean;
}> = ({ process, includeActive }) => {
  const { message } = App.useApp();
  const [qrVisible, setQrVisible] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState('');

  const toggleQr = async () => {
    if (qrVisible) {
      setQrVisible(false);
      return;
    }
    setQrVisible(true);
    if (qrImage || qrLoading) return;
    setQrLoading(true);
    try {
      const response = await getCompletedQrCode(process.id);
      if (response.code !== 0 || !response.data?.image_data_url) {
        throw new Error(response.msg || '二维码生成失败');
      }
      setQrImage(response.data.image_data_url);
    } catch (error: any) {
      setQrVisible(false);
      message.error(error?.message || '二维码生成失败');
    } finally {
      setQrLoading(false);
    }
  };
  const subRecordItems = [
    ...(process.completion_records?.length
      ? [
          {
            key: 'completion',
            label: `完工批次（${process.completion_records.length}）`,
            children: (
              <div className={styles.subRecordList}>
                {process.completion_records.map((record, index) => (
                  <CompletionBatch
                    key={record.id}
                    title={`第 ${index + 1} 次完工`}
                    record={record}
                  />
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(process.receive_records?.length
      ? [
          {
            key: 'receive',
            label: `接收记录（${process.receive_records.length}）`,
            children: (
              <div className={styles.subRecordList}>
                {process.receive_records.map((record, index) => (
                  <SubRecord
                    key={record.id}
                    title={`第 ${index + 1} 次接收`}
                    tone="receive"
                    record={record}
                  />
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(process.rework_records?.length
      ? [
          {
            key: 'rework',
            label: `返工记录（${process.rework_records.length}）`,
            children: (
              <div className={styles.subRecordList}>
                {process.rework_records.map((record, index) => (
                  <SubRecord
                    key={record.id}
                    title={`第 ${index + 1} 次返工`}
                    tone="rework"
                    record={record}
                  />
                ))}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      size="small"
      className={styles.processCard}
      title={
        <Space>
          <span>
            步骤 {process.seq} · {process.process_name}
          </span>
          <Tag color={process.status === 'done' ? 'success' : 'processing'}>
            {process.status === 'done'
              ? includeActive
                ? '已报工'
                : '已完工'
              : '进行中'}
          </Tag>
        </Space>
      }
      extra={
        <Space size={8}>
          <Text type="secondary">
            <PrinterOutlined /> 标签打印 {process.print_count} 次
          </Text>
          <Button
            type="link"
            size="small"
            icon={<QrcodeOutlined />}
            onClick={toggleQr}
          >
            {qrVisible ? '收起二维码' : '显示二维码'}
          </Button>
        </Space>
      }
    >
      <div className={styles.processBody}>
        <div className={styles.processMain}>
          <div className={styles.processMeta}>
            <span>工站：{process.station_name || '—'}</span>
            <span>
              开工人：
              {workerText(
                process.workers,
                includeActive ? undefined : process.operator_name,
              )}
            </span>
            <span>
              完工人：{process.complete_operator_name || '历史未记录'}
            </span>
          </div>
          <TimeRow
            start={process.start_time}
            end={process.end_time}
            duration={process.duration_seconds}
          />
          <QuantityGrid
            title="完工登记"
            total={process.qty_done}
            qtyA={process.qty_a}
            qtyA1={process.qty_a1}
            qtyA2={process.qty_a2}
            qtyC={process.qty_c}
          />
          {process.complete_reason && (
            <div className={styles.reason}>
              完工说明：{process.complete_reason}
            </div>
          )}
          <div className={styles.photoRow}>
            <PhotoGroup title="开工照片" urls={process.start_photos} />
            <PhotoGroup
              title="完工照片"
              urls={
                process.completion_records?.length
                  ? undefined
                  : process.complete_photos
              }
            />
          </div>
        </div>
        {qrVisible && (
          <div className={styles.processQr}>
            {qrLoading ? (
              <Spin size="small" />
            ) : (
              <img className={styles.qrCode} src={qrImage} alt="工序二维码" />
            )}
            <Text type="secondary">微信扫一扫查看</Text>
          </div>
        )}
      </div>
      {!!subRecordItems.length && (
        <Collapse
          className={styles.subCollapse}
          items={subRecordItems}
          size="small"
        />
      )}
    </Card>
  );
};

const CompletedWorkorderPage: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const defaultStart =
    query.get('start') || dayjs().subtract(29, 'day').format('YYYY-MM-DD');
  const defaultEnd = query.get('end') || dayjs().format('YYYY-MM-DD');
  const [routeOptions, setRouteOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [productDataAvailable, setProductDataAvailable] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CompletedWorkorder | null>(null);
  const [detailIncludesActive, setDetailIncludesActive] = useState(false);

  useEffect(() => {
    getRouteList().then((result) => {
      if (result.code === 0) {
        setRouteOptions(
          (result.data || []).map((route) => ({
            label: route.route_name,
            value: route.id,
          })),
        );
      }
    });
  }, []);

  const openDetail = useCallback(
    async (
      record: Pick<CompletedWorkorder, 'mo_code' | 'sort_seq'>,
      includeActive = false,
    ) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      setDetailIncludesActive(includeActive);
      try {
        const result = await getCompletedWorkorderDetail({
          mo_code: record.mo_code,
          sort_seq: record.sort_seq,
          ...(includeActive ? { include_active: 1 as const } : {}),
        });
        if (result.code !== 0) {
          message.error(result.msg || '工单详情加载失败');
          return;
        }
        setDetail(result.data);
        if (result.meta?.product_data_available === false) {
          setProductDataAvailable(false);
        }
      } catch {
        message.error('工单详情加载失败');
      } finally {
        setDetailLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    const moCode = query.get('mo_code')?.trim();
    const sortSeq = Number(query.get('sort_seq'));
    if (moCode && Number.isInteger(sortSeq) && sortSeq > 0) {
      void openDetail(
        { mo_code: moCode, sort_seq: sortSeq },
        query.get('source') === 'dashboard',
      );
    }
  }, [query, openDetail]);

  const columns: ProColumns<CompletedWorkorder>[] = [
    {
      title: '关键字',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: '工单号、路线或操作人',
        allowClear: true,
      },
    },
    {
      title: '完工日期',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      initialValue: [dayjs(defaultStart), dayjs(defaultEnd)],
      fieldProps: { allowClear: false },
    },
    {
      title: '工艺路线',
      dataIndex: 'route_id',
      valueType: 'select',
      hideInTable: true,
      fieldProps: {
        options: routeOptions,
        showSearch: true,
        optionFilterProp: 'label',
        allowClear: true,
      },
    },
    {
      title: '工单号',
      dataIndex: 'mo_code',
      width: 160,
      fixed: 'left',
      search: false,
      render: (_, record) => (
        <div>
          <Button
            type="link"
            className={styles.workorderLink}
            onClick={(event) => {
              event.stopPropagation();
              openDetail(record);
            }}
          >
            {record.mo_code}
          </Button>
          <Text type="secondary">行号 {record.sort_seq}</Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'workorder_status',
      width: 100,
      search: false,
      render: (_, record) =>
        record.workorder_status === 'done' ? (
          <Tag color="success">整单完工</Tag>
        ) : (
          <Tag color="processing">进行中</Tag>
        ),
    },
    {
      title: '产品',
      dataIndex: 'inv_name',
      width: 260,
      search: false,
      render: (_, record) => (
        <div className={styles.productCell}>
          <Text strong>{record.inv_name || '产品资料暂未获取'}</Text>
          <Text type="secondary">{record.inv_code || '—'}</Text>
          {record.customer_name && (
            <Text type="secondary">{record.customer_name}</Text>
          )}
        </div>
      ),
    },
    {
      title: '工艺路线',
      dataIndex: 'route_name',
      width: 220,
      ellipsis: true,
      search: false,
      render: (_, record) => (
        <div className={styles.productCell}>
          <Text>{record.route_name}</Text>
          <Text type="secondary">
            {record.done_process_count}/{record.process_count} 道工序
          </Text>
        </div>
      ),
    },
    {
      title: '计划数量',
      dataIndex: 'plan_qty',
      width: 100,
      search: false,
      align: 'right',
      render: (_, record) =>
        record.plan_qty == null ? '—' : `${numberText(record.plan_qty)} 件`,
    },
    {
      title: '最近完工数量',
      dataIndex: 'qty_done',
      width: 100,
      search: false,
      align: 'right',
      render: (_, record) => (
        <Text strong>{numberText(record.qty_done)} 件</Text>
      ),
    },
    {
      title: 'A',
      dataIndex: 'qty_a',
      width: 72,
      search: false,
      align: 'right',
      render: (_, record) => numberText(record.qty_a),
    },
    {
      title: 'A1',
      dataIndex: 'qty_a1',
      width: 72,
      search: false,
      align: 'right',
      render: (_, record) => numberText(record.qty_a1),
    },
    {
      title: 'A2',
      dataIndex: 'qty_a2',
      width: 72,
      search: false,
      align: 'right',
      render: (_, record) => numberText(record.qty_a2),
    },
    {
      title: 'C',
      dataIndex: 'qty_c',
      width: 72,
      search: false,
      align: 'right',
      render: (_, record) => (
        <Text type={record.qty_c > 0 ? 'warning' : undefined}>
          {numberText(record.qty_c)}
        </Text>
      ),
    },
    {
      title: '完工人员',
      dataIndex: 'operator_names',
      width: 160,
      ellipsis: true,
      search: false,
      render: (_, record) => record.operator_names || '—',
    },
    {
      title: '总用时',
      dataIndex: 'duration_seconds',
      width: 110,
      search: false,
      render: (_, record) => formatDuration(record.duration_seconds),
    },
    {
      title: '最近完工时间',
      dataIndex: 'end_time',
      width: 170,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            openDetail(record);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <Text className={styles.eyebrow}>生产追溯中心</Text>
          <Title level={2} className={styles.title}>
            完工记录
          </Title>
          <Paragraph className={styles.description}>
            只要工单产生过完工登记即可查询，并可查看已完工工序的数量、人员、时间、照片与返工记录。
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={() => actionRef.current?.reload()}
        >
          刷新记录
        </Button>
      </section>

      {!productDataAvailable && (
        <Alert
          className={styles.notice}
          type="warning"
          showIcon
          message="U8 产品资料暂时不可用"
          description="DB2 完工记录仍可正常查看，产品名称和计划数量将在 U8 恢复后自动补充。"
        />
      )}

      <div ref={scrollRef}>
        <ProTable<CompletedWorkorder>
          actionRef={actionRef}
          className={styles.table}
          rowKey={(record) => `${record.mo_code}-${record.sort_seq}`}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            className: styles.clickableRow,
          })}
          headerTitle={
            <Space>
              <FileDoneOutlined />
              有完工记录的工单
            </Space>
          }
          columns={columns}
          request={async (params) => {
            const dateRange = params.date_range as string[] | undefined;
            const result = await getCompletedWorkorderList({
              current: params.current,
              pageSize: params.pageSize,
              keyword: params.keyword as string | undefined,
              route_id: params.route_id as number | undefined,
              start_date: dateRange?.[0]
                ? dayjs(dateRange[0]).format('YYYY-MM-DD')
                : defaultStart,
              end_date: dateRange?.[1]
                ? dayjs(dateRange[1]).format('YYYY-MM-DD')
                : defaultEnd,
            });
            if (result.code !== 0) {
              message.error(result.msg || '完工记录加载失败');
              return { data: [], success: false, total: 0 };
            }
            setProductDataAvailable(
              result.meta?.product_data_available !== false,
            );
            return {
              data: result.data || [],
              success: true,
              total: result.total || 0,
            };
          }}
          search={{
            labelWidth: 'auto',
            span: { xs: 24, sm: 12, md: 8, lg: 8, xl: 6, xxl: 6 },
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条完工记录`,
          }}
          scroll={{ x: 1700, y: scrollHeight }}
          options={{ density: false, setting: false }}
        />
      </div>

      <Drawer
        title={
          detail
            ? `${detail.mo_code} · 行号 ${detail.sort_seq}`
            : detailIncludesActive
              ? '工单详情'
              : '完工记录详情'
        }
        open={detailOpen}
        size="large"
        loading={detailLoading}
        destroyOnHidden
        onClose={() => setDetailOpen(false)}
      >
        {detail && (
          <div className={styles.detail}>
            <section className={styles.detailHero}>
              <div>
                <Text type="secondary">产品</Text>
                <Title level={4}>{detail.inv_name || '产品资料暂未获取'}</Title>
                <Text type="secondary">{detail.inv_code || '—'}</Text>
              </div>
              <div className={styles.detailMetrics}>
                <Statistic
                  title={
                    detailIncludesActive
                      ? `${detail.final_process_name || '工序'}累计报工`
                      : detail.workorder_status === 'done'
                        ? '最终完工'
                        : '最近完工'
                  }
                  value={detail.qty_done}
                  suffix={detailIncludesActive ? detail.unit_name : '件'}
                  prefix={<CheckCircleOutlined />}
                />
                <Statistic
                  title={detailIncludesActive ? '起止间隔' : '总用时'}
                  value={formatDuration(detail.duration_seconds)}
                  prefix={<ClockCircleOutlined />}
                />
              </div>
            </section>

            <Card className={styles.summaryCard} size="small">
              <Descriptions
                size="small"
                column={3}
                items={[
                  {
                    key: 'route',
                    label: '工艺路线',
                    children: detail.route_name,
                    span: 'filled',
                  },
                  {
                    key: 'department',
                    label: '生产部门',
                    children:
                      detail.production_department || detail.dept_name || '—',
                  },
                  {
                    key: 'plan',
                    label: '计划数量',
                    children:
                      detail.plan_qty == null
                        ? '—'
                        : `${numberText(detail.plan_qty)} ${detailIncludesActive ? detail.unit_name || '' : '件'}`,
                  },
                  {
                    key: 'customer',
                    label: '客户',
                    children: detail.customer_name || '—',
                  },
                  {
                    key: 'sourceOrder',
                    label: '来源销售订单',
                    children: detail.source_so_code
                      ? `${detail.source_so_code}${detail.source_account ? `（${detail.source_account}）` : ''}`
                      : '—',
                  },
                  {
                    key: 'operators',
                    label: '完工人员',
                    children: detail.operator_names || '—',
                  },
                ]}
              />
              <TimeRow
                start={detail.start_time}
                end={detail.end_time}
                duration={detail.duration_seconds}
              />
              <QuantityGrid
                title={
                  detailIncludesActive
                    ? `${detail.final_process_name || '工序'}累计报工登记`
                    : detail.workorder_status === 'done'
                      ? '最终完工登记'
                      : '最近完工登记'
                }
                total={detail.qty_done}
                qtyA={detail.qty_a}
                qtyA1={detail.qty_a1}
                qtyA2={detail.qty_a2}
                qtyC={detail.qty_c}
              />
            </Card>

            <div className={styles.sectionTitle}>
              <div>
                <Title level={4}>工序履历</Title>
                <Text type="secondary">
                  {detailIncludesActive ? '已报工' : '已完工'}{' '}
                  {detail.done_process_count}/{detail.process_count} 道工序
                </Text>
              </div>
            </div>

            <Timeline
              items={(detail.processes || []).map((process) => ({
                color:
                  process.status !== 'done'
                    ? 'blue'
                    : process.qty_c > 0
                      ? 'orange'
                      : 'green',
                dot:
                  process.complete_photos?.length ||
                  process.start_photos?.length ? (
                    <PictureOutlined />
                  ) : undefined,
                content: (
                  <ProcessCard
                    process={process}
                    includeActive={detailIncludesActive}
                  />
                ),
              }))}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default CompletedWorkorderPage;
