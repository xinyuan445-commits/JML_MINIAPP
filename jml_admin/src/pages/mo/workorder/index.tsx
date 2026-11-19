import {
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { App, Button, Input, Tag, Tooltip } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useViewportScrollHeight } from '@/hooks/useViewportScrollHeight';
import {
  deleteWoRoute,
  getProductCategoryList,
  getRouteList,
  getWoRouteBindings,
  getWorkorderList,
  getWoStartedKeys,
  setWoRoute,
  setWoRouteBatch,
} from '../service';
import RoutePickerDrawer from './RoutePickerDrawer';
import type { RouteOption } from './routePickerModel';

type WoItem = {
  MoCode_a: string;
  SortSeq_b: number;
  DeptCode: string;
  cDepName: string;
  cInvName: string;
  InvCode_b: string;
  Qty_b: number;
  CategoryName?: string;
  // 显式绑定（用户手动指定）
  bound_id?: number;
  bound_name?: string;
  // 产品类别自动匹配路线
  auto_id?: number;
  auto_name?: string;
};

type RoutePickerTarget =
  | { mode: 'single'; record: WoItem }
  | { mode: 'batch' };

const WorkorderPage: React.FC = () => {
  const access = useAccess();
  const canEdit = access.can('workorder.edit');
  const canRemove = access.can('workorder.remove');
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { scrollRef, scrollHeight } = useViewportScrollHeight();
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [productCategories, setProductCategories] = useState<
    { code: string; name: string }[]
  >([]);
  const [allData, setAllData] = useState<WoItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [pickerTarget, setPickerTarget] = useState<RoutePickerTarget>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRouteList(false, true).then((result) => {
      if (result.code === 0)
        setRoutes(result.data.filter((route: RouteOption & { is_active: number }) => route.is_active));
    });
    getProductCategoryList().then((result) => {
      if (result.code === 0) setProductCategories(result.data);
    });
  }, []);

  useEffect(() => {
    if (!pickerTarget) return;
    getRouteList(false, true).then((result) => {
      if (result.code === 0)
        setRoutes(result.data.filter((route: RouteOption & { is_active: number }) => route.is_active));
    });
  }, [pickerTarget]);

  // 产品类别编码 → 自动生产路线
  const productRouteMap = useMemo(() => {
    const map: Record<string, { id: number; route_name: string }> = {};
    for (const r of routes) {
      for (const code of r.default_product_codes || []) {
        map[code] = { id: r.id, route_name: r.route_name };
      }
    }
    return map;
  }, [routes]);

  const categoryCodeByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of productCategories) map[c.name.trim()] = c.code;
    return map;
  }, [productCategories]);

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

  // 合并产品类别自动路线（不改写手工绑定）
  const enriched = useMemo<WoItem[]>(() => {
    return allData.map(w => {
      const categoryCode = categoryCodeByName[(w.CategoryName || '').trim()];
      const route = categoryCode ? productRouteMap[categoryCode] : undefined;
      return route ? { ...w, auto_id: route.id, auto_name: route.route_name } : w;
    });
  }, [allData, categoryCodeByName, productRouteMap]);

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

  const handleSetOne = async (
    mo_code: string,
    sort_seq: number,
    route_id: number,
  ) => {
    if (!canEdit) return false;
    setSaving(true);
    const res = await setWoRoute({ mo_code, sort_seq, route_id });
    setSaving(false);
    if (res.code === 0) {
      message.success('指定成功');
      await refresh();
      return true;
    }
    message.error(res.msg || '操作失败');
    return false;
  };

  const handleRemoveOne = async (mo_code: string, sort_seq: number) => {
    if (!canRemove) return;
    const res = await deleteWoRoute({ mo_code, sort_seq });
    if (res.code === 0) { message.success('已恢复默认路线'); refresh(); }
    else message.error(res.msg || '操作失败');
  };

  const handleRestoreDefault = (record: WoItem) => {
    if (!canRemove || !record.bound_id) return;
    modal.confirm({
      title: '恢复默认路线？',
      content: record.auto_name
        ? `将取消手工指定的“${record.bound_name}”，恢复为“${record.auto_name}”。`
        : `将取消手工指定的“${record.bound_name}”。当前产品类别没有匹配到默认路线。`,
      okText: '恢复默认',
      cancelText: '取消',
      onOk: () => handleRemoveOne(record.MoCode_a, record.SortSeq_b),
    });
  };

  const handleBatch = async (routeId: number) => {
    if (!canEdit) return false;
    if (!selectedKeys.length) {
      message.warning('请先勾选工单');
      return false;
    }
    setSaving(true);
    const items = selectedKeys.map((key) => {
      const [mo_code, sort_seq] = key.split('__');
      return { mo_code, sort_seq: Number(sort_seq) };
    });
    const res = await setWoRouteBatch({ route_id: routeId, items });
    setSaving(false);
    if (res.code === 0) {
      message.success(`已批量指定 ${items.length} 条`);
      setSelectedKeys([]);
      await refresh();
      return true;
    }
    message.error(res.msg || '操作失败');
    return false;
  };

  const pickerRecords = useMemo(() => {
    if (!pickerTarget) return [];
    if (pickerTarget.mode === 'single') return [pickerTarget.record];
    const keys = new Set(selectedKeys);
    return enriched.filter((record) =>
      keys.has(`${record.MoCode_a}__${record.SortSeq_b}`),
    );
  }, [enriched, pickerTarget, selectedKeys]);

  const pickerDeptCode = useMemo(() => {
    const values = new Set(pickerRecords.map((record) => record.DeptCode).filter(Boolean));
    return values.size === 1 ? [...values][0] : undefined;
  }, [pickerRecords]);

  const pickerCategoryCode = useMemo(() => {
    const values = new Set(
      pickerRecords
        .map(
          (record) =>
            categoryCodeByName[(record.CategoryName || '').trim()],
        )
        .filter(Boolean),
    );
    return values.size === 1 ? [...values][0] : undefined;
  }, [categoryCodeByName, pickerRecords]);

  const columns: ProColumns<WoItem>[] = [
    { title: '工单号', dataIndex: 'MoCode_a', width: 160 },
    { title: '行号', dataIndex: 'SortSeq_b', width: 70 },
    { title: '部门', dataIndex: 'cDepName', width: 120 },
    { title: '料号', dataIndex: 'InvCode_b', width: 160, ellipsis: true },
    { title: '产品名称', dataIndex: 'cInvName', ellipsis: true },
    { title: '产品类别', dataIndex: 'CategoryName', width: 200, ellipsis: true, render: (_, r) => r.CategoryName || '-' },
    { title: '计划数量', dataIndex: 'Qty_b', width: 100 },
    {
      title: '当前路线', width: 220,
      render: (_, r) => {
        const name = r.bound_name || r.auto_name;
        if (!name) return <Tag color="default">无匹配路线</Tag>;
        return (
          <div
            onDoubleClick={() => handleRestoreDefault(r)}
            style={{ cursor: canRemove && r.bound_name ? 'pointer' : 'default', userSelect: 'none' }}
          >
            <Tooltip title={canRemove && r.bound_name ? `${name}（双击恢复默认路线）` : name}>
              <Tag
                color={r.bound_name ? 'blue' : 'green'}
                style={{ display: 'block', maxWidth: '100%', marginInlineEnd: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {name}
              </Tag>
            </Tooltip>
            {canRemove && r.bound_name && (
              <div style={{ marginTop: 3, fontSize: 12, color: '#8c8c8c' }}>↺ 双击恢复默认</div>
            )}
          </div>
        );
      },
    },
    {
      title: '指定路线', width: 120, valueType: 'option',
      hideInTable: !canEdit,
      render: (_, r) => (
        <Button
          type="link"
          onClick={() => setPickerTarget({ mode: 'single', record: r })}
        >
          {r.bound_id ? '重新指定' : '选择路线'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <div ref={scrollRef}>
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
        rowSelection={
          canEdit
            ? {
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys as string[]),
              }
            : false
        }
        tableAlertRender={false}
        toolBarRender={() => [
          <Input.Search
            key="search"
            placeholder="搜索工单号 / 料号 / 产品名称"
            allowClear
            style={{ width: 280 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
          />,
          canEdit && (
            <Button
              key="batch"
              type="primary"
              disabled={!selectedKeys.length}
              onClick={() => setPickerTarget({ mode: 'batch' })}
            >
              选择路线并批量指定（{selectedKeys.length}条）
            </Button>
          ),
        ]}
        scroll={{ x: 1200, y: scrollHeight }}
      />
      </div>
      <RoutePickerDrawer
        open={Boolean(pickerTarget)}
        routes={routes}
        productCategories={productCategories}
        initialRouteId={
          pickerTarget?.mode === 'single'
            ? pickerTarget.record.bound_id || pickerTarget.record.auto_id
            : undefined
        }
        preferredDeptCode={pickerDeptCode}
        preferredCategoryCode={pickerCategoryCode}
        contextText={
          pickerTarget?.mode === 'single'
            ? `工单 ${pickerTarget.record.MoCode_a} / 行 ${pickerTarget.record.SortSeq_b} · ${pickerTarget.record.cInvName} · ${pickerTarget.record.CategoryName || '未标产品类别'}`
            : `已选择 ${pickerRecords.length} 条工单`
        }
        confirmLoading={saving}
        onClose={() => setPickerTarget(undefined)}
        onConfirm={async (routeId) => {
          const success =
            pickerTarget?.mode === 'single'
              ? await handleSetOne(
                  pickerTarget.record.MoCode_a,
                  pickerTarget.record.SortSeq_b,
                  routeId,
                )
              : await handleBatch(routeId);
          if (success) setPickerTarget(undefined);
        }}
      />
    </>
  );
};

export default WorkorderPage;
