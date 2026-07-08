const BASE_URL = "https://api.yonyouup.com/api",
  APP_KEY = "opa3616de88da543d8b",
  FROM_ACCOUNT = "JML2021",
  TO_ACCOUNT = "JML2021",
  DS_SEQUENCE = 7;

function readCachedU8Token() {
  try {
    const e = wx.getStorageSync("u8_token_cache");
    return (e == null ? void 0 : e.id) || ""
  } catch (e) {
    return ""
  }
}

// 获取交易号 tradeid（用于防重复提交）：GET /system/tradeid（注意不在 /api 下）
export function getTradeId({ token = readCachedU8Token() } = {}) {
  if (!token) return Promise.reject(new Error("缺少 token"));
  const qs = [
    `from_account=${encodeURIComponent(FROM_ACCOUNT)}`,
    `app_key=${encodeURIComponent(APP_KEY)}`,
    `token=${encodeURIComponent(token)}`
  ].join("&");
  const url = `https://api.yonyouup.com/system/tradeid?${qs}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      header: { "Content-Type": "application/json; charset=UTF-8" },
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`));
          return;
        }
        const d = res.data || {};
        const id = d.trade && d.trade.id;
        if (String(d.errcode) === "0" && id) resolve(id);
        else reject(new Error(d.errmsg || "获取交易号失败"));
      },
      fail: reject
    });
  });
}
export function getPurchaseOrderList(e = {}) {
  const {
    token: t = readCachedU8Token(),
    dateBegin: o,
    dateEnd: n,
    pageIndex: a = 1,
    rowsPerPage: r = 20,
    codeBegin: cb,
    codeEnd: ce,
    state: st,
    dsSequence: ds = DS_SEQUENCE // 支持参数传入，默认使用全局配置
  } = e;
  if (!t) return Promise.reject(new Error("缺少 U8 token，请先获取并缓存到 u8_token_cache.id"));
  if (!o || !n) return Promise.reject(new Error("缺少日期区间：dateBegin / dateEnd"));
  const s = `${BASE_URL}/purchaseorderlist/batch_get`,
    c = {
      from_account: FROM_ACCOUNT,
      to_account: TO_ACCOUNT,
      app_key: APP_KEY,
      token: t,
      ds_sequence: ds,
      page_index: a,
      rows_per_page: r,
      date_begin: o,
      date_end: n,
      ...(cb ? { code_begin: cb } : {}),
      ...(ce ? { code_end: ce } : {}),
      ...(st ? { state: st } : {})
    };
  return new Promise((e, t) => {
    wx.request({
      url: s,
      method: "GET",
      data: c,
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      success: o => {
        o.statusCode === 200 ? e(o.data) : t(new Error(`HTTP ${o.statusCode}: ${JSON.stringify(o.data)}`))
      },
      fail: e => t(e)
    })
  })
}

