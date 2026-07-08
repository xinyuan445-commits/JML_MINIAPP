const API = 'https://api.quanshenghuoqin.com/api/mo';

Page({
  data: {
    isEdit: false,
    form: { process_code: '', process_name: '', description: '', sort: '0' }
  },

  onLoad({ id }) {
    if (id) {
      this.id = id;
      this.setData({ isEdit: true });
      wx.setNavigationBarTitle({ title: '编辑工序' });
      this.loadDetail(id);
    } else {
      wx.setNavigationBarTitle({ title: '新增工序' });
    }
  },

  loadDetail(id) {
    wx.request({
      url: `${API}/process/detail`,
      method: 'GET',
      data: { id },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          const { process_code, process_name, description, sort } = res.data.data;
          this.setData({ form: { process_code, process_name, description: description || '', sort: String(sort) } });
        }
      }
    });
  },

  onInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  onSubmit() {
    const { form, isEdit } = this.data;
    if (!form.process_code.trim() || !form.process_name.trim()) {
      wx.showToast({ title: '编码和名称不能为空', icon: 'none' });
      return;
    }
    const url = isEdit ? `${API}/process/update` : `${API}/process/add`;
    const data = { ...form, sort: parseInt(form.sort) || 0 };
    if (isEdit) data.id = this.id;

    wx.showLoading({ title: '提交中...', mask: true });
    wx.request({
      url,
      method: 'POST',
      data,
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: isEdit ? '已更新' : '新增成功', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        } else {
          wx.showToast({ title: res.data.msg || '提交失败', icon: 'none' });
        }
      },
      complete: () => wx.hideLoading()
    });
  }
});
