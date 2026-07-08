const QUOTEAPI = 'https://api.quanshenghuoqin.com/api/quote';

function money(value) {
  if (value == null) return '';
  const n = Number(value) || 0;
  return (Math.trunc((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

Page({
  data: {
    keyword: '',
    startDate: '',
    endDate: '',
    categoryNames: ['全部'],   // 下拉显示，0=全部
    categoryCodes: [''],       // 与 categoryNames 对齐的 code
    categoryIndex: 0,
    list: [],
    loading: false
  },

  onLoad() {
    this.loadCategories();
    this.loadList();
  },

  onShow() {
    // 从新增/详情返回时刷新
    if (this._loaded) this.loadList(); else this._loaded = true;
  },

  onPullDownRefresh() {
    this.loadList(() => wx.stopPullDownRefresh());
  },

  loadCategories() {
    wx.request({
      url: `${QUOTEAPI}/category/list`,
      method: 'GET',
      success: (res) => {
        const { code, data } = res.data || {};
        if (code !== 0) return;
        const list = data || [];
        this.setData({
          categoryNames: ['全部'].concat(list.map(c => c.name)),
          categoryCodes: [''].concat(list.map(c => c.code))
        });
      }
    });
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(this._kwTimer);
    this._kwTimer = setTimeout(() => this.loadList(), 400);
  },
  onSearch() { clearTimeout(this._kwTimer); this.loadList(); },

  onStartDate(e) { this.setData({ startDate: e.detail.value }, () => this.loadList()); },
  onEndDate(e) { this.setData({ endDate: e.detail.value }, () => this.loadList()); },

  onCategoryFilter(e) {
    this.setData({ categoryIndex: +e.detail.value }, () => this.loadList());
  },

  onReset() {
    this.setData({ keyword: '', startDate: '', endDate: '', categoryIndex: 0 }, () => this.loadList());
  },

  loadList(done) {
    const d = this.data;
    this.setData({ loading: true });
    wx.request({
      url: `${QUOTEAPI}/list`,
      method: 'GET',
      data: {
        keyword: d.keyword.trim(),
        start_date: d.startDate,
        end_date: d.endDate,
        category_code: d.categoryCodes[d.categoryIndex] || ''
      },
      timeout: 15000,
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0) {
          wx.showToast({ title: msg || '加载失败', icon: 'none' });
          this.setData({ list: [] });
          return;
        }
        const list = (data || []).map(r => ({
          ...r,
          direct_price_text: money(r.direct_price_incl_tax),
          dealer_price_text: money(r.dealer_price_incl_tax)
        }));
        this.setData({ list });
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => {
        this.setData({ loading: false });
        if (done) done();
      }
    });
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `Detailed?id=${id}` });
  },

  goAdd() {
    wx.navigateTo({ url: 'Edit' });
  }
});
