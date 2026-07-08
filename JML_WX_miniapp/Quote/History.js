const QUOTEAPI = 'https://api.quanshenghuoqin.com/api/quote';

function money(value) {
  if (value == null) return '';
  const n = Number(value) || 0;
  return (Math.trunc((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

Page({
  data: {
    customer: '',
    list: [],
    loading: false
  },

  onLoad({ customer }) {
    const c = customer ? decodeURIComponent(customer) : '';
    this.setData({ customer: c });
    wx.setNavigationBarTitle({ title: c ? c + ' · 历史报价' : '历史报价' });
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    wx.request({
      url: `${QUOTEAPI}/list`,
      method: 'GET',
      data: { customer: this.data.customer },
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
      complete: () => this.setData({ loading: false })
    });
  },

  onTap(e) {
    wx.navigateTo({ url: `Detailed?id=${e.currentTarget.dataset.id}` });
  }
});
