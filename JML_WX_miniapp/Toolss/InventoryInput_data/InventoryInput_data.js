Page({
  data: {
    userId: "",        // 从上个页面带进来
    date: "",          // 默认当天
    pos: "",           // 货位
    page: 1,
    pageSize: 20,
    total: 0,
    records: [],
    loading: false,
    noMore: false
  },
  // 触底自动加载下一页
  onReachBottom() {
    if (this.data.noMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1
    });

    this.loadData();
  },
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
  
    wx.showModal({
      title: "确认删除",
      content: "确定要删除这条记录吗？",
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(id);
        }
      }
    });
  },
  deleteRecord(id) {
    wx.request({
      url: "https://api.quanshenghuoqin.com/api/query/checkvouch/delete",
      method: "DELETE",
      data: { id },
  
      success: (res) => {
        if (res.data.code === 0) {
          wx.showToast({ title: "删除成功" });
  
          // 从前端 UI 移除记录
          const newList = this.data.records.filter(item => item.id !== id);
          this.setData({ records: newList });
  
        } else {
          wx.showToast({ title: res.data.msg, icon: "none" });
        }
      },
  
      fail: () => {
        wx.showToast({ title: "网络错误", icon: "none" });
      }
    });
  },
  
  


  // 页面加载：接收 userId + 设置默认日期
  onLoad(options) {
    if (options.userId) {
      this.setData({ userId: options.userId });
    }

    // 设置默认日期 yyyy-mm-dd
    const today = new Date().toISOString().split("T")[0];
    this.setData({ date: today });
  },

  // 日期选择器事件
  onDateChange(e) {
    this.setData({ date: e.detail.value });
  },

  // 货位输入
  onPosInput(e) {
    this.setData({ pos: e.detail.value });
  },

  // 查询按钮
  onSearch() {
    const { date, userId, pos } = this.data;

    if (!date || !userId || !pos) {
      wx.showToast({ title: "日期、货位必须输入（用户自动带）", icon: "none" });
      return;
    }

    this.setData({
      page: 1,
      records: [],
      noMore: false
    });

    this.loadData();
  },

  // 加载更多
  loadMore() {
    if (this.data.noMore) return;

    this.setData({
      page: this.data.page + 1
    });

    this.loadData();
  },

  // 请求后端查询接口
  loadData() {
    this.setData({ loading: true });

    wx.request({
      url: "https://api.quanshenghuoqin.com/api/query/checkvouch",
      method: "GET",
      data: {
        date: this.data.date,
        userId: this.data.userId,
        // userId: "a0LIg00000J5sUpMAJ",

        pos: this.data.pos,
        page: this.data.page,
        pageSize: this.data.pageSize
      },

      success: (res) => {
        const r = res.data;
        if (r.code !== 0) {
          wx.showToast({ title: r.msg || "查询失败", icon: "none" });
          return;
        }

        // 对返回的每一条记录格式化
        const list = (r.data || []).map(item => {
          // 数量格式化为两位小数
          item.qty_fmt = Number(item.qty).toFixed(2);

          // 格式化时间
          item.createtime_fmt = this.formatDateTime(item.createtime);

          return item;
        });

        // 合并数据
        const newRecords = this.data.records.concat(list);

// 🔥 按 id 降序排列
newRecords.sort((a, b) => b.id - a.id);

        const noMore = newRecords.length >= r.total;

        this.setData({
          records: newRecords,
          total: r.total,
          noMore
        });
      },

      fail: () => {
        wx.showToast({ title: "网络错误", icon: "none" });
      },

      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  // 时间格式化 yyyy-mm-dd hh:mm:ss
  formatDateTime(str) {
    if (!str) return "";

    const d = new Date(str.replace(/-/g, "/")); // 兼容 iOS

    const pad = (n) => (n < 10 ? "0" + n : n);

    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
});
