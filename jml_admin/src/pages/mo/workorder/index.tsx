import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { App, Button, Input, Select, Space, Tag } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteWoRoute, getRouteList, getWoRouteBindings, getWoStartedKeys,
  getWorkorderList, setWoRoute, setWoRouteBatch,
} from '../service';

type WoItem = {
  MoCode_a: string;
  SortSeq_b: number;
  DeptCode: string;
  cDepName: string;
  cInvName: string;
  InvCode_b: string;
  Qty_b: number;
  // 显式绑定（用户手动指定）
  bound_id?: number;
  bound_name?: string;
  // 部门默认路线
  default_id?: number;
  default_name?: string;
};

const WorkorderPage: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [routes, setRoutes] = useState<any[]>([]);
  const [allData, setAllData] = useState<WoItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [batchRouteId, setBatchRouteId] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRouteList().then(r => { if (r.code === 0) setRoutes(r.data.filter((r: any) => r.is_active)); });
  }, []);

  // 部门编码 → 默认路线（严格精确匹配）
  const deptRouteMap = useMemo(() => {
    const map: Record<string, { id: number; route_name: string }> = {};
    for (const r of routes) {
      if (r.is_default && r.dept_code) map[r.dept_code] = { id: r.id, route_name: r.route_name };
    }
    return map;
  }, [routes]);

  const loadData = async () => {
    const [woRes, bindRes, startedRes] = await Promise.all([
      getWorkorderList(), getWoRouteBindings(), getWoStartedKeys(),
    ]);
    const woList: WoItem[] = woRes.code === 0 ? woRes.data : [];
    const bindMap: Record<string, any> = {};
    if (bindRes.code === 0) {
      for (const b of bindRes.data) bindMap[`${b.mo_code}__${b.sort_seq}`] = b;
    }
    const startedSet = new Set<string>(startedRes.code === 0 ? startedRes.data : []);
    const data = woList
      .filter(w => !startedSet.has(`${w.MoCode_a}__${w.SortSeq_b}`))
      .map(w => {
        const b = bindMap[`${w.MoCode_a}__${w.SortSeq_b}`];
        return { ...w, bound_id: b?.route_id, bound_name: b?.route_name };
      });
    setAllData(data);
    return data;
  };

  // 合并部门默认路线（不改写 bound，仅补充 default）
  const enriched = useMemo<WoItem[]>(() => {
    return allData.map(w => {
      const d = deptRouteMap[w.DeptCode];
      return d ? { ...w, default_id: d.id, default_name: d.route_name } : w;
    });
  }, [allData, deptRouteMap]);

  const filtered = useMemo(() => {
    if (!keyword) return enriched;
    const kw = keyword.toLowerCase();
    return enriched.filter(w =>
      w.MoCode_a?.toLowerCase().includes(kw) ||
      w.cInvName?.toLowerCase().includes(kw) ||
      w.InvCode_b?.toLowerCase().includes(kw)
    );
  }, [enriched, keyword]);

  const refresh = () => loadData();

  const handleSetOne = async (mo_code: string, sort_seq: number, route_id: number) => {
    const res = await setWoRoute({ mo_code, sort_seq, route_id });
    if (res.code === 0) { message.success('指定成功'); refresh(); }
    else message.error(res.msg || '操作失败');
  };

  const handleRemoveOne = async (mo_code: string, sort_seq: number) => {
    const res = await deleteWoRoute({ mo_code, sort_seq });
    if (res.code === 0) { message.success('已取消指定'); refresh(); }
    else message.error(res.msg || '操作失败');
  };

  const handleBatch = async () => {
    if (!batchRouteId) { message.warning('请先选择路线'); return; }
    if (!selectedKeys.length) { message.warning('请先勾选工单'); return; }
    setSaving(true);
    const items = selectedKeys.map(k => {
      const [mo_code, sort_seq] = k.split('__');
      return { mo_code, sort_seq: Number(sort_seq) };
    });
    const res = await setWoRouteBatch({ route_id: batchRouteId, items });
    setSaving(false);
    if (res.code === 0) {
      message.success(`已批量指定 ${items.length} 条`);
      setSelectedKeys([]);
      refresh();
    } else {
      message.error(res.msg || '操作失败');
    }
  };

  const columns: ProColumns<WoItem>[] = [
    { title: '工单号', dataIndex: 'MoCode_a', width: 160 },
    { title: '行号', dataIndex: 'SortSeq_b', width: 70 },
    { title: '部门', dataIndex: 'cDepName', width: 120 },
    { title: '料号', dataIndex: 'InvCode_b', width: 160, ellipsis: true },
    { title: '产品名称', dataIndex: 'cInvName', ellipsis: true },
    { title: '计划数量', dataIndex: 'Qty_b', width: 100 },
    {
      title: '当前路线', width: 180,
      render: (_, r) => {
        // 显式绑定优先，否则显示部门默认
        const name = r.bound_name || r.default_name;
        if (!name) return <Tag color="default">未指定</Tag>;
        return <Tag color={r.bound_name ? 'blue' : 'green'}>{name}</Tag>;
      },
    },
    {
      title: '指定路线', width: 240, valueType: 'option',
      render: (_, r) => (
        <Select
          style={{ width: 200 }}
          placeholder={r.default_name ?? '选择路线'}
          value={r.bound_id}
          allowClear
          onChange={v => {
            if (v) handleSetOne(r.MoCode_a, r.SortSeq_b, v);
            else if (r.bound_id) handleRemoveOne(r.MoCode_a, r.SortSeq_b);
          }}
          options={routes.map(rt => ({ label: rt.route_name, value: rt.id }))}
        />
      ),
    },
  ];

  return (
    <ProTable<WoItem>
      headerTitle="工单路线指定"
      actionRef={actionRef}
      rowKey={(r) => `${r.MoCode_a}__${r.SortSeq_b}`}
      search={false}
      dataSource={filtered}
      request={async () => {
        const data = await loadData();
        return { data, success: true };
      }}
      columns={columns}
      rowSelection={{
        selectedRowKeys: selectedKeys,
        onChange: (keys) => setSelectedKeys(keys as string[]),
      }}
      tableAlertRender={false}
      toolBarRender={() => [
        <Input.Search
          key="search"
          placeholder="搜索工单号 / 料号 / 产品名称"
          allowClear
          style={{ width: 280 }}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={v => setKeyword(v)}
        />,
        <Space key="batch">
          <Select
            style={{ width: 200 }}
            placeholder="批量选择路线"
            value={batchRouteId}
            onChange={setBatchRouteId}
            options={routes.map(r => ({ label: r.route_name, value: r.id }))}
          />
          <Button type="primary" loading={saving}
            disabled={!selectedKeys.length || !batchRouteId}
            onClick={handleBatch}>
            批量指定（{selectedKeys.length}条）
          </Button>
        </Space>,
      ]}
    />
  );
};

export default WorkorderPage;
