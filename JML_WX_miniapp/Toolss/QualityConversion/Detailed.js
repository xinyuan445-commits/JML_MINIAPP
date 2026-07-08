
const BASE_URL = 'https://api.quanshenghuoqin.com/api/query/run';
const TASK_API_BASE = 'https://api.quanshenghuoqin.com/api/factory/task';
const UPLOAD_URL = 'https://wxapp-crm.chameleon-artec.com/jml/api/core/file/upload';

Page({
  data: {
    currentStep: 0, // 0:发起, 1:质检, 2:厂长, 3:仓库, 4:完成
    stepsList: [], // 步骤条数据源 { title, desc }
    isEdit: false,
    id: null,
    currentUserId: '',
    form: {
      date: '',
      materialCode: '',
      specModel: '',
      batchNo: '',
      quantity: '',
      orderNo: '', // 新增：单号
      relatedOrderNo: '', // 关联工单号
      conversionReason: '', // 转换原因
      description: '' // 详细描述
    },
    statusCode: '',
    statusName: '',
    rejectReason: '',
    submitUserId: '',
    submitUserName: '',
    currentApprovalUserId: '',
    currentApprovalUserName: '',
    currentOwnerLabel: '',
    currentOwnerName: '',
    canEdit: true,
    canSubmit: true,
    canApprove: false,
    canReject: false,
    canRecall: false,
    approvalHistory: [],
    approvalRoleOwners: {},
    attachments: [],
    remarkModalVisible: false,
    remarkText: '',
    warehouseModalVisible: false,
    warehouseConversionNo: '',
    conversionTypes: [],
    conversionTypeIndex: -1,
    qualityLevels: [],
    qualityLevelIndex: -1,
    dutyOptions: [],
    dutyIndex: -1,
    
    // 查询/选择器状态
    searching: false,
    selectorVisible: false,
    selectorList: [], // 已加载的结果
    loadingMore: false,
    noMore: false,
    totalCount: 0,
    _searchTokens: [],
    _page: 0,
    _pageSize: 50,
    submitting: false,
  },

  async onLoad(options) {
    const today = new Date().toISOString().split('T')[0];
    const currentUserId = getCurrentUserId();
    
    await this.loadDictData();
    
    if (options.id) {
      this.setData({
        isEdit: true,
        id: options.id,
        currentUserId,
        canEdit: false,
        canSubmit: false
      });
      this.loadDetail(options.id);
    } else {
      this.setData({
        currentUserId,
        'form.date': today,
        canEdit: true,
        canSubmit: true
      });
      this.refreshOrderNo(today);
    }
  },

  loadDictData() {
    return new Promise((resolve) => {
      wx.request({
        url: `${TASK_API_BASE}/quality-conversion/dict`,
        method: 'GET',
        success: (res) => {
          if (res.data && res.data.code === 0) {
            this.setData({
              conversionTypes: res.data.data.conversionTypes || [],
              qualityLevels: res.data.data.qualityLevels || [],
              dutyOptions: res.data.data.dutyOptions || []
            });
          }
        },
        complete: resolve
      });
    });
  },

  loadDetail(id) {
    wx.showLoading({ title: '加载中...', mask: true });
    wx.request({
      url: `${TASK_API_BASE}/quality-conversion/detail`,
      method: 'GET',
      timeout: 15000,
      data: { id },
      success: (res) => {
        const d = res.data || {};
        if (d.code !== 0) {
          wx.showToast({ title: d.msg || '加载失败', icon: 'none' });
          return;
        }
        const row = d.data;
        if (!row) {
          wx.showToast({ title: '数据不存在', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }

        const conversionTypeIndex = this.data.conversionTypes.indexOf(row.conversion_type);
        const qualityLevelIndex = this.data.qualityLevels.indexOf(row.target_quality_level);
        const dutyIndex = this.data.dutyOptions.indexOf(row.duty_department);
        const currentUserId = this.data.currentUserId || getCurrentUserId();
        const submitUserId = row.submit_user_id || row.user_id || '';
        const currentApprovalUserId = row.current_approval_user_id || '';
        const currentApprovalUserName = row.current_approval_user_name || '';
        const approvalRoleOwners = row.approval_role_owners || {};
        const statusCode = row.status_code || '';
        const canEdit = !!currentUserId && currentUserId === submitUserId && (statusCode === '' || statusCode === 'DRAFT' || statusCode === 'REJECTED');
        const canSubmit = canEdit;
        const canApprove = !!currentUserId && currentUserId === currentApprovalUserId && /^PENDING_/.test(statusCode);
        const canReject = canApprove;
        const canRecall = !!currentUserId && currentUserId === submitUserId && /^PENDING_/.test(statusCode);
        const rawHistory = Array.isArray(d.history) ? d.history : [];
        const approvalHistory = rawHistory.map(x => ({
          ...x,
          created_time_fmt: formatDateTime(x.created_time),
          action_label: mapActionLabel(x.action),
          role_label: mapRoleLabelByHistory(x)
        }));
        const attachments = Array.isArray(d.attachments) ? d.attachments.map(x => x.file_url).filter(Boolean) : [];
        const submitUserName = inferSubmitUserName({
          submitUserId,
          currentUserId,
          currentUserName: getCurrentUserName(),
          history: approvalHistory
        });
        const currentOwnerLabel = mapOwnerLabelByStatus(statusCode);
        const currentOwnerName = inferCurrentOwnerName({
          statusCode,
          submitUserName,
          currentApprovalUserId,
          currentApprovalUserName,
          approvalRoleOwners
        });

        this.setData({
          form: {
            date: formatDateOnly(row.date),
            materialCode: row.material_code || '',
            specModel: row.spec_model || '',
            batchNo: row.batch_no || '',
            quantity: row.quantity != null ? String(row.quantity) : '',
            orderNo: row.order_no || '',
            relatedOrderNo: row.related_order_no || '',
            conversionReason: row.conversion_reason || '',
            description: row.description || ''
          },
          warehouseConversionNo: row.warehouse_conversion_no || '',
          conversionTypeIndex: conversionTypeIndex >= 0 ? conversionTypeIndex : -1,
          qualityLevelIndex: qualityLevelIndex >= 0 ? qualityLevelIndex : -1,
          dutyIndex: dutyIndex >= 0 ? dutyIndex : -1,
          statusCode,
          statusName: row.status_name || '',
          rejectReason: row.reject_reason || '',
          submitUserId,
          submitUserName,
          currentApprovalUserId,
          currentApprovalUserName,
          currentOwnerLabel,
          currentOwnerName,
          canEdit,
          canSubmit,
          canApprove,
          canReject,
          canRecall,
          approvalHistory,
          approvalRoleOwners,
          attachments,
          currentUserId
        });
        
        // 更新步骤条状态
        this.updateStep(statusCode, approvalHistory, approvalRoleOwners, submitUserName);
      },
      fail: (err) => {
        console.error('加载失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // ========== 物料查询相关 (UI交互部分保留) ==========
  
  // 扫码获取物料、批号和数量
  onScanMaterialCode() {
    if (!this.data.canEdit) return;
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: async (res) => {
        const scanResult = res.result;
        const arr = scanResult.split('|');
        if (arr.length < 5) {
          wx.showToast({ title: '标签格式不正确', icon: 'none' });
          return;
        }

        const newMaterialCode = arr[1] || '';
        const newBatchNo = arr[2] || '';

        wx.showLoading({ title: '查询数量...', mask: true });
        try {
          const qtyRes = await new Promise((resolve, reject) => {
            wx.request({
              url: 'https://api.quanshenghuoqin.com/api/query/label/qty',
              method: 'GET',
              data: { traceBackCode: scanResult },
              success: (response) => {
                if (response.data.code === 0 && response.data.data) {
                  resolve(response.data.data.qty);
                } else {
                  reject(new Error(response.data.msg || '获取数量失败'));
                }
              },
              fail: reject
            });
          });

          wx.hideLoading();

          const newQty = qtyRes !== null && qtyRes !== undefined ? String(qtyRes) : '';
          const { materialCode, batchNo, quantity } = this.data.form;

          // 检查是否已有值
          const hasValue = materialCode || batchNo || quantity;

          const applyValues = () => {
            this.setData({
              'form.materialCode': newMaterialCode,
              'form.batchNo': newBatchNo,
              'form.quantity': newQty
            });
          };

          if (hasValue) {
            wx.showModal({
              title: '提示',
              content: '当前物料编码、批号或数量已有值，是否覆盖？',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  applyValues();
                }
              }
            });
          } else {
            applyValues();
          }

        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e.message || '网络错误', icon: 'none' });
        }
      }
    });
  },

  // 点击查询按钮
  async onSearchItemCode() {
    const raw = (this.data.form.materialCode || '');
    // 支持：半/全角空格、逗号、顿号作为分隔；过滤空串
    const tokens = raw.split(/[ \u3000,，、]+/).map(s => s.trim()).filter(Boolean);
    console.log("搜索关键词:", tokens);

    if (!tokens.length) {
      wx.showToast({ title: '请先输入料号关键词', icon: 'none' });
      return;
    }

    // 初始化分页状态
    this.setData({
      searching: true,
      selectorVisible: true,
      selectorList: [],
      loadingMore: false,
      noMore: false,
      totalCount: 0,
      _searchTokens: tokens,
      _page: 0
    });

    wx.showLoading({ title: '查询中...', mask: true });
    try {
      await this._fetchPage(0); // 拉取第1页
    } catch (err) {
      console.error('查询失败:', err);
      wx.showToast({ title: '查询失败，请检查网络', icon: 'none' });
      this.setData({ selectorVisible: false });
    } finally {
      this.setData({ searching: false });
      wx.hideLoading();
    }
  },

  // 下一页
  async loadMore() {
    if (this.data.noMore || this.data.loadingMore) return;
    const next = this.data._page + 1;
    this.setData({ loadingMore: true });
    try {
      await this._fetchPage(next);
    } catch (e) {
      console.error('加载更多失败:', e);
      wx.showToast({ title: '加载更多失败', icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  // 关闭选择器
  closeSelector() {
    this.setData({ selectorVisible: false });
  },

  // 选择某一项并回填
  pickItem(e) {
    const code = e.currentTarget.dataset.code || '';
    if (!code) return;
  
    this.setData({
      'form.materialCode': code,
      selectorVisible: false
    });
  },

  // 拦截遮罩层滚动穿透
  noop() {},

  async _fetchPage(page) {
    const tokens = this.data._searchTokens;
    const size = this.data._pageSize;

    const { main, count } = buildSql(tokens, page, size);

    const [rowsRes, totalRes] = await Promise.allSettled([
      requestSql(main),
      requestSql(count)
    ]);

    const rows = rowsRes.status === 'fulfilled' ? rowsRes.value : [];
    const mapped = rows.map(r => ({
      code: r.cinvcode || r.code || '',
      name: r.cinvname || r.name || ''
    })).filter(x => x.code);

    let total = this.data.totalCount || 0;
    if (totalRes.status === 'fulfilled' && totalRes.value[0] && totalRes.value[0].total != null) {
      total = Number(totalRes.value[0].total) || mapped.length;
    }

    const newList = (page === 0 ? [] : this.data.selectorList).concat(mapped);
    const noMore = mapped.length < size || (total > 0 && newList.length >= total);

    this.setData({
      selectorList: newList,
      _page: page,
      totalCount: total || newList.length,
      noMore
    });
  },

  // ========== 表单交互 ==========

  // 日期选择
  onDateChange(e) {
    const newDate = e.detail.value;
    this.setData({ 'form.date': newDate });
  },

  // 转换类型选择
  onConversionTypeChange(e) {
    this.setData({ conversionTypeIndex: e.detail.value });
  },

  // 质量等级选择
  onQualityLevelChange(e) {
    this.setData({ qualityLevelIndex: e.detail.value });
  },
  
  // 责任归属选择
  onDutyChange(e) { 
    this.setData({ dutyIndex: e.detail.value }); 
  },

  // 输入框绑定
  onMaterialCodeInput(e) { this.setData({ 'form.materialCode': e.detail.value }); },
  onSpecModelInput(e) { this.setData({ 'form.specModel': e.detail.value }); },
  onBatchNoInput(e) { this.setData({ 'form.batchNo': e.detail.value }); },
  onQuantityInput(e) { this.setData({ 'form.quantity': e.detail.value }); },
  onRelatedOrderNoInput(e) { this.setData({ 'form.relatedOrderNo': e.detail.value }); },
  onConversionReasonInput(e) { this.setData({ 'form.conversionReason': e.detail.value }); },
  onDescriptionInput(e) { this.setData({ 'form.description': e.detail.value }); },

  // 重置
  onReset() {
    if (this.data.isEdit) return;
    const today = new Date().toISOString().split('T')[0];
    this.setData({
      form: {
        date: today,
        materialCode: '',
        specModel: '',
        batchNo: '',
        quantity: '',
        orderNo: '',
        relatedOrderNo: '',
        conversionReason: '',
        description: ''
      },
      conversionTypeIndex: -1,
      qualityLevelIndex: -1,
      dutyIndex: -1
    });
    this.refreshOrderNo(today);
    this.setData({ attachments: [] });
  },

  async onSaveDraft(options) {
    if (this.data.submitting) return;
    if (this.data.isEdit && !this.data.canEdit) {
      wx.showToast({ title: '当前状态不可保存', icon: 'none' });
      return;
    }

    const { date, materialCode, specModel, batchNo, quantity, orderNo, relatedOrderNo, conversionReason, description } = this.data.form;
    const { conversionTypes, conversionTypeIndex, qualityLevels, qualityLevelIndex, dutyOptions, dutyIndex } = this.data;

    if (!date) return wx.showToast({ title: '请选择日期', icon: 'none' });
    if (conversionTypeIndex < 0) return wx.showToast({ title: '请选择转换类型', icon: 'none' });
    if (!materialCode) return wx.showToast({ title: '请输入物料编码', icon: 'none' });
    if (!batchNo) return wx.showToast({ title: '请输入批号', icon: 'none' });
    if (!quantity) return wx.showToast({ title: '请输入数量', icon: 'none' });
    if (qualityLevelIndex < 0) return wx.showToast({ title: '请选择质量等级', icon: 'none' });

    const conversionType = conversionTypes[conversionTypeIndex];
    const targetQualityLevel = qualityLevels[qualityLevelIndex];
    const dutyDepartment = dutyIndex >= 0 ? dutyOptions[dutyIndex] : '';
    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return wx.showToast({ title: '数量必须大于0', icon: 'none' });

    const userId = this.data.currentUserId || getCurrentUserId();
    const userName = getCurrentUserName();
    if (!userId) return wx.showToast({ title: '用户信息缺失', icon: 'none' });

    const finalOrderNo = orderNo || makeFallbackOrderNo(date);
    if (!orderNo && finalOrderNo) this.setData({ 'form.orderNo': finalOrderNo });

    const payload = {
      date,
      conversion_type: conversionType,
      material_code: materialCode,
      spec_model: specModel,
      batch_no: batchNo,
      quantity: qtyNum,
      target_quality_level: targetQualityLevel,
      user_id: userId,
      user_name: userName,
      order_no: finalOrderNo,
      related_order_no: relatedOrderNo,
      duty_department: dutyDepartment,
      conversion_reason: conversionReason,
      description: description,
      attachments: this.data.attachments || []
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      let id = this.data.id;
      if (!id) {
        const addRes = await requestJson(`${TASK_API_BASE}/quality-conversion/add`, payload);
        id = addRes?.data?.id;
        if (!id) throw new Error('创建单据失败');
        this.setData({ id, isEdit: true });
      } else {
        await requestJson(`${TASK_API_BASE}/quality-conversion/update`, { id, ...payload });
      }
      if (!options || !options.silent) wx.showToast({ title: '已保存草稿', icon: 'success' });
      this.loadDetail(id);
    } catch (e) {
      wx.showToast({ title: e?.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.canSubmit) {
      wx.showToast({ title: '当前状态不可提交', icon: 'none' });
      return;
    }
    await this.onSaveDraft({ silent: true });
    const id = this.data.id;
    if (!id) return;

    const userId = this.data.currentUserId || getCurrentUserId();
    const userName = getCurrentUserName();
    if (!userId) return wx.showToast({ title: '用户信息缺失', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });
    try {
      await requestJson(`${TASK_API_BASE}/quality-conversion/submit`, { id, user_id: userId, user_name: userName });
      wx.showToast({ title: '已提交审批', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: e?.message || '提交失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  onApprove() {
    if (this.data.submitting || !this.data.canApprove) return;
    
    // 如果是仓库审批环节，拦截弹窗输入单号
    if (this.data.statusCode === 'PENDING_WAREHOUSE') {
      this.setData({ warehouseModalVisible: true, warehouseConversionNo: '' });
      return;
    }

    wx.showModal({
      title: '确认通过',
      content: '确定通过该单据吗？',
      success: async (res) => {
        if (!res.confirm) return;
        this.doApproveRequest();
      }
    });
  },

  closeWarehouseModal() {
    this.setData({ warehouseModalVisible: false, warehouseConversionNo: '' });
  },

  onWarehouseConversionNoInput(e) {
    this.setData({ warehouseConversionNo: e.detail.value });
  },

  confirmWarehouseApprove() {
    if (this.data.submitting || !this.data.canApprove) return;
    const no = (this.data.warehouseConversionNo || '').trim();
    if (!no) return wx.showToast({ title: '请输入形态转换单号', icon: 'none' });
    if (!no.startsWith('XTZH')) return wx.showToast({ title: '形态转换单号格式不正确，必须以 XTZH 开头', icon: 'none' });
    
    this.doApproveRequest(no);
  },

  async doApproveRequest(warehouseConversionNo = '') {
    const userId = this.data.currentUserId || getCurrentUserId();
    const userName = getCurrentUserName();
    if (!userId) return wx.showToast({ title: '用户信息缺失', icon: 'none' });
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });
    try {
      await requestJson(`${TASK_API_BASE}/quality-conversion/approve`, { 
        id: this.data.id, 
        user_id: userId, 
        user_name: userName,
        warehouse_conversion_no: warehouseConversionNo
      });
      wx.showToast({ title: '已通过', icon: 'success' });
      this.setData({ warehouseModalVisible: false });
      this.loadDetail(this.data.id);
    } catch (e) {
      wx.showToast({ title: e?.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  onReject() {
    if (this.data.submitting || !this.data.canReject) return;
    this.setData({ remarkModalVisible: true, remarkText: '' });
  },

  onRecall() {
    if (this.data.submitting || !this.data.canRecall) return;
    wx.showModal({
      title: '确认撤回',
      content: '撤回后将回到草稿状态，确定撤回吗？',
      success: async (res) => {
        if (!res.confirm) return;
        const userId = this.data.currentUserId || getCurrentUserId();
        const userName = getCurrentUserName();
        if (!userId) return wx.showToast({ title: '用户信息缺失', icon: 'none' });
        this.setData({ submitting: true });
        wx.showLoading({ title: '提交中...', mask: true });
        try {
          await requestJson(`${TASK_API_BASE}/quality-conversion/recall`, { id: this.data.id, user_id: userId, user_name: userName });
          wx.showToast({ title: '已撤回', icon: 'success' });
          this.loadDetail(this.data.id);
        } catch (e) {
          wx.showToast({ title: e?.message || '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
          this.setData({ submitting: false });
        }
      }
    });
  },

  closeRemarkModal() {
    this.setData({ remarkModalVisible: false, remarkText: '' });
  },

  onRemarkInput(e) {
    this.setData({ remarkText: e.detail.value });
  },

  async confirmReject() {
    if (this.data.submitting || !this.data.canReject) return;
    const remark = (this.data.remarkText || '').trim();
    if (!remark) return wx.showToast({ title: '请输入驳回原因', icon: 'none' });
    const userId = this.data.currentUserId || getCurrentUserId();
    const userName = getCurrentUserName();
    if (!userId) return wx.showToast({ title: '用户信息缺失', icon: 'none' });

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });
    try {
      await requestJson(`${TASK_API_BASE}/quality-conversion/reject`, { id: this.data.id, user_id: userId, user_name: userName, remark });
      wx.showToast({ title: '已驳回', icon: 'success' });
      this.setData({ remarkModalVisible: false, remarkText: '' });
      this.loadDetail(this.data.id);
    } catch (e) {
      wx.showToast({ title: e?.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  onPickImages() {
    if (this.data.submitting || !this.data.canEdit) return;
    const current = this.data.attachments || [];
    const remain = 5 - current.length;
    if (remain <= 0) return wx.showToast({ title: '最多5张', icon: 'none' });
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = (res.tempFiles || []).map(x => x.tempFilePath).filter(Boolean);
        if (!files.length) return;
        wx.showLoading({ title: '上传中...', mask: true });
        try {
          const urls = [];
          for (const p of files) {
            const u = await uploadImage(p);
            if (u) urls.push(u);
          }
          const next = current.concat(urls).slice(0, 5);
          this.setData({ attachments: next });
        } catch (e) {
          wx.showToast({ title: e?.message || '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.attachments || [];
    if (!url || !urls.length) return;
    wx.previewImage({ current: url, urls });
  },

  onDeleteImage(e) {
    if (this.data.submitting || !this.data.canEdit) return;
    const idx = Number(e.currentTarget.dataset.idx);
    const urls = (this.data.attachments || []).slice();
    if (!Number.isFinite(idx) || idx < 0 || idx >= urls.length) return;
    urls.splice(idx, 1);
    this.setData({ attachments: urls });
  },

  // 生成单号
  generateOrderNo(dateStr) {
    if (!dateStr) return;
    
    this.setData({
        'form.orderNo': makeFallbackOrderNo(dateStr)
    });
  },

  async refreshOrderNo(dateStr) {
    if (!dateStr || this.data.isEdit) return;
    try {
      const orderNo = await requestNextOrderNo(dateStr);
      if (orderNo) {
        this.setData({ 'form.orderNo': orderNo });
        return;
      }
      this.generateOrderNo(dateStr);
    } catch (e) {
      this.generateOrderNo(dateStr);
    }
  },

  updateStep(status, history, roleOwners, submitUserName) {
    let s = 0;
    // status: DRAFT, PENDING_QC, PENDING_DIRECTOR, PENDING_WAREHOUSE, COMPLETED, REJECTED
    // 0:发起, 1:质检, 2:厂长, 3:仓库, 4:完成
    if (status === 'PENDING_QC') s = 1;
    else if (status === 'PENDING_DIRECTOR') s = 2;
    else if (status === 'PENDING_WAREHOUSE') s = 3;
    else if (status === 'COMPLETED') s = 4;
    // 草稿或驳回，停留在0

    // 构建步骤条数据：title=人名, desc=时间
    // 节点定义
    const steps = [
      { key: 'SUBMIT', role: '发起人', user: submitUserName || '发起人' },
      { key: 'QC', role: '质检', user: roleOwners?.QC?.user_name || '质检' },
      { key: 'DIRECTOR', role: '厂长', user: roleOwners?.DIRECTOR?.user_name || '厂长' },
      { key: 'WAREHOUSE', role: '仓库', user: roleOwners?.WAREHOUSE?.user_name || '仓库' }
    ];

    // 辅助函数：找最后一次符合条件的审批记录
    const findLastHistory = (cond) => {
      for (let i = history.length - 1; i >= 0; i--) {
        if (cond(history[i])) return history[i];
      }
      return null;
    };

    const list = steps.map((step, idx) => {
      let time = '';
      let realUser = '';

      if (idx === 0) {
        // 发起节点：找最后一次 SUBMIT
        const h = findLastHistory(x => x.action === 'SUBMIT');
        if (h) {
          time = h.created_time_fmt;
          realUser = h.operator_user_name;
        }
      } else {
        // 审批节点
        let fromStatus = '';
        if (idx === 1) fromStatus = 'PENDING_QC';
        if (idx === 2) fromStatus = 'PENDING_DIRECTOR';
        if (idx === 3) fromStatus = 'PENDING_WAREHOUSE';

        const h = findLastHistory(x => x.action === 'APPROVE' && x.from_status_code === fromStatus);
        if (h) {
          time = h.created_time_fmt;
          realUser = h.operator_user_name;
        }
      }

      // 计算 statusText（顶部文字）
      // 规则：
      // - 已完成（有时间）：提交 / 通过
      // - 当前进行中（idx === s）：审批中
      // - 未开始（idx > s）：等待处理
      let statusText = '等待处理';
      if (idx === 0) {
        statusText = time ? '提交' : (idx === s ? '编辑中' : '等待提交');
      } else {
        if (time) statusText = '通过';
        else if (idx === s) statusText = '审批中';
        else if (idx < s) statusText = '通过'; // 容错：虽然没取到时间但步骤已过
        else statusText = '等待处理';
      }

      // 构造显示对象
      const timeParts = time ? time.split(' ') : ['', ''];
      return { 
        statusText,
        role: step.role,
        user: realUser || step.user,
        date: timeParts[0] || '',
        time: timeParts[1] || ''
      };
    });

    this.setData({ 
      currentStep: s,
      stepsList: list
    });
  }
});

function buildSql(tokens, page, pageSize) {
  const safe = (s) => s.replace(/'/g, "''");
  const where = tokens.map(k => `cinvcode LIKE '%${safe(k)}%'`).join(' and ');
  const offset = page * pageSize;

  const main = `SELECT cinvcode, cinvname FROM inventory WHERE ${where} ORDER BY cinvcode ASC LIMIT ${offset}, ${pageSize}`;
  const count = `SELECT COUNT(1) AS total FROM inventory WHERE ${where}`;
  return { main, count };
}

function requestSql(sql) {
  const url = `${BASE_URL}?sql=${encodeURIComponent(sql)}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 15000,
      success: (res) => {
        const d = res.data;
        const rows = Array.isArray(d) ? d :
          Array.isArray(d?.data) ? d.data :
          Array.isArray(d?.rows) ? d.rows : [];
        resolve(rows);
      },
      fail: reject
    });
  });
}

function requestNextOrderNo(dateStr) {
  const url = `${TASK_API_BASE}/quality-conversion/next-no`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 15000,
      data: { date: dateStr },
      success: (res) => {
        const d = res.data || {};
        if (d.code !== 0) {
          reject(new Error(d.msg || '获取单号失败'));
          return;
        }
        resolve(d.data?.order_no || '');
      },
      fail: reject
    });
  });
}

function makeFallbackOrderNo(dateStr) {
  if (!dateStr) return '';
  const ts = new Date().getTime().toString().slice(-3);
  const datePart = dateStr.replace(/-/g, '');
  return `XTZH_${datePart}-${ts}`;
}

function formatDateOnly(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = v.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    return '';
  }
  if (typeof v === 'number') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return '';
}

function pad2(n) {
  const s = String(n);
  return s.length >= 2 ? s : `0${s}`;
}

function getCurrentUserId() {
  try {
    const userObj = JSON.parse(wx.getStorageSync("userStore") || "{}");
    return userObj.userId || "";
  } catch (e) {
    return "";
  }
}

function getCurrentUserName() {
  try {
    const raw = wx.getStorageSync("userStore") || "{}";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const store = parsed?.state || parsed || {};
    const userInfo = store.userInfo || {};
    return (
      store.userName ||
      store.staffName ||
      userInfo.userName ||
      userInfo.staffName ||
      userInfo.staff_name ||
      userInfo.name ||
      userInfo.realName ||
      userInfo.real_name ||
      userInfo.username ||
      userInfo.nickName ||
      userInfo.nickname ||
      ""
    );
  } catch (e) {
    return "";
  }
}

function requestJson(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      timeout: 15000,
      header: { 'Content-Type': 'application/json' },
      data,
      success: (res) => {
        const d = res.data || {};
        if (res.statusCode === 200 && d.code === 0) {
          resolve(d);
          return;
        }
        reject(new Error(d.msg || d.error || '请求失败'));
      },
      fail: () => reject(new Error('网络错误'))
    });
  });
}

function formatDateTime(v) {
  if (!v) return '';
  const t = Date.parse(v);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return String(v);
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: UPLOAD_URL,
      name: 'file',
      filePath,
      success: ({ statusCode, data }) => {
        try {
          if (statusCode !== 200) {
            reject(new Error(`上传失败(${statusCode})`));
            return;
          }
          const ret = JSON.parse(data);
          const ok = (ret.success === true) || ret.code === 0 || ret.code === 1 || ret.code === '1';
          if (ok && ret.data && ret.data.url) {
            resolve(ret.data.url);
            return;
          }
          reject(new Error(ret.msg || '上传失败'));
        } catch (e) {
          reject(new Error('返回异常'));
        }
      },
      fail: () => reject(new Error('上传失败(网络)'))
    });
  });
}

function mapActionLabel(action) {
  const a = String(action || '').toUpperCase();
  if (a === 'SUBMIT') return '提交';
  if (a === 'APPROVE') return '通过';
  if (a === 'REJECT') return '驳回';
  if (a === 'RECALL') return '撤回';
  return action || '';
}

function mapOwnerLabelByStatus(statusCode) {
  const s = String(statusCode || '').toUpperCase();
  if (!s || s === 'DRAFT' || s === 'REJECTED') return '发起人';
  if (s === 'PENDING_QC') return '质检';
  if (s === 'PENDING_DIRECTOR') return '厂长';
  if (s === 'PENDING_WAREHOUSE') return '仓库';
  if (s === 'APPROVED') return '已完成';
  return s;
}

function mapRoleLabelByHistory(item) {
  const action = String(item?.action || '').toUpperCase();
  if (action === 'SUBMIT' || action === 'RECALL') return '发起人';
  const from = String(item?.from_status_code || '').toUpperCase();
  if (from === 'PENDING_QC') return '质检';
  if (from === 'PENDING_DIRECTOR') return '厂长';
  if (from === 'PENDING_WAREHOUSE') return '仓库';
  return '';
}

function inferSubmitUserName({ submitUserId, currentUserId, currentUserName, history }) {
  const list = Array.isArray(history) ? history : [];
  const submitRecord = list.find(x => String(x.action || '').toUpperCase() === 'SUBMIT');
  if (submitRecord?.operator_user_name) return submitRecord.operator_user_name;
  if (submitUserId && currentUserId && submitUserId === currentUserId) return currentUserName || '';
  return '';
}

function inferCurrentOwnerName({ statusCode, submitUserName, currentApprovalUserId, currentApprovalUserName, approvalRoleOwners }) {
  const s = String(statusCode || '').toUpperCase();
  if (!s || s === 'DRAFT' || s === 'REJECTED') return submitUserName || '';
  if (s === 'APPROVED') return '';
  if (currentApprovalUserName) return currentApprovalUserName;
  const owners = approvalRoleOwners || {};
  let role = '';
  if (s === 'PENDING_QC') role = 'QC';
  if (s === 'PENDING_DIRECTOR') role = 'DIRECTOR';
  if (s === 'PENDING_WAREHOUSE') role = 'WAREHOUSE';
  const cfg = owners[role] || {};
  if (cfg.user_name) return cfg.user_name;
  if (cfg.user_id && cfg.user_id === currentApprovalUserId && cfg.user_name) return cfg.user_name;
  return '';
}
