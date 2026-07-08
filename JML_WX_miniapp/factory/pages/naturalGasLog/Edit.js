const naturalGasApi = require('../../api/naturalGasLog.js');

const UPLOAD_URL = 'https://wxapp-crm.chameleon-artec.com/jml/api/core/file/upload';

/*
 * 旧版登记页未删除，完整代码保留在同目录 Edit.legacy.js。
 * 旧逻辑直接读取全表最后一笔记录，双工厂时会混用，当前页面不再调用。
 */
Page({
  data: {
    devices: [],
    deviceIndex: -1,
    deviceId: '',
    deviceLabel: '',
    beforeReading: null,
    hasBeforeReading: false,
    dailyReading: '',
    estimatedUsage: null,
    photoUrl: '',
    remark: '',
    loadingBefore: false,
    submitting: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '天然气登记表' });
    this.loadDevices();
  },

  async loadDevices() {
    try {
      const result = await naturalGasApi.queryDevices();
      this.setData({ devices: result.data || [] });
    } catch (error) {
      wx.showToast({ title: error.message || '设备加载失败', icon: 'none' });
    }
  },

  async onDeviceChange(event) {
    const deviceIndex = Number(event.detail.value);
    const device = this.data.devices[deviceIndex];
    if (!device) return;

    this.setData({
      deviceIndex,
      deviceId: device.id,
      deviceLabel: `${device.device_name}（${device.factory_name}）`,
      beforeReading: null,
      hasBeforeReading: false,
      estimatedUsage: null,
      loadingBefore: true
    });

    try {
      const result = await naturalGasApi.queryBeforeReading(device.id);
      const value = result.data && result.data.before_reading;
      const hasBeforeReading = value !== null && value !== undefined && value !== '';
      this.setData({
        beforeReading: hasBeforeReading ? Number(value) : null,
        hasBeforeReading,
        loadingBefore: false
      });
      this.calculateUsage();
    } catch (error) {
      this.setData({ loadingBefore: false });
      wx.showToast({ title: error.message || '上次读数获取失败', icon: 'none' });
    }
  },

  onReadingInput(event) {
    this.setData({ dailyReading: event.detail.value });
    this.calculateUsage();
  },

  calculateUsage() {
    const { dailyReading, beforeReading, hasBeforeReading } = this.data;
    if (dailyReading === '' || !hasBeforeReading) {
      this.setData({ estimatedUsage: null });
      return;
    }
    const usage = Number(dailyReading) - Number(beforeReading);
    this.setData({ estimatedUsage: Number.isFinite(usage) ? usage.toFixed(2) : null });
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value });
  },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: ({ tempFiles }) => this.uploadPhoto(tempFiles[0].tempFilePath)
    });
  },

  uploadPhoto(filePath) {
    wx.showLoading({ title: '上传中...', mask: true });
    wx.uploadFile({
      url: UPLOAD_URL,
      filePath,
      name: 'file',
      success: ({ statusCode, data }) => {
        try {
          const result = JSON.parse(data);
          if (statusCode === 200 && (result.code === '1' || result.code === 1) && result.data) {
            this.setData({ photoUrl: result.data.url });
            return;
          }
          wx.showToast({ title: result.msg || '图片上传失败', icon: 'none' });
        } catch (error) {
          wx.showToast({ title: '图片上传返回异常', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '图片上传失败', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },

  getStaffId() {
    try {
      const stored = wx.getStorageSync('userStore');
      const user = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return String((user && user.state && user.state.userId) || (user && user.userId) || '');
    } catch (error) {
      return '';
    }
  },

  async onSubmit() {
    const { deviceId, dailyReading, photoUrl, remark, estimatedUsage, submitting } = this.data;
    if (submitting) return;
    if (!deviceId) return wx.showToast({ title: '请选择天然气设备', icon: 'none' });
    if (dailyReading === '') return wx.showToast({ title: '请输入本次天然气示数', icon: 'none' });
    if (estimatedUsage !== null && Number(estimatedUsage) < 0) {
      return wx.showToast({ title: '本次示数不能小于上次示数', icon: 'none' });
    }
    if (!photoUrl) return wx.showToast({ title: '请上传天然气表示数照片', icon: 'none' });

    const staffId = this.getStaffId();
    if (!staffId) return wx.showToast({ title: '未登录，缺少操作人', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      await naturalGasApi.saveNewLog({
        device_id: deviceId,
        daily_reading: dailyReading,
        natural_gas_img1: photoUrl,
        remark: remark || '',
        staff_id: staffId
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      wx.$emit && wx.$emit('refresh-naturalGasLog', { refresh: true });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
