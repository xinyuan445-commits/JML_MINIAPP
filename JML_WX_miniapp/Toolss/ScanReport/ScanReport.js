Page({
  data: {
    // 基本字段
    work_order_no: '',
    line_no: '',
    // 展示用（去掉随机码）
    line_name: '',
    // 提交用（保留随机码）
    line_name_raw: '',
    scan_time: '',
    end_time: '',
    end_qty: '',
    has_record: false,
    show_end_fields: false,
    lockInputs: true,
    user_id: '',

    // 仅用于弹窗展示（不入库）
    inv_code: '',
    inv_name: '',
    qty: '',
    cus_name: '',

    // 工单行选择
    moItems: [],    // [{MoCode, RowNum, InvCode, InvName, Qty, CusName}]
    moChoices: []   // ["SCDDxxx-1", "SCDDxxx-2", ...]
  },

  /* ========== 工具函数 ========== */
  fmtNow() {
    const d = new Date(), p = n => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  },
  getUserIdFromStorage() {
    try {
      const raw = wx.getStorageSync('userStore');
      if (!raw) return null;
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return obj && obj.userId ? obj.userId : null;
    } catch (e) {
      console.warn('parse userStore failed:', e);
      return null;
    }
  },
  // 数字保留两位
  to2(v) {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return '';
    return n.toFixed(2);
  },
  // 展示时去掉末尾4位数字（如“肤感线0001” => “肤感线”），仅处理末尾恰好4位数字
  stripLineName(raw) {
    if (!raw) return '';
    return String(raw).trim().replace(/\d{4}$/, '');
  },

  /* ========== 生命周期 ========== */
  onLoad() {
    this.setData({ user_id: this.getUserIdFromStorage() || '' });
  },

  /* ========== 输入事件 ========== */
  onInputEndQty(e) {
    this.setData({ end_qty: (e.detail.value || '').trim() });
  },

  /* ========== 扫码：工单（只要求 {"MoCode": "..."}） ========== */
  onScanWO() {
    wx.scanCode({
      onlyFromCamera: true,
      success: res => {
        try {
          const o = JSON.parse(res.result || '{}');
          const mo = (o.MoCode || '').trim();
          if (!mo) {
            wx.showToast({ title: '二维码缺少 MoCode', icon: 'none' });
            return;
          }
          this.fetchMoLines(mo); // 扫码后去取工单行清单
        } catch {
          wx.showToast({ title: '二维码格式错误', icon: 'none' });
        }
      }
    });
  },

  // 拉取工单行：成功后“自动弹出”选择框；没数据才提示
  fetchMoLines(moRaw) {
    const mo = (moRaw || '').toUpperCase();
    this.setData({
      work_order_no: mo,
      moItems: [],
      moChoices: [],
      // 清空旧的选择与状态
      line_no: '',
      inv_code: '', inv_name: '', qty: '', cus_name: '',
      has_record: false, show_end_fields: false,
      scan_time: '', end_time: '', end_qty: ''
    });

    wx.request({
      url: 'https://api.quanshenghuoqin.com/api/factory/task/mo/info',
      method: 'POST',
      data: { MoCode: mo },
      success: r => {
        if (r.data?.code !== 0) {
          wx.showToast({ title: '查询工单失败', icon: 'none' });
          return;
        }
        const items = (r.data.data || []).map(x => ({
          ...x,
          Qty: this.to2(x.Qty) // Qty 展示两位
        }));
        if (!items.length) {
          wx.showToast({ title: '未查到工单行', icon: 'none' });
          return;
        }
        const choices = items.map(x => `${x.MoCode}-${x.RowNum}`);
        this.setData({ moItems: items, moChoices: choices }, () => {
          // 自动弹出下拉选择框
          this.onChooseMoLine();
        });
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' })
    });
  },

  // “工单号”栏里的选择：弹出 ActionSheet，选中后一次性回填
  onChooseMoLine() {
    const { moChoices, moItems } = this.data;
    if (!moChoices.length) {
      // 没有数据就不弹选择框
      return;
    }
    wx.showActionSheet({
      itemList: moChoices,
      success: res => {
        const idx = res.tapIndex;
        const row = moItems[idx];
        if (!row) return;

        // 回填：工单号、行号 + 展示信息（数量保留两位）
        this.setData({
          work_order_no: row.MoCode,
          line_no: String(row.RowNum),
          inv_code: (row.InvCode || '').trim(),
          inv_name: (row.InvName || '').trim(),
          qty: this.to2(row.Qty),
          cus_name: (row.CusName || '').trim()
        });

        // 选择后弹确认（逐行）
        const lines = [
          `工单号：${row.MoCode}`,
          `行号：${row.RowNum}`,
          `产品编码：${row.InvCode || '-'}`,
          `产品名称：${row.InvName || '-'}`,
          `生产数量：${this.to2(row.Qty) || '-'}`,
          `客户：${row.CusName || '-'}`
        ];
        wx.showModal({
          title: '工单行确认',
          content: lines.join('\n'),
          showCancel: false,
          confirmText: '我知道了'
        });

        // 选择后按你的规则检查（决定是否显示结束栏/生成开始时间）
        this.checkRecord({ fromPick: true });
      }
    });
  },

  /* ========== 扫码：产线 ==========
     需求：提交时携带“含随机码”的原始值；展示时仅显示文字（去掉末尾4位数字）
  =================================== */
  onScanLine() {
    wx.scanCode({
      onlyFromCamera: true,
      success: res => {
        const raw = (res.result || '').trim();
        if (!raw) {
          wx.showToast({ title: '产线为空', icon: 'none' });
          return;
        }
        // 存两个值：展示用去码，提交用原始
        const display = this.stripLineName(raw);
        this.setData({ line_name: display, line_name_raw: raw });
      }
    });
  },

  /* ========== 检查：有记录→显示结束栏；无记录→生成扫码时间 ========== */
  checkRecord(opts = {}) {
    const { work_order_no, line_no, user_id } = this.data;
    if (!work_order_no || !line_no || !user_id) {
      wx.showToast({ title: '缺少工单/行号/用户', icon: 'none' });
      return;
    }
    wx.request({
      url: 'https://api.quanshenghuoqin.com/api/factory/task/scan/check',
      method: 'POST',
      data: { work_order_no, line_no: Number(line_no), user_id },
      success: res => {
        if (res.data?.code !== 0) {
          wx.showToast({ title: '检查失败', icon: 'none' });
          return;
        }
        const d = res.data.data || {};
        if (d.has_record && d.data) {
          const endTime = d.data.end_time ? d.data.end_time : this.fmtNow();
          // 后端返回的 line_name 是库里存的“原始值”（包含随机码），展示时去掉末尾4位
          const displayLine = this.stripLineName(d.data.line_name || this.data.line_name);
          this.setData({
            has_record: true,
            show_end_fields: true,
            line_name: displayLine,
            line_name_raw: d.data.line_name || this.data.line_name_raw,
            scan_time: d.data.scan_time || '',
            end_time: endTime,
            end_qty: d.data.end_qty != null ? this.to2(d.data.end_qty) : ''
          });
        } else {
          const now = this.fmtNow();
          this.setData({
            has_record: false,
            show_end_fields: false,
            scan_time: now,
            end_time: '',
            end_qty: ''
          });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' })
    });
  },

  /* ========== 提交：有记录→更新结束；无记录→插入开始 ========== */
  onSubmit() {
    const { work_order_no, line_no, line_name, line_name_raw, user_id, has_record, end_time, end_qty, scan_time } = this.data;
    if (!work_order_no || !line_no || !user_id) {
      wx.showToast({ title: '请先选择工单行', icon: 'none' });
      return;
    }

    if (has_record) {
      // 结束：必须填写有效结束数量（两位小数）
      if (end_qty === '' || Number.isNaN(Number(end_qty))) {
        wx.showToast({ title: '请填写有效的结束数量', icon: 'none' });
        return;
      }
      const endQtyNum = Number(Number(end_qty).toFixed(2));
      const payload = {
        work_order_no,
        line_no: Number(line_no),
        user_id,
        end_time: end_time || this.fmtNow(),
        end_qty: endQtyNum
      };
      wx.request({
        url: 'https://api.quanshenghuoqin.com/api/factory/task/scan/submit',
        method: 'POST',
        data: payload,
        success: r => {
          if (r.data?.code === 0) {
            this.setData({
              end_time: r.data?.data?.end_time || payload.end_time,
              end_qty: this.to2(endQtyNum)
            });
            wx.showToast({ title: '已提交结束', icon: 'success' });
          } else {
            wx.showToast({ title: '更新失败', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '网络异常', icon: 'none' })
      });
    } else {
      // 开始：必须有产线；提交时带“原始产线”（含随机码）
      if (!line_name_raw && !line_name) {
        wx.showToast({ title: '请先扫码产线', icon: 'none' });
        return;
      }
      const lineToSave = line_name_raw || line_name; // 优先用原始值
      wx.request({
        url: 'https://api.quanshenghuoqin.com/api/factory/task/scan/submit',
        method: 'POST',
        data: {
          work_order_no,
          line_no: Number(line_no),
          user_id,
          line_name: lineToSave,
          scan_time
        },
        success: r => {
          if (r.data?.code === 0) {
            this.setData({
              has_record: true,
              show_end_fields: false,   // 开始成功后不显示结束栏（按你的规则）
              scan_time: r.data?.data?.scan_time || scan_time
            });
            wx.showToast({ title: '开始报工成功', icon: 'success' });
          } else {
            wx.showToast({ title: '提交失败', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '网络异常', icon: 'none' })
      });
    }
  }
});
