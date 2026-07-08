let debounceTimer = null;

Page({
  data: {
    apiBase: 'https://api.quanshenghuoqin.com',

    // 筛选条件
    cinvcode: '',
    ckb: '',
    ptypeOptions: ['全部', '成品', '半成品', '封边带'], // 0/1/2/3
    ptypeIndex: 0,
    companyOptions: ['全部', '金米龙', '科米龙'],        // 0/1/2
    companyIndex: 0,

    // 列表与分页
    list: [],
    page: 1,
    pageSize: 50,
    total: 0,
    loading: false,
    finished: false,

    // 统计
    loadedCount: 0,
    loadedQtySum: '0.00'
  },

  onShow() { this.resetAndSearch(); },
  onUnload() { if (debounceTimer) clearTimeout(debounceTimer); },

  // —— 输入变化：300ms 防抖后查询 ——
  onInputCode(e) {
    this.setData({ cinvcode: (e.detail.value || '').trim() });
    this.debounceReset();
  },
  onInputCkb(e) {
    this.setData({ ckb: (e.detail.value || '').trim() });
    this.debounceReset();
  },

  // —— 下拉变化：立即查询 ——
  onChangePtype(e) { this.setData({ ptypeIndex: Number(e.detail.value) }); this.resetAndSearch(); },
  onChangeCompany(e) { this.setData({ companyIndex: Number(e.detail.value) }); this.resetAndSearch(); },

  debounceReset() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => this.resetAndSearch(), 300);
  },

  resetAndSearch() {
    this.setData({
      list: [],
      page: 1,
      total: 0,
      finished: false,
      loadedCount: 0,
      loadedQtySum: '0.00'
    });
    this.fetchList();
  },

  onReachBottom() {
    if (this.data.loading || this.data.finished) return;
    this.fetchList();
  },

  fetchList() {
    const { apiBase, cinvcode, ckb, ptypeIndex, companyIndex, page, pageSize, list, loading, finished } = this.data;
    if (loading || finished) return;

    // 两个输入都空 => 查全部（后端 LIKE '%')
    const codeParam = cinvcode ? cinvcode : '%';

    const params = {
      cinvcode: codeParam,
      ckb: ckb || '',
      page,
      page_size: pageSize
    };
    if (ptypeIndex > 0) params.ptype = String(ptypeIndex); // '1'|'2'|'3'
    if (companyIndex === 1) params.company = '金米龙';
    if (companyIndex === 2) params.company = '科米龙';

    this.setData({ loading: true });

    wx.request({
      url: `${apiBase}/api/query/stock2`,
      method: 'GET',
      data: params,
      success: (res) => {
        const { code, msg, data } = res.data || {};
        if (code !== 0) {
          wx.showToast({ title: msg || '查询失败', icon: 'none' });
          return;
        }
        let rows = data?.rows || [];
        const total = data?.total || 0;

        // 数量两位小数
        rows = rows.map(r => ({
          ...r,
          qtyDisplay: (Number(r.iQuantity) || 0).toFixed(2)
        }));

        // 兜底：如果后端暂未实现 ptype 筛选，前端按首位过滤
        if (ptypeIndex > 0) {
          const want = String(ptypeIndex);
          rows = rows.filter(r => (r.cInvCode || '').startsWith(want));
        }

        const newList = list.concat(rows);

        // 统计
        const loadedCount = newList.length;
        const loadedQtySum = newList.reduce((sum, r) => sum + (parseFloat(r.qtyDisplay) || 0), 0);

        this.setData({
          list: newList,
          total,
          page: page + 1,
          finished: newList.length >= total,
          loadedCount,
          loadedQtySum: loadedQtySum.toFixed(2)
        });

        if (!newList.length) {
          wx.showToast({ title: '暂无数据', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ loading: false })
    });
  }
});
