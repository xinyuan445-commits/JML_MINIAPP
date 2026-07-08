const API_BASE = 'https://api.quanshenghuoqin.com/api/factory/task';

Page({
  data: {
    tab: 'all',
    currentUserId: '',
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: false
  },

  onShow() {
    const currentUserId = getCurrentUserId();
    this.setData({
      currentUserId,
      page: 1,
      list: [],
      hasMore: true
    });
    this.loadData();
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({
      tab,
      page: 1,
      list: [],
      hasMore: true
    });
    this.loadData();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadData();
    }
  },

  loadData() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });

    const { page, pageSize, tab, currentUserId } = this.data;
    const extra = {};
    if (tab === 'mine' && currentUserId) extra.submit_user_id = currentUserId;
    if (tab === 'todo' && currentUserId) extra.current_approval_user_id = currentUserId;
    
    wx.request({
      url: `${API_BASE}/quality-conversion/list`,
      method: 'GET',
      data: {
          page: page,
          pageSize: pageSize,
          ...extra
      },
      success: (res) => {
        const d = res.data;
        if (d.code === 0 && Array.isArray(d.data)) {
            const listData = d.data;
            if (listData.length < pageSize) {
              this.setData({ hasMore: false });
            }
    
            this.setData({
              list: this.data.list.concat(listData),
              page: page + 1
            });
        } else {
             wx.showToast({ title: d.msg || '加载失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error(err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `./Detailed?id=${id}`
    });
  },

  goAdd() {
    wx.navigateTo({
      url: `./Detailed`
    });
  }
});

function getCurrentUserId() {
  try {
    const userObj = JSON.parse(wx.getStorageSync("userStore") || "{}");
    return userObj.userId || "";
  } catch (e) {
    return "";
  }
}
