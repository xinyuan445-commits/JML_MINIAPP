const naturalGasApi = require('../../api/naturalGasLog.js');

const IMAGE_BASE = 'https://wxapp-crm.chameleon-artec.com/jml';

/*
 * 旧版详情和编辑入口完整保留在 Detailed.legacy.js。
 * 当前详情只读，避免新版登记页把编辑操作误处理成新增。
 */
Page({
  data: {
    id: '',
    detail: null,
    imageUrl: '',
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.loadDetail();
  },

  async loadDetail() {
    if (!this.data.id) {
      wx.showToast({ title: '缺少记录ID', icon: 'none' });
      return;
    }
    try {
      const result = await naturalGasApi.queryNewDetail(this.data.id);
      const detail = result.data;
      if (!detail) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      const image = detail.natural_gas_img1 || '';
      this.setData({
        detail: {
          ...detail,
          createdTimeText: this.formatDateTime(detail.created_time),
          updateTimeText: this.formatDateTime(detail.update_time)
        },
        imageUrl: image && !/^https?:\/\//.test(image) ? IMAGE_BASE + image : image,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || '详情加载失败', icon: 'none' });
    }
  },

  formatDateTime(value) {
    if (!value) return '';
    const text = String(value);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]} ${iso[4]}:${iso[5]}:${iso[6]}`;

    const rfc = text.match(/^[A-Za-z]{3},\s(\d{2})\s([A-Za-z]{3})\s(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
    if (rfc) {
      const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      return `${rfc[3]}-${months[rfc[2]] || rfc[2]}-${rfc[1]} ${rfc[4]}:${rfc[5]}:${rfc[6]}`;
    }
    return text;
  },

  previewImage() {
    if (this.data.imageUrl) {
      wx.previewImage({ current: this.data.imageUrl, urls: [this.data.imageUrl] });
    }
  }
});