export function getPurchaseOrderDetail(e = {}) {
  const {
    token: t = readCachedU8Token(),
    id: o,
    dsSequence: ds = DS_SEQUENCE // 支持参数传入，默认使用全局配置
  } = e;
  if (!t) return Promise.reject(new Error("缺少 U8 token"));
  if (!o) return Promise.reject(new Error("缺少 id（采购单号）"));
  const n = `${BASE_URL}/purchaseorder/get`,
    a = {
      from_account: FROM_ACCOUNT,
      to_account: TO_ACCOUNT,
      app_key: APP_KEY,
      token: t,
      ds_sequence: ds,
      id: o
    };
  return new Promise((e, t) => {
    wx.request({
      url: n,
      method: "GET",
      data: a,
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      success: o => {
        o.statusCode === 200 ? e(o.data) : t(new Error(`HTTP ${o.statusCode}: ${JSON.stringify(o.data)}`))
      },
      fail: e => t(e)
    })
  })
}
export function verifyPurchaseOrder({
  token: e,
  voucher_code: t,
  person_code: o,
  user_id: n,
  ds_sequence: a = DS_SEQUENCE
}) {
  if (!e) return Promise.reject(new Error("缺少 token"));
  if (!t) return Promise.reject(new Error("缺少 voucher_code"));
  // 审核前动态获取交易号（防重复提交），不再依赖写死的 tradeid
  return getTradeId({ token: e }).then((tradeid) => {
    const s = [`from_account=${encodeURIComponent(FROM_ACCOUNT)}`, `to_account=${encodeURIComponent(TO_ACCOUNT)}`, `app_key=${encodeURIComponent(APP_KEY)}`, `token=${encodeURIComponent(e)}`, ...(a != null ? [`ds_sequence=${encodeURIComponent(a)}`] : []), `tradeid=${encodeURIComponent(tradeid)}`].join("&");
    const c = `${BASE_URL}/purchaseorder/verify?${s}`;
    const i = { purchaseorder: { voucher_code: t } };
    return new Promise((resolve, reject) => {
      wx.request({
        url: c,
        method: "POST",
        header: { "Content-Type": "application/json; charset=UTF-8" },
        data: i,
        success: res => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`));
            return;
          }
          const d = res.data || {};
          String(d.errcode) === "0" ? resolve(d) : reject(new Error(d.errmsg || "审核失败"));
        },
        fail: reject
      });
    });
  });
}
export const approvePurchaseOrder = verifyPurchaseOrder;
export function loginU8UserV2({
  token: e,
  user_id: t,
  password: o,
  ds_sequence: n = DS_SEQUENCE
}) {
  if (!e) return Promise.reject(new Error("缺少 token"));
  if (!t) return Promise.reject(new Error("缺少 user_id"));
  if (o == null) return Promise.reject(new Error("缺少 password"));
  const a = [`from_account=${encodeURIComponent(FROM_ACCOUNT)}`, `to_account=${encodeURIComponent(TO_ACCOUNT)}`, `app_key=${encodeURIComponent(APP_KEY)}`, `token=${encodeURIComponent(e)}`, ...(n != null ? [`ds_sequence=${encodeURIComponent(n)}`] : [])].join("&"),
    r = `${BASE_URL}/user/login_v2?${a}`,
    s = {
      user: {
        user_id: t,
        password: o
      }
    };
  return new Promise((t, o) => {
    wx.request({
      url: r,
      method: "POST",
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      data: s,
      success: e => {
        if (e.statusCode !== 200) {
          o(new Error(`HTTP ${e.statusCode}: ${JSON.stringify(e.data)}`));
          return
        }
        const n = e.data || {};
        if (String(n.errcode) === "0") {
          try {
            wx.setStorageSync("u8_user_login_resp", n)
          } catch (e) {}
          t(n)
        } else o(new Error(n.errmsg || "登录失败"))
      },
      fail: e => o(e)
    })
  })
}
export const loginU8User = loginU8UserV2;
export function fetchInventory({
  token: e
}) {
  if (!e) return Promise.reject(new Error("缺少 token"));
  const t = [`from_account=${encodeURIComponent(FROM_ACCOUNT)}`, `to_account=${encodeURIComponent(TO_ACCOUNT)}`, `app_key=${encodeURIComponent(APP_KEY)}`, `token=${encodeURIComponent(e)}`, `ds_sequence=${encodeURIComponent(DS_SEQUENCE)}`].join("&"),
    o = `${BASE_URL}/inventory/get?${t}`;
  return new Promise((e, t) => {
    wx.request({
      url: o,
      method: "GET",
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      success: o => {
        if (o.statusCode !== 200) {
          t(new Error(`HTTP ${o.statusCode}: ${JSON.stringify(o.data)}`));
          return
        }
        const n = Array.isArray(o.data?.inventory) ? o.data.inventory : [];
        const a = n.filter(e => /^1|^2|^31/.test(String(e.code))).map(e => ({
          code: e.code,
          name: e.name
        }));
        e(a)
      },
      fail: e => t(e)
    })
  })
}

export function getPurchaseOrderList2(e = {}) {
  const {
    token: t = readCachedU8Token(),
    dateBegin: o,
    dateEnd: n,
    pageIndex: a = 1,
    rowsPerPage: r = 20,
    codeBegin: cb,
    codeEnd: ce,
    state: st // 新增状态筛选参数
  } = e;

  if (!t) return Promise.reject(new Error("缺少 U8 token，请先获取并缓存到 u8_token_cache.id"));
  if (!o || !n) return Promise.reject(new Error("缺少日期区间：dateBegin / dateEnd"));

  const s = `${BASE_URL}/purchaseorderlist/batch_get`,
    c = {
      from_account: FROM_ACCOUNT,
      to_account: TO_ACCOUNT,
      app_key: APP_KEY,
      token: t,
      ds_sequence: 5,   // ✅ 固定为 5
      page_index: a,
      rows_per_page: r,
      date_begin: o,
      date_end: n,
      ...(cb ? { code_begin: cb } : {}),
      ...(ce ? { code_end: ce } : {}),
      ...(st ? { state: st } : {}) // 传递 state 参数
    };

  return new Promise((e, t) => {
    wx.request({
      url: s,
      method: "GET",
      data: c,
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      success: o => {
        o.statusCode === 200 ? e(o.data) : t(new Error(`HTTP ${o.statusCode}: ${JSON.stringify(o.data)}`))
      },
      fail: e => t(e)
    })
  })
}
// 固定 ds_sequence=5 的采购单详情查询
export function getPurchaseOrderDetail2(e = {}) {
  const {
    token: t = readCachedU8Token(),
    id: o
  } = e;

  if (!t) return Promise.reject(new Error("缺少 U8 token"));
  if (!o) return Promise.reject(new Error("缺少 id（采购单号）"));

  const n = `${BASE_URL}/purchaseorder/get`,
    a = {
      from_account: FROM_ACCOUNT,
      to_account: TO_ACCOUNT,
      app_key: APP_KEY,
      token: t,
      ds_sequence: 5,   // ✅ 固定为 5
      id: o
    };

  return new Promise((e, t) => {
    wx.request({
      url: n,
      method: "GET",
      data: a,
      header: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      success: o => {
        o.statusCode === 200 ? e(o.data) : t(new Error(`HTTP ${o.statusCode}: ${JSON.stringify(o.data)}`))
      },
      fail: e => t(e)
    })
  })
}

// 旧版固定 ds=5 的审核，统一走 verifyPurchaseOrder（内部自动取 tradeid）
export function approvePurchaseOrder2(opts = {}) {
  return verifyPurchaseOrder({ ds_sequence: 5, ...opts });
}
// 弃审采购订单（需手动传 ds_sequence）
export function unverifyPurchaseOrder({ voucher_code, ds_sequence } = {}) {
  const token = (wx.getStorageSync("u8_token_cache") || {}).id || "";
  if (!token) return Promise.reject(new Error("缺少 U8 token"));
  if (!voucher_code) return Promise.reject(new Error("缺少 voucher_code"));
  if (ds_sequence == null || ds_sequence === "") return Promise.reject(new Error("缺少 ds_sequence"));

  // ✅ 把 from_account 等拼到 URL 查询串
  const qs = [
    `from_account=${encodeURIComponent(FROM_ACCOUNT)}`,
    `to_account=${encodeURIComponent(TO_ACCOUNT)}`,
    `app_key=${encodeURIComponent(APP_KEY)}`,
    `token=${encodeURIComponent(token)}`,
    `ds_sequence=${encodeURIComponent(ds_sequence)}`
  ].join("&");

  const url = `${BASE_URL}/purchaseorder/unverify?${qs}`;
  const body = { purchaseorder: { voucher_code } };

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "POST",
      data: body,
      header: { "Content-Type": "application/json; charset=UTF-8" },
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data); // { errcode: "0", errmsg: "" }
        else reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`));
      },
      fail: reject
    });
  });
}
