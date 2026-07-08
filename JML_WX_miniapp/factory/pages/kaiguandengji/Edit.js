const API_BASE   = 'https://api.quanshenghuoqin.com';
const UPLOAD_URL = 'https://wxapp-crm.chameleon-artec.com/jml/api/core/file/upload';

Page({
  data: {
    docNo: '',
    devices: [], deviceIdx: -1, deviceId: null, deviceName: '',
    opType: 1,       // 1=开, 2=关
    photoUrl: '',
    remark: ''       // 备注
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '设备开关登记' });
    this.fetchDocNo();
    this.fetchDevices();
  },

  // ===== 单号 =====
  fetchDocNo() {
    wx.request({
      url: `${API_BASE}/api/factory/task/docno/next`,
      method: 'GET',
      success: ({ data }) => {
        if (data.success === true || data.code === 0 || data.code === 1 || data.code === '1') {
          let no = data.data.doc_no || '';
          if (/-000$/.test(no)) no = no.replace(/-000$/, '-001');
          this.setData({ docNo: no });
        } else {
          wx.showToast({ title: data.msg || '取号失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' })
    });
  },

  // ===== 设备列表 =====
  fetchDevices() {
    wx.request({
      url: `${API_BASE}/api/factory/task/list`,
      method: 'GET',
      success: ({ data }) => {
        if (data.success === true || data.code === 0 || data.code === 1 || data.code === '1') {
          this.setData({ devices: data.data || [] });
        } else {
          wx.showToast({ title: data.msg || '加载设备失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' })
    });
  },

  onDevicePick(e) {
    const idx = Number(e.detail.value);
    const d = this.data.devices[idx];
    this.setData({ deviceIdx: idx, deviceId: d.id, deviceName: d.device_name });
  },

  // ===== 开关 =====
  onSwitchChange(e) {
    this.setData({ opType: e.detail.value ? 1 : 2 });
  },

  // ===== 备注 =====
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // ===== 上传图片 =====
  onPickAndUpload() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],   // 只允许拍照
      success: (res) => {
        const f = res.tempFiles[0];
        wx.showLoading({ title: '上传中...', mask: true });
        wx.uploadFile({
          url: UPLOAD_URL,
          name: 'file',
          filePath: f.tempFilePath,
          success: ({ statusCode, data }) => {
            try {
              if (statusCode !== 200) {
                wx.showToast({ title: `上传失败(${statusCode})`, icon: 'none' });
                return;
              }
              const ret = JSON.parse(data);
              const ok = (ret.success === true) || ret.code === 0 || ret.code === 1 || ret.code === '1';
              if (ok && ret.data && ret.data.url) {
                this.setData({ photoUrl: ret.data.url });
                wx.showToast({ title: '上传成功', icon: 'success' });
              } else {
                wx.showToast({ title: ret.msg || '上传失败', icon: 'none' });
              }
            } catch (err) {
              wx.showToast({ title: '返回异常', icon: 'none' });
              console.error('parse error:', err, data);
            }
          },
          fail: () => wx.showToast({ title: '上传失败(网络)', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      }
    });
  },

  // ===== 提交 =====
  onSubmit() {
    const { docNo, deviceId, opType, photoUrl, remark } = this.data;

    let staffId = '';
    try {
      const e = wx.getStorageSync("userStore");
      if (e) {
        const t = typeof e === "string" ? JSON.parse(e) : e;
        staffId = t?.userId ?? '';
      }
    } catch (err) {
      console.log("解析 userStore 出错:", err);
    }

    if (!docNo)   return wx.showToast({ title: '单号缺失', icon: 'none' });
    if (!deviceId)return wx.showToast({ title: '请选择设备', icon: 'none' });
    if (!staffId) return wx.showToast({ title: '未登录，缺少操作人', icon: 'none' });

    wx.showLoading({ title: '提交中...', mask: true });

    wx.request({
      url: `${API_BASE}/api/factory/task/switch-log/add`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        doc_no: docNo,
        device_id: deviceId,
        op_type: opType,
        staff_id: staffId,
        photo_url: photoUrl || '',
        remark: remark || ''
      },
      success: ({ data }) => {
        const ok = (data.success === true) || data.code === 0 || data.code === 1 || data.code === '1';
        if (ok) {
          wx.showToast({ title: '已提交', icon: 'success' });
          // 提交成功 → 刷新上一页列表
          const pages = getCurrentPages();
          if (pages.length > 1) {
            const prevPage = pages[pages.length - 2];
            if (prevPage.resetAndFetch) {
              prevPage.resetAndFetch();
            }
          }
          setTimeout(() => wx.navigateBack(), 600);
        } else {
          wx.showToast({ title: data.msg || '提交失败', icon: 'none' });
          const errStr = (data.error || data.msg || '') + '';
          if (errStr.includes('doc_no') || errStr.includes('Duplicate')) {
            this.fetchDocNo();
          }
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  }
});
