const QUOTEAPI  = 'https://api.quanshenghuoqin.com/api/quote';
const QUERY_RUN = 'https://api.quanshenghuoqin.com/api/query/run';
const MOAPI     = 'https://api.jinmilong.cn/api/mo';

const MATERIAL_TYPES = ['基材', '正面装饰纸', '背面装饰纸', '正面装饰木皮', '反面装饰木皮'];

// 金额统一截断到两位，不四舍五入。
function trunc2(value) {
  const n = Number(value) || 0;
  return Math.trunc((n + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return trunc2(value).toFixed(2);
}

// 当前登录用户ID（与 Mo/ProcessMgmt 取法一致）
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
    form: { customer: '', categoryCode: '', categoryName: '', invCode: '' },
    categories: [],
    categoryNames: [],
    categoryIndex: -1,
    // 客户联想
    custSugs: [],
    custSugVisible: false,
    // 存货编码查询（仅标识，不再算成本）
    searching: false,
    invPopupVisible: false,
    invResults: [],
    // 成本（固定，来自产品类别）
    calc: null,
    costItems: [],
    expandedCost: '',
    // 报价参数默认值，可按单修改；物流成本在每条材料中单独控制。
    rates: { firstPass: '96', gross: '25', dealer: '15', tax: '13' },
    result: null,
    formulaOpen: false,
    // 材料明细（可折叠，未税计入成本未税）
    matTypes: MATERIAL_TYPES,
    materials: [],
    materialTotal: '0.00',
    materialOpen: false,
    saving: false
  },

  onLoad(options) {
    this.copyId = options && options.copy_id ? decodeURIComponent(options.copy_id) : '';
    // 复制为新报价：带 category_code / inv_code / customer 预填
    if (options && (options.category_code || options.inv_code || options.customer)) {
      this.prefill = {
        category_code: options.category_code ? decodeURIComponent(options.category_code) : '',
        inv_code: options.inv_code ? decodeURIComponent(options.inv_code) : '',
        customer: options.customer ? decodeURIComponent(options.customer) : ''
      };
    }
    this.loadCategories();
  },

  onShow() {
    if (!this.data.categories.length) this.loadCategories();
  },

  loadCategories() {
    wx.request({
      url: `${QUOTEAPI}/category/list`,
      method: 'GET',
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0) {
          wx.showToast({ title: msg || '加载失败', icon: 'none' });
          return;
        }
        const list = data || [];
        this.setData({ categories: list, categoryNames: list.map(c => c.name) }, () => {
          if (this.copyId && !this._copyLoaded) {
            this._copyLoaded = true;
            this.loadCopySource(this.copyId, list);
          } else if (this.prefill && !this._prefilled) {
            this._prefilled = true;
            this.applyPrefill(list);
          }
        });
      },
      fail: () => wx.showToast({ title: '网络异常', icon: 'none' })
    });
  },

  loadCopySource(id, categories) {
    wx.showLoading({ title: '复制中', mask: true });
    wx.request({
      url: `${QUOTEAPI}/detail`,
      method: 'GET',
      data: { id },
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0 || !data) {
          wx.showModal({ title: '复制失败', content: msg || '原报价不存在', showCancel: false });
          return;
        }
        const snapshot = data.form_snapshot || {};
        const savedRates = snapshot.rates || {};
        const savedMaterials = (snapshot.materials && snapshot.materials.items) || [];
        const oldLogistics = snapshot.logistics || {};
        const materials = savedMaterials.map((item, index) => {
          const savedTypeName = item.typeName || MATERIAL_TYPES[item.typeIndex] || MATERIAL_TYPES[0];
          const typeIndex = Math.max(0, MATERIAL_TYPES.indexOf(savedTypeName));
          const hasRowLogistics = item.logisticsEnabled !== undefined;
          const inheritOldLogistics = !hasRowLogistics && index === 0 && oldLogistics.enabled;
          return {
            key: `${Date.now()}_${index}`,
            typeIndex,
            typeName: MATERIAL_TYPES[typeIndex],
            code: item.code || '',
            priceExcl: money(item.priceExcl),
            logisticsEnabled: hasRowLogistics ? !!item.logisticsEnabled : !!inheritOldLogistics,
            logisticsCost: hasRowLogistics
              ? money(item.logisticsEnabled ? item.logisticsCost : 0)
              : money(inheritOldLogistics ? oldLogistics.unitCost : 0)
          };
        });
        const categoryIndex = categories.findIndex(c => c.code === data.category_code);
        this.setData({
          categoryIndex,
          'form.customer': data.customer || '',
          'form.categoryCode': data.category_code || '',
          'form.categoryName': data.category_name || '',
          'form.invCode': (snapshot.basic && snapshot.basic.invCode) || '',
          'rates.firstPass': String(savedRates.firstPass ?? '96'),
          'rates.gross': String(savedRates.directMargin ?? '25'),
          'rates.dealer': String(savedRates.dealerMargin ?? '15'),
          'rates.tax': String(savedRates.tax ?? '13'),
          materials,
          materialOpen: materials.length > 0
        }, () => {
          if (categoryIndex >= 0) this.loadCost(data.category_code);
        });
      },
      fail: () => wx.showModal({ title: '复制失败', content: '网络异常', showCancel: false }),
      complete: () => wx.hideLoading()
    });
  },

  applyPrefill(list) {
    const p = this.prefill;
    const patch = {};
    if (p.customer) patch['form.customer'] = p.customer;
    if (p.inv_code) patch['form.invCode'] = p.inv_code;
    let idx = -1;
    if (p.category_code) {
      idx = list.findIndex(c => c.code === p.category_code);
      if (idx >= 0) {
        patch.categoryIndex = idx;
        patch['form.categoryName'] = list[idx].name;
        patch['form.categoryCode'] = list[idx].code;
      }
    }
    this.setData(patch, () => { if (idx >= 0) this.loadCost(list[idx].code); });
  },

  // 客户联想
  onCustInput(e) {
    const v = e.detail.value;
    this.setData({ 'form.customer': v });
    clearTimeout(this._custTimer);
    if (!v.trim()) {
      this.setData({ custSugs: [], custSugVisible: false });
      return;
    }
    this._custTimer = setTimeout(() => this.loadCustomerSugs(v.trim()), 300);
  },

  loadCustomerSugs(kw) {
    wx.request({
      url: `${QUOTEAPI}/customers`,
      method: 'GET',
      data: { keyword: kw },
      success: (res) => {
        const { code, data } = res.data || {};
        if (code !== 0) return;
        const sugs = (data || []).filter(s => s !== this.data.form.customer);
        this.setData({ custSugs: sugs, custSugVisible: sugs.length > 0 });
      }
    });
  },

  onCustFocus() {
    if (this.data.custSugs.length) this.setData({ custSugVisible: true });
  },

  onCustBlur() {
    setTimeout(() => this.setData({ custSugVisible: false }), 200);
  },

  pickCust(e) {
    const name = e.currentTarget.dataset.name || '';
    this.setData({ 'form.customer': name, custSugVisible: false, custSugs: [] });
  },

  goCustHistory() {
    const c = (this.data.form.customer || '').trim();
    if (!c) { wx.showToast({ title: '请先输入客户', icon: 'none' }); return; }
    wx.navigateTo({ url: `History?customer=${encodeURIComponent(c)}` });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onCategoryChange(e) {
    const idx = e.detail.value;
    const c = this.data.categories[idx];
    if (!c) {
      this.loadCategories();
      wx.showToast({ title: '类别加载中，请重试', icon: 'none' });
      return;
    }
    this.setData({ categoryIndex: idx, 'form.categoryName': c.name, 'form.categoryCode': c.code });
    this.loadCost(c.code);
  },

  // 按产品类别取固定成本
  loadCost(code) {
    wx.showLoading({ title: '加载中', mask: true });
    wx.request({
      url: `${QUOTEAPI}/cost/calc`,
      method: 'GET',
      data: { category_code: code },
      success: (res) => {
        const { code: c, data, msg } = res.data || {};
        if (c !== 0) {
          this.setData({ calc: null, costItems: [], totalExcl: '', totalIncl: '', result: null });
          wx.showModal({ title: '无法获取成本', content: msg || '失败', showCancel: false });
          return;
        }
        const co = data.costs || {};
        const breakdown = data.breakdown || {};
        const fmt = (v) => (v == null ? '—' : money(v));
        const processes = data.processes || [];
        const laborTotal = (+breakdown.process_labor || 0) + (+breakdown.management || 0);
        data.costs = { ...co, labor: laborTotal };
        const processDetails = (field) => processes
          .filter(p => (+p[field] || 0) !== 0)
          .map(p => ({
            name: p[`${field === 'aux_material' ? 'aux' : field}_process_name`] || p.process_name,
            amount: fmt(p[field])
          }));
        const laborDetails = processDetails('labor');
        laborDetails.push({
          name: '管理费用',
          amount: fmt(breakdown.management)
        });
        const auxDetails = processes
          .filter(p => (+p.aux_material || 0) !== 0)
          .map(p => ({
            name: p.aux_process_name || p.process_name,
            amount: fmt((+p.aux_material || 0) / 1.13)
          }));
        const costItems = [
          { key: 'labor', name: '人工成本（含管理费用）', amount: fmt(laborTotal), details: laborDetails },
          { key: 'aux', name: '辅助材料（未税）', amount: fmt(co.aux_material), details: auxDetails.concat([
            { name: '包装辅材', amount: fmt((+breakdown.packaging_aux || 0) / 1.13) }
          ]) },
          { key: 'energy', name: '能耗', amount: fmt(co.energy), details: processDetails('energy').concat([
            { name: '能耗公摊', amount: fmt(breakdown.common_energy) }
          ]) }
        ];
        this.setData({ calc: data, costItems, expandedCost: '' }, () => this.recompute());
      },
      fail: () => wx.showModal({ title: '网络错误', content: '获取成本失败', showCancel: false }),
      complete: () => wx.hideLoading()
    });
  },

  toggleCost(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ expandedCost: this.data.expandedCost === key ? '' : key });
  },

  onRateInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`rates.${field}`]: e.detail.value }, () => this.recompute());
  },

  // 成本未税 = 人工（含管理费）+ 能耗 + 未税辅材 + 材料未税合计
  // 报价未税 = 含合格率成本 ÷(1-售价毛利率)；报价含税 = 报价未税 ×(1+固定税率)
  recompute() {
    const d = this.data.calc;
    const co = (d && d.costs) || {};
    if (!d || (co.labor == null && co.energy == null && co.aux_material == null)) {
      this.setData({ result: null });
      return;
    }
    const matExcl = (this.data.materials || []).reduce((s, m) => s + (parseFloat(m.priceExcl) || 0), 0);
    const logistics = (this.data.materials || []).reduce(
      (s, m) => s + (m.logisticsEnabled ? (parseFloat(m.logisticsCost) || 0) : 0), 0
    );
    const base = (+co.labor || 0) + (+co.energy || 0)
      + (+co.aux_material || 0) + matExcl + logistics;
    const fp = parseFloat(this.data.rates.firstPass);
    const gm = parseFloat(this.data.rates.gross);    // 直营毛利率
    const dl = parseFloat(this.data.rates.dealer);   // 经销商毛利率
    const tax = parseFloat(this.data.rates.tax);
    const afterYield = Math.ceil(fp > 0 ? base / (fp / 100) : base);
    const withTax = (v) => (!isNaN(tax) ? v * (1 + tax / 100) : v);
    const directExcl = !isNaN(gm) && gm < 100 ? afterYield / (1 - gm / 100) : afterYield;
    const dealerExcl = !isNaN(dl) && dl < 100 ? afterYield / (1 - dl / 100) : afterYield;
    this.setData({
      materialTotal: money(matExcl + logistics),
      result: {
        afterYield: String(afterYield),
        hasDirect: !isNaN(gm),
        hasDealer: !isNaN(dl),
        directExcl: money(directExcl),
        directIncl: money(withTax(directExcl)),
        dealerExcl: money(dealerExcl),
        dealerIncl: money(withTax(dealerExcl))
      }
    });
  },

  toggleFormula() {
    this.setData({ formulaOpen: !this.data.formulaOpen });
  },

  // ── 材料明细 ──
  toggleMaterial() {
    this.setData({ materialOpen: !this.data.materialOpen });
  },

  addMaterial() {
    const materials = this.data.materials.concat({
      key: `${Date.now()}_${this.data.materials.length}`,
      typeIndex: 0, typeName: MATERIAL_TYPES[0],
      code: '', priceExcl: '0.00', logisticsEnabled: false, logisticsCost: '0'
    });
    this.setData({ materials, materialOpen: true });
  },

  delMaterial(e) {
    const i = e.currentTarget.dataset.index;
    const materials = this.data.materials.slice();
    materials.splice(i, 1);
    this.setData({ materials }, () => this.recompute());
  },

  onMatType(e) {
    const i = e.currentTarget.dataset.index;
    const idx = +e.detail.value;
    this.setData({ [`materials[${i}].typeIndex`]: idx, [`materials[${i}].typeName`]: MATERIAL_TYPES[idx] });
  },

  onMatCode(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`materials[${i}].code`]: e.detail.value });
  },

  onMatCodeBlur(e) {
    this.fetchMatPrice(e.currentTarget.dataset.index);
  },

  // 按料号查最近采购价，自动回填未税单价（失焦、选中后都调）
  fetchMatPrice(i) {
    const m = this.data.materials[i];
    const code = (m && m.code || '').trim();
    if (!code) return;
    wx.request({
      url: `${MOAPI}/material/price`,
      method: 'GET',
      data: { inv_code: code, mat_type: m.typeName },
      timeout: 15000,
      success: (res) => {
        const { code: c, data, msg } = res.data || {};
        if (c !== 0 || !data) { wx.showToast({ title: msg || '无采购价', icon: 'none' }); return; }
        const incl = data.price_incl == null ? 0 : +data.price_incl;
        const excl = data.price_excl == null ? incl / 1.13 : +data.price_excl;
        this.setData({
          [`materials[${i}].priceExcl`]: money(excl)
        }, () => this.recompute());
      },
      fail: () => wx.showToast({ title: '查价失败', icon: 'none' })
    });
  },

  onMatPriceExcl(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`materials[${i}].priceExcl`]: e.detail.value }, () => this.recompute());
  },

  onMatLogisticsSwitch(e) {
    const i = e.currentTarget.dataset.index;
    const enabled = !!e.detail.value;
    const current = parseFloat(this.data.materials[i].logisticsCost) || 0;
    this.setData({
      [`materials[${i}].logisticsEnabled`]: enabled,
      [`materials[${i}].logisticsCost`]: enabled ? (current > 0 ? String(current) : '5') : '0'
    }, () => this.recompute());
  },

  onMatLogisticsInput(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`materials[${i}].logisticsCost`]: e.detail.value }, () => this.recompute());
  },

  // 调存货搜索接口，结果灌入弹层（产品不传 mat_type，材料传行类型）
  _doInvSearch(keyword, matType) {
    const kw = (keyword || '').trim();
    if (!kw) { wx.showToast({ title: '请先输入关键词', icon: 'none' }); return; }
    this.setData({ searching: true });
    wx.request({
      url: `${QUOTEAPI}/inventory/search`,
      method: 'GET',
      data: { keyword: kw, mat_type: matType || '' },
      timeout: 15000,
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0) { wx.showToast({ title: msg || '查询失败', icon: 'none' }); return; }
        const list = data || [];
        this.setData({ invResults: list, invPopupVisible: true });
        if (!list.length) wx.showToast({ title: '无匹配', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '查询失败', icon: 'none' }),
      complete: () => this.setData({ searching: false })
    });
  },

  // 产品存货搜索（原方式：分词 + 固定过滤裸 SQL 走 /query/run）
  searchInv() {
    this._matIndex = null;
    const raw = this.data.form.invCode || '';
    const tokens = raw.split(/[ 　,，、]+/).map(s => s.trim()).filter(Boolean);
    if (!tokens.length) {
      wx.showToast({ title: '请先输入存货编码关键词', icon: 'none' });
      return;
    }
    const safe = (s) => s.replace(/'/g, "''");
    const tokenWhere = tokens.map(k => `cinvcode LIKE '%${safe(k)}%'`).join(' and ');
    const fixedWhere = "cinvcode LIKE '1%' and cinvcode NOT LIKE '%88%' and cinvname NOT LIKE '%测试%' and cinvname NOT LIKE '%客供%' and cinvcode LIKE '%-%-%-%' and CHAR_LENGTH(SUBSTRING_INDEX(SUBSTRING_INDEX(cinvcode, '-', 4), '-', -1)) <= 6 and CHAR_LENGTH(SUBSTRING_INDEX(cinvcode, '-', -1)) > 2";
    const sql = `SELECT cinvcode, cinvname FROM inventory WHERE ${tokenWhere} and ${fixedWhere} ORDER BY cinvcode ASC LIMIT 0, 50`;

    this.setData({ searching: true });
    wx.request({
      url: `${QUERY_RUN}?sql=${encodeURIComponent(sql)}`,
      method: 'GET',
      timeout: 15000,
      success: (res) => {
        const d = res.data;
        const rows = Array.isArray(d) ? d
          : (Array.isArray(d && d.data) ? d.data
          : (Array.isArray(d && d.rows) ? d.rows : []));
        const list = rows.map(r => ({ code: r.cinvcode || '', name: r.cinvname || '' })).filter(x => x.code);
        this.setData({ invResults: list, invPopupVisible: true });
        if (!list.length) wx.showToast({ title: '无匹配存货', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '查询失败', icon: 'none' }),
      complete: () => this.setData({ searching: false })
    });
  },

  // 材料存货搜索（按该行材料类型前缀过滤）
  searchMat(e) {
    const i = e.currentTarget.dataset.index;
    const m = this.data.materials[i];
    this._matIndex = i;
    this._doInvSearch(m && m.code, m && m.typeName);
  },

  pickInv(e) {
    const code = e.currentTarget.dataset.code || '';
    if (!code) return;
    if (this._matIndex != null) {
      const i = this._matIndex;
      this._matIndex = null;
      this.setData({ [`materials[${i}].code`]: code, invPopupVisible: false }, () => this.fetchMatPrice(i));
    } else {
      this.setData({ 'form.invCode': code, invPopupVisible: false });
    }
  },

  closeInv() {
    this.setData({ invPopupVisible: false });
  },

  noop() {},

  copyInvCode() {
    const code = (this.data.form.invCode || '').trim();
    if (!code) { wx.showToast({ title: '存货编码为空', icon: 'none' }); return; }
    wx.setClipboardData({ data: code });
  },

  showTips() {
    wx.showModal({
      title: '注意事项',
      content: '1、客户会自动联想，仅限创建过报价单的客户\n2、报价参数默认96%/25%/15%/13%，可按单修改\n3、每条材料可单独启用物流，开启后默认5元，关闭按0元\n4、保存前请核对好填写信息！！！！',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onSave() {
    const d = this.data;
    if (d.saving) return;
    if (!(d.form.customer || '').trim()) { wx.showToast({ title: '请填写客户', icon: 'none' }); return; }
    if (!d.form.categoryCode)            { wx.showToast({ title: '请选择产品类型', icon: 'none' }); return; }
    if (!d.calc || !d.result)            { wx.showToast({ title: '成本未加载，请重选产品类型', icon: 'none' }); return; }
    const fp = parseFloat(d.rates.firstPass);
    const gross = parseFloat(d.rates.gross);
    const dealer = parseFloat(d.rates.dealer);
    const tax = parseFloat(d.rates.tax);
    if (!(fp > 0 && fp <= 100)) { wx.showToast({ title: '一次合格率须大于0且不超过100', icon: 'none' }); return; }
    if (!(gross >= 0 && gross < 100)) { wx.showToast({ title: '直营毛利率须在0到100之间', icon: 'none' }); return; }
    if (!(dealer >= 0 && dealer < 100)) { wx.showToast({ title: '经销商毛利率须在0到100之间', icon: 'none' }); return; }
    if (!(tax >= 0)) { wx.showToast({ title: '报价税率不能小于0', icon: 'none' }); return; }
    const userId = getUserId();
    if (!userId) { wx.showToast({ title: '未获取到登录员工', icon: 'none' }); return; }

    const calc = d.calc;
    const co = calc.costs || {};
    const bd = calc.breakdown || {};
    const processes = calc.processes || [];
    const materialTotal = (d.materials || []).reduce((sum, item) => sum + (+item.priceExcl || 0), 0);
    const logisticsTotal = (d.materials || []).reduce(
      (sum, item) => sum + (item.logisticsEnabled ? (+item.logisticsCost || 0) : 0), 0
    );
    const snapshot = {
      basic: {
        customer: d.form.customer.trim(),
        categoryCode: d.form.categoryCode,
        categoryName: d.form.categoryName,
        invCode: (d.form.invCode || '').trim(),
        unit: calc.unit || ''
      },
      route: {
        routeNo: calc.route_no,
        routeDesc: calc.route_desc || ''
      },
      labor: {
        total: co.labor,
        processTotal: bd.process_labor,
        managementBase: bd.management_base,
        managementRate: bd.management_rate,
        management: bd.management,
        managementMethod: calc.mgmt_method || '',
        items: processes.filter(p => (+p.labor || 0) !== 0).map(p => ({
          processCode: p.labor_process_code || p.process_code,
          processName: p.labor_process_name || p.process_name,
          amount: p.labor
        }))
      },
      auxiliary: {
        totalInclTax: (+bd.process_aux_material || 0) + (+bd.packaging_aux || 0),
        totalExclTax: co.aux_material,
        taxRate: 13,
        items: processes.filter(p => (+p.aux_material || 0) !== 0).map(p => ({
          processCode: p.aux_process_code || p.process_code,
          processName: p.aux_process_name || p.process_name,
          amountInclTax: p.aux_material,
          amountExclTax: trunc2((+p.aux_material || 0) / 1.13),
          remark: p.remark || ''
        })).concat([{
          processCode: 'PACKAGING_AUX',
          processName: '包装辅材',
          amountInclTax: +bd.packaging_aux || 0,
          amountExclTax: trunc2((+bd.packaging_aux || 0) / 1.13)
        }])
      },
      energy: {
        total: co.energy,
        processTotal: bd.process_energy,
        commonEnergy: bd.common_energy,
        items: processes.filter(p => (+p.energy || 0) !== 0).map(p => ({
          processCode: p.energy_process_code || p.process_code,
          processName: p.energy_process_name || p.process_name,
          amount: p.energy
        }))
      },
      materials: {
        baseExclTax: trunc2(materialTotal),
        logisticsTotal: trunc2(logisticsTotal),
        totalExclTax: trunc2(materialTotal + logisticsTotal),
        items: (d.materials || []).map(item => ({ ...item }))
      },
      logistics: {
        enabled: logisticsTotal > 0,
        unitCost: trunc2(logisticsTotal)
      },
      rates: {
        firstPass: d.rates.firstPass,
        directMargin: d.rates.gross,
        dealerMargin: d.rates.dealer,
        tax: d.rates.tax
      },
      result: { ...d.result }
    };

    this.setData({ saving: true });
    wx.request({
      url: `${QUOTEAPI}/save`,
      method: 'POST',
      data: { created_staff_id: userId, form_snapshot: snapshot },
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0 || !data) {
          wx.showModal({ title: '保存失败', content: msg || '保存失败', showCancel: false });
          return;
        }
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => wx.redirectTo({ url: `Detailed?id=${data.id}` }), 500);
      },
      fail: () => wx.showModal({ title: '网络错误', content: '保存报价失败', showCancel: false }),
      complete: () => this.setData({ saving: false })
    });
  }
});
