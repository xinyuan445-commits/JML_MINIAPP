import { getPurchaseOrderDetail, approvePurchaseOrder } from "../../api/u8_po";
import { getPurchaseOrderDetail2, approvePurchaseOrder2, unverifyPurchaseOrder } from "../../api/u8_po";

Page({
  data: {
    code: "",
    company: "",
    header: { 
      state: "", 
      code: "", 
      date: "", 
      vendorname: "", 
      maker: "", 
      verifier: "", 
      remark: "",
      define1: "",
      define14: "" 
    },
    items: [],
    statusTheme: "default", // TDesign tag theme
    lineCount: 0,
    totalAmount: "--"
  },

  async onLoad(options) {
    const code = options?.code || "";
    const company = options?.company || "";
    this.setData({ code, company });
    await this.fetchDetail();
  },

  async fetchDetail(silent = false) {
    const { code, company } = this.data;
    if (!code) {
      wx.showToast({ title: "缺少单号", icon: "none" });
      return;
    }
    const token = (wx.getStorageSync("u8_token_cache") || {}).id || "";
    
    // 根据公司计算 dsSequence (001->5, 008->7, 007->8)
    let ds = 5; // 默认 001
    if (company === "008") ds = 7;
    else if (company === "007") ds = 8;

    if (!silent) wx.showLoading({ title: "加载中...", mask: true });
    try {
      // 统一使用 getPurchaseOrderDetail
      const resp = await getPurchaseOrderDetail({ token, id: code, dsSequence: ds });
      
      // 容错处理：确保能取到 purchaseorder 对象
      // U8 API 可能返回 { purchaseorder: {...} } 或直接返回 purchaseorder 对象
      let po = resp?.purchaseorder || resp || {};
      // 如果 resp 本身就是 purchaseorder 对象（有些版本 API 是这样），则 po 就是 resp
      if (!po.code && resp.code) {
        po = resp;
      }
      
      const header = {
        state: po.state || "",
        code:  po.code  || "",
        date:  po.date  || "",
        vendorname: po.vendorname || "",
        maker: po.maker || "",
        verifier: po.verifier || "",
        remark: po.remark || "",
        define1: po.define1 || "",
        define14: po.define14 || ""
      };

      // 解析明细
      let entries = [];
      if (Array.isArray(po.entry)) {
        entries = po.entry;
      } else if (po.entry) {
        // 只有一行时可能是对象
        entries = [po.entry];
      }

      const items = entries.map((it, idx) => ({
        key: `${it.inventorycode || idx}`,
        inventorycode: it.inventorycode || "",
        inventoryname: it.inventoryname || "",
        inventorystd:  it.inventorystd  || "",
        unitname:      it.unitname       || "",
        quantity:      formatFixed2(it.quantity),
        taxprice:      formatFixed2(it.taxprice),
        sum:           formatFixed2(it.sum)
      }));

      const total = entries.reduce((acc, it) => {
        const n = Number(it?.sum);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);

      this.setData({
        header,
        items,
        statusTheme: this.mapStateToTheme(header.state),
        lineCount: items.length,
        totalAmount: formatFixed2(total)
      });
    } catch (err) {
      console.error("[PO-DETAIL] 请求失败:", err);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      if (!silent) wx.hideLoading();
    }
  },

  mapStateToTheme(s) {
    switch (String(s || "").trim()) {
      case "开立": return "primary"; // 蓝色
      case "审核": return "success"; // 绿色
      case "关闭": return "default"; // 灰色
      default: return "default";
    }
  },

  onApprove: async function () {
    const code = this.data?.header?.code;
    const company = this.data?.company;
    if (!code) {
      wx.showToast({ title: "缺少单号", icon: "none" });
      return;
    }
    const token = (wx.getStorageSync("u8_token_cache") || {}).id || "";
    
    // 根据公司计算 dsSequence
    let ds = 5;
    if (company === "008") ds = 7;
    else if (company === "007") ds = 8;
  
    wx.showLoading({ title: "提交中...", mask: true });
    try {
      // 统一使用 approvePurchaseOrder，并传入 ds_sequence
      const r = await approvePurchaseOrder({ token, voucher_code: code, ds_sequence: ds });
      // 检查 errcode
      if (r && (r.errcode === "0" || r.errcode === 0)) {
        // 1. 立即关闭 Loading
        wx.hideLoading();
        // 2. 显示成功提示
        wx.showToast({ title: "审核成功", icon: "success" });
        
        // 3. 乐观更新：立即修改本地状态，给用户“秒开”的错觉
        this.setData({
          'header.state': '审核',
          statusTheme: 'success'
        });

        // 4. 标记列表页需要刷新
        try { wx.setStorageSync('po_need_reload', 1) } catch(e) {}
        
        // 5. 静默刷新详情（不显示 Loading），获取真实的审核人等信息
        await this.fetchDetail(true); 
      } else {
        throw new Error(r?.errmsg || "审核失败");
      }
    } catch (err) {
      wx.hideLoading();
      console.error("[审核失败]", err);
      wx.showToast({ title: err?.message || "审核失败", icon: "none" });
    }
  },

  onUnverify: async function () {
    const code = this.data?.header?.code;
    const company = this.data?.company;
    if (!code) {
      wx.showToast({ title: "缺少单号", icon: "none" });
      return;
    }
  
    let ds = 5;
    if (company === "008") ds = 7;
    else if (company === "007") ds = 8;
  
    wx.showLoading({ title: "提交中...", mask: true });
    try {
      const resp = await unverifyPurchaseOrder({
        voucher_code: code,
        ds_sequence: ds
      });
      if (String(resp?.errcode) === "0") {
        wx.hideLoading();
        wx.showToast({ title: "弃审成功", icon: "success" });

        // 乐观更新
        this.setData({
          'header.state': '开立',
          statusTheme: 'primary'
        });

        try { wx.setStorageSync('po_need_reload', 1) } catch(e) {}
        await this.fetchDetail(true); 
      } else {
        wx.hideLoading();
        wx.showToast({ title: resp?.errmsg || "弃审失败", icon: "none" });
      }
    } catch (err) {
      wx.hideLoading();
      console.error("[弃审失败]", err);
      wx.showToast({ title: err?.message || "网络/接口错误", icon: "none" });
    }
  }
});

function formatFixed2(v) {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  const s = n.toFixed(2);
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
