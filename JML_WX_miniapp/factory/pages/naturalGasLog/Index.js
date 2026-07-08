const naturalGasApi = require('../../api/naturalGasLog.js');

/*
 * 旧版列表完整保留在 Index.legacy.js。
 * 旧版 Java 查询不区分工厂，本页改用按设备关联的新 API。
 */
Page({
  data: {
    factoryOptions: [
      { code: '', name: '全部工厂' },
      { code: 'KML', name: '科米龙' },
      { code: 'JP', name: '金鹏' }
    ],
    factoryIndex: 0,
    factoryName: '全部工厂',
    keyword: '',
    startDate: '',
    endDate: '',
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    finished: false,
    scrolling: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '天然气登记' });
    this.resetAndFetch();
  },

  onShow() {
    if (this.loadedOnce) this.resetAndFetch();
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.resetAndFetch().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.fetchList();
  },

  // 滚动时收缩到右边缘，停止 150ms 后自动展开。
  onPageScroll() {
    clearTimeout(this._scrollTimer);
    if (!this.data.scrolling) this.setData({ scrolling: true });
    this._scrollTimer = setTimeout(() => this.setData({ scrolling: false }), 150);
  },

  onUnload() {
    clearTimeout(this._scrollTimer);
  },

  onFactoryChange(event) {
    const factoryIndex = Number(event.detail.value);
    const factory = this.data.factoryOptions[factoryIndex];
    this.setData({ factoryIndex, factoryName: factory.name });
    this.resetAndFetch();
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  onSearch() {
    this.resetAndFetch();
  },

  onStartDate(event) {
    this.setData({ startDate: event.detail.value });
    this.resetAndFetch();
  },

  onEndDate(event) {
    this.setData({ endDate: event.detail.value });
    this.resetAndFetch();
  },

  clearFilters() {
    this.setData({
      factoryIndex: 0,
      factoryName: '全部工厂',
      keyword: '',
      startDate: '',
      endDate: ''
    });
    this.resetAndFetch();
  },

  resetAndFetch() {
    this.setData({ list: [], page: 1, total: 0, finished: false });
    return this.fetchList();
  },

  async fetchList() {
    if (this.data.loading || this.data.finished) return;
    this.setData({ loading: true });
    const factory = this.data.factoryOptions[this.data.factoryIndex];
    try {
      const result = await naturalGasApi.queryNewPage({
        factory_code: factory.code,
        keyword: this.data.keyword.trim(),
        start_date: this.data.startDate,
        end_date: this.data.endDate,
        page: this.data.page,
        page_size: this.data.pageSize
      });
      const payload = result.data || {};
      const rows = (payload.list || []).map(item => ({
        ...item,
        factoryLabel: `${item.factory_name || ''}（${item.factory_code || ''}）`,
        createdTimeText: this.formatDateTime(item.created_time)
      }));
      this.setData({
        list: this.data.list.concat(rows),
        total: payload.total || 0,
        page: this.data.page + 1,
        finished: Boolean(payload.last_page),
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '列表加载失败', icon: 'none' });
    }
  },

  formatDateTime(value) {
    if (!value) return '';
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]} ${iso[4]}:${iso[5]}:${iso[6]}`;

    // Flask 会把 datetime 输出为 Thu, 02 Jul 2026 10:20:30 GMT。
    // 数据库存的是本地时间，这里只调整展示格式，不再额外换算时区。
    const rfc = text.match(/^[A-Za-z]{3},\s(\d{2})\s([A-Za-z]{3})\s(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
    if (rfc) {
      const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      return `${rfc[3]}-${months[rfc[2]] || rfc[2]}-${rfc[1]} ${rfc[4]}:${rfc[5]}:${rfc[6]}`;
    }
    return text;
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/factory/pages/naturalGasLog/Detailed?id=${event.currentTarget.dataset.id}`
    });
  },

  openCreate() {
    wx.navigateTo({ url: '/factory/pages/naturalGasLog/Edit' });
  }
});
