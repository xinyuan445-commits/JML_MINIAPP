Page({
  data: {
    tools: [],                  // ← 从接口赋值
    showBatchDialog: false,
    batchInput: '',
    batchOutput: '',
    apiBase: 'https://api.quanshenghuoqin.com' // 需要的话换成本地地址
  },

  onShow() {
    this.fetchTools();
  },

  // 解析本地 userStore（本地是 string，需要 JSON.parse）
  getUserIdFromStorage() {
    try {
      const raw = wx.getStorageSync('userStore'); // 这里是字符串
      if (!raw) return null;
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // 期望字段：userId
      return obj && obj.userId ? obj.userId : null;
    } catch (e) {
      console.warn('parse userStore failed:', e);
      return null;
    }
  },

  // 拉取可用工具（工具启用 && 用户已授权）
  fetchTools() {
    const userId = this.getUserIdFromStorage();
    if (!userId) {
      wx.showToast({ title: '未获取到用户ID', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中', mask: true });
    wx.request({
      url: `${this.data.apiBase}/api/factory/task/tools/user-permissions`,
      method: 'GET',
      data: { user_id: userId }, // 后端按此参数取值
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0) {
          wx.showToast({ title: msg || '加载失败', icon: 'none' });
          return;
        }
        // 后端返回：data.tools 数组，字段：tool_name, path, icon, emoji
        const list = (data?.tools || []).map(t => ({
          name: t.tool_name,
          path: t.path,
          icon: t.icon,
          emoji: t.emoji
        }));
        console.log(list);
        this.setData({ tools: list });
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => wx.hideLoading()
    });
  },

  // 工具入口点击
  goTool(e) {
    const { name } = e.currentTarget.dataset;
    const tool = this.data.tools.find(t => t.name === name);
    if (!tool || !tool.path) {
      wx.showToast({ title: '未配置跳转路径', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: tool.path });
  },

  // 防止背景滚动
  preventTouchMove() {},

  // 输入批次号
  onBatchInput(e) {
    this.setData({ batchInput: e.detail.value });
  },

  // 转换规则：全角→半角、转大写、统一连接符为-、去除空白与无关字符
  doConvert() {
    const raw = (this.data.batchInput || '').trim();
    if (!raw) {
      wx.showToast({ title: '请输入批次号', icon: 'none' });
      return;
    }
    const toDBC = (str) => {
      let out = '';
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 12288) { out += ' '; continue; }               // 全角空格
        if (code >= 65281 && code <= 65374) { out += String.fromCharCode(code - 65248); } // 全角 → 半角
        else { out += str.charAt(i); }
      }
      return out;
    };

    let s = toDBC(raw).toUpperCase()
      .replace(/[—–－—_··•·]/g, '-')  // 各类连接符
      .replace(/[\\/]/g, '-')         // 斜杠
      .replace(/\s+/g, '')            // 空白
      .replace(/[^A-Z0-9-]/g, '')     // 只留字母数字和横杠
      .replace(/-+/g, '-')            // 连续横杠
      .replace(/^-|-$/g, '');         // 两端横杠

    this.setData({ batchOutput: s });
  },

  copyBatch() {
    const text = this.data.batchOutput;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  closeBatch() {
    this.setData({ showBatchDialog: false, batchInput: '', batchOutput: '' });
  }
});
