const API_BASE = 'https://api.quanshenghuoqin.com/api/mo';

Page({
  data: {
    menus: []
  },

  onShow() {
    this.loadMenus();
  },

  loadMenus() {
    wx.showLoading({ title: '加载中', mask: true });
    wx.request({
      url: `${API_BASE}/menu`,
      method: 'GET',
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0) {
          wx.showToast({ title: msg || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ menus: data || [] });
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => wx.hideLoading()
    });
  },

  goPage(e) {
    const path = e.currentTarget.dataset.path;
    wx.navigateTo({ url: path });
  }
});
