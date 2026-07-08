Page({
  data: {
    position: "",
    list: [],
    page: 1,
    pageSize: 20,   // ✅ 默认 20 条
    total: 0,
    hasMore: false,
    loading: false,
    queried: false
  },

  onPositionInput(e) {
    this.setData({ position: e.detail.value });
  },

  onQuery() {
    if (!this.data.position) {
      wx.showToast({
        title: "请输入货位",
        icon: "none"
      });
      return;
    }

    this.setData({
      list: [],
      page: 1,
      queried: true,
      hasMore: true
    });

    this.fetchData();
  },

  // ✅ 触底加载
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1
    });

    this.fetchData();
  },

  fetchData() {
    const { position, page, pageSize, list } = this.data;

    this.setData({ loading: true });

    wx.request({
      url: "https://api.quanshenghuoqin.com/api/query/stock/by-position",
      method: "GET",
      data: {
        position,
        page,
        page_size: pageSize
      },
      success: (res) => {
        if (res.data.code !== 0) {
          wx.showToast({
            title: res.data.msg || "查询失败",
            icon: "none"
          });
          return;
        }

        const newList = res.data.data || [];
        const total = res.data.total || 0;
        const mergedList = list.concat(newList);

        this.setData({
          list: mergedList,
          total,
          hasMore: mergedList.length < total
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  }
});
