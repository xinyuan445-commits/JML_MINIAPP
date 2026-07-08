const API_BASE = 'https://api.quanshenghuoqin.com';

Page({
  data:{
    start:'',  // 当月1号
    end:'',    // 今天
    list:[]
  },

  onLoad(){
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.setData({
      start: this.fmt(startOfMonth),
      end: this.fmt(today)
    }, this.fetchList);
  },

  // —— 日期选择：双向自动纠正 —— //
  onStartChange(e){
    const start = e.detail.value;
    const { end } = this.data;
    if (end && new Date(start) > new Date(end)) {
      this.setData({ start, end: start }, this.fetchList);
      wx.showToast({ title: '开始不能大于结束，已自动调整', icon: 'none' });
    } else {
      this.setData({ start }, this.fetchList);
    }
  },
  onEndChange(e){
    const end = e.detail.value;
    const { start } = this.data;
    if (start && new Date(end) < new Date(start)) {
      this.setData({ end, start: end }, this.fetchList);
      wx.showToast({ title: '结束不能小于开始，已自动调整', icon: 'none' });
    } else {
      this.setData({ end }, this.fetchList);
    }
  },

  // —— 新建 —— //
  onCreate(){
    wx.navigateTo({ url:'/factory/pages/kaiguandengji/Edit' });
  },

  // —— 查看 —— //
  goDetail(e){
    const doc_no = e.currentTarget.dataset.docno;
    wx.navigateTo({ url:`/factory/pages/kaiguandengji/Detail?doc_no=${encodeURIComponent(doc_no)}` });
  },

  // —— 拉列表 —— //
  fetchList(){
    const { start, end } = this.data;
    wx.request({
      url: `${API_BASE}/api/factory/task/switch-log/list`,
      method:'GET',
      data:{ start, end, page:1, page_size:200 },
      success:({data})=>{
        if (data.code === 0 || data.code === 1 || data.success === true) {
          const arr = Array.isArray(data.data) ? data.data : (data.data?.list || []);
          const list = arr.map(it => ({
            ...it,
            // iOS 兼容格式化
            created_time_txt: this.formatLocalDatetime(it.created_time || it.create_time),
            staff_name: it.staff_name || it.staff_id || ''
          }));
          this.setData({ list });
        } else {
          wx.showToast({ title: data.msg || '加载失败', icon: 'none' });
        }
      },
      fail:()=> wx.showToast({ title:'网络错误', icon:'none' })
    });
  },

  // —— 工具：iOS 兼容的时间格式化 —— //
  formatLocalDatetime(input){
    if (!input) return '';
    const s = String(input).trim();

    // 已是后端格式化好的：YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(s)) {
      return s; // 直接用，不再 new Date()
    }
    // ISO：YYYY-MM-DDTHH:mm:ss[.SSS][Z|+08:00]
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
      // 去掉毫秒与时区，或按需保留
      return s.replace('T',' ').replace(/(\.\d+)?(Z|[+\-]\d{2}:\d{2})?$/, '');
    }
    // RFC1123 / GMT：Tue, 30 Sep 2025 11:49:29 GMT
    if (s.includes('GMT') || s.includes(',')) {
      // 尝试手动拆分
      const cleaned = s.replace(/GMT.*$/,'').trim(); // 去掉 GMT 及后缀
      // 可能是 "Tue, 30 Sep 2025 11:49:29" 或 "Tue 30 Sep 2025 11:49:29"
      const parts = cleaned.replace(',', '').split(/\s+/);
      // 期望: [Tue, 30, Sep, 2025, 11:49:29] 或 [Tue, 30, Sep, 2025, 11:49:29]
      if (parts.length >= 5) {
        const map = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                     Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
        // 兼容有/无星期名
        let dayIdx = isNaN(parts[0]) ? 1 : 0; // 如果第一段不是数字，当作有星期名
        const dd = parts[dayIdx].padStart(2,'0');
        const mm = map[parts[dayIdx+1]] || '01';
        const yy = parts[dayIdx+2];
        const tt = parts[dayIdx+3] || '00:00:00';
        return `${yy}-${mm}-${dd} ${tt}`;
      }
    }
    // 兜底：把 2025-09-30T11:49:29.000Z 这类再清一次
    return s.replace('T',' ').replace(/(\.\d+)?(Z|[+\-]\d{2}:\d{2})?$/, '');
  },

  // 仅用于生成 YYYY-MM-DD（顶部日期）
  fmt(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  },

  // 供 Edit 成功后刷新
  resetAndFetch(){ this.fetchList(); }
});
