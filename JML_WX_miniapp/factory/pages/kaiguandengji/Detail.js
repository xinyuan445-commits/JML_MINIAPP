const API_BASE = 'https://api.quanshenghuoqin.com';

Page({
  data: {
    docNo: '',
    detail: {}
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '设备开关明细' });
    const doc_no = options.doc_no || '';
    if (!doc_no) {
      wx.showToast({ title: '缺少单号', icon: 'none' });
      return;
    }
    this.setData({ docNo: doc_no });
    this.fetchDetail(doc_no);
  },

  fetchDetail(doc_no) {
    wx.showLoading({ title: '加载中...', mask: true });
    wx.request({
      url: `${API_BASE}/api/factory/task/switch-log/detail`,
      method: 'GET',
      data: { doc_no },
      success: ({ data }) => {
        if (data && (data.success === true || data.code === 0 || data.code === 1 || data.code === '1') && data.data) {
          const row = data.data || {};
          // 统一本地可读时间（兼容 iOS）
          row.created_time_txt = this.formatLocalDatetime(row.created_time || row.create_time);
          this.setData({ detail: row });
        } else {
          wx.showToast({ title: (data && data.msg) || '未找到单据', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },

  // —— iOS 兼容时间格式化：转成 YYYY-MM-DD HH:mm:ss —— //
  formatLocalDatetime(input){
    if (!input) return '';
    const s = String(input).trim();

    // 已是后端格式化好的：YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(s)) return s;

    // ISO：YYYY-MM-DDTHH:mm:ss(.SSS)?(Z|+08:00)?
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
      return s.replace('T',' ').replace(/(\.\d+)?(Z|[+\-]\d{2}:\d{2})?$/, '');
    }

    // RFC1123 / GMT：Tue, 30 Sep 2025 11:49:29 GMT
    if (s.includes('GMT') || s.includes(',')) {
      const cleaned = s.replace(/GMT.*$/,'').replace(',', '').trim();
      const parts = cleaned.split(/\s+/);
      // 可能是 [Tue, 30, Sep, 2025, 11:49:29] 或 [30, Sep, 2025, 11:49:29]
      const mon = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
      let i = isNaN(parts[0]) ? 1 : 0; // 有星期名则从 1 开始取
      if (parts.length >= i+4) {
        const dd = parts[i].padStart(2,'0');
        const mm = mon[parts[i+1]] || '01';
        const yy = parts[i+2];
        const tt = parts[i+3] || '00:00:00';
        return `${yy}-${mm}-${dd} ${tt}`;
      }
    }
    // 兜底
    return s.replace('T',' ').replace(/(\.\d+)?(Z|[+\-]\d{2}:\d{2})?$/, '');
  }
});
