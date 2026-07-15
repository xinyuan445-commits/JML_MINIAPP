const MOAPI    = 'https://api.jinmilong.cn/api/mo';
const PTHONAPI = 'https://api.quanshenghuoqin.com/api/mo';
const UPLOAD_URL = 'https://wxapp-crm.chameleon-artec.com/jml/api/core/file/upload';

function getUserId() {
  try {
    const e = wx.getStorageSync('userStore');
    if (e) {
      const t = typeof e === 'string' ? JSON.parse(e) : e;
      return (t?.state?.userId ?? t?.userId ?? '').toString();
    }
  } catch (e) {}
  return '';
}

Page({
  data: {
    header:     null,
    components: [],
    execStatus: null,
    isHistoryMode: false,
    historyRecord: null,
    historyFold: {
      rework: true,
      makeup: true,
      receive: true
    },
    selectedStationId: null,
    isLoading:  false,

    // 开工
    isStarting: false,
    showWorkerPopup: false,
    workersLoading: false,
    departments: [],
    departmentSelecting: true,
    currentDeptId: 1,
    currentDeptName: '',
    deptTrail: [],
    childDepartments: [],
    selectedDeptId: '',
    selectedDeptLabel: '全部人员',
    workers: [],
    filteredWorkers: [],
    workerKeyword: '',
    draftWorkerIds: [],
    draftTempWorkerCount: 0,
    draftTempWorkers: [],
    selectedWorkers: [],
    selectedTempWorkerCount: 0,
    selectedWorkerText: '',

    // 完工弹窗
    showCompletePopup:    false,
    completeForm:         { qty_a: '', qty_c: '', reason: '' },
    completePhotoUrl:     '',
    completeQtyWarn:      false,  // 不足
    completeQtyOver:      false,  // 超出
    completeQtyCDisabled: false,
    compThreshold:        0,
    isCompleting:         false,

    // 接收弹窗
    showReceivePopup: false,
    receiveForm:      { qty: '', reason: '' },
    receiveQtyWarn:   false,
    receiveQtyOver:   false,  // 超出
    currentHandover:  null,
    isReceiving:      false,

    // 接收弹窗（沿用原追加逻辑）
    showMakeupPopup:  false,
    makeupForm:       { qty: '', reason: '', photo_url: '' },
    makeupOverPlan:   false,
    currentLatestExec: null,
    isMakingUp:       false,
    showReceiveWorkCompletePopup: false,
    receiveWorkCompleteForm: { qty_a: '', qty_c: '' },
    selectedReceiveWorkers: [],
    selectedReceiveTempWorkerCount: 0,
    selectedReceiveWorkerText: '',

    // C级品返工
    showReworkStartPopup: false,
    showReworkCompletePopup: false,
    reworkForm: { qty: '', reason: '' },
    reworkCompleteForm: { qty_a: '', qty_c: '', remark: '' },
    selectedReworkWorkers: [],
    selectedReworkTempWorkerCount: 0,
    selectedReworkWorkerText: '',
    workerSelectionPurpose: 'start',
    isReworking: false
  },

  onLoad({ mo_code, sort_seq, dept_code, category_name, exec_id }) {
    this.mo_code   = mo_code;
    this.sort_seq  = sort_seq;
    this.dept_code = dept_code || '';
    this.category_name = category_name ? decodeURIComponent(category_name) : '';
    this.exec_id = exec_id || '';
    if (this.exec_id) {
      this.setData({ isHistoryMode: true });
      wx.setNavigationBarTitle({ title: '完工记录' });
    }
    this.load();
  },

  load() {
    this.setData({ isLoading: true });
    let detailDone = false, statusDone = false;

    const tryFinish = () => {
      if (detailDone && statusDone) this.setData({ isLoading: false });
    };

    wx.request({
      url: `${MOAPI}/workorder/detail`,
      data: { mo_code: this.mo_code, sort_seq: this.sort_seq },
      timeout: 15000,
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code === 0) {
          this.category_name = (data.header && data.header.CategoryName) || this.category_name;
          this.setData({ header: data.header, components: data.components || [] });
        } else {
          wx.showToast({ title: msg || '加载失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => { detailDone = true; tryFinish(); }
    });

    const loadExecution = this.exec_id ? this.loadExecutionHistory : this.loadStatus;
    loadExecution.call(this, () => { statusDone = true; tryFinish(); });
  },

  loadExecutionHistory(cb) {
    wx.request({
      url: `${PTHONAPI}/execution/detail`,
      data: { id: this.exec_id },
      timeout: 10000,
      success: (res) => {
        if ((res.data || {}).code === 0) {
          const record = res.data.data;
          record.start_text = record.start_time || '-';
          record.end_text = record.end_time || '-';
          this.setData({
            historyRecord: record,
            historyFold: {
              rework: !(record.rework && record.rework.status === 'processing'),
              makeup: true,
              receive: !(record.receive_work && record.receive_work.status === 'processing')
            }
          });
        } else {
          wx.showToast({ title: res.data.msg || '记录加载失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '记录加载失败', icon: 'none' }),
      complete: () => { if (cb) cb(); }
    });
  },

  toggleHistoryFold(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this.setData({ [`historyFold.${key}`]: !this.data.historyFold[key] });
  },

  goNextProcess() {
    const nextExecId = this.data.historyRecord && this.data.historyRecord.next_exec_id;
    const historyParam = nextExecId ? `&exec_id=${nextExecId}` : '';
    wx.redirectTo({
      url: `Detailed?mo_code=${encodeURIComponent(this.mo_code)}&sort_seq=${this.sort_seq}&dept_code=${encodeURIComponent(this.dept_code || '')}&category_name=${encodeURIComponent(this.category_name || '')}${historyParam}`
    });
  },

  loadStatus(cb) {
    wx.request({
      url: `${PTHONAPI}/wo-status`,
      data: {
        mo_code: this.mo_code,
        sort_seq: this.sort_seq,
        dept_code: this.dept_code,
        category_name: this.category_name
      },
      timeout: 10000,
      success: (res) => {
        if ((res.data || {}).code === 0) {
          const d = res.data.data;
          const autoStation = (d.stations && d.stations.length === 1) ? d.stations[0].id : null;
          const patch = { execStatus: d, selectedStationId: autoStation };
          if (d.status !== 'processing') {
            patch.selectedWorkers = [];
            patch.selectedTempWorkerCount = 0;
            patch.selectedWorkerText = '';
          }
          this.setData(patch);
        }
      },
      complete: () => { if (cb) cb(); }
    });
  },

  // ── 工站选择 ──────────────────────────────────────────────────
  onSelectStation(e) {
    this.setData({ selectedStationId: e.detail.value });
  },

  // ── 开工人员 ──────────────────────────────────────────────────
  openWorkerPopup() {
    this.setData({
      showWorkerPopup: true,
      workerSelectionPurpose: 'start',
      draftWorkerIds: this.data.selectedWorkers.map(item => item.user_id),
      draftTempWorkerCount: this.data.selectedTempWorkerCount,
      draftTempWorkers: Array.from(
        { length: this.data.selectedTempWorkerCount }, (_, index) => `临时工${index + 1}`
      )
    }, () => {
      if (this.data.workers.length) this.resetDeptNavigator();
      else this.loadWorkerOptions();
    });
  },

  closeWorkerPopup() {
    const patch = { showWorkerPopup: false, workerKeyword: '' };
    if (this.data.workerSelectionPurpose === 'rework') {
      patch.showReworkStartPopup = true;
    } else if (this.data.workerSelectionPurpose === 'receive') {
      patch.showMakeupPopup = true;
    }
    this.setData(patch);
  },

  onWorkerPopupChange(e) {
    if (!e.detail.visible) this.closeWorkerPopup();
  },

  loadWorkerOptions() {
    this.setData({ workersLoading: true });
    const request = (url) => new Promise((resolve, reject) => {
      wx.request({
        url,
        timeout: 10000,
        success: (res) => (res.data || {}).code === 0 ? resolve(res.data.data || []) : reject(),
        fail: reject
      });
    });
    Promise.all([
      request(`${PTHONAPI}/dingtalk/departments`),
      request(`${PTHONAPI}/dingtalk/workers`)
    ]).then(([departments, workers]) => {
      this.setData({
        departments: departments.concat([{
          dept_id: -1,
          parent_dept_id: 1,
          dept_name: '临时工',
          dept_level: 1,
          dept_path: '临时工'
        }]),
        workers
      }, () => this.resetDeptNavigator());
    }).catch(() => {
      wx.showToast({ title: '人员加载失败', icon: 'none' });
    }).finally(() => this.setData({ workersLoading: false }));
  },

  resetDeptNavigator() {
    const root = this.data.departments.find(item => Number(item.dept_id) === 1);
    if (!root) return;
    this.setData({
      departmentSelecting: true,
      currentDeptId: Number(root.dept_id),
      currentDeptName: root.dept_name,
      deptTrail: [root],
      childDepartments: this.getChildDepartments(root.dept_id),
      selectedDeptId: '',
      selectedDeptLabel: '全部人员',
      workerKeyword: ''
    });
  },

  getChildDepartments(parentId) {
    return this.data.departments.filter(
      item => Number(item.parent_dept_id) === Number(parentId)
    );
  },

  enterDepartment(e) {
    const deptId = Number(e.currentTarget.dataset.deptid);
    const department = this.data.departments.find(item => Number(item.dept_id) === deptId);
    if (!department) return;
    const children = this.getChildDepartments(deptId);
    const deptTrail = [...this.data.deptTrail, department];
    if (!children.length) {
      this.setData({
        currentDeptId: deptId,
        currentDeptName: department.dept_name,
        deptTrail,
        childDepartments: [],
        selectedDeptId: deptId,
        selectedDeptLabel: department.dept_name,
        departmentSelecting: false
      }, () => this.applyWorkerFilter());
      return;
    }
    this.setData({
      currentDeptId: deptId,
      currentDeptName: department.dept_name,
      deptTrail,
      childDepartments: children
    });
  },

  jumpDepartment(e) {
    const trailIndex = Number(e.currentTarget.dataset.index);
    const deptTrail = this.data.deptTrail.slice(0, trailIndex + 1);
    const department = deptTrail[deptTrail.length - 1];
    this.setData({
      currentDeptId: Number(department.dept_id),
      currentDeptName: department.dept_name,
      deptTrail,
      childDepartments: this.getChildDepartments(department.dept_id)
    });
  },

  useCurrentDepartment() {
    const department = this.data.deptTrail[this.data.deptTrail.length - 1];
    const isRoot = Number(department.dept_id) === 1;
    this.setData({
      selectedDeptId: isRoot ? '' : Number(department.dept_id),
      selectedDeptLabel: isRoot ? '全部人员' : `${department.dept_name}及下级`,
      departmentSelecting: false
    }, () => this.applyWorkerFilter());
  },

  changeDepartment() {
    this.resetDeptNavigator();
  },

  onWorkerKeywordInput(e) {
    this.setData({ workerKeyword: e.detail.value }, () => this.applyWorkerFilter());
  },

  applyWorkerFilter() {
    const { workers, departments, selectedDeptId, workerKeyword, draftWorkerIds } = this.data;
    const keyword = workerKeyword.trim().toLowerCase();
    const deptIds = new Set();
    if (selectedDeptId) {
      deptIds.add(Number(selectedDeptId));
      let changed = true;
      while (changed) {
        changed = false;
        departments.forEach(item => {
          if (deptIds.has(Number(item.parent_dept_id)) && !deptIds.has(Number(item.dept_id))) {
            deptIds.add(Number(item.dept_id));
            changed = true;
          }
        });
      }
    }
    const filteredWorkers = workers
      .filter(item => !selectedDeptId || (item.dept_ids || []).some(id => deptIds.has(Number(id))))
      .filter(item => !keyword || item.user_name.toLowerCase().includes(keyword))
      .map(item => ({ ...item, selected: draftWorkerIds.includes(item.user_id) }));
    this.setData({ filteredWorkers });
  },

  addTempWorker() {
    if (this.data.draftWorkerIds.length + this.data.draftTempWorkerCount >= 50) {
      wx.showToast({ title: '单次人员不能超过50人', icon: 'none' });
      return;
    }
    const count = this.data.draftTempWorkerCount + 1;
    this.setData({
      draftTempWorkerCount: count,
      draftTempWorkers: Array.from({ length: count }, (_, index) => `临时工${index + 1}`)
    });
  },

  removeTempWorker() {
    if (this.data.draftTempWorkerCount > 0) {
      const count = this.data.draftTempWorkerCount - 1;
      this.setData({
        draftTempWorkerCount: count,
        draftTempWorkers: Array.from({ length: count }, (_, index) => `临时工${index + 1}`)
      });
    }
  },

  toggleWorker(e) {
    const userId = e.currentTarget.dataset.userid;
    const draftWorkerIds = [...this.data.draftWorkerIds];
    const index = draftWorkerIds.indexOf(userId);
    if (index >= 0) draftWorkerIds.splice(index, 1);
    else draftWorkerIds.push(userId);
    this.setData({ draftWorkerIds }, () => this.applyWorkerFilter());
  },

  confirmWorkers() {
    if (!this.data.draftWorkerIds.length) {
      wx.showToast({ title: '请至少选择一名正式员工', icon: 'none' });
      return;
    }
    const selected = new Set(this.data.draftWorkerIds);
    const workers = this.data.workers.filter(item => selected.has(item.user_id));
    const workerNames = workers.map(item => item.user_name);
    for (let i = 1; i <= this.data.draftTempWorkerCount; i += 1) {
      workerNames.push(`临时工${i}`);
    }
    const workerText = workerNames.join('、');
    const patch = {
      showWorkerPopup: false,
      workerKeyword: ''
    };
    if (this.data.workerSelectionPurpose === 'rework') {
      patch.selectedReworkWorkers = workers;
      patch.selectedReworkTempWorkerCount = this.data.draftTempWorkerCount;
      patch.selectedReworkWorkerText = workerText;
      patch.showReworkStartPopup = true;
    } else if (this.data.workerSelectionPurpose === 'receive') {
      patch.selectedReceiveWorkers = workers;
      patch.selectedReceiveTempWorkerCount = this.data.draftTempWorkerCount;
      patch.selectedReceiveWorkerText = workerText;
      patch.showMakeupPopup = true;
    } else {
      patch.selectedWorkers = workers;
      patch.selectedTempWorkerCount = this.data.draftTempWorkerCount;
      patch.selectedWorkerText = workerText;
    }
    this.setData(patch);
  },

  openReworkWorkers() {
    this.setData({
      showWorkerPopup: true,
      showReworkStartPopup: false,
      workerSelectionPurpose: 'rework',
      draftWorkerIds: this.data.selectedReworkWorkers.map(item => item.user_id),
      draftTempWorkerCount: this.data.selectedReworkTempWorkerCount,
      draftTempWorkers: Array.from(
        { length: this.data.selectedReworkTempWorkerCount }, (_, index) => `临时工${index + 1}`
      )
    }, () => {
      if (this.data.workers.length) this.resetDeptNavigator();
      else this.loadWorkerOptions();
    });
  },

  openReceiveWorkers() {
    this.setData({
      showWorkerPopup: true,
      showMakeupPopup: false,
      workerSelectionPurpose: 'receive',
      draftWorkerIds: this.data.selectedReceiveWorkers.map(item => item.user_id),
      draftTempWorkerCount: this.data.selectedReceiveTempWorkerCount,
      draftTempWorkers: Array.from(
        { length: this.data.selectedReceiveTempWorkerCount }, (_, index) => `临时工${index + 1}`
      )
    }, () => {
      if (this.data.workers.length) this.resetDeptNavigator();
      else this.loadWorkerOptions();
    });
  },

  // ── 开工 ──────────────────────────────────────────────────────
  onStart() {
    const { execStatus, selectedStationId, selectedWorkers, selectedTempWorkerCount } = this.data;
    if (execStatus.stations && execStatus.stations.length > 1 && !selectedStationId) {
      wx.showToast({ title: '请先选择工站', icon: 'none' });
      return;
    }
    if (!selectedWorkers.length) {
      wx.showToast({ title: '请至少选择一名正式员工', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '开工中...', mask: true });
    this.setData({ isStarting: true });
    wx.request({
      url: `${PTHONAPI}/start`,
      method: 'POST',
      data: {
        mo_code:    this.mo_code,
        sort_seq:   this.sort_seq,
        dept_code:  this.dept_code,
        category_name: this.category_name,
        station_id: selectedStationId,
        user_id:    getUserId(),
        worker_ids: selectedWorkers.map(item => item.user_id),
        temp_worker_count: selectedTempWorkerCount
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '开工成功', icon: 'success' });
          setTimeout(() => this.loadStatus(), 800);
        } else {
          wx.showToast({ title: res.data.msg || '开工失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => { wx.hideLoading(); this.setData({ isStarting: false }); }
    });
  },

  // ── 完工 ──────────────────────────────────────────────────────
  _calcThreshold() {
    const received = this.data.execStatus && this.data.execStatus.received_qty;
    if (received != null) return received;
    return (this.data.components || [])
      .filter(c => {
        const code = String(c.sub_code || '');
        return code.startsWith('2') || code.startsWith('31');
      })
      .reduce((sum, c) => sum + (parseFloat(c.qty_plan) || 0), 0);
  },

  onComplete() {
    const received = this.data.execStatus && this.data.execStatus.received_qty;
    this.setData({
      showCompletePopup:    true,
      compThreshold:        this._calcThreshold(),
      compThresholdLabel:   received != null ? '上工序接收数量' : '子件参考数量',
      completeForm:         { qty_a: '', qty_c: '', reason: '' },
      completePhotoUrl:     '',
      completeQtyWarn:      false,
      completeQtyOver:      false,
      completeQtyCDisabled: false
    });
  },

  _updateCompleteWarn(qty_a_str, qty_c_str) {
    const a         = parseFloat(qty_a_str || 0);
    const c         = parseFloat(qty_c_str || 0);
    const total     = a + c;
    const threshold = this.data.compThreshold;
    const disabled  = threshold > 0 && a >= threshold;
    return {
      completeQtyWarn:      threshold > 0 && total < threshold,
      completeQtyOver:      threshold > 0 && total > threshold,
      completeQtyCDisabled: disabled
    };
  },

  onCompleteQtyAInput(e) {
    const qty_a = e.detail.value;
    const qty_c = this.data.completeForm.qty_c;
    const warn  = this._updateCompleteWarn(qty_a, qty_c);
    this.setData({
      'completeForm.qty_a': qty_a,
      'completeForm.qty_c': warn.completeQtyCDisabled ? '' : qty_c,
      ...warn
    });
  },

  onCompleteQtyCInput(e) {
    const qty_c = e.detail.value;
    const qty_a = this.data.completeForm.qty_a;
    const warn  = this._updateCompleteWarn(qty_a, qty_c);
    this.setData({ 'completeForm.qty_c': qty_c, ...warn });
  },

  onCompleteReasonInput(e) {
    this.setData({ 'completeForm.reason': e.detail.value });
  },

  onPickCompletePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.showLoading({ title: '上传中...', mask: true });
        wx.uploadFile({
          url: UPLOAD_URL,
          name: 'file',
          filePath: file.tempFilePath,
          success: ({ statusCode, data }) => {
            try {
              if (statusCode !== 200) {
                wx.showToast({ title: `上传失败(${statusCode})`, icon: 'none' });
                return;
              }
              const ret = JSON.parse(data);
              const ok = ret.success === true || ret.code === 0 || ret.code === 1 || ret.code === '1';
              if (ok && ret.data && ret.data.url) {
                this.setData({ completePhotoUrl: ret.data.url });
                wx.showToast({ title: '上传成功', icon: 'success' });
              } else {
                wx.showToast({ title: ret.msg || '上传失败', icon: 'none' });
              }
            } catch (err) {
              wx.showToast({ title: '返回异常', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '上传失败(网络)', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      }
    });
  },

  closeComplete() {
    this.setData({ showCompletePopup: false });
  },
  onCompletePopupChange(e) {
    if (!e.detail.visible) this.closeComplete();
  },

  submitComplete() {
    const { completeForm, completeQtyWarn, completePhotoUrl } = this.data;
    const qty_a = parseFloat(completeForm.qty_a || 0);
    const qty_c = parseFloat(completeForm.qty_c || 0);
    if (qty_a < 0 || qty_c < 0) {
      wx.showToast({ title: '数量不能为负数', icon: 'none' });
      return;
    }
    if (qty_a + qty_c <= 0) {
      wx.showToast({ title: '请输入完工数量', icon: 'none' });
      return;
    }
    if (qty_a > 99999 || qty_c > 99999) {
      wx.showToast({ title: '数量不能超过99999', icon: 'none' });
      return;
    }
    if ((completeQtyWarn || this.data.completeQtyOver) && !completeForm.reason.trim()) {
      wx.showToast({ title: '数量与参考值不符，请填写说明', icon: 'none' });
      return;
    }
    if (!completePhotoUrl) {
      wx.showToast({ title: '\u8bf7\u5148\u62cd\u5b8c\u5de5\u4ea7\u54c1\u7167\u7247', icon: 'none' });
      return;
    }
    this.setData({ isCompleting: true });
    wx.request({
      url: `${PTHONAPI}/complete`,
      method: 'POST',
      data: {
        mo_code:         this.mo_code,
        sort_seq:        this.sort_seq,
        qty_a:           qty_a,
        qty_c:           qty_c,
        complete_reason: completeForm.reason.trim(),
        complete_photo_url: completePhotoUrl,
        user_id:         getUserId()
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '完工成功', icon: 'success' });
          this.setData({ showCompletePopup: false });
          setTimeout(() => this.loadStatus(), 800);
        } else {
          wx.showToast({ title: res.data.msg || '操作失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isCompleting: false })
    });
  },

  // ── 接收 ──────────────────────────────────────────────────────
  onReceive() {
    const qtyOut = (this.data.execStatus.handover || {}).qty_out || '';
    this.setData({
      showReceivePopup: true,
      currentHandover:  this.data.execStatus.handover,
      receiveForm:      { qty: qtyOut, reason: '' },
      receiveQtyWarn:   false,
      receiveQtyOver:   false
    });
  },

  onReceiveQtyInput(e) {
    const qty    = e.detail.value;
    const qtyOut = (this.data.currentHandover || {}).qty_out || 0;
    const n      = parseFloat(qty || 0);
    this.setData({
      'receiveForm.qty': qty,
      receiveQtyWarn:    n < qtyOut,
      receiveQtyOver:    n > qtyOut
    });
  },

  onReceiveReasonInput(e) {
    this.setData({ 'receiveForm.reason': e.detail.value });
  },

  closeReceive() {
    this.setData({ showReceivePopup: false });
  },
  onReceivePopupChange(e) {
    if (!e.detail.visible) this.closeReceive();
  },

  submitReceive() {
    const { receiveForm, receiveQtyWarn, receiveQtyOver, currentHandover } = this.data;
    const qty = parseFloat(receiveForm.qty);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入接收数量', icon: 'none' });
      return;
    }
    if (qty > 99999) {
      wx.showToast({ title: '数量不能超过99999', icon: 'none' });
      return;
    }
    if ((receiveQtyWarn || receiveQtyOver) && !receiveForm.reason.trim()) {
      wx.showToast({ title: '数量与交接数量不符，请填写说明', icon: 'none' });
      return;
    }
    this.setData({ isReceiving: true });
    wx.request({
      url: `${PTHONAPI}/receive`,
      method: 'POST',
      data: {
        mo_code:        this.mo_code,
        sort_seq:       this.sort_seq,
        handover_id:    currentHandover.id,
        qty_in:         qty,
        receipt_reason: receiveForm.reason.trim(),
        user_id:        getUserId()
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '接收成功', icon: 'success' });
          this.setData({ showReceivePopup: false });
          this.loadStatus();
        } else {
          wx.showToast({ title: res.data.msg || '操作失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isReceiving: false })
    });
  },

  // ── 接收 ──────────────────────────────────────────────────────
  onMakeup() {
    const record = this.data.isHistoryMode ? this.data.historyRecord : null;
    if (record && record.receive_work && record.receive_work.status === 'processing') {
      this.setData({
        showReceiveWorkCompletePopup: true,
        receiveWorkCompleteForm: { qty_a: '', qty_c: '' }
      });
      return;
    }
    const target = this.data.isHistoryMode
      ? this.data.historyRecord
      : this.data.execStatus.latest_exec;
    const refQty = parseFloat(target && target.receive_ref_qty !== undefined && target.receive_ref_qty !== null
      ? target.receive_ref_qty
      : 0);
    const current = parseFloat(target && target.receive_current_qty !== undefined && target.receive_current_qty !== null
      ? target.receive_current_qty
      : ((target || {}).qty_done || 0));
    const available = target && target.receive_available_qty !== undefined && target.receive_available_qty !== null
      ? target.receive_available_qty
      : Math.max(0, refQty - current);
    this.setData({
      showMakeupPopup:   true,
      currentLatestExec: target,
      makeupForm:        { qty: '', reason: '', photo_url: '' },
      makeupOverPlan:    false,
      selectedReceiveWorkers: [],
      selectedReceiveTempWorkerCount: 0,
      selectedReceiveWorkerText: ''
    });
  },

  onMakeupQtyInput(e) {
    const qty = parseFloat(e.detail.value || 0);
    const current = parseFloat((this.data.currentLatestExec || {}).receive_current_qty || 0);
    const refQty = parseFloat((this.data.currentLatestExec || {}).receive_ref_qty || 0);
    this.setData({
      'makeupForm.qty': e.detail.value,
      makeupOverPlan: refQty > 0 && current + qty > refQty
    });
  },

  onMakeupReasonInput(e) {
    this.setData({ 'makeupForm.reason': e.detail.value });
  },

  closeMakeup() {
    this.setData({ showMakeupPopup: false });
  },
  onMakeupPopupChange(e) {
    if (!e.detail.visible) this.closeMakeup();
  },

  closeReceiveWorkComplete() {
    this.setData({ showReceiveWorkCompletePopup: false });
  },

  onReceiveWorkCompleteAInput(e) {
    this.setData({ 'receiveWorkCompleteForm.qty_a': e.detail.value });
  },

  onReceiveWorkCompleteCInput(e) {
    this.setData({ 'receiveWorkCompleteForm.qty_c': e.detail.value });
  },

  onPickReceivePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.showLoading({ title: '上传中...', mask: true });
        wx.uploadFile({
          url: UPLOAD_URL,
          name: 'file',
          filePath: file.tempFilePath,
          success: ({ statusCode, data }) => {
            try {
              if (statusCode !== 200) {
                wx.showToast({ title: `上传失败(${statusCode})`, icon: 'none' });
                return;
              }
              const ret = JSON.parse(data);
              const ok = ret.success === true || ret.code === 0 || ret.code === 1 || ret.code === '1';
              if (ok && ret.data && ret.data.url) {
                this.setData({ 'makeupForm.photo_url': ret.data.url });
                wx.showToast({ title: '上传成功', icon: 'success' });
              } else {
                wx.showToast({ title: ret.msg || '上传失败', icon: 'none' });
              }
            } catch (err) {
              wx.showToast({ title: '返回异常', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '上传失败(网络)', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      }
    });
  },

  submitMakeup() {
    const {
      makeupForm, currentLatestExec, selectedReceiveWorkers, selectedReceiveTempWorkerCount
    } = this.data;
    const qty = parseFloat(makeupForm.qty);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入接收数量', icon: 'none' });
      return;
    }
    if (qty > 99999) {
      wx.showToast({ title: '数量不能超过99999', icon: 'none' });
      return;
    }
    if (this.data.makeupOverPlan && !(makeupForm.reason || '').trim()) {
      wx.showToast({ title: '超过上工序完工数，请填写原因', icon: 'none' });
      return;
    }
    if (!selectedReceiveWorkers.length) {
      wx.showToast({ title: '请选择接收人员', icon: 'none' });
      return;
    }
    if (!makeupForm.photo_url) {
      wx.showToast({ title: '请先拍领用照片', icon: 'none' });
      return;
    }
    this.setData({ isMakingUp: true });
    wx.request({
      url: `${PTHONAPI}/receive-work/start`,
      method: 'POST',
      data: {
        exec_id:  currentLatestExec.id,
        qty_input: qty,
        reason:   (makeupForm.reason || '').trim(),
        photo_url: makeupForm.photo_url || '',
        worker_ids: selectedReceiveWorkers.map(item => item.user_id),
        temp_worker_count: selectedReceiveTempWorkerCount,
        user_id:  getUserId()
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '接收已开始', icon: 'success' });
          this.setData({ showMakeupPopup: false });
          if (this.data.isHistoryMode) this.loadExecutionHistory();
          else setTimeout(() => this.loadStatus(), 800);
        } else {
          wx.showToast({ title: res.data.msg || '操作失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isMakingUp: false })
    });
  },

  submitReceiveWorkComplete() {
    const form = this.data.receiveWorkCompleteForm;
    const receive = this.data.historyRecord && this.data.historyRecord.receive_work;
    if (!receive || receive.status !== 'processing') {
      wx.showToast({ title: '没有进行中的接收', icon: 'none' });
      return;
    }
    const qty_a = parseFloat(form.qty_a || 0);
    const qty_c = parseFloat(form.qty_c || 0);
    if (qty_a < 0 || qty_c < 0 || qty_a + qty_c <= 0) {
      wx.showToast({ title: '请输入接收完工数量', icon: 'none' });
      return;
    }
    if (Math.abs(qty_a + qty_c - receive.qty_input) > 0.0001) {
      wx.showToast({ title: 'A、C级合计须等于接收数量', icon: 'none' });
      return;
    }
    this.setData({ isMakingUp: true });
    wx.request({
      url: `${PTHONAPI}/receive-work/complete`,
      method: 'POST',
      data: {
        receive_id: receive.id,
        qty_a,
        qty_c
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '接收完工成功', icon: 'success' });
          this.setData({ showReceiveWorkCompletePopup: false });
          this.loadExecutionHistory();
        } else {
          wx.showToast({ title: res.data.msg || '接收完工失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isMakingUp: false })
    });
  },

  // ── C级品返工 ─────────────────────────────────────────────────
  onRework() {
    const rework = this.data.historyRecord && this.data.historyRecord.rework;
    if (rework && rework.status === 'processing') {
      this.setData({
        showReworkCompletePopup: true,
        reworkCompleteForm: { qty_a: '', qty_c: '', remark: '' }
      });
      return;
    }
    this.setData({
      showReworkStartPopup: true,
      reworkForm: { qty: '', reason: '' },
      selectedReworkWorkers: [],
      selectedReworkTempWorkerCount: 0,
      selectedReworkWorkerText: ''
    });
  },

  onReworkQtyInput(e) {
    this.setData({ 'reworkForm.qty': e.detail.value });
  },

  onReworkReasonInput(e) {
    this.setData({ 'reworkForm.reason': e.detail.value });
  },

  closeReworkStart() {
    this.setData({ showReworkStartPopup: false });
  },

  submitReworkStart() {
    const { reworkForm, selectedReworkWorkers, selectedReworkTempWorkerCount, historyRecord } = this.data;
    const qty = parseFloat(reworkForm.qty);
    if (!qty || qty <= 0 || qty > historyRecord.qty_c) {
      wx.showToast({ title: '返工数量不能超过当前C级数量', icon: 'none' });
      return;
    }
    if (!reworkForm.reason.trim()) {
      wx.showToast({ title: '请填写返工说明', icon: 'none' });
      return;
    }
    if (!selectedReworkWorkers.length) {
      wx.showToast({ title: '请至少选择一名正式员工', icon: 'none' });
      return;
    }
    this.setData({ isReworking: true });
    wx.request({
      url: `${PTHONAPI}/rework/start`,
      method: 'POST',
      data: {
        exec_id: historyRecord.id,
        qty_input: qty,
        reason: reworkForm.reason.trim(),
        worker_ids: selectedReworkWorkers.map(item => item.user_id),
        temp_worker_count: selectedReworkTempWorkerCount,
        user_id: getUserId()
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '返工已开始', icon: 'success' });
          this.setData({ showReworkStartPopup: false });
          this.loadExecutionHistory();
        } else {
          wx.showToast({ title: res.data.msg || '返工开始失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isReworking: false })
    });
  },

  onReworkCompleteAInput(e) {
    this.setData({ 'reworkCompleteForm.qty_a': e.detail.value });
  },

  onReworkCompleteCInput(e) {
    this.setData({ 'reworkCompleteForm.qty_c': e.detail.value });
  },

  onReworkCompleteRemarkInput(e) {
    this.setData({ 'reworkCompleteForm.remark': e.detail.value });
  },

  closeReworkComplete() {
    this.setData({ showReworkCompletePopup: false });
  },

  submitReworkComplete() {
    const { reworkCompleteForm, historyRecord } = this.data;
    const qty_a = parseFloat(reworkCompleteForm.qty_a || 0);
    const qty_c = parseFloat(reworkCompleteForm.qty_c || 0);
    const rework = historyRecord.rework;
    if (qty_a < 0 || qty_c < 0 || qty_a + qty_c <= 0) {
      wx.showToast({ title: '请输入返工完工数量', icon: 'none' });
      return;
    }
    if (Math.abs(qty_a + qty_c - rework.qty_input) > 0.0001) {
      wx.showToast({ title: 'A、C级合计须等于返工数量', icon: 'none' });
      return;
    }
    this.setData({ isReworking: true });
    wx.request({
      url: `${PTHONAPI}/rework/complete`,
      method: 'POST',
      data: {
        rework_id: rework.id,
        qty_a,
        qty_c,
        remark: reworkCompleteForm.remark.trim(),
        user_id: getUserId()
      },
      success: (res) => {
        if ((res.data || {}).code === 0) {
          wx.showToast({ title: '返工完工成功', icon: 'success' });
          this.setData({ showReworkCompletePopup: false });
          this.loadExecutionHistory();
        } else {
          wx.showToast({ title: res.data.msg || '返工完工失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' }),
      complete: () => this.setData({ isReworking: false })
    });
  },

  noop() {}
});
