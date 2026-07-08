const MOAPI    = 'https://api.jinmilong.cn/api/mo';
const PTHONAPI = 'https://api.quanshenghuoqin.com/api/mo';

Page({
  data: {
    list: [],
    isLoading: false,
    refreshing: false
  },

  onLoad({ mo_code }) {
    this.mo_code_filter = mo_code ? decodeURIComponent(mo_code) : '';
    if (this.mo_code_filter) {
      wx.setNavigationBarTitle({ title: this.mo_code_filter });
    }
    this.loadList();
  },
  onShow() { if (this._loaded) this.loadList(); else this._loaded = true; },

  onTap(e) {
    const { mocode, sortseq, deptcode, categoryname } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `Detailed?mo_code=${mocode}&sort_seq=${sortseq}&dept_code=${deptcode || ''}&category_name=${encodeURIComponent(categoryname || '')}`
    });
  },

  loadList() {
    this.setData({ isLoading: true });
    let orders = null, deptMap = null;

    const merge = () => {
      if (orders === null || deptMap === null) return;
      let list = orders.map(o => ({
        ...o,
        route_name:  deptMap[o.DeptCode] || '',
        exec_status: 'pending'
      }));
      if (this.mo_code_filter) {
        list = list.filter(o => o.MoCode_a === this.mo_code_filter);
      }
      this.setData({ list, isLoading: false, refreshing: false });
      this._loadStatusBatch(list);
    };

    wx.request({
      url: `${MOAPI}/workorder/list`,
      timeout: 15000,
      success: (res) => {
        orders = ((res.data || {}).code === 0) ? (res.data.data || []) : [];
        if ((res.data || {}).code !== 0) {
          wx.showToast({ title: (res.data || {}).msg || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        orders = [];
      },
      complete: merge
    });

    wx.request({
      url: `${PTHONAPI}/route/dept-map`,
      timeout: 10000,
      success: (res) => { deptMap = ((res.data || {}).code === 0) ? res.data.data : {}; },
      fail: () => { deptMap = {}; },
      complete: merge
    });
  },

  _loadStatusBatch(list) {
    if (!list.length) return;
    wx.request({
      url: `${PTHONAPI}/wo-status-batch`,
      method: 'POST',
      timeout: 10000,
      data: {
        items: list.map(o => ({
          mo_code:  o.MoCode_a,
          sort_seq: o.SortSeq_b,
          dept_code: o.DeptCode || '',
          category_name: o.CategoryName || ''
        }))
      },
      success: (res) => {
        if ((res.data || {}).code !== 0) return;
        const statusMap = {};
        for (const s of res.data.data) {
          statusMap[`${s.mo_code}_${s.sort_seq}`] = s;
        }
        const updated = this.data.list.map(o => {
          const s = statusMap[`${o.MoCode_a}_${o.SortSeq_b}`] || {};
          return {
            ...o,
            exec_status:  s.status       || 'pending',
            process_name: s.process_name || ''
          };
        });
        this.setData({ list: updated });
      },
      fail: () => {
        wx.showToast({ title: '状态加载失败', icon: 'none' });
      }
    });
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadList();
  }
});
