const PTHONAPI = 'https://api.quanshenghuoqin.com/api/mo';
const MOAPI    = 'https://api.jinmilong.cn/api/mo';

function getUserId() {
  try {
    const e = wx.getStorageSync('userStore');
    if (e) {
      const t = typeof e === 'string' ? JSON.parse(e) : e;
      return (t?.state?.userId ?? t?.userId ?? '').toString();
    }
  } catch (e) {}
  return '';
}

Page({
  data: {
    searchVal: '',
    processingRecs: [],
    doneRecs: [],
    isLoading: false,
    expandedPanels: ['processing']
  },

  onLoad() { this.loadRecords(); },
  onShow() { if (this._loaded) this.loadRecords(); else this._loaded = true; },

  onInput(e) {
    this.setData({ searchVal: e.detail.value });
  },

  onSearch() {
    const val = this.data.searchVal.trim();
    if (!val) {
      wx.showToast({ title: '请输入工单号', icon: 'none' });
      return;
    }
    if (val === 'jml888') {
      wx.navigateTo({ url: 'Index' });
      return;
    }
    wx.navigateTo({ url: `Index?mo_code=${encodeURIComponent(val)}` });
  },

  onScan() {
    wx.scanCode({
      success: (res) => {
        try {
          const data = JSON.parse(res.result);
          const mo_code = (data.mocode || '').trim();
          if (!mo_code) {
            wx.showToast({ title: '二维码无工单号', icon: 'none' });
            return;
          }
          wx.navigateTo({ url: `Index?mo_code=${encodeURIComponent(mo_code)}` });
        } catch {
          wx.showToast({ title: '二维码格式错误', icon: 'none' });
        }
      },
      fail: () => {}
    });
  },

  loadRecords() {
    const userId = getUserId();
    if (!userId) return;
    this.setData({ isLoading: true });

    let myRows = null, woMap = null;

    const merge = () => {
      if (myRows === null || woMap === null) return;
      const records = myRows.map(r => {
        const wo = woMap[`${r.mo_code}_${r.sort_seq}`] || {};
        return {
          ...r,
          inv_code:  wo.InvCode_b || '',
          inv_name:  wo.cInvName  || '',
          category_name: wo.CategoryName || '',
          qty_str:   r.qty_done != null ? String(parseFloat(r.qty_done)) : '0',
          start_str: r.start_time ? r.start_time.substring(11, 16) : '--',
          end_str:   r.end_time   ? r.end_time.substring(11, 16)   : '进行中'
        };
      });
      const processingRecs = records.filter(r => r.status === 'processing');
      const doneRecs       = records.filter(r => r.status === 'done');
      this.setData({ processingRecs, doneRecs, isLoading: false });
    };

    wx.request({
      url: `${PTHONAPI}/my-records`,
      data: { user_id: userId },
      timeout: 10000,
      success: (res) => {
        myRows = ((res.data || {}).code === 0) ? (res.data.data || []) : [];
      },
      fail: () => {
        wx.showToast({ title: '记录加载失败', icon: 'none' });
        myRows = [];
      },
      complete: merge
    });

    wx.request({
      url: `${MOAPI}/workorder/list`,
      timeout: 15000,
      success: (res) => {
        const list = ((res.data || {}).code === 0) ? (res.data.data || []) : [];
        woMap = {};
        for (const o of list) woMap[`${o.MoCode_a}_${o.SortSeq_b}`] = o;
      },
      fail: () => { woMap = {}; },
      complete: merge
    });
  },

  onCollapseChange(e) {
    this.setData({ expandedPanels: e.detail.value });
  },

  onTapRecord(e) {
    const { execid, status, mocode, sortseq, categoryname } = e.currentTarget.dataset;
    const historyParam = status === 'done' ? `&exec_id=${execid}` : '';
    wx.navigateTo({
      url: `Detailed?mo_code=${mocode}&sort_seq=${sortseq}&dept_code=&category_name=${encodeURIComponent(categoryname || '')}${historyParam}`
    });
  }
});
