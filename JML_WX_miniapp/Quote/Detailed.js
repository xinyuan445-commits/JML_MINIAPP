const QUOTEAPI = 'https://api.quanshenghuoqin.com/api/quote';

function money(value) {
  const n = Number(value) || 0;
  return (Math.trunc((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

function pct(value) {
  return value === null || value === undefined || value === '' ? '—' : `${value}%`;
}

function wholeUp(value) {
  return String(Math.ceil(Number(value) || 0));
}

Page({
  data: {
    rec: null,
    snapshot: {},
    costRows: [],
    rates: {},
    result: {},
    formulaOpen: false,
    scrolling: false
  },

  onPageScroll() {
    clearTimeout(this._scrollTimer);
    if (!this.data.scrolling) this.setData({ scrolling: true });
    this._scrollTimer = setTimeout(() => this.setData({ scrolling: false }), 150);
  },

  onLoad({ id }) {
    this.id = id;
    this.loadDetail(id);
  },

  loadDetail(id) {
    wx.showLoading({ title: '加载中', mask: true });
    wx.request({
      url: `${QUOTEAPI}/detail`,
      method: 'GET',
      data: { id },
      success: (res) => {
        const { code, data, msg } = res.data || {};
        if (code !== 0 || !data) {
          wx.showModal({ title: '加载失败', content: msg || '记录不存在', showCancel: false });
          return;
        }
        const s = data.form_snapshot || {};
        const labor = s.labor || {};
        const auxiliary = s.auxiliary || {};
        const energy = s.energy || {};
        const materials = s.materials || {};
        const rates = s.rates || {};
        const laborItems = (labor.items || []).map(it => ({ name: it.processName, amount: money(it.amount) }));
        laborItems.push({ name: '管理费用', amount: money(labor.management) });
        const auxItems = (auxiliary.items || []).map(it => ({
          name: it.processName,
          amount: money(it.amountExclTax)
        }));
        const energyItems = (energy.items || []).map(it => ({ name: it.processName, amount: money(it.amount) }));
        energyItems.push({ name: '能耗公摊', amount: money(energy.commonEnergy) });
        const materialItems = (materials.items || []).map(it => {
          const logisticsCost = it.logisticsEnabled ? (+it.logisticsCost || 0) : 0;
          return {
            name: `${it.typeName || '材料'} · ${it.code || '未填写料号'}${logisticsCost ? ` · 物流 ¥${money(logisticsCost)}` : ''}`,
            amount: money((+it.priceExcl || 0) + logisticsCost)
          };
        });
        const costRows = [
          { type: 'labor', name: '人工成本（含管理费用）', amount: money(data.labor_cost), items: laborItems, expanded: false },
          { type: 'aux', name: '辅助材料（未税）', amount: money(data.aux_cost_excl_tax), items: auxItems, expanded: false },
          { type: 'energy', name: '能耗', amount: money(data.energy_cost), items: energyItems, expanded: false },
          { type: 'materials', name: '材料（含物流）', amount: money((+data.material_cost_excl_tax || 0) + (+data.logistics_cost || 0)), items: materialItems, expanded: false }
        ];
        this.setData({
          rec: data,
          snapshot: s,
          costRows,
          rates: {
            firstPass: pct(rates.firstPass),
            direct: pct(rates.directMargin),
            dealer: pct(rates.dealerMargin),
            tax: pct(rates.tax)
          },
          result: {
            base: money(data.base_cost_excl_tax),
            afterYield: wholeUp(data.cost_after_yield),
            directExcl: data.direct_price_excl_tax == null ? '' : money(data.direct_price_excl_tax),
            directIncl: data.direct_price_incl_tax == null ? '' : money(data.direct_price_incl_tax),
            dealerExcl: data.dealer_price_excl_tax == null ? '' : money(data.dealer_price_excl_tax),
            dealerIncl: data.dealer_price_incl_tax == null ? '' : money(data.dealer_price_incl_tax)
          }
        });
      },
      fail: () => wx.showModal({ title: '网络错误', content: '加载失败', showCancel: false }),
      complete: () => wx.hideLoading()
    });
  },

  toggleCat(e) {
    const i = e.currentTarget.dataset.index;
    this.setData({ [`costRows[${i}].expanded`]: !this.data.costRows[i].expanded });
  },

  toggleFormula() {
    this.setData({ formulaOpen: !this.data.formulaOpen });
  },

  goCustHistory() {
    const customer = (this.data.rec && this.data.rec.customer || '').trim();
    if (customer) wx.navigateTo({ url: `History?customer=${encodeURIComponent(customer)}` });
  },

  onCopy() {
    const r = this.data.rec;
    if (!r) return;
    wx.navigateTo({
      url: `Edit?copy_id=${encodeURIComponent(r.id || this.id)}`
    });
  }
});
