"use strict";

function e(e, t) {
  for (var n = 0; n < t.length; n++) {
    const r = t[n];
    if ("string" != typeof r && !Array.isArray(r))
      for (const t in r)
        if ("default" !== t && !(t in e)) {
          const n = Object.getOwnPropertyDescriptor(r, t);
          n && Object.defineProperty(e, t, n.get ? n : {
            enumerable: !0,
            get: () => r[t]
          })
        }
  }
  return Object.freeze(Object.defineProperty(e, Symbol.toStringTag, {
    value: "Module"
  }))
}

function t(e, t) {
  const n = Object.create(null),
    r = e.split(",");
  for (let o = 0; o < r.length; o++) n[r[o]] = !0;
  return t ? e => !!n[e.toLowerCase()] : e => !!n[e]
}

function n(e) {
  if (w(e)) {
    const t = {};
    for (let r = 0; r < e.length; r++) {
      const o = e[r],
        i = _(o) ? a(o) : n(o);
      if (i)
        for (const e in i) t[e] = i[e]
    }
    return t
  }
  return _(e) || k(e) ? e : void 0
}
const r = /;(?![^(]*\))/g,
  o = /:([^]+)/,
  i = /\/\*.*?\*\//gs;

function a(e) {
  const t = {};
  return e.replace(i, "").split(r).forEach((e => {
    if (e) {
      const n = e.split(o);
      n.length > 1 && (t[n[0].trim()] = n[1].trim())
    }
  })), t
}

function s(e) {
  let t = "";
  if (_(e)) t = e;
  else if (w(e))
    for (let n = 0; n < e.length; n++) {
      const r = s(e[n]);
      r && (t += r + " ")
    } else if (k(e))
      for (const n in e) e[n] && (t += n + " ");
  return t.trim()
}
const c = (e, t) => t && t.__v_isRef ? c(e, t.value) : S(t) ? {
    [`Map(${t.size})`]: [...t.entries()].reduce(((e, [t, n]) => (e[`${t} =>`] = n, e)), {})
  } : x(t) ? {
    [`Set(${t.size})`]: [...t.values()]
  } : !k(t) || w(t) || C(t) ? t : String(t),
  u = {},
  l = [],
  f = () => {},
  p = () => !1,
  d = /^on[^a-z]/,
  h = e => d.test(e),
  g = e => e.startsWith("onUpdate:"),
  y = Object.assign,
  m = (e, t) => {
    const n = e.indexOf(t);
    n > -1 && e.splice(n, 1)
  },
  b = Object.prototype.hasOwnProperty,
  v = (e, t) => b.call(e, t),
  w = Array.isArray,
  S = e => "[object Map]" === I(e),
  x = e => "[object Set]" === I(e),
  A = e => "function" == typeof e,
  _ = e => "string" == typeof e,
  P = e => "symbol" == typeof e,
  k = e => null !== e && "object" == typeof e,
  T = e => k(e) && A(e.then) && A(e.catch),
  E = Object.prototype.toString,
  I = e => E.call(e),
  O = e => I(e).slice(8, -1),
  C = e => "[object Object]" === I(e),
  B = e => _(e) && "NaN" !== e && "-" !== e[0] && "" + parseInt(e, 10) === e,
  j = t(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),
  D = e => {
    const t = Object.create(null);
    return n => t[n] || (t[n] = e(n))
  },
  N = /-(\w)/g,
  R = D((e => e.replace(N, ((e, t) => t ? t.toUpperCase() : "")))),
  L = /\B([A-Z])/g,
  M = D((e => e.replace(L, "-$1").toLowerCase())),
  F = D((e => e.charAt(0).toUpperCase() + e.slice(1))),
  U = D((e => e ? `on${F(e)}` : "")),
  q = (e, t) => !Object.is(e, t),
  $ = (e, t) => {
    for (let n = 0; n < e.length; n++) e[n](t)
  },
  z = (e, t, n) => {
    Object.defineProperty(e, t, {
      configurable: !0,
      enumerable: !1,
      value: n
    })
  },
  Q = e => {
    const t = parseFloat(e);
    return isNaN(t) ? e : t
  },
  H = e => {
    const t = _(e) ? Number(e) : NaN;
    return isNaN(t) ? e : t
  },
  W = "\n",
  V = "d",
  K = "onShow",
  J = "onHide",
  G = "onLaunch",
  Y = "onError",
  X = "onThemeChange",
  Z = "onPageNotFound",
  ee = "onUnhandledRejection",
  te = "onLoad",
  ne = "onReady",
  re = "onUnload",
  oe = "onInit",
  ie = "onSaveExitState",
  ae = "onResize",
  se = "onBackPress",
  ce = "onPageScroll",
  ue = "onTabItemTap",
  le = "onReachBottom",
  fe = "onPullDownRefresh",
  pe = "onShareTimeline",
  de = "onAddToFavorites",
  he = "onShareAppMessage",
  ge = "onNavigationBarButtonTap",
  ye = "onNavigationBarSearchInputClicked",
  me = "onNavigationBarSearchInputChanged",
  be = "onNavigationBarSearchInputConfirmed",
  ve = "onNavigationBarSearchInputFocusChanged",
  we = /:/g;
const Se = (e, t) => {
  let n;
  for (let r = 0; r < e.length; r++) n = e[r](t);
  return n
};

function xe(e, t = null) {
  let n;
  return (...r) => (e && (n = e.apply(t, r), e = null), n)
}

function Ae(e, t) {
  if (!_(t)) return;
  const n = (t = t.replace(/\[(\d+)\]/g, ".$1")).split(".");
  let r = n[0];
  return e || (e = {}), 1 === n.length ? e[r] : Ae(e[r], n.slice(1).join("."))
}

function _e(e) {
  let t = {};
  return C(e) && Object.keys(e).sort().forEach((n => {
    const r = n;
    t[r] = e[r]
  })), Object.keys(t) ? t : e
}
const Pe = encodeURIComponent;

function ke(e, t = Pe) {
  const n = e ? Object.keys(e).map((n => {
    let r = e[n];
    return void 0 === typeof r || null === r ? r = "" : C(r) && (r = JSON.stringify(r)), t(n) + "=" + t(r)
  })).filter((e => e.length > 0)).join("&") : null;
  return n ? `?${n}` : ""
}
const Te = [oe, te, K, J, re, se, ce, ue, le, fe, pe, he, de, ie, ge, ye, me, be, ve];
const Ee = [K, J, G, Y, X, Z, ee, "onExit", oe, te, ne, re, ae, se, ce, ue, le, fe, pe, de, he, ie, ge, ye, me, be, ve],
  Ie = (() => ({
    onPageScroll: 1,
    onShareAppMessage: 2,
    onShareTimeline: 4
  }))();

function Oe(e, t, n = !0) {
  return !(n && !A(t)) && (Ee.indexOf(e) > -1 || 0 === e.indexOf("on"))
}
let Ce;
const Be = [];
const je = xe(((e, t) => {
    if (A(e._component.onError)) return t(e)
  })),
  De = function () {};
De.prototype = {
  on: function (e, t, n) {
    var r = this.e || (this.e = {});
    return (r[e] || (r[e] = [])).push({
      fn: t,
      ctx: n
    }), this
  },
  once: function (e, t, n) {
    var r = this;

    function o() {
      r.off(e, o), t.apply(n, arguments)
    }
    return o._ = t, this.on(e, o, n)
  },
  emit: function (e) {
    for (var t = [].slice.call(arguments, 1), n = ((this.e || (this.e = {}))[e] || []).slice(), r = 0, o = n.length; r < o; r++) n[r].fn.apply(n[r].ctx, t);
    return this
  },
  off: function (e, t) {
    var n = this.e || (this.e = {}),
      r = n[e],
      o = [];
    if (r && t)
      for (var i = 0, a = r.length; i < a; i++) r[i].fn !== t && r[i].fn._ !== t && o.push(r[i]);
    return o.length ? n[e] = o : delete n[e], this
  }
};
var Ne = De;
const Re = ["{", "}"];
const Le = /^(?:\d)+/,
  Me = /^(?:\w)+/;
const Fe = "zh-Hans",
  Ue = "zh-Hant",
  qe = "en",
  $e = "fr",
  ze = "es",
  Qe = Object.prototype.hasOwnProperty,
  He = (e, t) => Qe.call(e, t),
  We = new class {
    constructor() {
      this._caches = Object.create(null)
    }
    interpolate(e, t, n = Re) {
      if (!t) return [e];
      let r = this._caches[e];
      return r || (r = function (e, [t, n]) {
          const r = [];
          let o = 0,
            i = "";
          for (; o < e.length;) {
            let a = e[o++];
            if (a === t) {
              i && r.push({
                type: "text",
                value: i
              }), i = "";
              let t = "";
              for (a = e[o++]; void 0 !== a && a !== n;) t += a, a = e[o++];
              const s = a === n,
                c = Le.test(t) ? "list" : s && Me.test(t) ? "named" : "unknown";
              r.push({
                value: t,
                type: c
              })
            } else i += a
          }
          return i && r.push({
            type: "text",
            value: i
          }), r
        }(e, n), this._caches[e] = r),
        function (e, t) {
          const n = [];
          let r = 0;
          const o = Array.isArray(t) ? "list" : (i = t, null !== i && "object" == typeof i ? "named" : "unknown");
          var i;
          if ("unknown" === o) return n;
          for (; r < e.length;) {
            const i = e[r];
            switch (i.type) {
              case "text":
                n.push(i.value);
                break;
              case "list":
                n.push(t[parseInt(i.value, 10)]);
                break;
              case "named":
                "named" === o && n.push(t[i.value])
            }
            r++
          }
          return n
        }(r, t)
    }
  };

function Ve(e, t) {
  if (!e) return;
  if (e = e.trim().replace(/_/g, "-"), t && t[e]) return e;
  if ("chinese" === (e = e.toLowerCase())) return Fe;
  if (0 === e.indexOf("zh")) return e.indexOf("-hans") > -1 ? Fe : e.indexOf("-hant") > -1 ? Ue : (n = e, ["-tw", "-hk", "-mo", "-cht"].find((e => -1 !== n.indexOf(e))) ? Ue : Fe);
  var n;
  let r = [qe, $e, ze];
  t && Object.keys(t).length > 0 && (r = Object.keys(t));
  const o = function (e, t) {
    return t.find((t => 0 === e.indexOf(t)))
  }(e, r);
  return o || void 0
}
class Ke {
  constructor({
    locale: e,
    fallbackLocale: t,
    messages: n,
    watcher: r,
    formater: o
  }) {
    this.locale = qe, this.fallbackLocale = qe, this.message = {}, this.messages = {}, this.watchers = [], t && (this.fallbackLocale = t), this.formater = o || We, this.messages = n || {}, this.setLocale(e || qe), r && this.watchLocale(r)
  }
  setLocale(e) {
    const t = this.locale;
    this.locale = Ve(e, this.messages) || this.fallbackLocale, this.messages[this.locale] || (this.messages[this.locale] = {}), this.message = this.messages[this.locale], t !== this.locale && this.watchers.forEach((e => {
      e(this.locale, t)
    }))
  }
  getLocale() {
    return this.locale
  }
  watchLocale(e) {
    const t = this.watchers.push(e) - 1;
    return () => {
      this.watchers.splice(t, 1)
    }
  }
  add(e, t, n = !0) {
    const r = this.messages[e];
    r ? n ? Object.assign(r, t) : Object.keys(t).forEach((e => {
      He(r, e) || (r[e] = t[e])
    })) : this.messages[e] = t
  }
  f(e, t, n) {
    return this.formater.interpolate(e, t, n).join("")
  }
  t(e, t, n) {
    let r = this.message;
    return "string" == typeof t ? (t = Ve(t, this.messages)) && (r = this.messages[t]) : n = t, He(r, e) ? this.formater.interpolate(r[e], n).join("") : (console.warn(`Cannot translate the value of keypath ${e}. Use the value of keypath as default.`), e)
  }
}

function Je(e) {
  return function () {
    try {
      return e.apply(e, arguments)
    } catch (Vs) {
      console.error(Vs)
    }
  }
}
let Ge = 1;
const Ye = {};

function Xe(e, t, n) {
  if ("number" == typeof e) {
    const r = Ye[e];
    if (r) return r.keepAlive || delete Ye[e], r.callback(t, n)
  }
  return t
}
const Ze = "success",
  et = "fail",
  tt = "complete";

function nt(e, t = {}, {
  beforeAll: n,
  beforeSuccess: r
} = {}) {
  C(t) || (t = {});
  const {
    success: o,
    fail: i,
    complete: a
  } = function (e) {
    const t = {};
    for (const n in e) {
      const r = e[n];
      A(r) && (t[n] = Je(r), delete e[n])
    }
    return t
  }(t), s = A(o), c = A(i), u = A(a), l = Ge++;
  return function (e, t, n, r = !1) {
    Ye[e] = {
      name: t,
      keepAlive: r,
      callback: n
    }
  }(l, e, (l => {
    (l = l || {}).errMsg = function (e, t) {
      return e && -1 !== e.indexOf(":fail") ? t + e.substring(e.indexOf(":fail")) : t + ":ok"
    }(l.errMsg, e), A(n) && n(l), l.errMsg === e + ":ok" ? (A(r) && r(l, t), s && o(l)) : c && i(l), u && a(l)
  })), l
}
const rt = "success",
  ot = "fail",
  it = "complete",
  at = {},
  st = {};

function ct(e, t) {
  return function (n) {
    return e(n, t) || n
  }
}

function ut(e, t, n) {
  let r = !1;
  for (let o = 0; o < e.length; o++) {
    const i = e[o];
    if (r) r = Promise.resolve(ct(i, n));
    else {
      const e = i(t, n);
      if (T(e) && (r = Promise.resolve(e)), !1 === e) return {
        then() {},
        catch () {}
      }
    }
  }
  return r || {
    then: e => e(t),
    catch () {}
  }
}

function lt(e, t = {}) {
  return [rt, ot, it].forEach((n => {
    const r = e[n];
    if (!w(r)) return;
    const o = t[n];
    t[n] = function (e) {
      ut(r, e, t).then((e => A(o) && o(e) || e))
    }
  })), t
}

function ft(e, t) {
  const n = [];
  w(at.returnValue) && n.push(...at.returnValue);
  const r = st[e];
  return r && w(r.returnValue) && n.push(...r.returnValue), n.forEach((e => {
    t = e(t) || t
  })), t
}

function pt(e) {
  const t = Object.create(null);
  Object.keys(at).forEach((e => {
    "returnValue" !== e && (t[e] = at[e].slice())
  }));
  const n = st[e];
  return n && Object.keys(n).forEach((e => {
    "returnValue" !== e && (t[e] = (t[e] || []).concat(n[e]))
  })), t
}

function dt(e, t, n, r) {
  const o = pt(e);
  if (o && Object.keys(o).length) {
    if (w(o.invoke)) {
      return ut(o.invoke, n).then((n => t(lt(pt(e), n), ...r)))
    }
    return t(lt(o, n), ...r)
  }
  return t(n, ...r)
}

function ht(e, t) {
  return (n = {}, ...r) => function (e) {
    return !(!C(e) || ![Ze, et, tt].find((t => A(e[t]))))
  }(n) ? ft(e, dt(e, t, n, r)) : ft(e, new Promise(((o, i) => {
    dt(e, t, y(n, {
      success: o,
      fail: i
    }), r)
  })))
}

function gt(e, t, n, r) {
  return Xe(e, y({
    errMsg: t + ":fail" + (n ? " " + n : "")
  }, r))
}

function yt(e, t, n, r) {
  if (r && r.beforeInvoke) {
    const e = r.beforeInvoke(t);
    if (_(e)) return e
  }
  const o = function (e, t) {
    const n = e[0];
    if (!t || !C(t.formatArgs) && C(n)) return;
    const r = t.formatArgs,
      o = Object.keys(r);
    for (let i = 0; i < o.length; i++) {
      const t = o[i],
        a = r[t];
      if (A(a)) {
        const r = a(e[0][t], n);
        if (_(r)) return r
      } else v(n, t) || (n[t] = a)
    }
  }(t, r);
  if (o) return o
}

function mt(e, t, n, r) {
  return n => {
    const o = nt(e, n, r),
      i = yt(0, [n], 0, r);
    return i ? gt(o, e, i) : t(n, {
      resolve: t => function (e, t, n) {
        return Xe(e, y(n || {}, {
          errMsg: t + ":ok"
        }))
      }(o, e, t),
      reject: (t, n) => gt(o, e, function (e) {
        return !e || _(e) ? e : e.stack ? (console.error(e.message + W + e.stack), e.message) : e
      }(t), n)
    })
  }
}

function bt(e, t, n, r) {
  return function (e, t, n, r) {
    return (...e) => {
      const n = yt(0, e, 0, r);
      if (n) throw new Error(n);
      return t.apply(null, e)
    }
  }(0, t, 0, r)
}
let vt = !1,
  wt = 0,
  St = 0;

function xt() {
  const {
    platform: e,
    pixelRatio: t,
    windowWidth: n
  } = wx.getSystemInfoSync();
  wt = n, St = t, vt = "ios" === e
}
const At = bt(0, ((e, t) => {
  if (0 === wt && xt(), 0 === (e = Number(e))) return 0;
  let n = e / 750 * (t || wt);
  return n < 0 && (n = -n), n = Math.floor(n + 1e-4), 0 === n && (n = 1 !== St && vt ? .5 : 1), e < 0 ? -n : n
}));

function _t(e, t) {
  Object.keys(t).forEach((n => {
    A(t[n]) && (e[n] = function (e, t) {
      const n = t ? e ? e.concat(t) : w(t) ? t : [t] : e;
      return n ? function (e) {
        const t = [];
        for (let n = 0; n < e.length; n++) - 1 === t.indexOf(e[n]) && t.push(e[n]);
        return t
      }(n) : n
    }(e[n], t[n]))
  }))
}

function Pt(e, t) {
  e && t && Object.keys(t).forEach((n => {
    const r = e[n],
      o = t[n];
    w(r) && A(o) && m(r, o)
  }))
}
const kt = bt(0, ((e, t) => {
    _(e) && C(t) ? _t(st[e] || (st[e] = {}), t) : C(e) && _t(at, e)
  })),
  Tt = bt(0, ((e, t) => {
    _(e) ? C(t) ? Pt(st[e], t) : delete st[e] : C(e) && Pt(at, e)
  })),
  Et = new Ne,
  It = bt(0, ((e, t) => (Et.on(e, t), () => Et.off(e, t)))),
  Ot = bt(0, ((e, t) => (Et.once(e, t), () => Et.off(e, t)))),
  Ct = bt(0, ((e, t) => {
    e ? (w(e) || (e = [e]), e.forEach((e => Et.off(e, t)))) : Et.e = {}
  })),
  Bt = bt(0, ((e, ...t) => {
    Et.emit(e, ...t)
  }));
let jt, Dt, Nt;

function Rt(e) {
  try {
    return JSON.parse(e)
  } catch (Vs) {}
  return e
}
const Lt = [];

function Mt(e, t) {
  Lt.forEach((n => {
    n(e, t)
  })), Lt.length = 0
}
const Ft = ht(Ut = "getPushClientId", function (e, t, n, r) {
  return mt(e, t, 0, r)
}(Ut, ((e, {
  resolve: t,
  reject: n
}) => {
  Promise.resolve().then((() => {
    void 0 === Nt && (Nt = !1, jt = "", Dt = "uniPush is not enabled"), Lt.push(((e, r) => {
      e ? t({
        cid: e
      }) : n(r)
    })), void 0 !== jt && Mt(jt, Dt)
  }))
}), 0, qt));
var Ut, qt;
const $t = [],
  zt = /^\$|getLocale|setLocale|sendNativeEvent|restoreGlobal|requireGlobal|getCurrentSubNVue|getMenuButtonBoundingClientRect|^report|interceptors|Interceptor$|getSubNVueById|requireNativePlugin|upx2px|hideKeyboard|canIUse|^create|Sync$|Manager$|base64ToArrayBuffer|arrayBufferToBase64|getDeviceInfo|getAppBaseInfo|getWindowInfo|getSystemSetting|getAppAuthorizeSetting/,
  Qt = /^create|Manager$/,
  Ht = ["createBLEConnection"],
  Wt = ["createBLEConnection"],
  Vt = /^on|^off/;

function Kt(e) {
  return Qt.test(e) && -1 === Ht.indexOf(e)
}

function Jt(e) {
  return zt.test(e) && -1 === Wt.indexOf(e)
}

function Gt(e) {
  return !(Kt(e) || Jt(e) || function (e) {
    return Vt.test(e) && "onPush" !== e
  }(e))
}

function Yt(e, t) {
  return Gt(e) && A(t) ? function (n = {}, ...r) {
    return A(n.success) || A(n.fail) || A(n.complete) ? ft(e, dt(e, t, n, r)) : ft(e, new Promise(((o, i) => {
      dt(e, t, y({}, n, {
        success: o,
        fail: i
      }), r)
    })))
  } : t
}
Promise.prototype.finally || (Promise.prototype.finally = function (e) {
  const t = this.constructor;
  return this.then((n => t.resolve(e && e()).then((() => n))), (n => t.resolve(e && e()).then((() => {
    throw n
  }))))
});
const Xt = ["success", "fail", "cancel", "complete"];
const Zt = () => {
    const e = A(getApp) && getApp({
      allowDefault: !0
    });
    return e && e.$vm ? e.$vm.$locale : Ve(wx.getSystemInfoSync().language) || qe
  },
  en = [];
"undefined" != typeof global && (global.getLocale = Zt);
const tn = "__DC_STAT_UUID";
let nn;

function rn(e = wx) {
  return function (t, n) {
    nn = nn || e.getStorageSync(tn), nn || (nn = Date.now() + "" + Math.floor(1e7 * Math.random()), wx.setStorage({
      key: tn,
      data: nn
    })), n.deviceId = nn
  }
}

function on(e, t) {
  if (e.safeArea) {
    const n = e.safeArea;
    t.safeAreaInsets = {
      top: n.top,
      left: n.left,
      right: e.windowWidth - n.right,
      bottom: e.screenHeight - n.bottom
    }
  }
}

function an(e, t) {
  let n = e.deviceType || "phone"; {
    const e = {
        ipad: "pad",
        windows: "pc",
        mac: "pc"
      },
      r = Object.keys(e),
      o = t.toLocaleLowerCase();
    for (let t = 0; t < r.length; t++) {
      const i = r[t];
      if (-1 !== o.indexOf(i)) {
        n = e[i];
        break
      }
    }
  }
  return n
}

function sn(e) {
  let t = e;
  return t && (t = t.toLocaleLowerCase()), t
}

function cn(e) {
  return Zt ? Zt() : e
}

function un(e) {
  let t = e.hostName || "WeChat";
  return e.environment ? t = e.environment : e.host && e.host.env && (t = e.host.env), t
}
const ln = {
    returnValue: (e, t) => {
      on(e, t), rn()(e, t),
        function (e, t) {
          const {
            brand: n = "",
            model: r = "",
            system: o = "",
            language: i = "",
            theme: a,
            version: s,
            platform: c,
            fontSizeSetting: u,
            SDKVersion: l,
            pixelRatio: f,
            deviceOrientation: p
          } = e;
          let d = "",
            h = "";
          d = o.split(" ")[0] || "", h = o.split(" ")[1] || "";
          let g = s,
            m = an(e, r),
            b = sn(n),
            v = un(e),
            w = p,
            S = f,
            x = l;
          const A = i.replace(/_/g, "-"),
            _ = {
              appId: "__UNI__4EB86B2",
              appName: "金米龙",
              appVersion: "1.0.0",
              appVersionCode: "100",
              appLanguage: cn(A),
              uniCompileVersion: "3.98",
              uniRuntimeVersion: "3.98",
              uniPlatform: "mp-weixin",
              deviceBrand: b,
              deviceModel: r,
              deviceType: m,
              devicePixelRatio: S,
              deviceOrientation: w,
              osName: d.toLocaleLowerCase(),
              osVersion: h,
              hostTheme: a,
              hostVersion: g,
              hostLanguage: A,
              hostName: v,
              hostSDKVersion: x,
              hostFontSizeSetting: u,
              windowTop: 0,
              windowBottom: 0,
              osLanguage: void 0,
              osTheme: void 0,
              ua: void 0,
              hostPackageName: void 0,
              browserName: void 0,
              browserVersion: void 0
            };
          y(t, _)
        }(e, t)
    }
  },
  fn = ln,
  pn = {
    args(e, t) {
      let n = parseInt(e.current);
      if (isNaN(n)) return;
      const r = e.urls;
      if (!w(r)) return;
      const o = r.length;
      return o ? (n < 0 ? n = 0 : n >= o && (n = o - 1), n > 0 ? (t.current = r[n], t.urls = r.filter(((e, t) => !(t < n) || e !== r[n]))) : t.current = r[0], {
        indicator: !1,
        loop: !1
      }) : void 0
    }
  },
  dn = {
    args(e, t) {
      t.alertText = e.title
    }
  },
  hn = {
    returnValue: (e, t) => {
      const {
        brand: n,
        model: r
      } = e;
      let o = an(e, r),
        i = sn(n);
      rn()(e, t), t = _e(y(t, {
        deviceType: o,
        deviceBrand: i,
        deviceModel: r
      }))
    }
  },
  gn = {
    returnValue: (e, t) => {
      const {
        version: n,
        language: r,
        SDKVersion: o,
        theme: i
      } = e;
      let a = un(e),
        s = r.replace(/_/g, "-");
      t = _e(y(t, {
        hostVersion: n,
        hostLanguage: s,
        hostName: a,
        hostSDKVersion: o,
        hostTheme: i,
        appId: "__UNI__4EB86B2",
        appName: "金米龙",
        appVersion: "1.0.0",
        appVersionCode: "100",
        appLanguage: cn(s)
      }))
    }
  },
  yn = {
    returnValue: (e, t) => {
      on(e, t), t = _e(y(t, {
        windowTop: 0,
        windowBottom: 0
      }))
    }
  },
  mn = {
    $on: It,
    $off: Ct,
    $once: Ot,
    $emit: Bt,
    upx2px: At,
    interceptors: {},
    addInterceptor: kt,
    removeInterceptor: Tt,
    onCreateVueApp: function (e) {
      if (Ce) return e(Ce);
      Be.push(e)
    },
    invokeCreateVueAppHook: function (e) {
      Ce = e, Be.forEach((t => t(e)))
    },
    getLocale: Zt,
    setLocale: e => {
      const t = A(getApp) && getApp();
      if (!t) return !1;
      return t.$vm.$locale !== e && (t.$vm.$locale = e, en.forEach((t => t({
        locale: e
      }))), !0)
    },
    onLocaleChange: e => {
      -1 === en.indexOf(e) && en.push(e)
    },
    getPushClientId: Ft,
    onPushMessage: e => {
      -1 === $t.indexOf(e) && $t.push(e)
    },
    offPushMessage: e => {
      if (e) {
        const t = $t.indexOf(e);
        t > -1 && $t.splice(t, 1)
      } else $t.length = 0
    },
    invokePushCallback: function (e) {
      if ("enabled" === e.type) Nt = !0;
      else if ("clientId" === e.type) jt = e.cid, Dt = e.errMsg, Mt(jt, e.errMsg);
      else if ("pushMsg" === e.type) {
        const t = {
          type: "receive",
          data: Rt(e.message)
        };
        for (let e = 0; e < $t.length; e++) {
          if ((0, $t[e])(t), t.stopped) break
        }
      } else "click" === e.type && $t.forEach((t => {
        t({
          type: "click",
          data: Rt(e.message)
        })
      }))
    }
  };
const bn = ["qy", "env", "error", "version", "lanDebug", "cloud", "serviceMarket", "router", "worklet", "__webpack_require_UNI_MP_PLUGIN__"],
  vn = ["lanDebug", "router", "worklet"],
  wn = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : null;

function Sn(e) {
  return (!wn || 1154 !== wn.scene || !vn.includes(e)) && (bn.indexOf(e) > -1 || "function" == typeof wx[e])
}

function xn() {
  const e = {};
  for (const t in wx) Sn(t) && (e[t] = wx[t]);
  return "undefined" != typeof globalThis && "undefined" == typeof requireMiniProgram && (globalThis.wx = e), e
}
const An = ["__route__", "__wxExparserNodeId__", "__wxWebviewId__"],
  _n = (Pn = {
    oauth: ["weixin"],
    share: ["weixin"],
    payment: ["wxpay"],
    push: ["weixin"]
  }, function ({
    service: e,
    success: t,
    fail: n,
    complete: r
  }) {
    let o;
    Pn[e] ? (o = {
      errMsg: "getProvider:ok",
      service: e,
      provider: Pn[e]
    }, A(t) && t(o)) : (o = {
      errMsg: "getProvider:fail:服务[" + e + "]不存在"
    }, A(n) && n(o)), A(r) && r(o)
  });
var Pn;
const kn = xn();
let Tn = kn.getAppBaseInfo && kn.getAppBaseInfo();
Tn || (Tn = kn.getSystemInfoSync());
const En = Tn ? Tn.host : null,
  In = En && "SAAASDK" === En.env ? kn.miniapp.shareVideoMessage : kn.shareVideoMessage;
var On = Object.freeze({
  __proto__: null,
  createSelectorQuery: function () {
    const e = kn.createSelectorQuery(),
      t = e.in;
    return e.in = function (e) {
      return t.call(this, function (e) {
        const t = Object.create(null);
        return An.forEach((n => {
          t[n] = e[n]
        })), t
      }(e))
    }, e
  },
  getProvider: _n,
  shareVideoMessage: In
});
const Cn = {
  args(e, t) {
    e.compressedHeight && !t.compressHeight && (t.compressHeight = e.compressedHeight), e.compressedWidth && !t.compressWidth && (t.compressWidth = e.compressedWidth)
  }
};
var Bn = Object.freeze({
  __proto__: null,
  compressImage: Cn,
  getAppAuthorizeSetting: {
    returnValue: function (e, t) {
      const {
        locationReducedAccuracy: n
      } = e;
      t.locationAccuracy = "unsupported", !0 === n ? t.locationAccuracy = "reduced" : !1 === n && (t.locationAccuracy = "full")
    }
  },
  getAppBaseInfo: gn,
  getDeviceInfo: hn,
  getSystemInfo: ln,
  getSystemInfoSync: fn,
  getWindowInfo: yn,
  previewImage: pn,
  redirectTo: {},
  showActionSheet: dn
});
const jn = xn();
var Dn = function (e, t, n = wx) {
  const r = function (e) {
    function t(e, t, n) {
      return function (o) {
        return t(r(e, o, n))
      }
    }

    function n(e, n, r = {}, o = {}, i = !1) {
      if (C(n)) {
        const a = !0 === i ? n : {};
        A(r) && (r = r(n, a) || {});
        for (const s in n)
          if (v(r, s)) {
            let t = r[s];
            A(t) && (t = t(n[s], n, a)), t ? _(t) ? a[t] = n[s] : C(t) && (a[t.name ? t.name : s] = t.value) : console.warn(`微信小程序 ${e} 暂不支持 ${s}`)
          } else if (-1 !== Xt.indexOf(s)) {
          const r = n[s];
          A(r) && (a[s] = t(e, r, o))
        } else i || v(a, s) || (a[s] = n[s]);
        return a
      }
      return A(n) && (n = t(e, n, o)), n
    }

    function r(t, r, o, i = !1) {
      return A(e.returnValue) && (r = e.returnValue(t, r)), n(t, r, o, {}, i)
    }
    return function (t, o) {
      if (!v(e, t)) return o;
      const i = e[t];
      return i ? function (e, o) {
        let a = i;
        A(i) && (a = i(e));
        const s = [e = n(t, e, a.args, a.returnValue)];
        void 0 !== o && s.push(o);
        const c = wx[a.name || t].apply(wx, s);
        return Jt(t) ? r(t, c, a.returnValue, Kt(t)) : c
      } : function () {
        console.error(`微信小程序 暂不支持${t}`)
      }
    }
  }(t);
  return new Proxy({}, {
    get: (t, o) => v(t, o) ? t[o] : v(e, o) ? Yt(o, e[o]) : v(mn, o) ? Yt(o, mn[o]) : Yt(o, r(o, n[o]))
  })
}(On, Bn, jn);
let Nn;
class Rn {
  constructor(e = !1) {
    this.detached = e, this._active = !0, this.effects = [], this.cleanups = [], this.parent = Nn, !e && Nn && (this.index = (Nn.scopes || (Nn.scopes = [])).push(this) - 1)
  }
  get active() {
    return this._active
  }
  run(e) {
    if (this._active) {
      const t = Nn;
      try {
        return Nn = this, e()
      } finally {
        Nn = t
      }
    }
  }
  on() {
    Nn = this
  }
  off() {
    Nn = this.parent
  }
  stop(e) {
    if (this._active) {
      let t, n;
      for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].stop();
      for (t = 0, n = this.cleanups.length; t < n; t++) this.cleanups[t]();
      if (this.scopes)
        for (t = 0, n = this.scopes.length; t < n; t++) this.scopes[t].stop(!0);
      if (!this.detached && this.parent && !e) {
        const e = this.parent.scopes.pop();
        e && e !== this && (this.parent.scopes[this.index] = e, e.index = this.index)
      }
      this.parent = void 0, this._active = !1
    }
  }
}

function Ln(e) {
  return new Rn(e)
}

function Mn() {
  return Nn
}
const Fn = e => {
    const t = new Set(e);
    return t.w = 0, t.n = 0, t
  },
  Un = e => (e.w & Qn) > 0,
  qn = e => (e.n & Qn) > 0,
  $n = new WeakMap;
let zn = 0,
  Qn = 1;
const Hn = 30;
let Wn;
const Vn = Symbol(""),
  Kn = Symbol("");
class Jn {
  constructor(e, t = null, n) {
    this.fn = e, this.scheduler = t, this.active = !0, this.deps = [], this.parent = void 0,
      function (e, t = Nn) {
        t && t.active && t.effects.push(e)
      }(this, n)
  }
  run() {
    if (!this.active) return this.fn();
    let e = Wn,
      t = Yn;
    for (; e;) {
      if (e === this) return;
      e = e.parent
    }
    try {
      return this.parent = Wn, Wn = this, Yn = !0, Qn = 1 << ++zn, zn <= Hn ? (({
        deps: e
      }) => {
        if (e.length)
          for (let t = 0; t < e.length; t++) e[t].w |= Qn
      })(this) : Gn(this), this.fn()
    } finally {
      zn <= Hn && (e => {
        const {
          deps: t
        } = e;
        if (t.length) {
          let n = 0;
          for (let r = 0; r < t.length; r++) {
            const o = t[r];
            Un(o) && !qn(o) ? o.delete(e) : t[n++] = o, o.w &= ~Qn, o.n &= ~Qn
          }
          t.length = n
        }
      })(this), Qn = 1 << --zn, Wn = this.parent, Yn = t, this.parent = void 0, this.deferStop && this.stop()
    }
  }
  stop() {
    Wn === this ? this.deferStop = !0 : this.active && (Gn(this), this.onStop && this.onStop(), this.active = !1)
  }
}

function Gn(e) {
  const {
    deps: t
  } = e;
  if (t.length) {
    for (let n = 0; n < t.length; n++) t[n].delete(e);
    t.length = 0
  }
}
let Yn = !0;
const Xn = [];

function Zn() {
  Xn.push(Yn), Yn = !1
}

function er() {
  const e = Xn.pop();
  Yn = void 0 === e || e
}

function tr(e, t, n) {
  if (Yn && Wn) {
    let t = $n.get(e);
    t || $n.set(e, t = new Map);
    let r = t.get(n);
    r || t.set(n, r = Fn()), nr(r)
  }
}

function nr(e, t) {
  let n = !1;
  zn <= Hn ? qn(e) || (e.n |= Qn, n = !Un(e)) : n = !e.has(Wn), n && (e.add(Wn), Wn.deps.push(e))
}

function rr(e, t, n, r, o, i) {
  const a = $n.get(e);
  if (!a) return;
  let s = [];
  if ("clear" === t) s = [...a.values()];
  else if ("length" === n && w(e)) {
    const e = Number(r);
    a.forEach(((t, n) => {
      ("length" === n || n >= e) && s.push(t)
    }))
  } else switch (void 0 !== n && s.push(a.get(n)), t) {
    case "add":
      w(e) ? B(n) && s.push(a.get("length")) : (s.push(a.get(Vn)), S(e) && s.push(a.get(Kn)));
      break;
    case "delete":
      w(e) || (s.push(a.get(Vn)), S(e) && s.push(a.get(Kn)));
      break;
    case "set":
      S(e) && s.push(a.get(Vn))
  }
  if (1 === s.length) s[0] && or(s[0]);
  else {
    const e = [];
    for (const t of s) t && e.push(...t);
    or(Fn(e))
  }
}

function or(e, t) {
  const n = w(e) ? e : [...e];
  for (const r of n) r.computed && ir(r);
  for (const r of n) r.computed || ir(r)
}

function ir(e, t) {
  (e !== Wn || e.allowRecurse) && (e.scheduler ? e.scheduler() : e.run())
}
const ar = t("__proto__,__v_isRef,__isVue"),
  sr = new Set(Object.getOwnPropertyNames(Symbol).filter((e => "arguments" !== e && "caller" !== e)).map((e => Symbol[e])).filter(P)),
  cr = hr(),
  ur = hr(!1, !0),
  lr = hr(!0),
  fr = pr();

function pr() {
  const e = {};
  return ["includes", "indexOf", "lastIndexOf"].forEach((t => {
    e[t] = function (...e) {
      const n = Gr(this);
      for (let t = 0, o = this.length; t < o; t++) tr(n, 0, t + "");
      const r = n[t](...e);
      return -1 === r || !1 === r ? n[t](...e.map(Gr)) : r
    }
  })), ["push", "pop", "shift", "unshift", "splice"].forEach((t => {
    e[t] = function (...e) {
      Zn();
      const n = Gr(this)[t].apply(this, e);
      return er(), n
    }
  })), e
}

function dr(e) {
  const t = Gr(this);
  return tr(t, 0, e), t.hasOwnProperty(e)
}

function hr(e = !1, t = !1) {
  return function (n, r, o) {
    if ("__v_isReactive" === r) return !e;
    if ("__v_isReadonly" === r) return e;
    if ("__v_isShallow" === r) return t;
    if ("__v_raw" === r && o === (e ? t ? zr : $r : t ? qr : Ur).get(n)) return n;
    const i = w(n);
    if (!e) {
      if (i && v(fr, r)) return Reflect.get(fr, r, o);
      if ("hasOwnProperty" === r) return dr
    }
    const a = Reflect.get(n, r, o);
    return (P(r) ? sr.has(r) : ar(r)) ? a : (e || tr(n, 0, r), t ? a : no(a) ? i && B(r) ? a : a.value : k(a) ? e ? Hr(a) : Qr(a) : a)
  }
}

function gr(e = !1) {
  return function (t, n, r, o) {
    let i = t[n];
    if (Kr(i) && no(i) && !no(r)) return !1;
    if (!e && (Jr(r) || Kr(r) || (i = Gr(i), r = Gr(r)), !w(t) && no(i) && !no(r))) return i.value = r, !0;
    const a = w(t) && B(n) ? Number(n) < t.length : v(t, n),
      s = Reflect.set(t, n, r, o);
    return t === Gr(o) && (a ? q(r, i) && rr(t, "set", n, r) : rr(t, "add", n, r)), s
  }
}
const yr = {
    get: cr,
    set: gr(),
    deleteProperty: function (e, t) {
      const n = v(e, t);
      e[t];
      const r = Reflect.deleteProperty(e, t);
      return r && n && rr(e, "delete", t, void 0), r
    },
    has: function (e, t) {
      const n = Reflect.has(e, t);
      return P(t) && sr.has(t) || tr(e, 0, t), n
    },
    ownKeys: function (e) {
      return tr(e, 0, w(e) ? "length" : Vn), Reflect.ownKeys(e)
    }
  },
  mr = {
    get: lr,
    set: (e, t) => !0,
    deleteProperty: (e, t) => !0
  },
  br = y({}, yr, {
    get: ur,
    set: gr(!0)
  }),
  vr = e => e,
  wr = e => Reflect.getPrototypeOf(e);

function Sr(e, t, n = !1, r = !1) {
  const o = Gr(e = e.__v_raw),
    i = Gr(t);
  n || (t !== i && tr(o, 0, t), tr(o, 0, i));
  const {
    has: a
  } = wr(o), s = r ? vr : n ? Zr : Xr;
  return a.call(o, t) ? s(e.get(t)) : a.call(o, i) ? s(e.get(i)) : void(e !== o && e.get(t))
}

function xr(e, t = !1) {
  const n = this.__v_raw,
    r = Gr(n),
    o = Gr(e);
  return t || (e !== o && tr(r, 0, e), tr(r, 0, o)), e === o ? n.has(e) : n.has(e) || n.has(o)
}

function Ar(e, t = !1) {
  return e = e.__v_raw, !t && tr(Gr(e), 0, Vn), Reflect.get(e, "size", e)
}

function _r(e) {
  e = Gr(e);
  const t = Gr(this);
  return wr(t).has.call(t, e) || (t.add(e), rr(t, "add", e, e)), this
}

function Pr(e, t) {
  t = Gr(t);
  const n = Gr(this),
    {
      has: r,
      get: o
    } = wr(n);
  let i = r.call(n, e);
  i || (e = Gr(e), i = r.call(n, e));
  const a = o.call(n, e);
  return n.set(e, t), i ? q(t, a) && rr(n, "set", e, t) : rr(n, "add", e, t), this
}

function kr(e) {
  const t = Gr(this),
    {
      has: n,
      get: r
    } = wr(t);
  let o = n.call(t, e);
  o || (e = Gr(e), o = n.call(t, e)), r && r.call(t, e);
  const i = t.delete(e);
  return o && rr(t, "delete", e, void 0), i
}

function Tr() {
  const e = Gr(this),
    t = 0 !== e.size,
    n = e.clear();
  return t && rr(e, "clear", void 0, void 0), n
}

function Er(e, t) {
  return function (n, r) {
    const o = this,
      i = o.__v_raw,
      a = Gr(i),
      s = t ? vr : e ? Zr : Xr;
    return !e && tr(a, 0, Vn), i.forEach(((e, t) => n.call(r, s(e), s(t), o)))
  }
}

function Ir(e, t, n) {
  return function (...r) {
    const o = this.__v_raw,
      i = Gr(o),
      a = S(i),
      s = "entries" === e || e === Symbol.iterator && a,
      c = "keys" === e && a,
      u = o[e](...r),
      l = n ? vr : t ? Zr : Xr;
    return !t && tr(i, 0, c ? Kn : Vn), {
      next() {
        const {
          value: e,
          done: t
        } = u.next();
        return t ? {
          value: e,
          done: t
        } : {
          value: s ? [l(e[0]), l(e[1])] : l(e),
          done: t
        }
      },
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

function Or(e) {
  return function (...t) {
    return "delete" !== e && this
  }
}

function Cr() {
  const e = {
      get(e) {
        return Sr(this, e)
      },
      get size() {
        return Ar(this)
      },
      has: xr,
      add: _r,
      set: Pr,
      delete: kr,
      clear: Tr,
      forEach: Er(!1, !1)
    },
    t = {
      get(e) {
        return Sr(this, e, !1, !0)
      },
      get size() {
        return Ar(this)
      },
      has: xr,
      add: _r,
      set: Pr,
      delete: kr,
      clear: Tr,
      forEach: Er(!1, !0)
    },
    n = {
      get(e) {
        return Sr(this, e, !0)
      },
      get size() {
        return Ar(this, !0)
      },
      has(e) {
        return xr.call(this, e, !0)
      },
      add: Or("add"),
      set: Or("set"),
      delete: Or("delete"),
      clear: Or("clear"),
      forEach: Er(!0, !1)
    },
    r = {
      get(e) {
        return Sr(this, e, !0, !0)
      },
      get size() {
        return Ar(this, !0)
      },
      has(e) {
        return xr.call(this, e, !0)
      },
      add: Or("add"),
      set: Or("set"),
      delete: Or("delete"),
      clear: Or("clear"),
      forEach: Er(!0, !0)
    };
  return ["keys", "values", "entries", Symbol.iterator].forEach((o => {
    e[o] = Ir(o, !1, !1), n[o] = Ir(o, !0, !1), t[o] = Ir(o, !1, !0), r[o] = Ir(o, !0, !0)
  })), [e, n, t, r]
}
const [Br, jr, Dr, Nr] = Cr();

function Rr(e, t) {
  const n = t ? e ? Nr : Dr : e ? jr : Br;
  return (t, r, o) => "__v_isReactive" === r ? !e : "__v_isReadonly" === r ? e : "__v_raw" === r ? t : Reflect.get(v(n, r) && r in t ? n : t, r, o)
}
const Lr = {
    get: Rr(!1, !1)
  },
  Mr = {
    get: Rr(!1, !0)
  },
  Fr = {
    get: Rr(!0, !1)
  },
  Ur = new WeakMap,
  qr = new WeakMap,
  $r = new WeakMap,
  zr = new WeakMap;

function Qr(e) {
  return Kr(e) ? e : Wr(e, !1, yr, Lr, Ur)
}

function Hr(e) {
  return Wr(e, !0, mr, Fr, $r)
}

function Wr(e, t, n, r, o) {
  if (!k(e)) return e;
  if (e.__v_raw && (!t || !e.__v_isReactive)) return e;
  const i = o.get(e);
  if (i) return i;
  const a = (s = e).__v_skip || !Object.isExtensible(s) ? 0 : function (e) {
    switch (e) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0
    }
  }(O(s));
  var s;
  if (0 === a) return e;
  const c = new Proxy(e, 2 === a ? r : n);
  return o.set(e, c), c
}

function Vr(e) {
  return Kr(e) ? Vr(e.__v_raw) : !(!e || !e.__v_isReactive)
}

function Kr(e) {
  return !(!e || !e.__v_isReadonly)
}

function Jr(e) {
  return !(!e || !e.__v_isShallow)
}

function Gr(e) {
  const t = e && e.__v_raw;
  return t ? Gr(t) : e
}

function Yr(e) {
  return z(e, "__v_skip", !0), e
}
const Xr = e => k(e) ? Qr(e) : e,
  Zr = e => k(e) ? Hr(e) : e;

function eo(e) {
  Yn && Wn && nr((e = Gr(e)).dep || (e.dep = Fn()))
}

function to(e, t) {
  const n = (e = Gr(e)).dep;
  n && or(n)
}

function no(e) {
  return !(!e || !0 !== e.__v_isRef)
}

function ro(e) {
  return oo(e, !1)
}

function oo(e, t) {
  return no(e) ? e : new io(e, t)
}
class io {
  constructor(e, t) {
    this.__v_isShallow = t, this.dep = void 0, this.__v_isRef = !0, this._rawValue = t ? e : Gr(e), this._value = t ? e : Xr(e)
  }
  get value() {
    return eo(this), this._value
  }
  set value(e) {
    const t = this.__v_isShallow || Jr(e) || Kr(e);
    e = t ? e : Gr(e), q(e, this._rawValue) && (this._rawValue = e, this._value = t ? e : Xr(e), to(this))
  }
}

function ao(e) {
  return no(e) ? e.value : e
}
const so = {
  get: (e, t, n) => ao(Reflect.get(e, t, n)),
  set: (e, t, n, r) => {
    const o = e[t];
    return no(o) && !no(n) ? (o.value = n, !0) : Reflect.set(e, t, n, r)
  }
};

function co(e) {
  return Vr(e) ? e : new Proxy(e, so)
}
class uo {
  constructor(e, t, n) {
    this._object = e, this._key = t, this._defaultValue = n, this.__v_isRef = !0
  }
  get value() {
    const e = this._object[this._key];
    return void 0 === e ? this._defaultValue : e
  }
  set value(e) {
    this._object[this._key] = e
  }
  get dep() {
    return e = Gr(this._object), t = this._key, null === (n = $n.get(e)) || void 0 === n ? void 0 : n.get(t);
    var e, t, n
  }
}

function lo(e, t, n) {
  const r = e[t];
  return no(r) ? r : new uo(e, t, n)
}
var fo;
class po {
  constructor(e, t, n, r) {
    this._setter = t, this.dep = void 0, this.__v_isRef = !0, this[fo] = !1, this._dirty = !0, this.effect = new Jn(e, (() => {
      this._dirty || (this._dirty = !0, to(this))
    })), this.effect.computed = this, this.effect.active = this._cacheable = !r, this.__v_isReadonly = n
  }
  get value() {
    const e = Gr(this);
    return eo(e), !e._dirty && e._cacheable || (e._dirty = !1, e._value = e.effect.run()), e._value
  }
  set value(e) {
    this._setter(e)
  }
}

function ho(e, t, n, r) {
  let o;
  try {
    o = r ? e(...r) : e()
  } catch (i) {
    yo(i, t, n)
  }
  return o
}

function go(e, t, n, r) {
  if (A(e)) {
    const o = ho(e, t, n, r);
    return o && T(o) && o.catch((e => {
      yo(e, t, n)
    })), o
  }
  const o = [];
  for (let i = 0; i < e.length; i++) o.push(go(e[i], t, n, r));
  return o
}

function yo(e, t, n, r = !0) {
  t && t.vnode;
  if (t) {
    let r = t.parent;
    const o = t.proxy,
      i = n;
    for (; r;) {
      const t = r.ec;
      if (t)
        for (let n = 0; n < t.length; n++)
          if (!1 === t[n](e, o, i)) return;
      r = r.parent
    }
    const a = t.appContext.config.errorHandler;
    if (a) return void ho(a, null, 10, [e, o, i])
  }! function (e, t, n, r = !0) {
    console.error(e)
  }(e, 0, 0, r)
}
fo = "__v_isReadonly";
let mo = !1,
  bo = !1;
const vo = [];
let wo = 0;
const So = [];
let xo = null,
  Ao = 0;
const _o = Promise.resolve();
let Po = null;

function ko(e) {
  const t = Po || _o;
  return e ? t.then(this ? e.bind(this) : e) : t
}

function To(e) {
  vo.length && vo.includes(e, mo && e.allowRecurse ? wo + 1 : wo) || (null == e.id ? vo.push(e) : vo.splice(function (e) {
    let t = wo + 1,
      n = vo.length;
    for (; t < n;) {
      const r = t + n >>> 1;
      Co(vo[r]) < e ? t = r + 1 : n = r
    }
    return t
  }(e.id), 0, e), Eo())
}

function Eo() {
  mo || bo || (bo = !0, Po = _o.then(jo))
}

function Io(e) {
  w(e) ? So.push(...e) : xo && xo.includes(e, e.allowRecurse ? Ao + 1 : Ao) || So.push(e), Eo()
}

function Oo(e, t = (mo ? wo + 1 : 0)) {
  for (; t < vo.length; t++) {
    const e = vo[t];
    e && e.pre && (vo.splice(t, 1), t--, e())
  }
}
const Co = e => null == e.id ? 1 / 0 : e.id,
  Bo = (e, t) => {
    const n = Co(e) - Co(t);
    if (0 === n) {
      if (e.pre && !t.pre) return -1;
      if (t.pre && !e.pre) return 1
    }
    return n
  };

function jo(e) {
  bo = !1, mo = !0, vo.sort(Bo);
  try {
    for (wo = 0; wo < vo.length; wo++) {
      const e = vo[wo];
      e && !1 !== e.active && ho(e, null, 14)
    }
  } finally {
    wo = 0, vo.length = 0,
      function (e) {
        if (So.length) {
          const e = [...new Set(So)];
          if (So.length = 0, xo) return void xo.push(...e);
          for (xo = e, xo.sort(((e, t) => Co(e) - Co(t))), Ao = 0; Ao < xo.length; Ao++) xo[Ao]();
          xo = null, Ao = 0
        }
      }(), mo = !1, Po = null, (vo.length || So.length) && jo()
  }
}

function Do(e, t, ...n) {
  if (e.isUnmounted) return;
  const r = e.vnode.props || u;
  let o = n;
  const i = t.startsWith("update:"),
    a = i && t.slice(7);
  if (a && a in r) {
    const e = `${"modelValue"===a?"model":a}Modifiers`,
      {
        number: t,
        trim: i
      } = r[e] || u;
    i && (o = n.map((e => _(e) ? e.trim() : e))), t && (o = n.map(Q))
  }
  let s, c = r[s = U(t)] || r[s = U(R(t))];
  !c && i && (c = r[s = U(M(t))]), c && go(c, e, 6, o);
  const l = r[s + "Once"];
  if (l) {
    if (e.emitted) {
      if (e.emitted[s]) return
    } else e.emitted = {};
    e.emitted[s] = !0, go(l, e, 6, o)
  }
}

function No(e, t, n = !1) {
  const r = t.emitsCache,
    o = r.get(e);
  if (void 0 !== o) return o;
  const i = e.emits;
  let a = {},
    s = !1;
  if (!A(e)) {
    const r = e => {
      const n = No(e, t, !0);
      n && (s = !0, y(a, n))
    };
    !n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r)
  }
  return i || s ? (w(i) ? i.forEach((e => a[e] = null)) : y(a, i), k(e) && r.set(e, a), a) : (k(e) && r.set(e, null), null)
}

function Ro(e, t) {
  return !(!e || !h(t)) && (t = t.slice(2).replace(/Once$/, ""), v(e, t[0].toLowerCase() + t.slice(1)) || v(e, M(t)) || v(e, t))
}
let Lo = null;

function Mo(e) {
  const t = Lo;
  return Lo = e, e && e.type.__scopeId, t
}

function Fo(e, t, n = !1) {
  const r = $i || Lo;
  if (r) {
    const o = null == r.parent ? r.vnode.appContext && r.vnode.appContext.provides : r.parent.provides;
    if (o && e in o) return o[e];
    if (arguments.length > 1) return n && A(t) ? t.call(r.proxy) : t
  }
}
const Uo = {};

function qo(e, t, n) {
  return $o(e, t, n)
}

function $o(e, t, {
  immediate: n,
  deep: r,
  flush: o,
  onTrack: i,
  onTrigger: a
} = u) {
  const s = Mn() === (null == $i ? void 0 : $i.scope) ? $i : null;
  let c, l, p = !1,
    d = !1;
  if (no(e) ? (c = () => e.value, p = Jr(e)) : Vr(e) ? (c = () => e, r = !0) : w(e) ? (d = !0, p = e.some((e => Vr(e) || Jr(e))), c = () => e.map((e => no(e) ? e.value : Vr(e) ? Ho(e) : A(e) ? ho(e, s, 2) : void 0))) : c = A(e) ? t ? () => ho(e, s, 2) : () => {
      if (!s || !s.isUnmounted) return l && l(), go(e, s, 3, [h])
    } : f, t && r) {
    const e = c;
    c = () => Ho(e())
  }
  let h = e => {
      l = v.onStop = () => {
        ho(e, s, 4)
      }
    },
    g = d ? new Array(e.length).fill(Uo) : Uo;
  const y = () => {
    if (v.active)
      if (t) {
        const e = v.run();
        (r || p || (d ? e.some(((e, t) => q(e, g[t]))) : q(e, g))) && (l && l(), go(t, s, 3, [e, g === Uo ? void 0 : d && g[0] === Uo ? [] : g, h]), g = e)
      } else v.run()
  };
  let b;
  y.allowRecurse = !!t, "sync" === o ? b = y : "post" === o ? b = () => Ri(y, s && s.suspense) : (y.pre = !0, s && (y.id = s.uid), b = () => To(y));
  const v = new Jn(c, b);
  t ? n ? y() : g = v.run() : "post" === o ? Ri(v.run.bind(v), s && s.suspense) : v.run();
  return () => {
    v.stop(), s && s.scope && m(s.scope.effects, v)
  }
}

function zo(e, t, n) {
  const r = this.proxy,
    o = _(e) ? e.includes(".") ? Qo(r, e) : () => r[e] : e.bind(r, r);
  let i;
  A(t) ? i = t : (i = t.handler, n = t);
  const a = $i;
  Qi(this);
  const s = $o(o, i.bind(r), n);
  return a ? Qi(a) : Hi(), s
}

function Qo(e, t) {
  const n = t.split(".");
  return () => {
    let t = e;
    for (let e = 0; e < n.length && t; e++) t = t[n[e]];
    return t
  }
}

function Ho(e, t) {
  if (!k(e) || e.__v_skip) return e;
  if ((t = t || new Set).has(e)) return e;
  if (t.add(e), no(e)) Ho(e.value, t);
  else if (w(e))
    for (let n = 0; n < e.length; n++) Ho(e[n], t);
  else if (x(e) || S(e)) e.forEach((e => {
    Ho(e, t)
  }));
  else if (C(e))
    for (const n in e) Ho(e[n], t);
  return e
}
const Wo = e => e.type.__isKeepAlive;

function Vo(e, t) {
  Jo(e, "a", t)
}

function Ko(e, t) {
  Jo(e, "da", t)
}

function Jo(e, t, n = $i) {
  const r = e.__wdc || (e.__wdc = () => {
    let t = n;
    for (; t;) {
      if (t.isDeactivated) return;
      t = t.parent
    }
    return e()
  });
  if (Yo(t, r, n), n) {
    let e = n.parent;
    for (; e && e.parent;) Wo(e.parent.vnode) && Go(r, t, n, e), e = e.parent
  }
}

function Go(e, t, n, r) {
  const o = Yo(t, e, r, !0);
  oi((() => {
    m(r[t], o)
  }), n)
}

function Yo(e, t, n = $i, r = !1) {
  if (n) {
    (function (e) {
      return Te.indexOf(e) > -1
    })(e) && (n = n.root);
    const o = n[e] || (n[e] = []),
      i = t.__weh || (t.__weh = (...r) => {
        if (n.isUnmounted) return;
        Zn(), Qi(n);
        const o = go(t, n, e, r);
        return Hi(), er(), o
      });
    return r ? o.unshift(i) : o.push(i), i
  }
}
const Xo = e => (t, n = $i) => (!Vi || "sp" === e) && Yo(e, ((...e) => t(...e)), n),
  Zo = Xo("bm"),
  ei = Xo("m"),
  ti = Xo("bu"),
  ni = Xo("u"),
  ri = Xo("bum"),
  oi = Xo("um"),
  ii = Xo("sp"),
  ai = Xo("rtg"),
  si = Xo("rtc");

function ci(e, t = $i) {
  Yo("ec", e, t)
}
const ui = "components";

function li(e, t) {
  return e && (e[t] || e[R(t)] || e[F(R(t))])
}
const fi = e => e ? Wi(e) ? Gi(e) || e.proxy : fi(e.parent) : null,
  pi = y(Object.create(null), {
    $: e => e,
    $el: e => e.__$el || (e.__$el = {}),
    $data: e => e.data,
    $props: e => e.props,
    $attrs: e => e.attrs,
    $slots: e => e.slots,
    $refs: e => e.refs,
    $parent: e => fi(e.parent),
    $root: e => fi(e.root),
    $emit: e => e.emit,
    $options: e => vi(e),
    $forceUpdate: e => e.f || (e.f = () => To(e.update)),
    $watch: e => zo.bind(e)
  }),
  di = (e, t) => e !== u && !e.__isScriptSetup && v(e, t),
  hi = {
    get({
      _: e
    }, t) {
      const {
        ctx: n,
        setupState: r,
        data: o,
        props: i,
        accessCache: a,
        type: s,
        appContext: c
      } = e;
      let l;
      if ("$" !== t[0]) {
        const s = a[t];
        if (void 0 !== s) switch (s) {
          case 1:
            return r[t];
          case 2:
            return o[t];
          case 4:
            return n[t];
          case 3:
            return i[t]
        } else {
          if (di(r, t)) return a[t] = 1, r[t];
          if (o !== u && v(o, t)) return a[t] = 2, o[t];
          if ((l = e.propsOptions[0]) && v(l, t)) return a[t] = 3, i[t];
          if (n !== u && v(n, t)) return a[t] = 4, n[t];
          gi && (a[t] = 0)
        }
      }
      const f = pi[t];
      let p, d;
      return f ? ("$attrs" === t && tr(e, 0, t), f(e)) : (p = s.__cssModules) && (p = p[t]) ? p : n !== u && v(n, t) ? (a[t] = 4, n[t]) : (d = c.config.globalProperties, v(d, t) ? d[t] : void 0)
    },
    set({
      _: e
    }, t, n) {
      const {
        data: r,
        setupState: o,
        ctx: i
      } = e;
      return di(o, t) ? (o[t] = n, !0) : r !== u && v(r, t) ? (r[t] = n, !0) : !v(e.props, t) && (("$" !== t[0] || !(t.slice(1) in e)) && (i[t] = n, !0))
    },
    has({
      _: {
        data: e,
        setupState: t,
        accessCache: n,
        ctx: r,
        appContext: o,
        propsOptions: i
      }
    }, a) {
      let s;
      return !!n[a] || e !== u && v(e, a) || di(t, a) || (s = i[0]) && v(s, a) || v(r, a) || v(pi, a) || v(o.config.globalProperties, a)
    },
    defineProperty(e, t, n) {
      return null != n.get ? e._.accessCache[t] = 0 : v(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n)
    }
  };
let gi = !0;

function yi(e) {
  const t = vi(e),
    n = e.proxy,
    r = e.ctx;
  gi = !1, t.beforeCreate && mi(t.beforeCreate, e, "bc");
  const {
    data: o,
    computed: i,
    methods: a,
    watch: s,
    provide: c,
    inject: u,
    created: l,
    beforeMount: p,
    mounted: d,
    beforeUpdate: h,
    updated: g,
    activated: y,
    deactivated: m,
    beforeDestroy: b,
    beforeUnmount: v,
    destroyed: S,
    unmounted: x,
    render: _,
    renderTracked: P,
    renderTriggered: T,
    errorCaptured: E,
    serverPrefetch: I,
    expose: O,
    inheritAttrs: C,
    components: B,
    directives: j,
    filters: D
  } = t;
  if (u && function (e, t, n = f, r = !1) {
      w(e) && (e = Ai(e));
      for (const o in e) {
        const n = e[o];
        let i;
        i = k(n) ? "default" in n ? Fo(n.from || o, n.default, !0) : Fo(n.from || o) : Fo(n), no(i) && r ? Object.defineProperty(t, o, {
          enumerable: !0,
          configurable: !0,
          get: () => i.value,
          set: e => i.value = e
        }) : t[o] = i
      }
    }(u, r, null, e.appContext.config.unwrapInjectedRef), a)
    for (const f in a) {
      const e = a[f];
      A(e) && (r[f] = e.bind(n))
    }
  if (o) {
    const t = o.call(n, n);
    k(t) && (e.data = Qr(t))
  }
  if (gi = !0, i)
    for (const w in i) {
      const e = i[w],
        t = A(e) ? e.bind(n, n) : A(e.get) ? e.get.bind(n, n) : f,
        o = !A(e) && A(e.set) ? e.set.bind(n) : f,
        a = Yi({
          get: t,
          set: o
        });
      Object.defineProperty(r, w, {
        enumerable: !0,
        configurable: !0,
        get: () => a.value,
        set: e => a.value = e
      })
    }
  if (s)
    for (const f in s) bi(s[f], r, n, f);
  if (c) {
    const e = A(c) ? c.call(n) : c;
    Reflect.ownKeys(e).forEach((t => {
      ! function (e, t) {
        if ($i) {
          let n = $i.provides;
          const r = $i.parent && $i.parent.provides;
          r === n && (n = $i.provides = Object.create(r)), n[e] = t, "app" === $i.type.mpType && $i.appContext.app.provide(e, t)
        }
      }(t, e[t])
    }))
  }

  function N(e, t) {
    w(t) ? t.forEach((t => e(t.bind(n)))) : t && e(t.bind(n))
  }
  if (l && mi(l, e, "c"), N(Zo, p), N(ei, d), N(ti, h), N(ni, g), N(Vo, y), N(Ko, m), N(ci, E), N(si, P), N(ai, T), N(ri, v), N(oi, x), N(ii, I), w(O))
    if (O.length) {
      const t = e.exposed || (e.exposed = {});
      O.forEach((e => {
        Object.defineProperty(t, e, {
          get: () => n[e],
          set: t => n[e] = t
        })
      }))
    } else e.exposed || (e.exposed = {});
  _ && e.render === f && (e.render = _), null != C && (e.inheritAttrs = C), B && (e.components = B), j && (e.directives = j), e.ctx.$onApplyOptions && e.ctx.$onApplyOptions(t, e, n)
}

function mi(e, t, n) {
  go(w(e) ? e.map((e => e.bind(t.proxy))) : e.bind(t.proxy), t, n)
}

function bi(e, t, n, r) {
  const o = r.includes(".") ? Qo(n, r) : () => n[r];
  if (_(e)) {
    const n = t[e];
    A(n) && qo(o, n)
  } else if (A(e)) qo(o, e.bind(n));
  else if (k(e))
    if (w(e)) e.forEach((e => bi(e, t, n, r)));
    else {
      const r = A(e.handler) ? e.handler.bind(n) : t[e.handler];
      A(r) && qo(o, r, e)
    }
}

function vi(e) {
  const t = e.type,
    {
      mixins: n,
      extends: r
    } = t,
    {
      mixins: o,
      optionsCache: i,
      config: {
        optionMergeStrategies: a
      }
    } = e.appContext,
    s = i.get(t);
  let c;
  return s ? c = s : o.length || n || r ? (c = {}, o.length && o.forEach((e => wi(c, e, a, !0))), wi(c, t, a)) : c = t, k(t) && i.set(t, c), c
}

function wi(e, t, n, r = !1) {
  const {
    mixins: o,
    extends: i
  } = t;
  i && wi(e, i, n, !0), o && o.forEach((t => wi(e, t, n, !0)));
  for (const a in t)
    if (r && "expose" === a);
    else {
      const r = Si[a] || n && n[a];
      e[a] = r ? r(e[a], t[a]) : t[a]
    } return e
}
const Si = {
  data: xi,
  props: Pi,
  emits: Pi,
  methods: Pi,
  computed: Pi,
  beforeCreate: _i,
  created: _i,
  beforeMount: _i,
  mounted: _i,
  beforeUpdate: _i,
  updated: _i,
  beforeDestroy: _i,
  beforeUnmount: _i,
  destroyed: _i,
  unmounted: _i,
  activated: _i,
  deactivated: _i,
  errorCaptured: _i,
  serverPrefetch: _i,
  components: Pi,
  directives: Pi,
  watch: function (e, t) {
    if (!e) return t;
    if (!t) return e;
    const n = y(Object.create(null), e);
    for (const r in t) n[r] = _i(e[r], t[r]);
    return n
  },
  provide: xi,
  inject: function (e, t) {
    return Pi(Ai(e), Ai(t))
  }
};

function xi(e, t) {
  return t ? e ? function () {
    return y(A(e) ? e.call(this, this) : e, A(t) ? t.call(this, this) : t)
  } : t : e
}

function Ai(e) {
  if (w(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
    return t
  }
  return e
}

function _i(e, t) {
  return e ? [...new Set([].concat(e, t))] : t
}

function Pi(e, t) {
  return e ? y(y(Object.create(null), e), t) : t
}

function ki(e, t, n, r = !1) {
  const o = {},
    i = {};
  e.propsDefaults = Object.create(null), Ti(e, t, o, i);
  for (const a in e.propsOptions[0]) a in o || (o[a] = void 0);
  n ? e.props = r ? o : Wr(o, !1, br, Mr, qr) : e.type.props ? e.props = o : e.props = i, e.attrs = i
}

function Ti(e, t, n, r) {
  const [o, i] = e.propsOptions;
  let a, s = !1;
  if (t)
    for (let c in t) {
      if (j(c)) continue;
      const u = t[c];
      let l;
      o && v(o, l = R(c)) ? i && i.includes(l) ? (a || (a = {}))[l] = u : n[l] = u : Ro(e.emitsOptions, c) || c in r && u === r[c] || (r[c] = u, s = !0)
    }
  if (i) {
    const t = Gr(n),
      r = a || u;
    for (let a = 0; a < i.length; a++) {
      const s = i[a];
      n[s] = Ei(o, t, s, r[s], e, !v(r, s))
    }
  }
  return s
}

function Ei(e, t, n, r, o, i) {
  const a = e[n];
  if (null != a) {
    const e = v(a, "default");
    if (e && void 0 === r) {
      const e = a.default;
      if (a.type !== Function && A(e)) {
        const {
          propsDefaults: i
        } = o;
        n in i ? r = i[n] : (Qi(o), r = i[n] = e.call(null, t), Hi())
      } else r = e
    }
    a[0] && (i && !e ? r = !1 : !a[1] || "" !== r && r !== M(n) || (r = !0))
  }
  return r
}

function Ii(e, t, n = !1) {
  const r = t.propsCache,
    o = r.get(e);
  if (o) return o;
  const i = e.props,
    a = {},
    s = [];
  let c = !1;
  if (!A(e)) {
    const r = e => {
      c = !0;
      const [n, r] = Ii(e, t, !0);
      y(a, n), r && s.push(...r)
    };
    !n && t.mixins.length && t.mixins.forEach(r), e.extends && r(e.extends), e.mixins && e.mixins.forEach(r)
  }
  if (!i && !c) return k(e) && r.set(e, l), l;
  if (w(i))
    for (let l = 0; l < i.length; l++) {
      const e = R(i[l]);
      Oi(e) && (a[e] = u)
    } else if (i)
      for (const u in i) {
        const e = R(u);
        if (Oi(e)) {
          const t = i[u],
            n = a[e] = w(t) || A(t) ? {
              type: t
            } : Object.assign({}, t);
          if (n) {
            const t = ji(Boolean, n.type),
              r = ji(String, n.type);
            n[0] = t > -1, n[1] = r < 0 || t < r, (t > -1 || v(n, "default")) && s.push(e)
          }
        }
      }
  const f = [a, s];
  return k(e) && r.set(e, f), f
}

function Oi(e) {
  return "$" !== e[0]
}

function Ci(e) {
  const t = e && e.toString().match(/^\s*(function|class) (\w+)/);
  return t ? t[2] : null === e ? "null" : ""
}

function Bi(e, t) {
  return Ci(e) === Ci(t)
}

function ji(e, t) {
  return w(t) ? t.findIndex((t => Bi(t, e))) : A(t) && Bi(t, e) ? 0 : -1
}

function Di() {
  return {
    app: null,
    config: {
      isNativeTag: p,
      performance: !1,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap,
    propsCache: new WeakMap,
    emitsCache: new WeakMap
  }
}
let Ni = 0;
const Ri = Io,
  Li = "__vInternal";

function Mi(e) {
  return e ? Vr(t = e) || Kr(t) || Li in e ? y({}, e) : e : null;
  var t
}
const Fi = Di();
let Ui = 0;

function qi(e, t, n) {
  const r = e.type,
    o = (t ? t.appContext : e.appContext) || Fi,
    i = {
      uid: Ui++,
      vnode: e,
      type: r,
      parent: t,
      appContext: o,
      root: null,
      next: null,
      subTree: null,
      effect: null,
      update: null,
      scope: new Rn(!0),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: t ? t.provides : Object.create(o.provides),
      accessCache: null,
      renderCache: [],
      components: null,
      directives: null,
      propsOptions: Ii(r, o),
      emitsOptions: No(r, o),
      emit: null,
      emitted: null,
      propsDefaults: u,
      inheritAttrs: r.inheritAttrs,
      ctx: u,
      data: u,
      props: u,
      attrs: u,
      slots: u,
      refs: u,
      setupState: u,
      setupContext: null,
      suspense: n,
      suspenseId: n ? n.pendingId : 0,
      asyncDep: null,
      asyncResolved: !1,
      isMounted: !1,
      isUnmounted: !1,
      isDeactivated: !1,
      bc: null,
      c: null,
      bm: null,
      m: null,
      bu: null,
      u: null,
      um: null,
      bum: null,
      da: null,
      a: null,
      rtg: null,
      rtc: null,
      ec: null,
      sp: null
    };
  return i.ctx = {
    _: i
  }, i.root = t ? t.root : i, i.emit = Do.bind(null, i), e.ce && e.ce(i), i
}
let $i = null;
const zi = () => $i || Lo,
  Qi = e => {
    $i = e, e.scope.on()
  },
  Hi = () => {
    $i && $i.scope.off(), $i = null
  };

function Wi(e) {
  return 4 & e.vnode.shapeFlag
}
let Vi = !1;

function Ki(e, t = !1) {
  Vi = t;
  const {
    props: n
  } = e.vnode, r = Wi(e);
  ki(e, n, r, t);
  const o = r ? function (e, t) {
    const n = e.type;
    e.accessCache = Object.create(null), e.proxy = Yr(new Proxy(e.ctx, hi));
    const {
      setup: r
    } = n;
    if (r) {
      const t = e.setupContext = r.length > 1 ? function (e) {
        const t = t => {
          e.exposed = t || {}
        };
        let n;
        return {
          get attrs() {
            return n || (n = function (e) {
              return new Proxy(e.attrs, {
                get: (t, n) => (tr(e, 0, "$attrs"), t[n])
              })
            }(e))
          },
          slots: e.slots,
          emit: e.emit,
          expose: t
        }
      }(e) : null;
      Qi(e), Zn();
      const n = ho(r, e, 0, [e.props, t]);
      er(), Hi(), T(n) ? n.then(Hi, Hi) : function (e, t, n) {
        A(t) ? e.render = t : k(t) && (e.setupState = co(t));
        Ji(e)
      }(e, n)
    } else Ji(e)
  }(e) : void 0;
  return Vi = !1, o
}

function Ji(e, t, n) {
  const r = e.type;
  e.render || (e.render = r.render || f), Qi(e), Zn(), yi(e), er(), Hi()
}

function Gi(e) {
  if (e.exposed) return e.exposeProxy || (e.exposeProxy = new Proxy(co(Yr(e.exposed)), {
    get: (t, n) => n in t ? t[n] : e.proxy[n],
    has: (e, t) => t in e || t in pi
  }))
}
const Yi = (e, t) => function (e, t, n = !1) {
    let r, o;
    const i = A(e);
    return i ? (r = e, o = f) : (r = e.get, o = e.set), new po(r, o, i || !o, n)
  }(e, 0, Vi),
  Xi = "3.2.47";

function Zi(e) {
  return ao(e)
}
const ea = "[object Array]",
  ta = "[object Object]";

function na(e, t) {
  const n = {};
  return ra(e, t), oa(e, t, "", n), n
}

function ra(e, t) {
  if ((e = Zi(e)) === t) return;
  const n = I(e),
    r = I(t);
  if (n == ta && r == ta)
    for (let o in t) {
      const n = e[o];
      void 0 === n ? e[o] = null : ra(n, t[o])
    } else n == ea && r == ea && e.length >= t.length && t.forEach(((t, n) => {
      ra(e[n], t)
    }))
}

function oa(e, t, n, r) {
  if ((e = Zi(e)) === t) return;
  const o = I(e),
    i = I(t);
  if (o == ta)
    if (i != ta || Object.keys(e).length < Object.keys(t).length) ia(r, n, e);
    else
      for (let a in e) {
        const o = Zi(e[a]),
          i = t[a],
          s = I(o),
          c = I(i);
        if (s != ea && s != ta) o != i && ia(r, ("" == n ? "" : n + ".") + a, o);
        else if (s == ea) c != ea || o.length < i.length ? ia(r, ("" == n ? "" : n + ".") + a, o) : o.forEach(((e, t) => {
          oa(e, i[t], ("" == n ? "" : n + ".") + a + "[" + t + "]", r)
        }));
        else if (s == ta)
          if (c != ta || Object.keys(o).length < Object.keys(i).length) ia(r, ("" == n ? "" : n + ".") + a, o);
          else
            for (let e in o) oa(o[e], i[e], ("" == n ? "" : n + ".") + a + "." + e, r)
      } else o == ea ? i != ea || e.length < t.length ? ia(r, n, e) : e.forEach(((e, o) => {
        oa(e, t[o], n + "[" + o + "]", r)
      })) : ia(r, n, e)
}

function ia(e, t, n) {
  e[t] = n
}

function aa(e) {
  const t = e.ctx.__next_tick_callbacks;
  if (t && t.length) {
    const e = t.slice(0);
    t.length = 0;
    for (let t = 0; t < e.length; t++) e[t]()
  }
}

function sa(e, t) {
  const n = e.ctx;
  if (!n.__next_tick_pending && ! function (e) {
      return vo.includes(e.update)
    }(e)) return ko(t && t.bind(e.proxy));
  let r;
  return n.__next_tick_callbacks || (n.__next_tick_callbacks = []), n.__next_tick_callbacks.push((() => {
    t ? ho(t.bind(e.proxy), e, 14) : r && r(e.proxy)
  })), new Promise((e => {
    r = e
  }))
}

function ca(e, t) {
  const n = typeof (e = Zi(e));
  if ("object" === n && null !== e) {
    let n = t.get(e);
    if (void 0 !== n) return n;
    if (w(e)) {
      const r = e.length;
      n = new Array(r), t.set(e, n);
      for (let o = 0; o < r; o++) n[o] = ca(e[o], t)
    } else {
      n = {}, t.set(e, n);
      for (const r in e) v(e, r) && (n[r] = ca(e[r], t))
    }
    return n
  }
  if ("symbol" !== n) return e
}

function ua(e) {
  return ca(e, "undefined" != typeof WeakMap ? new WeakMap : new Map)
}

function la(e, t, n) {
  if (!t) return;
  t = ua(t);
  const r = e.ctx,
    o = r.mpType;
  if ("page" === o || "component" === o) {
    t.r0 = 1;
    const o = r.$scope,
      i = Object.keys(t),
      a = na(t, n || function (e, t) {
        const n = e.data,
          r = Object.create(null);
        return t.forEach((e => {
          r[e] = n[e]
        })), r
      }(o, i));
    Object.keys(a).length ? (r.__next_tick_pending = !0, o.setData(a, (() => {
      r.__next_tick_pending = !1, aa(e)
    })), Oo()) : aa(e)
  }
}

function fa(e, t, n) {
  t.appContext.config.globalProperties.$applyOptions(e, t, n);
  const r = e.computed;
  if (r) {
    const e = Object.keys(r);
    if (e.length) {
      const n = t.ctx;
      n.$computedKeys || (n.$computedKeys = []), n.$computedKeys.push(...e)
    }
  }
  delete t.ctx.$onApplyOptions
}

function pa(e, t = !1) {
  const {
    setupState: n,
    $templateRefs: r,
    ctx: {
      $scope: o,
      $mpPlatform: i
    }
  } = e;
  if ("mp-alipay" === i) return;
  if (!r || !o) return;
  if (t) return r.forEach((e => da(e, null, n)));
  const a = "mp-baidu" === i || "mp-toutiao" === i,
    s = e => {
      const t = (o.selectAllComponents(".r") || []).concat(o.selectAllComponents(".r-i-f") || []);
      return e.filter((e => {
        const r = function (e, t) {
          const n = e.find((e => e && (e.properties || e.props).uI === t));
          if (n) {
            const e = n.$vm;
            return e ? Gi(e.$) || e : function (e) {
              k(e) && Yr(e);
              return e
            }(n)
          }
          return null
        }(t, e.i);
        return !(!a || null !== r) || (da(e, r, n), !1)
      }))
    },
    c = () => {
      const t = s(r);
      t.length && e.proxy && e.proxy.$scope && e.proxy.$scope.setData({
        r1: 1
      }, (() => {
        s(t)
      }))
    };
  o._$setRef ? o._$setRef(c) : sa(e, c)
}

function da({
  r: e,
  f: t
}, n, r) {
  if (A(e)) e(n, {});
  else {
    const o = _(e),
      i = no(e);
    if (o || i)
      if (t) {
        if (!i) return;
        w(e.value) || (e.value = []);
        const t = e.value;
        if (-1 === t.indexOf(n)) {
          if (t.push(n), !n) return;
          ri((() => m(t, n)), n.$)
        }
      } else o ? v(r, e) && (r[e] = n) : no(e) && (e.value = n)
  }
}
var ha, ga;
(ga = ha || (ha = {})).APP = "app", ga.PAGE = "page", ga.COMPONENT = "component";
const ya = Io;

function ma(e, t) {
  const n = e.component = qi(e, t.parentComponent, null);
  return n.ctx.$onApplyOptions = fa, n.ctx.$children = [], "app" === t.mpType && (n.render = f), t.onBeforeSetup && t.onBeforeSetup(n, t), Ki(n), t.parentComponent && n.proxy && t.parentComponent.ctx.$children.push(Gi(n) || n.proxy),
    function (e) {
      const t = xa.bind(e);
      e.$updateScopedSlots = () => ko((() => To(t)));
      const n = () => {
          if (e.isMounted) {
            const {
              next: t,
              bu: n,
              u: r
            } = e;
            Aa(e, !1), Sa(), n && $(n), Aa(e, !0), la(e, va(e)), r && ya(r)
          } else ri((() => {
            pa(e, !0)
          }), e), la(e, va(e))
        },
        r = e.effect = new Jn(n, (() => To(e.update)), e.scope),
        o = e.update = r.run.bind(r);
      o.id = e.uid, Aa(e, !0), o()
    }(n), n.proxy
}
const ba = e => {
  let t;
  for (const n in e)("class" === n || "style" === n || h(n)) && ((t || (t = {}))[n] = e[n]);
  return t
};

function va(e) {
  const {
    type: t,
    vnode: n,
    proxy: r,
    withProxy: o,
    props: i,
    propsOptions: [a],
    slots: s,
    attrs: c,
    emit: u,
    render: l,
    renderCache: f,
    data: p,
    setupState: d,
    ctx: h,
    uid: g,
    appContext: {
      app: {
        config: {
          globalProperties: {
            pruneComponentPropsCache: y
          }
        }
      }
    },
    inheritAttrs: m
  } = e;
  let b;
  e.$templateRefs = [], e.$ei = 0, y(g), e.__counter = 0 === e.__counter ? 1 : 0;
  const v = Mo(e);
  try {
    if (4 & n.shapeFlag) {
      wa(m, i, a, c);
      const e = o || r;
      b = l.call(e, e, f, i, d, p, h)
    } else {
      wa(m, i, a, t.props ? c : ba(c));
      const e = t;
      b = e.length > 1 ? e(i, {
        attrs: c,
        slots: s,
        emit: u
      }) : e(i, null)
    }
  } catch (w) {
    yo(w, e, 1), b = !1
  }
  return pa(e), Mo(v), b
}

function wa(e, t, n, r) {
  if (t && r && !1 !== e) {
    const e = Object.keys(r).filter((e => "class" !== e && "style" !== e));
    if (!e.length) return;
    n && e.some(g) ? e.forEach((e => {
      g(e) && e.slice(9) in n || (t[e] = r[e])
    })) : e.forEach((e => t[e] = r[e]))
  }
}
const Sa = e => {
  Zn(), Oo(), er()
};

function xa() {
  const e = this.$scopedSlotsData;
  if (!e || 0 === e.length) return;
  const t = this.ctx.$scope,
    n = t.data,
    r = Object.create(null);
  e.forEach((({
    path: e,
    index: t,
    data: o
  }) => {
    const i = Ae(n, e),
      a = _(t) ? `${e}.${t}` : `${e}[${t}]`;
    if (void 0 === i || void 0 === i[t]) r[a] = o;
    else {
      const e = na(o, i[t]);
      Object.keys(e).forEach((t => {
        r[a + "." + t] = e[t]
      }))
    }
  })), e.length = 0, Object.keys(r).length && t.setData(r)
}

function Aa({
  effect: e,
  update: t
}, n) {
  e.allowRecurse = t.allowRecurse = n
}
const _a = function (e, t = null) {
  A(e) || (e = Object.assign({}, e)), null == t || k(t) || (t = null);
  const n = Di(),
    r = new Set,
    o = n.app = {
      _uid: Ni++,
      _component: e,
      _props: t,
      _container: null,
      _context: n,
      _instance: null,
      version: Xi,
      get config() {
        return n.config
      },
      set config(e) {},
      use: (e, ...t) => (r.has(e) || (e && A(e.install) ? (r.add(e), e.install(o, ...t)) : A(e) && (r.add(e), e(o, ...t))), o),
      mixin: e => (n.mixins.includes(e) || n.mixins.push(e), o),
      component: (e, t) => t ? (n.components[e] = t, o) : n.components[e],
      directive: (e, t) => t ? (n.directives[e] = t, o) : n.directives[e],
      mount() {},
      unmount() {},
      provide: (e, t) => (n.provides[e] = t, o)
    };
  return o
};

function Pa(e, t = null) {
  ("undefined" != typeof window ? window : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof global ? global : "undefined" != typeof my ? my : void 0).__VUE__ = !0;
  const n = _a(e, t),
    r = n._context;
  r.config.globalProperties.$nextTick = function (e) {
    return sa(this.$, e)
  };
  const o = e => (e.appContext = r, e.shapeFlag = 6, e),
    i = function (e, t) {
      return ma(o(e), t)
    },
    a = function (e) {
      return e && function (e) {
        const {
          bum: t,
          scope: n,
          update: r,
          um: o
        } = e;
        t && $(t), n.stop(), r && (r.active = !1), o && ya(o), ya((() => {
          e.isUnmounted = !0
        }))
      }(e.$)
    };
  return n.mount = function () {
    e.render = f;
    const t = ma(o({
      type: e
    }), {
      mpType: ha.APP,
      mpInstance: null,
      parentComponent: null,
      slots: [],
      props: null
    });
    return n._instance = t.$, t.$app = n, t.$createComponent = i, t.$destroyComponent = a, r.$appInstance = t, t
  }, n.unmount = function () {}, n
}

function ka(e, t, n, r) {
  A(t) && Yo(e, t.bind(n), r)
}

function Ta(e, t, n) {
  ! function (e, t, n) {
    const r = e.mpType || n.$mpType;
    r && "component" !== r && Object.keys(e).forEach((r => {
      if (Oe(r, e[r], !1)) {
        const o = e[r];
        w(o) ? o.forEach((e => ka(r, e, n, t))) : ka(r, o, n, t)
      }
    }))
  }(e, t, n)
}

function Ea(e, t, n) {
  return e[t] = n
}

function Ia(e, ...t) {
  const n = this[e];
  return n ? n(...t) : (console.error(`method ${e} not found`), null)
}

function Oa(e) {
  return function (t, n, r) {
    if (!n) throw t;
    const o = e._instance;
    if (!o || !o.proxy) throw t;
    o.proxy.$callHook(Y, t)
  }
}

function Ca(e, t) {
  return e ? [...new Set([].concat(e, t))] : t
}
let Ba;
const ja = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  Da = /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/;

function Na() {
  const e = Dn.getStorageSync("uni_id_token") || "",
    t = e.split(".");
  if (!e || 3 !== t.length) return {
    uid: null,
    role: [],
    permission: [],
    tokenExpired: 0
  };
  let n;
  try {
    n = JSON.parse((r = t[1], decodeURIComponent(Ba(r).split("").map((function (e) {
      return "%" + ("00" + e.charCodeAt(0).toString(16)).slice(-2)
    })).join(""))))
  } catch (o) {
    throw new Error("获取当前用户信息出错，详细错误信息为：" + o.message)
  }
  var r;
  return n.tokenExpired = 1e3 * n.exp, delete n.exp, delete n.iat, n
}

function Ra(e) {
  const t = e._context.config;
  var n;
  t.errorHandler = je(e, Oa), n = t.optionMergeStrategies, Ee.forEach((e => {
    n[e] = Ca
  }));
  const r = t.globalProperties;
  ! function (e) {
    e.uniIDHasRole = function (e) {
      const {
        role: t
      } = Na();
      return t.indexOf(e) > -1
    }, e.uniIDHasPermission = function (e) {
      const {
        permission: t
      } = Na();
      return this.uniIDHasRole("admin") || t.indexOf(e) > -1
    }, e.uniIDTokenValid = function () {
      const {
        tokenExpired: e
      } = Na();
      return e > Date.now()
    }
  }(r), r.$set = Ea, r.$applyOptions = Ta, r.$callMethod = Ia, Dn.invokeCreateVueAppHook(e)
}
Ba = "function" != typeof atob ? function (e) {
  if (e = String(e).replace(/[\t\n\f\r ]+/g, ""), !Da.test(e)) throw new Error("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
  var t;
  e += "==".slice(2 - (3 & e.length));
  for (var n, r, o = "", i = 0; i < e.length;) t = ja.indexOf(e.charAt(i++)) << 18 | ja.indexOf(e.charAt(i++)) << 12 | (n = ja.indexOf(e.charAt(i++))) << 6 | (r = ja.indexOf(e.charAt(i++))), o += 64 === n ? String.fromCharCode(t >> 16 & 255) : 64 === r ? String.fromCharCode(t >> 16 & 255, t >> 8 & 255) : String.fromCharCode(t >> 16 & 255, t >> 8 & 255, 255 & t);
  return o
} : atob;
const La = Object.create(null);

function Ma(e) {
  delete La[e]
}

function Fa(e) {
  if (!e) return;
  const [t, n] = e.split(",");
  return La[t] ? La[t][parseInt(n)] : void 0
}
var Ua = {
  install(e) {
    Ra(e), e.config.globalProperties.pruneComponentPropsCache = Ma;
    const t = e.mount;
    e.mount = function (n) {
      const r = t.call(e, n),
        o = function () {
          const e = "createApp";
          if ("undefined" != typeof global) return global[e];
          if ("undefined" != typeof my) return my[e]
        }();
      return o ? o(r) : "undefined" != typeof createMiniProgramApp && createMiniProgramApp(r), r
    }
  }
};

function qa(e, t) {
  const n = zi(),
    r = n.ctx,
    o = void 0 === t || "mp-weixin" !== r.$mpPlatform && "mp-qq" !== r.$mpPlatform || !_(t) && "number" != typeof t ? "" : "_" + t,
    i = "e" + n.$ei++ + o,
    a = r.$scope;
  if (!e) return delete a[i], i;
  const s = a[i];
  return s ? s.value = e : a[i] = function (e, t) {
    const n = e => {
      var r;
      (r = e).type && r.target && (r.preventDefault = f, r.stopPropagation = f, r.stopImmediatePropagation = f, v(r, "detail") || (r.detail = {}), v(r, "markerId") && (r.detail = "object" == typeof r.detail ? r.detail : {}, r.detail.markerId = r.markerId), C(r.detail) && v(r.detail, "checked") && !v(r.detail, "value") && (r.detail.value = r.detail.checked), C(r.detail) && (r.target = y({}, r.target, r.detail)));
      let o = [e];
      e.detail && e.detail.__args__ && (o = e.detail.__args__);
      const i = n.value,
        a = () => go(function (e, t) {
          if (w(t)) {
            const n = e.stopImmediatePropagation;
            return e.stopImmediatePropagation = () => {
              n && n.call(e), e._stopped = !0
            }, t.map((e => t => !t._stopped && e(t)))
          }
          return t
        }(e, i), t, 5, o),
        s = e.target,
        c = !!s && (!!s.dataset && "true" === String(s.dataset.eventsync));
      if (!$a.includes(e.type) || c) {
        const t = a();
        if ("input" === e.type && (w(t) || T(t))) return;
        return t
      }
      setTimeout(a)
    };
    return n.value = e, n
  }(e, n), i
}
const $a = ["tap", "longpress", "longtap", "transitionend", "animationstart", "animationiteration", "animationend", "touchforcechange"];

function za(e, t = {}, n) {
  const r = zi(),
    {
      parent: o,
      isMounted: i,
      ctx: {
        $scope: a
      }
    } = r,
    s = (a.properties || a.props).uI;
  if (!s) return;
  if (!o && !i) return void ei((() => {
    za(e, t, n)
  }), r);
  const c = function (e, t) {
    let n = t.parent;
    for (; n;) {
      const t = n.$ssi;
      if (t && t[e]) return t[e];
      n = n.parent
    }
  }(s, r);
  c && c(e, t, n)
}

function Qa(e, {
  name: t,
  path: n,
  vueId: r
}) {
  const o = zi();
  e.path = n;
  const i = o.$ssi || (o.$ssi = {}),
    a = i[r] || (i[r] = function (e) {
      const t = (n, r, o) => {
        const i = t.slots[n];
        if (!i) return;
        const a = void 0 !== o;
        o = o || 0;
        const s = Mo(e),
          c = i.fn(r, n + (a ? "-" + o : ""), o),
          u = i.fn.path;
        Mo(s), (e.$scopedSlotsData || (e.$scopedSlotsData = [])).push({
          path: u,
          index: o,
          data: c
        }), e.$updateScopedSlots()
      };
      return t.slots = {}, t
    }(o));
  return a.slots[t] ? a.slots[t].fn = e : a.slots[t] = {
    fn: e
  }, Ae(o.ctx.$scope.data, n)
}

function Ha(e) {
  return _(e) ? e : function (e) {
    let t = "";
    if (!e || _(e)) return t;
    for (const n in e) t += `${n.startsWith("--")?n:M(n)}:${e[n]};`;
    return t
  }(n(e))
}
const Wa = function (e, t = null) {
    return e && (e.mpType = "app"), Pa(e, t).use(Ua)
  },
  Va = ["createSelectorQuery", "createIntersectionObserver", "selectAllComponents", "selectComponent"];

function Ka(e, t) {
  const n = e.ctx;
  n.mpType = t.mpType, n.$mpType = t.mpType, n.$mpPlatform = "mp-weixin", n.$scope = t.mpInstance, n.$mp = {}, n._self = {}, e.slots = {}, w(t.slots) && t.slots.length && (t.slots.forEach((t => {
    e.slots[t] = !0
  })), e.slots[V] && (e.slots.default = !0)), n.getOpenerEventChannel = function () {
    return t.mpInstance.getOpenerEventChannel()
  }, n.$hasHook = Ja, n.$callHook = Ga, e.emit = function (e, t) {
    return function (n, ...r) {
      const o = t.$scope;
      if (o && n) {
        const e = {
          __args__: r
        };
        o.triggerEvent(n, e)
      }
      return e.apply(this, [n, ...r])
    }
  }(e.emit, n)
}

function Ja(e) {
  const t = this.$[e];
  return !(!t || !t.length)
}

function Ga(e, t) {
  "mounted" === e && (Ga.call(this, "bm"), this.$.isMounted = !0, e = "m");
  const n = this.$[e];
  return n && Se(n, t)
}
const Ya = [te, K, J, re, ae, ue, le, fe, de];

function Xa(e, t = new Set) {
  if (e) {
    Object.keys(e).forEach((n => {
      Oe(n, e[n]) && t.add(n)
    })); {
      const {
        extends: n,
        mixins: r
      } = e;
      r && r.forEach((e => Xa(e, t))), n && Xa(n, t)
    }
  }
  return t
}

function Za(e, t, n) {
  -1 !== n.indexOf(t) || v(e, t) || (e[t] = function (e) {
    return this.$vm && this.$vm.$callHook(t, e)
  })
}
const es = [ne];

function ts(e, t, n = es) {
  t.forEach((t => Za(e, t, n)))
}

function ns(e, t, n = es) {
  Xa(t).forEach((t => Za(e, t, n)))
}
const rs = xe((() => {
  const e = [],
    t = A(getApp) && getApp({
      allowDefault: !0
    });
  if (t && t.$vm && t.$vm.$) {
    const n = t.$vm.$.appContext.mixins;
    if (w(n)) {
      const t = Object.keys(Ie);
      n.forEach((n => {
        t.forEach((t => {
          v(n, t) && !e.includes(t) && e.push(t)
        }))
      }))
    }
  }
  return e
}));
const os = [K, J, Y, X, Z, ee];

function is(e, t) {
  const n = e.$,
    r = {
      globalData: e.$options && e.$options.globalData || {},
      $vm: e,
      onLaunch(t) {
        this.$vm = e;
        const r = n.ctx;
        this.$vm && r.$scope || (Ka(n, {
          mpType: "app",
          mpInstance: this,
          slots: []
        }), r.globalData = this.globalData, e.$callHook(G, t))
      }
    },
    {
      onError: o
    } = n;
  o && (n.appContext.config.errorHandler = t => {
      e.$callHook(Y, t)
    }),
    function (e) {
      const t = ro(Ve(wx.getSystemInfoSync().language) || qe);
      Object.defineProperty(e, "$locale", {
        get: () => t.value,
        set(e) {
          t.value = e
        }
      })
    }(e);
  const i = e.$.type;
  ts(r, os), ns(r, i); {
    const e = i.methods;
    e && y(r, e)
  }
  return t && t.parse(r), r
}

function as(e, t) {
  if (A(e.onLaunch)) {
    const t = wx.getLaunchOptionsSync && wx.getLaunchOptionsSync();
    e.onLaunch(t)
  }
  A(e.onShow) && wx.onAppShow && wx.onAppShow((e => {
    t.$callHook("onShow", e)
  })), A(e.onHide) && wx.onAppHide && wx.onAppHide((e => {
    t.$callHook("onHide", e)
  }))
}
const ss = ["externalClasses"];
const cs = /_(.*)_worklet_factory_/;

function us(e, t) {
  const n = e.$children;
  for (let o = n.length - 1; o >= 0; o--) {
    const e = n[o];
    if (e.$scope._$vueId === t) return e
  }
  let r;
  for (let o = n.length - 1; o >= 0; o--)
    if (r = us(n[o], t), r) return r
}
const ls = ["eO", "uR", "uRIF", "uI", "uT", "uP", "uS"];

function fs(e) {
  e.properties || (e.properties = {}), y(e.properties, function (e, t = !1) {
    const n = {};
    return t || (ls.forEach((e => {
      n[e] = {
        type: null,
        value: ""
      }
    })), n.uS = {
      type: null,
      value: [],
      observer: function (e) {
        const t = Object.create(null);
        e && e.forEach((e => {
          t[e] = !0
        })), this.setData({
          $slots: t
        })
      }
    }), e.behaviors && e.behaviors.includes("wx://form-field") && (e.properties && e.properties.name || (n.name = {
      type: null,
      value: ""
    }), e.properties && e.properties.value || (n.value = {
      type: null,
      value: ""
    })), n
  }(e), function (e) {
    const t = {};
    return e && e.virtualHost && (t.virtualHostStyle = {
      type: null,
      value: ""
    }, t.virtualHostClass = {
      type: null,
      value: ""
    }), t
  }(e.options))
}
const ps = [String, Number, Boolean, Object, Array, null];

function ds(e, t) {
  const n = function (e, t) {
    return w(e) && 1 === e.length ? e[0] : e
  }(e);
  return -1 !== ps.indexOf(n) ? n : null
}

function hs(e, t) {
  return (t ? function (e) {
    const t = {};
    C(e) && Object.keys(e).forEach((n => {
      -1 === ls.indexOf(n) && (t[n] = e[n])
    }));
    return t
  }(e) : Fa(e.uP)) || {}
}

function gs(e) {
  const t = function () {
    const e = this.properties.uP;
    e && (this.$vm ? function (e, t) {
      const n = Gr(t.props),
        r = Fa(e) || {};
      ys(n, r) && (! function (e, t, n, r) {
        const {
          props: o,
          attrs: i,
          vnode: {
            patchFlag: a
          }
        } = e, s = Gr(o), [c] = e.propsOptions;
        let u = !1;
        if (!(r || a > 0) || 16 & a) {
          let r;
          Ti(e, t, o, i) && (u = !0);
          for (const i in s) t && (v(t, i) || (r = M(i)) !== i && v(t, r)) || (c ? !n || void 0 === n[i] && void 0 === n[r] || (o[i] = Ei(c, s, i, void 0, e, !0)) : delete o[i]);
          if (i !== s)
            for (const e in i) t && v(t, e) || (delete i[e], u = !0)
        } else if (8 & a) {
          const n = e.vnode.dynamicProps;
          for (let r = 0; r < n.length; r++) {
            let a = n[r];
            if (Ro(e.emitsOptions, a)) continue;
            const l = t[a];
            if (c)
              if (v(i, a)) l !== i[a] && (i[a] = l, u = !0);
              else {
                const t = R(a);
                o[t] = Ei(c, s, t, l, e, !1)
              }
            else l !== i[a] && (i[a] = l, u = !0)
          }
        }
        u && rr(e, "set", "$attrs")
      }(t, r, n, !1), o = t.update, vo.indexOf(o) > -1 && function (e) {
        const t = vo.indexOf(e);
        t > wo && vo.splice(t, 1)
      }(t.update), t.update());
      var o
    }(e, this.$vm.$) : "m" === this.properties.uT && function (e, t) {
      const n = t.properties,
        r = Fa(e) || {};
      ys(n, r, !1) && t.setData(r)
    }(e, this))
  };
  e.observers || (e.observers = {}), e.observers.uP = t
}

function ys(e, t, n = !0) {
  const r = Object.keys(t);
  if (n && r.length !== Object.keys(e).length) return !0;
  for (let o = 0; o < r.length; o++) {
    const n = r[o];
    if (t[n] !== e[n]) return !0
  }
  return !1
}

function ms(e, t) {
  e.data = {}, e.behaviors = function (e) {
    const t = e.behaviors;
    let n = e.props;
    n || (e.props = n = []);
    const r = [];
    return w(t) && t.forEach((e => {
      r.push(e.replace("uni://", "wx://")), "uni://form-field" === e && (w(n) ? (n.push("name"), n.push("modelValue")) : (n.name = {
        type: String,
        default: ""
      }, n.modelValue = {
        type: [String, Number, Boolean, Array, Object, Date],
        default: ""
      }))
    })), r
  }(t)
}

function bs(e, {
  parse: t,
  mocks: n,
  isPage: r,
  initRelation: o,
  handleLink: i,
  initLifetimes: a
}) {
  e = e.default || e;
  const s = {
    multipleSlots: !0,
    addGlobalClass: !0,
    pureDataPattern: /^uP$/
  };
  w(e.mixins) && e.mixins.forEach((e => {
    k(e.options) && y(s, e.options)
  })), e.options && y(s, e.options);
  const c = {
    options: s,
    lifetimes: a({
      mocks: n,
      isPage: r,
      initRelation: o,
      vueOptions: e
    }),
    pageLifetimes: {
      show() {
        this.$vm && this.$vm.$callHook("onPageShow")
      },
      hide() {
        this.$vm && this.$vm.$callHook("onPageHide")
      },
      resize(e) {
        this.$vm && this.$vm.$callHook("onPageResize", e)
      }
    },
    methods: {
      __l: i
    }
  };
  var u, l, f, p;
  return ms(c, e), fs(c), gs(c),
    function (e, t) {
      ss.forEach((n => {
        v(t, n) && (e[n] = t[n])
      }))
    }(c, e), u = c.methods, l = e.wxsCallMethods, w(l) && l.forEach((e => {
      u[e] = function (t) {
        return this.$vm[e](t)
      }
    })), f = c.methods, (p = e.methods) && Object.keys(p).forEach((e => {
      const t = e.match(cs);
      if (t) {
        const n = t[1];
        f[e] = p[e], f[n] = p[n]
      }
    })), t && t(c, {
      handleLink: i
    }), c
}
let vs, ws;

function Ss() {
  return getApp().$vm
}

function xs(e, t) {
  const {
    parse: n,
    mocks: r,
    isPage: o,
    initRelation: i,
    handleLink: a,
    initLifetimes: s
  } = t, c = bs(e, {
    mocks: r,
    isPage: o,
    initRelation: i,
    handleLink: a,
    initLifetimes: s
  });
  ! function ({
    properties: e
  }, t) {
    w(t) ? t.forEach((t => {
      e[t] = {
        type: String,
        value: ""
      }
    })) : C(t) && Object.keys(t).forEach((n => {
      const r = t[n];
      if (C(r)) {
        let t = r.default;
        A(t) && (t = t());
        const o = r.type;
        r.type = ds(o), e[n] = {
          type: r.type,
          value: t
        }
      } else e[n] = {
        type: ds(r)
      }
    }))
  }(c, (e.default || e).props);
  const u = c.methods;
  return u.onLoad = function (e) {
      var t;
      return this.options = e, this.$page = {
        fullPath: (t = this.route + ke(e), function (e) {
          return 0 === e.indexOf("/")
        }(t) ? t : "/" + t)
      }, this.$vm && this.$vm.$callHook(te, e)
    }, ts(u, Ya), ns(u, e),
    function (e, t) {
      if (!t) return;
      Object.keys(Ie).forEach((n => {
        t & Ie[n] && Za(e, n, [])
      }))
    }(u, e.__runtimeHooks), ts(u, rs()), n && n(c, {
      handleLink: a
    }), c
}
const As = Page,
  _s = Component;

function Ps(e) {
  const t = e.triggerEvent,
    n = function (n, ...r) {
      return t.apply(e, [(o = n, R(o.replace(we, "-"))), ...r]);
      var o
    };
  try {
    e.triggerEvent = n
  } catch (r) {
    e._triggerEvent = n
  }
}

function ks(e, t, n) {
  const r = t[e];
  t[e] = r ? function (...e) {
    return Ps(this), r.apply(this, e)
  } : function () {
    Ps(this)
  }
}
Page = function (e) {
  return ks(te, e), As(e)
}, Component = function (e) {
  ks("created", e);
  return e.properties && e.properties.uP || (fs(e), gs(e)), _s(e)
};
var Ts = Object.freeze({
  __proto__: null,
  handleLink: function (e) {
    const t = e.detail || e.value,
      n = t.vuePid;
    let r;
    n && (r = us(this.$vm, n)), r || (r = this.$vm), t.parent = r
  },
  initLifetimes: function ({
    mocks: e,
    isPage: t,
    initRelation: n,
    vueOptions: r
  }) {
    return {
      attached() {
        let o = this.properties;
        ! function (e, t) {
          if (!e) return;
          const n = e.split(","),
            r = n.length;
          1 === r ? t._$vueId = n[0] : 2 === r && (t._$vueId = n[0], t._$vuePid = n[1])
        }(o.uI, this);
        const i = {
          vuePid: this._$vuePid
        };
        n(this, i);
        const a = this,
          s = t(a);
        let c = o;
        this.$vm = function (e, t) {
          vs || (vs = Ss().$createComponent);
          const n = vs(e, t);
          return Gi(n.$) || n
        }({
          type: r,
          props: hs(c, s)
        }, {
          mpType: s ? "page" : "component",
          mpInstance: a,
          slots: o.uS || {},
          parentComponent: i.parent && i.parent.$,
          onBeforeSetup(t, n) {
            ! function (e, t) {
              Object.defineProperty(e, "refs", {
                get() {
                  const e = {};
                  return function (e, t, n) {
                    e.selectAllComponents(t).forEach((e => {
                      const t = e.properties.uR;
                      n[t] = e.$vm || e
                    }))
                  }(t, ".r", e), t.selectAllComponents(".r-i-f").forEach((t => {
                    const n = t.properties.uR;
                    n && (e[n] || (e[n] = []), e[n].push(t.$vm || t))
                  })), e
                }
              })
            }(t, a),
            function (e, t, n) {
              const r = e.ctx;
              n.forEach((n => {
                v(t, n) && (e[n] = r[n] = t[n])
              }))
            }(t, a, e),
            function (e, t) {
              Ka(e, t);
              const n = e.ctx;
              Va.forEach((e => {
                n[e] = function (...t) {
                  const r = n.$scope;
                  if (r && r[e]) return r[e].apply(r, t)
                }
              }))
            }(t, n)
          }
        }), s || function (e) {
          const t = e.$options;
          w(t.behaviors) && t.behaviors.includes("uni://form-field") && e.$watch("modelValue", (() => {
            e.$scope && e.$scope.setData({
              name: e.name,
              value: e.modelValue
            })
          }), {
            immediate: !0
          })
        }(this.$vm)
      },
      ready() {
        this.$vm && (this.$vm.$callHook("mounted"), this.$vm.$callHook(ne))
      },
      detached() {
        var e;
        this.$vm && (Ma(this.$vm.$.uid), e = this.$vm, ws || (ws = Ss().$destroyComponent), ws(e))
      }
    }
  },
  initRelation: function (e, t) {
    e.triggerEvent("__l", t)
  },
  isPage: function (e) {
    return !!e.route
  },
  mocks: ["__route__", "__wxExparserNodeId__", "__wxWebviewId__"]
});
const Es = function (e) {
  return App(is(e, Is))
};
var Is;
const Os = (Cs = Ts, function (e) {
  return Component(xs(e, Cs))
});
var Cs;
const Bs = function (e) {
    return function (t) {
      return Component(bs(t, e))
    }
  }(Ts),
  js = function (e) {
    return function (t) {
      as(is(t, e), t)
    }
  }(),
  Ds = function (e) {
    return function (t) {
      const n = is(t, e),
        r = A(getApp) && getApp({
          allowDefault: !0
        });
      if (!r) return;
      t.$.ctx.$scope = r;
      const o = r.globalData;
      o && Object.keys(n.globalData).forEach((e => {
        v(o, e) || (o[e] = n.globalData[e])
      })), Object.keys(n).forEach((e => {
        v(r, e) || (r[e] = n[e])
      })), as(n, t)
    }
  }();
wx.createApp = global.createApp = Es, wx.createPage = Os, wx.createComponent = Bs, wx.createPluginApp = global.createPluginApp = js, wx.createSubpackageApp = global.createSubpackageApp = Ds;
const Ns = e => (t, n = zi()) => {
    !Vi && Yo(e, t, n)
  },
  Rs = Ns(K),
  Ls = Ns(J),
  Ms = Ns(G),
  Fs = Ns(te),
  Us = Ns(ne),
  qs = Ns(re),
  $s = Ns(le),
  zs = Ns(fe);

function Qs(e) {
  return (Qs = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) {
    return typeof e
  } : function (e) {
    return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
  })(e)
}

function Hs(e, t, n) {
  return (t = function (e) {
    var t = function (e, t) {
      if ("object" !== Qs(e) || null === e) return e;
      var n = e[Symbol.toPrimitive];
      if (void 0 !== n) {
        var r = n.call(e, "string");
        if ("object" !== Qs(r)) return r;
        throw new TypeError("@@toPrimitive must return a primitive value.")
      }
      return String(e)
    }(e);
    return "symbol" === Qs(t) ? t : t + ""
  }(t)) in e ? Object.defineProperty(e, t, {
    value: n,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[t] = n, e
}
var Ws, Vs, Ks = Symbol("__ROUTER__"),
  Js = Symbol("__ROUTE__");
(Vs = Ws || (Ws = {})).push = "navigateTo", Vs.replace = "redirectTo", Vs.replaceAll = "reLaunch", Vs.pushTab = "switchTab", Vs.back = "navigateBack";
var Gs = ["navigateTo", "redirectTo", "reLaunch", "switchTab", "navigateBack"];

function Ys(e) {
  var t = {},
    n = e.split("?"),
    r = "",
    o = [];
  n.length > 1 && (r = n[1]), o = r.split("&");
  for (var i = 0; o.length > i; i++) 2 === o[i].split("=").length && (t[o[i].split("=")[0]] = o[i].split("=")[1]);
  return t
}

function Xs(e, t, n) {
  return e.replace(RegExp(t, "g"), n)
}

function Zs(e) {
  return null == e || 0 === Object.keys(e).length
}

function ec(e, t) {
  var n = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(e);
    t && (r = r.filter((function (t) {
      return Object.getOwnPropertyDescriptor(e, t).enumerable
    }))), n.push.apply(n, r)
  }
  return n
}

function tc(e) {
  for (var t = 1; arguments.length > t; t++) {
    var n = null != arguments[t] ? arguments[t] : {};
    t % 2 ? ec(Object(n), !0).forEach((function (t) {
      Hs(e, t, n[t])
    })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ec(Object(n)).forEach((function (t) {
      Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
    }))
  }
  return e
}
var nc = {
  navigateTo: Dn.navigateTo,
  redirectTo: Dn.redirectTo,
  reLaunch: Dn.reLaunch,
  switchTab: Dn.switchTab,
  navigateBack: Dn.navigateBack
};

function rc(e, t, n) {
  var r = oc(e, t);
  switch (n) {
    case "push":
      nc.navigateTo({
        url: r
      });
      break;
    case "replace":
      nc.redirectTo({
        url: r
      });
      break;
    case "pushTab":
      nc.switchTab({
        url: r
      });
      break;
    case "replaceAll":
      nc.reLaunch({
        url: r
      });
      break;
    default:
      throw Error("无效的路由类型，请确保提供正确的路由类型")
  }
}

function oc(e, t) {
  var n, r = "",
    o = {};
  if ("string" == typeof e) r = e;
  else {
    if (e.name) {
      var i = t.routes.find((function (t) {
        return t.name === e.name
      }));
      if (!i || !i.path) throw Error("您正在尝试访问的路由未在路由表中定义。请检查您的路由配置。");
      r = i.path, o = e.params
    } else e.path && (n = Xs(n = "/".concat(e.path.split("?")[0]), "//", "/"), n = Xs(n, "https:/", "https://"), r = Xs(n, "http:/", "http://"), o = tc(tc({}, Ys(e.path)), e.query || {}));
    o && (r = function (e, t) {
      for (var n in t) e.indexOf("?") > -1 ? e += "&".concat(n, "=").concat(t[n]) : e += "?".concat(n, "=").concat(t[n]);
      return e
    }(r, o = function (e) {
      var t = {};
      if (e)
        for (var n in e) {
          var r = e[n];
          void 0 === r && (r = ""), t[n] = r
        }
      return t
    }(o)))
  }
  return r
}

function ic(e) {
  var t, n = (t = getCurrentPages()).length > 0 ? t[t.length - 1] : void 0;
  if (n && n.route && e.routes) {
    var r = ac("/".concat(n.route), e);
    return n.$page && (r.fullPath = n.$page.fullPath ? n.$page.fullPath : "", r.query = n.$page.fullPath ? Ys(n.$page.fullPath) : {}, r.params = n.$page.fullPath ? Ys(n.$page.fullPath) : {}), r
  }
}

function ac(e, t) {
  e = e.split("?")[0];
  var n = t.routes.find((function (t) {
    return t.path === e || t.aliasPath === e
  }));
  return JSON.parse(JSON.stringify(n))
}

function sc(e, t, n) {
  e.guardHooks[t] = [n]
}
var cc = {
  navigateTo: Dn.navigateTo,
  redirectTo: Dn.redirectTo,
  reLaunch: Dn.reLaunch,
  switchTab: Dn.switchTab,
  navigateBack: Dn.navigateBack
};

function uc(e, t) {
  var n = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(e);
    t && (r = r.filter((function (t) {
      return Object.getOwnPropertyDescriptor(e, t).enumerable
    }))), n.push.apply(n, r)
  }
  return n
}

function lc(e) {
  for (var t = 1; arguments.length > t; t++) {
    var n = null != arguments[t] ? arguments[t] : {};
    t % 2 ? uc(Object(n), !0).forEach((function (t) {
      Hs(e, t, n[t])
    })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : uc(Object(n)).forEach((function (t) {
      Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
    }))
  }
  return e
}
const fc = {
  easycom: {
    custom: {
      "^u--(.*)": "uview-plus/components/u-$1/u-$1.vue",
      "^up-(.*)": "uview-plus/components/u-$1/u-$1.vue",
      "^u-([^-].*)": "uview-plus/components/u-$1/u-$1.vue"
    }
  },
  pages: [{
    path: "pages/user/login",
    name: "login",
    aliasPath: "/login",
    meta: {
      workAuth: !1
    },
    style: {
      navigationBarTitleText: "登录"
    }
  }, {
    path: "pages/user/changePwd",
    name: "changePwd",
    aliasPath: "/changePwd",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "修改密码"
    }
  }, {
    path: "pages/home",
    name: "home",
    aliasPath: "/home",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "工作台",
      navigationStyle: "custom"
    }
  }, {
    path: "pages/test",
    name: "test",
    aliasPath: "/test",
    meta: {
      workAuth: !1
    },
    style: {
      navigationBarTitleText: "测试",
      navigationStyle: "custom"
    }
  }, {
    path: "business/company/Index",
    name: "company",
    aliasPath: "/company",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "公司列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/company/Edit",
    name: "companyEdit",
    aliasPath: "/companyEdit",
    meta: {
      workAuth: !0,
      title: "公司"
    },
    style: {
      navigationBarTitleText: "公司",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/company/Detailed",
    name: "companyInfo",
    aliasPath: "/companyInfo",
    meta: {
      workAuth: !0,
      title: "公司信息详情"
    },
    style: {
      navigationBarTitleText: "公司信息详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/contact/Index",
    name: "contact",
    aliasPath: "/contact",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "联系人列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/contact/Edit",
    name: "contactEdit",
    aliasPath: "/contactEdit",
    meta: {
      workAuth: !0,
      title: "联系人"
    },
    style: {
      navigationBarTitleText: "联系人",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/contact/Detailed",
    name: "contactInfo",
    aliasPath: "/contactInfo",
    meta: {
      workAuth: !0,
      title: "联系人详情"
    },
    style: {
      navigationBarTitleText: "联系人详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/address/Detailed",
    name: "addressInfo",
    aliasPath: "/addressInfo",
    meta: {
      workAuth: !0,
      title: "公司地址详情"
    },
    style: {
      navigationBarTitleText: "公司地址详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/address/Edit",
    name: "addressEdit",
    aliasPath: "/addressEdit",
    meta: {
      workAuth: !0,
      title: "公司地址"
    },
    style: {
      navigationBarTitleText: "公司地址",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/index/index",
    name: "index",
    aliasPath: "/index",
    meta: {
      workAuth: !1
    },
    style: {
      navigationBarTitleText: "登录"
    }
  }, {
    path: "business/workreport/Index",
    name: "workReport",
    aliasPath: "/workReport",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "工作报告",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/workreport/Edit",
    name: "workreportEdit",
    aliasPath: "/workreportEdit",
    meta: {
      workAuth: !0,
      title: "工作报告"
    },
    style: {
      navigationBarTitleText: "工作报告",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/workreport/Detailed",
    name: "workreportInfo",
    aliasPath: "/workreportInfo",
    meta: {
      workAuth: !0,
      title: "工作报告详情"
    },
    style: {
      navigationBarTitleText: "工作报告详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/workreport/SignedReport",
    name: "signedReport",
    aliasPath: "/signedReport",
    meta: {
      workAuth: !0,
      title: "我的签到报告"
    },
    style: {
      navigationBarTitleText: "我的签到报告",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/director/Index",
    name: "director",
    aliasPath: "/director",
    meta: {
      workAuth: !0,
      title: "经理报告"
    },
    style: {
      navigationBarTitleText: "经理报告",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/director/list",
    name: "directolist",
    aliasPath: "/directolist",
    meta: {
      workAuth: !0,
      title: "经理报告"
    },
    style: {
      navigationBarTitleText: "经理报告",
      enablePullDownRefresh: !1
    }
  }, {
    path: "complaint-package/complaint/Index",
    name: "complaint",
    aliasPath: "/complaint",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "客服服务列表"
    }
  }, {
    path: "complaint-package/complaint/ApproveList",
    name: "complaintApprove",
    aliasPath: "/complaintApprove",
    meta: {
      workAuth: !0
    },
    params: {
      paramName: "value"
    },
    style: {
      navigationBarTitleText: "客服服务审批列表"
    }
  }, {
    path: "complaint-package/complaint/Edit",
    name: "complaintEdit",
    aliasPath: "/complaintEdit",
    meta: {
      workAuth: !0,
      title: "客服服务"
    },
    style: {
      navigationBarTitleText: "客服服务",
      enablePullDownRefresh: !1
    }
  }, {
    path: "complaint-package/complaint/Detailed",
    name: "complaintInfo",
    aliasPath: "/complaintInfo",
    meta: {
      workAuth: !0,
      title: "客服服务详情"
    },
    style: {
      navigationBarTitleText: "客服服务详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/mileage/Index",
    name: "mileage",
    aliasPath: "/mileage",
    meta: {
      workAuth: !0,
      title: "里程认证列表"
    },
    style: {
      navigationBarTitleText: "里程认证列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/mileage/Detailed",
    name: "mileageInfo",
    aliasPath: "/mileageInfo",
    meta: {
      workAuth: !0,
      title: "里程认证详情"
    },
    style: {
      navigationBarTitleText: "里程认证详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/internalTicket/Index",
    name: "internalTicket",
    aliasPath: "/internalTicket",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "内部工单列表"
    }
  }, {
    path: "business/internalTicket/Edit",
    name: "internalTicketEdit",
    aliasPath: "/internalTicketEdit",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "内部工单",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/internalTicket/Detailed",
    name: "internalTicketInfo",
    aliasPath: "/internalTicketInfo",
    meta: {
      workAuth: !0,
      title: "内部工单详情"
    },
    style: {
      navigationBarTitleText: "内部工单详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/lead/Index",
    name: "lead",
    aliasPath: "/lead",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "线索列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/lead/Edit",
    name: "leadEdit",
    aliasPath: "/leadEdit",
    meta: {
      workAuth: !0,
      title: "线索"
    },
    style: {
      navigationBarTitleText: "线索",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/lead/Detailed",
    name: "leadInfo",
    aliasPath: "/leadInfo",
    meta: {
      workAuth: !0,
      title: "线索详情"
    },
    style: {
      navigationBarTitleText: "线索详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/project/Index",
    name: "project",
    aliasPath: "/project",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "项目列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/project/Detailed",
    name: "projectInfo",
    aliasPath: "/projectInfo",
    meta: {
      workAuth: !0,
      title: "项目详情"
    },
    style: {
      navigationBarTitleText: "项目详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/project/Edit",
    name: "projectEdit",
    aliasPath: "/projectEdit",
    meta: {
      workAuth: !0,
      title: "项目"
    },
    style: {
      navigationBarTitleText: "项目",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/Po/Po",
    name: "Po",
    aliasPath: "/Po",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "采购",
      enablePullDownRefresh: !1
    }
  }, {
    path: "pages/Po/Details_Po",
    name: "Details_Po",
    aliasPath: "/Details_Po",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "采购订单",
      enablePullDownRefresh: !1
    }
  }, {
    path: "Toolss/Toolss",
    name: "Toolss",
    aliasPath: "/Toolss",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "小工具",
      enablePullDownRefresh: !1
    }
  }, {
    path: "Mo/Mo",
    name: "Mo",
    aliasPath: "/Mo",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "现场管理",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opportunity/Index",
    name: "opp",
    aliasPath: "/opp",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "业务机会列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opportunity/Detailed",
    name: "oppInfo",
    aliasPath: "/oppInfo",
    meta: {
      workAuth: !0,
      title: "业务机会详情"
    },
    style: {
      navigationBarTitleText: "业务机会详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opportunity/Edit",
    name: "oppEdit",
    aliasPath: "/oppEdit",
    meta: {
      workAuth: !0,
      title: "业务机会"
    },
    style: {
      navigationBarTitleText: "业务机会",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opp_product/Index",
    name: "opp_product",
    aliasPath: "/opp_product",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "业务机会产品列表",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opp_product/Detailed",
    name: "opp_productInfo",
    aliasPath: "/opp_productInfo",
    meta: {
      workAuth: !0,
      title: "业务机会产品详情"
    },
    style: {
      navigationBarTitleText: "业务机会产品详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/opp_product/Edit",
    name: "opp_productEdit",
    aliasPath: "/opp_productEdit",
    meta: {
      workAuth: !0,
      title: "业务机会产品"
    },
    style: {
      navigationBarTitleText: "业务机会产品",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/cost/Index",
    name: "cost",
    aliasPath: "/cost",
    meta: {
      workAuth: !0
    },
    style: {
      navigationBarTitleText: "费用报销",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/cost/Detailed",
    name: "costInfo",
    aliasPath: "/costInfo",
    meta: {
      workAuth: !0,
      title: "费用详情"
    },
    style: {
      navigationBarTitleText: "费用详情",
      enablePullDownRefresh: !1
    }
  }, {
    path: "business/cost/Edit",
    name: "costEdit",
    aliasPath: "/costEdit",
    meta: {
      workAuth: !0,
      title: "费用详情"
    },
    style: {
      navigationBarTitleText: "费用详情",
      enablePullDownRefresh: !1
    }
  }],
  subPackages: [{
    root: "factory",
    pages: [{
      path: "pages/paintLinProd/Index",
      name: "paintLinProd",
      aliasPath: "/paintLinProd",
      meta: {
        workAuth: !0,
        title: "烤漆线-生产工艺单"
      },
      style: {
        navigationBarTitleText: "烤漆线-生产工艺单"
      }
    }, {
      path: "pages/paintLinProd/Edit",
      name: "paintLinProdEdit",
      aliasPath: "/paintLinProdEdit",
      meta: {
        workAuth: !0,
        title: "烤漆线-生产工艺单"
      },
      style: {
        navigationBarTitleText: "烤漆线-生产工艺单",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/paintLinProd/Detailed",
      name: "paintLinProdInfo",
      aliasPath: "/paintLinProdInfo",
      meta: {
        workAuth: !0,
        title: "烤漆线-生产工艺单"
      },
      style: {
        navigationBarTitleText: "烤漆线-生产工艺单",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/pressLineReport/Index",
      name: "pressLineReport",
      aliasPath: "/pressLineReport",
      meta: {
        workAuth: !0,
        title: "压贴线-日报表"
      },
      style: {
        navigationBarTitleText: "压贴线-日报表"
      }
    }, {
      path: "pages/pressLineReport/Edit",
      name: "pressLineReportEdit",
      aliasPath: "/pressLineReportEdit",
      meta: {
        workAuth: !0,
        title: "压贴线-日报表"
      },
      style: {
        navigationBarTitleText: "压贴线-日报表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/pressLineReport/Detailed",
      name: "pressLineReportInfo",
      aliasPath: "/pressLineReportInfo",
      meta: {
        workAuth: !0,
        title: "压贴线-日报表"
      },
      style: {
        navigationBarTitleText: "压贴线-日报表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/printingLineReport/Index",
      name: "printingLineReport",
      aliasPath: "/printingLineReport",
      meta: {
        workAuth: !0,
        title: "打印线-日报表"
      },
      style: {
        navigationBarTitleText: "打印线-日报表"
      }
    }, {
      path: "pages/printingLineReport/Edit",
      name: "printingLineReportEdit",
      aliasPath: "/printingLineReportEdit",
      meta: {
        workAuth: !0,
        title: "打印线-日报表"
      },
      style: {
        navigationBarTitleText: "打印线-日报表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/printingLineReport/Detailed",
      name: "printingLineReportInfo",
      aliasPath: "/printingLineReportInfo",
      meta: {
        workAuth: !0,
        title: "打印线-日报表"
      },
      style: {
        navigationBarTitleText: "打印线-日报表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/pressLineProduction/Index",
      name: "pressLineProduction",
      aliasPath: "/pressLineProduction",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "压贴线-生产工艺单"
      }
    }, {
      path: "pages/pressLineProduction/Edit",
      name: "pressLineProductionEdit",
      aliasPath: "/pressLineProductionEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "压贴线-生产工艺单",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/pressLineProduction/Detailed",
      name: "pressLineProductionInfo",
      aliasPath: "/pressLineProductionInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "压贴线-生产工艺单",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/sandingBelt/Index",
      name: "sandingBelt",
      aliasPath: "/sandingBelt",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "砂带更换记录"
      }
    }, {
      path: "pages/sandingBelt/Edit",
      name: "sandingBeltEdit",
      aliasPath: "/sandingBeltEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "砂带更换记录",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/sandingBelt/Detailed",
      name: "sandingBeltInfo",
      aliasPath: "/sandingBeltInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "砂带更换记录",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/perDeviceMnt/Index",
      name: "perDeviceMnt",
      aliasPath: "/perDeviceMnt",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "第三方维保"
      }
    }, {
      path: "pages/perDeviceMnt/Edit",
      name: "perDeviceMntEdit",
      aliasPath: "/perDeviceMntEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "第三方维保",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/perDeviceMnt/Detailed",
      name: "perDeviceMntInfo",
      aliasPath: "/perDeviceMntInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "第三方维保",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/nitrogenLog/Index",
      name: "nitrogenLog",
      aliasPath: "/nitrogenLog",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "氮气登记表"
      }
    }, {
      path: "pages/nitrogenLog/Edit",
      name: "nitrogenLogEdit",
      aliasPath: "/nitrogenLogEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "氮气登记表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/nitrogenLog/Detailed",
      name: "nitrogenLogInfo",
      aliasPath: "/nitrogenLogInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "氮气登记表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/partsPurchase/Index",
      name: "partsPurchase",
      aliasPath: "/partsPurchase",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "零配件采购"
      }
    }, {
      path: "pages/partsPurchase/Edit",
      name: "partsPurchaseEdit",
      aliasPath: "/partsPurchaseEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "零配件采购",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/partsPurchase/Detailed",
      name: "partsPurchaseInfo",
      aliasPath: "/partsPurchaseInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "零配件采购",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/deviceRepair/Index",
      name: "deviceRepair",
      aliasPath: "/deviceRepair",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "设备维修"
      }
    }, {
      path: "pages/deviceRepair/Edit",
      name: "deviceRepairEdit",
      aliasPath: "/deviceRepairEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "设备维修",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/deviceRepair/Detailed",
      name: "deviceRepairInfo",
      aliasPath: "/deviceRepairInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "设备维修",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/jobAssignment/Index",
      name: "jobAssignment",
      aliasPath: "/jobAssignment",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "岗位分工"
      }
    }, {
      path: "pages/jobAssignment/Edit",
      name: "jobAssignmentEdit",
      aliasPath: "/jobAssignmentEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "岗位分工",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/jobAssignment/Detailed",
      name: "jobAssignmentInfo",
      aliasPath: "/jobAssignmentInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "岗位分工",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/dailyInspection/Index",
      name: "dailyInspection",
      aliasPath: "/dailyInspection",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "每日巡检报告"
      }
    }, {
      path: "pages/dailyInspection/Edit",
      name: "dailyInspectionEdit",
      aliasPath: "/dailyInspectionEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "每日巡检报告",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/dailyInspection/Detailed",
      name: "dailyInspectionInfo",
      aliasPath: "/dailyInspectionInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "每日巡检报告",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/naturalGasLog/Index",
      name: "naturalGasLog",
      aliasPath: "/naturalGasLog",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "天然气登记表"
      }
    }, {
      path: "pages/naturalGasLog/Edit",
      name: "naturalGasLogEdit",
      aliasPath: "/naturalGasLogEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "天然气登记表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/naturalGasLog/Detailed",
      name: "naturalGasLogInfo",
      aliasPath: "/naturalGasLogInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "天然气登记表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/electricityLog/Index",
      name: "electricityLog",
      aliasPath: "/electricityLog",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "电用量登记表"
      }
    }, {
      path: "pages/electricityLog/Edit",
      name: "electricityLogEdit",
      aliasPath: "/electricityLogEdit",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "电用量登记表",
        enablePullDownRefresh: !1
      }
    }, {
      path: "pages/electricityLog/Detailed",
      name: "electricityLogInfo",
      aliasPath: "/electricityLogInfo",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "电用量登记表",
        enablePullDownRefresh: !1
      }
    },
    {
      path: "pages/kaiguandengji/Index",
      name: "kaiguandengji",
      aliasPath: "/kaiguandengji",
      meta: {
        workAuth: !0
      },
      style: {
        navigationBarTitleText: "设备开关记录表",
        enablePullDownRefresh: !1
      }
    }
  
  ]
  }],
  globalStyle: {
    navigationBarTextStyle: "black",
    navigationBarTitleText: "加载中",
    navigationBarBackgroundColor: "#fff",
    backgroundColor: "#F8F8F8",
    backgroundTextStyle: "light"
  }
};
/*!
 * uni-reade-pages-vite v0.0.1
 * 2023 weisheng
 */
function pc(e, t) {
  (null == t || t > e.length) && (t = e.length);
  for (var n = 0, r = Array(t); t > n; n++) r[n] = e[n];
  return r
}

function dc(e) {
  return function (e) {
    if (Array.isArray(e)) return pc(e)
  }(e) || function (e) {
    if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"]) return Array.from(e)
  }(e) || function (e, t) {
    if (e) {
      if ("string" == typeof e) return pc(e, t);
      var n = Object.prototype.toString.call(e).slice(8, -1);
      return "Object" === n && e.constructor && (n = e.constructor.name), "Map" === n || "Set" === n ? Array.from(e) : "Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n) ? pc(e, t) : void 0
    }
  }(e) || function () {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
  }()
}
var hc = {
  includes: ["meta", "path", "aliasPath", "name"]
};

function gc(e) {
  for (var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n = [], r = 0; e.length > r; r++) {
    for (var o = e[r], i = {}, a = 0; hc.includes.length > a; a++) {
      var s = hc.includes[a],
        c = o[s];
      "path" === s && (c = t ? "/".concat(t, "/").concat(c) : "/".concat(c)), "aliasPath" === s && 0 == r && null == t ? i[s] = i[s] || "/" : void 0 !== c && (i[s] = c)
    }
    n.push(i)
  }
  return n
}
/*!
 * pinia v2.0.36
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */
let yc;
const mc = e => yc = e,
  bc = Symbol();

function vc(e) {
  return e && "object" == typeof e && "[object Object]" === Object.prototype.toString.call(e) && "function" != typeof e.toJSON
}
var wc, Sc;
(Sc = wc || (wc = {})).direct = "direct", Sc.patchObject = "patch object", Sc.patchFunction = "patch function";
const xc = () => {};

function Ac(e, t, n, r = xc) {
  e.push(t);
  const o = () => {
    const n = e.indexOf(t);
    n > -1 && (e.splice(n, 1), r())
  };
  return !n && Mn() && function (e) {
    Nn && Nn.cleanups.push(e)
  }(o), o
}

function _c(e, ...t) {
  e.slice().forEach((e => {
    e(...t)
  }))
}

function Pc(e, t) {
  e instanceof Map && t instanceof Map && t.forEach(((t, n) => e.set(n, t))), e instanceof Set && t instanceof Set && t.forEach(e.add, e);
  for (const n in t) {
    if (!t.hasOwnProperty(n)) continue;
    const r = t[n],
      o = e[n];
    vc(o) && vc(r) && e.hasOwnProperty(n) && !no(r) && !Vr(r) ? e[n] = Pc(o, r) : e[n] = r
  }
  return e
}
const kc = Symbol();
const {
  assign: Tc
} = Object;

function Ec(e, t, n, r) {
  const {
    state: o,
    actions: i,
    getters: a
  } = t, s = n.state.value[e];
  let c;
  return c = Ic(e, (function () {
    s || (n.state.value[e] = o ? o() : {});
    const t = function (e) {
      const t = w(e) ? new Array(e.length) : {};
      for (const n in e) t[n] = lo(e, n);
      return t
    }(n.state.value[e]);
    return Tc(t, i, Object.keys(a || {}).reduce(((t, r) => (t[r] = Yr(Yi((() => {
      mc(n);
      const t = n._s.get(e);
      return a[r].call(t, t)
    }))), t)), {}))
  }), t, n, r, !0), c
}

function Ic(e, t, n = {}, r, o, i) {
  let a;
  const s = Tc({
      actions: {}
    }, n),
    c = {
      deep: !0
    };
  let u, l, f, p = Yr([]),
    d = Yr([]);
  const h = r.state.value[e];
  let g;

  function y(t) {
    let n;
    u = l = !1, "function" == typeof t ? (t(r.state.value[e]), n = {
      type: wc.patchFunction,
      storeId: e,
      events: f
    }) : (Pc(r.state.value[e], t), n = {
      type: wc.patchObject,
      payload: t,
      storeId: e,
      events: f
    });
    const o = g = Symbol();
    ko().then((() => {
      g === o && (u = !0)
    })), l = !0, _c(p, n, r.state.value[e])
  }
  i || h || (r.state.value[e] = {}), ro({});
  const m = i ? function () {
    const {
      state: e
    } = n, t = e ? e() : {};
    this.$patch((e => {
      Tc(e, t)
    }))
  } : xc;

  function b(t, n) {
    return function () {
      mc(r);
      const o = Array.from(arguments),
        i = [],
        a = [];
      let s;
      _c(d, {
        args: o,
        name: t,
        store: v,
        after: function (e) {
          i.push(e)
        },
        onError: function (e) {
          a.push(e)
        }
      });
      try {
        s = n.apply(this && this.$id === e ? this : v, o)
      } catch (c) {
        throw _c(a, c), c
      }
      return s instanceof Promise ? s.then((e => (_c(i, e), e))).catch((e => (_c(a, e), Promise.reject(e)))) : (_c(i, s), s)
    }
  }
  const v = Qr({
    _p: r,
    $id: e,
    $onAction: Ac.bind(null, d),
    $patch: y,
    $reset: m,
    $subscribe(t, n = {}) {
      const o = Ac(p, t, n.detached, (() => i())),
        i = a.run((() => qo((() => r.state.value[e]), (r => {
          ("sync" === n.flush ? l : u) && t({
            storeId: e,
            type: wc.direct,
            events: f
          }, r)
        }), Tc({}, c, n))));
      return o
    },
    $dispose: function () {
      a.stop(), p = [], d = [], r._s.delete(e)
    }
  });
  r._s.set(e, v);
  const w = r._e.run((() => (a = Ln(), a.run((() => t())))));
  for (const A in w) {
    const t = w[A];
    if (no(t) && (!no(x = t) || !x.effect) || Vr(t)) i || (!h || vc(S = t) && S.hasOwnProperty(kc) || (no(t) ? t.value = h[A] : Pc(t, h[A])), r.state.value[e][A] = t);
    else if ("function" == typeof t) {
      const e = b(A, t);
      w[A] = e, s.actions[A] = t
    }
  }
  var S, x;
  return Tc(v, w), Tc(Gr(v), w), Object.defineProperty(v, "$state", {
    get: () => r.state.value[e],
    set: e => {
      y((t => {
        Tc(t, e)
      }))
    }
  }), r._p.forEach((e => {
    Tc(v, a.run((() => e({
      store: v,
      app: r._a,
      pinia: r,
      options: s
    }))))
  })), h && i && n.hydrate && n.hydrate(v.$state, h), u = !0, l = !0, v
}
var Oc = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};

function Cc(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e
}

function Bc(e) {
  if (e.__esModule) return e;
  var t = e.default;
  if ("function" == typeof t) {
    var n = function e() {
      if (this instanceof e) {
        var n = [null];
        return n.push.apply(n, arguments), new(Function.bind.apply(t, n))
      }
      return t.apply(this, arguments)
    };
    n.prototype = t.prototype
  } else n = {};
  return Object.defineProperty(n, "__esModule", {
    value: !0
  }), Object.keys(e).forEach((function (t) {
    var r = Object.getOwnPropertyDescriptor(e, t);
    Object.defineProperty(n, t, r.get ? r : {
      enumerable: !0,
      get: function () {
        return e[t]
      }
    })
  })), n
}
var jc = {},
  Dc = {
    get exports() {
      return jc
    },
    set exports(e) {
      jc = e
    }
  },
  Nc = {},
  Rc = {
    get exports() {
      return Nc
    },
    set exports(e) {
      Nc = e
    }
  },
  Lc = function (e, t) {
    return function () {
      for (var n = new Array(arguments.length), r = 0; r < n.length; r++) n[r] = arguments[r];
      return e.apply(t, n)
    }
  },
  Mc = Lc,
  Fc = Object.prototype.toString;

function Uc(e) {
  return Array.isArray(e)
}

function qc(e) {
  return void 0 === e
}

function $c(e) {
  return "[object ArrayBuffer]" === Fc.call(e)
}

function zc(e) {
  return null !== e && "object" == typeof e
}

function Qc(e) {
  if ("[object Object]" !== Fc.call(e)) return !1;
  var t = Object.getPrototypeOf(e);
  return null === t || t === Object.prototype
}

function Hc(e) {
  return "[object Function]" === Fc.call(e)
}

function Wc(e, t) {
  if (null != e)
    if ("object" != typeof e && (e = [e]), Uc(e))
      for (var n = 0, r = e.length; n < r; n++) t.call(null, e[n], n, e);
    else
      for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && t.call(null, e[o], o, e)
}
var Vc = {
    isArray: Uc,
    isArrayBuffer: $c,
    isBuffer: function (e) {
      return null !== e && !qc(e) && null !== e.constructor && !qc(e.constructor) && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e)
    },
    isFormData: function (e) {
      return "[object FormData]" === Fc.call(e)
    },
    isArrayBufferView: function (e) {
      return "undefined" != typeof ArrayBuffer && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && $c(e.buffer)
    },
    isString: function (e) {
      return "string" == typeof e
    },
    isNumber: function (e) {
      return "number" == typeof e
    },
    isObject: zc,
    isPlainObject: Qc,
    isUndefined: qc,
    isDate: function (e) {
      return "[object Date]" === Fc.call(e)
    },
    isFile: function (e) {
      return "[object File]" === Fc.call(e)
    },
    isBlob: function (e) {
      return "[object Blob]" === Fc.call(e)
    },
    isFunction: Hc,
    isStream: function (e) {
      return zc(e) && Hc(e.pipe)
    },
    isURLSearchParams: function (e) {
      return "[object URLSearchParams]" === Fc.call(e)
    },
    isStandardBrowserEnv: function () {
      return ("undefined" == typeof navigator || "ReactNative" !== navigator.product && "NativeScript" !== navigator.product && "NS" !== navigator.product) && ("undefined" != typeof window && "undefined" != typeof document)
    },
    forEach: Wc,
    merge: function e() {
      var t = {};

      function n(n, r) {
        Qc(t[r]) && Qc(n) ? t[r] = e(t[r], n) : Qc(n) ? t[r] = e({}, n) : Uc(n) ? t[r] = n.slice() : t[r] = n
      }
      for (var r = 0, o = arguments.length; r < o; r++) Wc(arguments[r], n);
      return t
    },
    extend: function (e, t, n) {
      return Wc(t, (function (t, r) {
        e[r] = n && "function" == typeof t ? Mc(t, n) : t
      })), e
    },
    trim: function (e) {
      return e.trim ? e.trim() : e.replace(/^\s+|\s+$/g, "")
    },
    stripBOM: function (e) {
      return 65279 === e.charCodeAt(0) && (e = e.slice(1)), e
    }
  },
  Kc = Vc;

function Jc(e) {
  return encodeURIComponent(e).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]")
}
var Gc = function (e, t, n) {
    if (!t) return e;
    var r;
    if (n) r = n(t);
    else if (Kc.isURLSearchParams(t)) r = t.toString();
    else {
      var o = [];
      Kc.forEach(t, (function (e, t) {
        null != e && (Kc.isArray(e) ? t += "[]" : e = [e], Kc.forEach(e, (function (e) {
          Kc.isDate(e) ? e = e.toISOString() : Kc.isObject(e) && (e = JSON.stringify(e)), o.push(Jc(t) + "=" + Jc(e))
        })))
      })), r = o.join("&")
    }
    if (r) {
      var i = e.indexOf("#"); - 1 !== i && (e = e.slice(0, i)), e += (-1 === e.indexOf("?") ? "?" : "&") + r
    }
    return e
  },
  Yc = Vc;

function Xc() {
  this.handlers = []
}
Xc.prototype.use = function (e, t, n) {
  return this.handlers.push({
    fulfilled: e,
    rejected: t,
    synchronous: !!n && n.synchronous,
    runWhen: n ? n.runWhen : null
  }), this.handlers.length - 1
}, Xc.prototype.eject = function (e) {
  this.handlers[e] && (this.handlers[e] = null)
}, Xc.prototype.forEach = function (e) {
  Yc.forEach(this.handlers, (function (t) {
    null !== t && e(t)
  }))
};
var Zc, eu, tu, nu, ru, ou, iu, au, su, cu, uu, lu, fu, pu, du, hu, gu, yu, mu, bu, vu, wu, Su = Xc,
  xu = Vc,
  Au = function (e, t) {
    xu.forEach(e, (function (n, r) {
      r !== t && r.toUpperCase() === t.toUpperCase() && (e[t] = n, delete e[r])
    }))
  },
  _u = function (e, t, n, r, o) {
    return e.config = t, n && (e.code = n), e.request = r, e.response = o, e.isAxiosError = !0, e.toJSON = function () {
      return {
        message: this.message,
        name: this.name,
        description: this.description,
        number: this.number,
        fileName: this.fileName,
        lineNumber: this.lineNumber,
        columnNumber: this.columnNumber,
        stack: this.stack,
        config: this.config,
        code: this.code,
        status: this.response && this.response.status ? this.response.status : null
      }
    }, e
  };

function Pu() {
  if (eu) return Zc;
  eu = 1;
  var e = _u;
  return Zc = function (t, n, r, o, i) {
    var a = new Error(t);
    return e(a, n, r, o, i)
  }
}

function ku() {
  if (lu) return uu;
  lu = 1;
  var e = au ? iu : (au = 1, iu = function (e) {
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e)
    }),
    t = cu ? su : (cu = 1, su = function (e, t) {
      return t ? e.replace(/\/+$/, "") + "/" + t.replace(/^\/+/, "") : e
    });
  return uu = function (n, r) {
    return n && !e(r) ? t(n, r) : r
  }
}

function Tu() {
  if (yu) return gu;

  function e(e) {
    this.message = e
  }
  return yu = 1, e.prototype.toString = function () {
    return "Cancel" + (this.message ? ": " + this.message : "")
  }, e.prototype.__CANCEL__ = !0, gu = e
}

function Eu() {
  if (bu) return mu;
  bu = 1;
  var e = Vc,
    t = function () {
      if (nu) return tu;
      nu = 1;
      var e = Pu();
      return tu = function (t, n, r) {
        var o = r.config.validateStatus;
        r.status && o && !o(r.status) ? n(e("Request failed with status code " + r.status, r.config, null, r.request, r)) : t(r)
      }
    }(),
    n = function () {
      if (ou) return ru;
      ou = 1;
      var e = Vc;
      return ru = e.isStandardBrowserEnv() ? {
        write: function (t, n, r, o, i, a) {
          var s = [];
          s.push(t + "=" + encodeURIComponent(n)), e.isNumber(r) && s.push("expires=" + new Date(r).toGMTString()), e.isString(o) && s.push("path=" + o), e.isString(i) && s.push("domain=" + i), !0 === a && s.push("secure"), document.cookie = s.join("; ")
        },
        read: function (e) {
          var t = document.cookie.match(new RegExp("(^|;\\s*)(" + e + ")=([^;]*)"));
          return t ? decodeURIComponent(t[3]) : null
        },
        remove: function (e) {
          this.write(e, "", Date.now() - 864e5)
        }
      } : {
        write: function () {},
        read: function () {
          return null
        },
        remove: function () {}
      }, ru
    }(),
    r = Gc,
    o = ku(),
    i = function () {
      if (pu) return fu;
      pu = 1;
      var e = Vc,
        t = ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "user-agent"];
      return fu = function (n) {
        var r, o, i, a = {};
        return n ? (e.forEach(n.split("\n"), (function (n) {
          if (i = n.indexOf(":"), r = e.trim(n.substr(0, i)).toLowerCase(), o = e.trim(n.substr(i + 1)), r) {
            if (a[r] && t.indexOf(r) >= 0) return;
            a[r] = "set-cookie" === r ? (a[r] ? a[r] : []).concat([o]) : a[r] ? a[r] + ", " + o : o
          }
        })), a) : a
      }
    }(),
    a = function () {
      if (hu) return du;
      hu = 1;
      var e = Vc;
      return du = e.isStandardBrowserEnv() ? function () {
        var t, n = /(msie|trident)/i.test(navigator.userAgent),
          r = document.createElement("a");

        function o(e) {
          var t = e;
          return n && (r.setAttribute("href", t), t = r.href), r.setAttribute("href", t), {
            href: r.href,
            protocol: r.protocol ? r.protocol.replace(/:$/, "") : "",
            host: r.host,
            search: r.search ? r.search.replace(/^\?/, "") : "",
            hash: r.hash ? r.hash.replace(/^#/, "") : "",
            hostname: r.hostname,
            port: r.port,
            pathname: "/" === r.pathname.charAt(0) ? r.pathname : "/" + r.pathname
          }
        }
        return t = o(window.location.href),
          function (n) {
            var r = e.isString(n) ? o(n) : n;
            return r.protocol === t.protocol && r.host === t.host
          }
      }() : function () {
        return !0
      }
    }(),
    s = Pu(),
    c = Iu(),
    u = Tu();
  return mu = function (l) {
    return new Promise((function (f, p) {
      var d, h = l.data,
        g = l.headers,
        y = l.responseType;

      function m() {
        l.cancelToken && l.cancelToken.unsubscribe(d), l.signal && l.signal.removeEventListener("abort", d)
      }
      e.isFormData(h) && delete g["Content-Type"];
      var b = new XMLHttpRequest;
      if (l.auth) {
        var v = l.auth.username || "",
          w = l.auth.password ? unescape(encodeURIComponent(l.auth.password)) : "";
        g.Authorization = "Basic " + btoa(v + ":" + w)
      }
      var S = o(l.baseURL, l.url);

      function x() {
        if (b) {
          var e = "getAllResponseHeaders" in b ? i(b.getAllResponseHeaders()) : null,
            n = {
              data: y && "text" !== y && "json" !== y ? b.response : b.responseText,
              status: b.status,
              statusText: b.statusText,
              headers: e,
              config: l,
              request: b
            };
          t((function (e) {
            f(e), m()
          }), (function (e) {
            p(e), m()
          }), n), b = null
        }
      }
      if (b.open(l.method.toUpperCase(), r(S, l.params, l.paramsSerializer), !0), b.timeout = l.timeout, "onloadend" in b ? b.onloadend = x : b.onreadystatechange = function () {
          b && 4 === b.readyState && (0 !== b.status || b.responseURL && 0 === b.responseURL.indexOf("file:")) && setTimeout(x)
        }, b.onabort = function () {
          b && (p(s("Request aborted", l, "ECONNABORTED", b)), b = null)
        }, b.onerror = function () {
          p(s("Network Error", l, null, b)), b = null
        }, b.ontimeout = function () {
          var e = l.timeout ? "timeout of " + l.timeout + "ms exceeded" : "timeout exceeded",
            t = l.transitional || c.transitional;
          l.timeoutErrorMessage && (e = l.timeoutErrorMessage), p(s(e, l, t.clarifyTimeoutError ? "ETIMEDOUT" : "ECONNABORTED", b)), b = null
        }, e.isStandardBrowserEnv()) {
        var A = (l.withCredentials || a(S)) && l.xsrfCookieName ? n.read(l.xsrfCookieName) : void 0;
        A && (g[l.xsrfHeaderName] = A)
      }
      "setRequestHeader" in b && e.forEach(g, (function (e, t) {
        void 0 === h && "content-type" === t.toLowerCase() ? delete g[t] : b.setRequestHeader(t, e)
      })), e.isUndefined(l.withCredentials) || (b.withCredentials = !!l.withCredentials), y && "json" !== y && (b.responseType = l.responseType), "function" == typeof l.onDownloadProgress && b.addEventListener("progress", l.onDownloadProgress), "function" == typeof l.onUploadProgress && b.upload && b.upload.addEventListener("progress", l.onUploadProgress), (l.cancelToken || l.signal) && (d = function (e) {
        b && (p(!e || e && e.type ? new u("canceled") : e), b.abort(), b = null)
      }, l.cancelToken && l.cancelToken.subscribe(d), l.signal && (l.signal.aborted ? d() : l.signal.addEventListener("abort", d))), h || (h = null), b.send(h)
    }))
  }
}

function Iu() {
  if (wu) return vu;
  wu = 1;
  var e = Vc,
    t = Au,
    n = _u,
    r = {
      "Content-Type": "application/x-www-form-urlencoded"
    };

  function o(t, n) {
    !e.isUndefined(t) && e.isUndefined(t["Content-Type"]) && (t["Content-Type"] = n)
  }
  var i, a = {
    transitional: {
      silentJSONParsing: !0,
      forcedJSONParsing: !0,
      clarifyTimeoutError: !1
    },
    adapter: (("undefined" != typeof XMLHttpRequest || "undefined" != typeof process && "[object process]" === Object.prototype.toString.call(process)) && (i = Eu()), i),
    transformRequest: [function (n, r) {
      return t(r, "Accept"), t(r, "Content-Type"), e.isFormData(n) || e.isArrayBuffer(n) || e.isBuffer(n) || e.isStream(n) || e.isFile(n) || e.isBlob(n) ? n : e.isArrayBufferView(n) ? n.buffer : e.isURLSearchParams(n) ? (o(r, "application/x-www-form-urlencoded;charset=utf-8"), n.toString()) : e.isObject(n) || r && "application/json" === r["Content-Type"] ? (o(r, "application/json"), function (t, n, r) {
        if (e.isString(t)) try {
          return (n || JSON.parse)(t), e.trim(t)
        } catch (Vs) {
          if ("SyntaxError" !== Vs.name) throw Vs
        }
        return (r || JSON.stringify)(t)
      }(n)) : n
    }],
    transformResponse: [function (t) {
      var r = this.transitional || a.transitional,
        o = r && r.silentJSONParsing,
        i = r && r.forcedJSONParsing,
        s = !o && "json" === this.responseType;
      if (s || i && e.isString(t) && t.length) try {
        return JSON.parse(t)
      } catch (Vs) {
        if (s) {
          if ("SyntaxError" === Vs.name) throw n(Vs, this, "E_JSON_PARSE");
          throw Vs
        }
      }
      return t
    }],
    timeout: 0,
    xsrfCookieName: "XSRF-TOKEN",
    xsrfHeaderName: "X-XSRF-TOKEN",
    maxContentLength: -1,
    maxBodyLength: -1,
    validateStatus: function (e) {
      return e >= 200 && e < 300
    },
    headers: {
      common: {
        Accept: "application/json, text/plain, */*"
      }
    }
  };
  return e.forEach(["delete", "get", "head"], (function (e) {
    a.headers[e] = {}
  })), e.forEach(["post", "put", "patch"], (function (t) {
    a.headers[t] = e.merge(r)
  })), vu = a
}
var Ou, Cu, Bu = Vc,
  ju = Iu();

function Du() {
  return Cu ? Ou : (Cu = 1, Ou = function (e) {
    return !(!e || !e.__CANCEL__)
  })
}
var Nu = Vc,
  Ru = function (e, t, n) {
    var r = this || ju;
    return Bu.forEach(n, (function (n) {
      e = n.call(r, e, t)
    })), e
  },
  Lu = Du(),
  Mu = Iu(),
  Fu = Tu();

function Uu(e) {
  if (e.cancelToken && e.cancelToken.throwIfRequested(), e.signal && e.signal.aborted) throw new Fu("canceled")
}
var qu, $u, zu = Vc,
  Qu = function (e, t) {
    t = t || {};
    var n = {};

    function r(e, t) {
      return zu.isPlainObject(e) && zu.isPlainObject(t) ? zu.merge(e, t) : zu.isPlainObject(t) ? zu.merge({}, t) : zu.isArray(t) ? t.slice() : t
    }

    function o(n) {
      return zu.isUndefined(t[n]) ? zu.isUndefined(e[n]) ? void 0 : r(void 0, e[n]) : r(e[n], t[n])
    }

    function i(e) {
      if (!zu.isUndefined(t[e])) return r(void 0, t[e])
    }

    function a(n) {
      return zu.isUndefined(t[n]) ? zu.isUndefined(e[n]) ? void 0 : r(void 0, e[n]) : r(void 0, t[n])
    }

    function s(n) {
      return n in t ? r(e[n], t[n]) : n in e ? r(void 0, e[n]) : void 0
    }
    var c = {
      url: i,
      method: i,
      data: i,
      baseURL: a,
      transformRequest: a,
      transformResponse: a,
      paramsSerializer: a,
      timeout: a,
      timeoutMessage: a,
      withCredentials: a,
      adapter: a,
      responseType: a,
      xsrfCookieName: a,
      xsrfHeaderName: a,
      onUploadProgress: a,
      onDownloadProgress: a,
      decompress: a,
      maxContentLength: a,
      maxBodyLength: a,
      transport: a,
      httpAgent: a,
      httpsAgent: a,
      cancelToken: a,
      socketPath: a,
      responseEncoding: a,
      validateStatus: s
    };
    return zu.forEach(Object.keys(e).concat(Object.keys(t)), (function (e) {
      var t = c[e] || o,
        r = t(e);
      zu.isUndefined(r) && t !== s || (n[e] = r)
    })), n
  };

function Hu() {
  return $u ? qu : ($u = 1, qu = {
    version: "0.26.0"
  })
}
var Wu = Hu().version,
  Vu = {};
["object", "boolean", "number", "function", "string", "symbol"].forEach((function (e, t) {
  Vu[e] = function (n) {
    return typeof n === e || "a" + (t < 1 ? "n " : " ") + e
  }
}));
var Ku = {};
Vu.transitional = function (e, t, n) {
  function r(e, t) {
    return "[Axios v" + Wu + "] Transitional option '" + e + "'" + t + (n ? ". " + n : "")
  }
  return function (n, o, i) {
    if (!1 === e) throw new Error(r(o, " has been removed" + (t ? " in " + t : "")));
    return t && !Ku[o] && (Ku[o] = !0, console.warn(r(o, " has been deprecated since v" + t + " and will be removed in the near future"))), !e || e(n, o, i)
  }
};
var Ju, Gu, Yu, Xu, Zu, el, tl = {
    assertOptions: function (e, t, n) {
      if ("object" != typeof e) throw new TypeError("options must be an object");
      for (var r = Object.keys(e), o = r.length; o-- > 0;) {
        var i = r[o],
          a = t[i];
        if (a) {
          var s = e[i],
            c = void 0 === s || a(s, i, e);
          if (!0 !== c) throw new TypeError("option " + i + " must be " + c)
        } else if (!0 !== n) throw Error("Unknown option " + i)
      }
    },
    validators: Vu
  },
  nl = Vc,
  rl = Gc,
  ol = Su,
  il = function (e) {
    return Uu(e), e.headers = e.headers || {}, e.data = Ru.call(e, e.data, e.headers, e.transformRequest), e.headers = Nu.merge(e.headers.common || {}, e.headers[e.method] || {}, e.headers), Nu.forEach(["delete", "get", "head", "post", "put", "patch", "common"], (function (t) {
      delete e.headers[t]
    })), (e.adapter || Mu.adapter)(e).then((function (t) {
      return Uu(e), t.data = Ru.call(e, t.data, t.headers, e.transformResponse), t
    }), (function (t) {
      return Lu(t) || (Uu(e), t && t.response && (t.response.data = Ru.call(e, t.response.data, t.response.headers, e.transformResponse))), Promise.reject(t)
    }))
  },
  al = Qu,
  sl = tl,
  cl = sl.validators;

function ul(e) {
  this.defaults = e, this.interceptors = {
    request: new ol,
    response: new ol
  }
}
ul.prototype.request = function (e, t) {
  "string" == typeof e ? (t = t || {}).url = e : t = e || {}, (t = al(this.defaults, t)).method ? t.method = t.method.toLowerCase() : this.defaults.method ? t.method = this.defaults.method.toLowerCase() : t.method = "get";
  var n = t.transitional;
  void 0 !== n && sl.assertOptions(n, {
    silentJSONParsing: cl.transitional(cl.boolean),
    forcedJSONParsing: cl.transitional(cl.boolean),
    clarifyTimeoutError: cl.transitional(cl.boolean)
  }, !1);
  var r = [],
    o = !0;
  this.interceptors.request.forEach((function (e) {
    "function" == typeof e.runWhen && !1 === e.runWhen(t) || (o = o && e.synchronous, r.unshift(e.fulfilled, e.rejected))
  }));
  var i, a = [];
  if (this.interceptors.response.forEach((function (e) {
      a.push(e.fulfilled, e.rejected)
    })), !o) {
    var s = [il, void 0];
    for (Array.prototype.unshift.apply(s, r), s = s.concat(a), i = Promise.resolve(t); s.length;) i = i.then(s.shift(), s.shift());
    return i
  }
  for (var c = t; r.length;) {
    var u = r.shift(),
      l = r.shift();
    try {
      c = u(c)
    } catch (f) {
      l(f);
      break
    }
  }
  try {
    i = il(c)
  } catch (f) {
    return Promise.reject(f)
  }
  for (; a.length;) i = i.then(a.shift(), a.shift());
  return i
}, ul.prototype.getUri = function (e) {
  return e = al(this.defaults, e), rl(e.url, e.params, e.paramsSerializer).replace(/^\?/, "")
}, nl.forEach(["delete", "get", "head", "options"], (function (e) {
  ul.prototype[e] = function (t, n) {
    return this.request(al(n || {}, {
      method: e,
      url: t,
      data: (n || {}).data
    }))
  }
})), nl.forEach(["post", "put", "patch"], (function (e) {
  ul.prototype[e] = function (t, n, r) {
    return this.request(al(r || {}, {
      method: e,
      url: t,
      data: n
    }))
  }
}));
var ll = Vc,
  fl = Lc,
  pl = ul,
  dl = Qu;
var hl = function e(t) {
  var n = new pl(t),
    r = fl(pl.prototype.request, n);
  return ll.extend(r, pl.prototype, n), ll.extend(r, n), r.create = function (n) {
    return e(dl(t, n))
  }, r
}(Iu());
hl.Axios = pl, hl.Cancel = Tu(), hl.CancelToken = function () {
  if (Gu) return Ju;
  Gu = 1;
  var e = Tu();

  function t(t) {
    if ("function" != typeof t) throw new TypeError("executor must be a function.");
    var n;
    this.promise = new Promise((function (e) {
      n = e
    }));
    var r = this;
    this.promise.then((function (e) {
      if (r._listeners) {
        var t, n = r._listeners.length;
        for (t = 0; t < n; t++) r._listeners[t](e);
        r._listeners = null
      }
    })), this.promise.then = function (e) {
      var t, n = new Promise((function (e) {
        r.subscribe(e), t = e
      })).then(e);
      return n.cancel = function () {
        r.unsubscribe(t)
      }, n
    }, t((function (t) {
      r.reason || (r.reason = new e(t), n(r.reason))
    }))
  }
  return t.prototype.throwIfRequested = function () {
    if (this.reason) throw this.reason
  }, t.prototype.subscribe = function (e) {
    this.reason ? e(this.reason) : this._listeners ? this._listeners.push(e) : this._listeners = [e]
  }, t.prototype.unsubscribe = function (e) {
    if (this._listeners) {
      var t = this._listeners.indexOf(e); - 1 !== t && this._listeners.splice(t, 1)
    }
  }, t.source = function () {
    var e;
    return {
      token: new t((function (t) {
        e = t
      })),
      cancel: e
    }
  }, Ju = t
}(), hl.isCancel = Du(), hl.VERSION = Hu().version, hl.all = function (e) {
  return Promise.all(e)
}, hl.spread = Xu ? Yu : (Xu = 1, Yu = function (e) {
  return function (t) {
    return e.apply(null, t)
  }
}), hl.isAxiosError = function () {
  if (el) return Zu;
  el = 1;
  var e = Vc;
  return Zu = function (t) {
    return e.isObject(t) && !0 === t.isAxiosError
  }
}(), Rc.exports = hl, Nc.default = hl, Dc.exports = Nc;
const gl = Cc(jc);
var yl, ml = "undefined" != typeof Symbol && Symbol,
  bl = function () {
    if ("function" != typeof Symbol || "function" != typeof Object.getOwnPropertySymbols) return !1;
    if ("symbol" == typeof Symbol.iterator) return !0;
    var e = {},
      t = Symbol("test"),
      n = Object(t);
    if ("string" == typeof t) return !1;
    if ("[object Symbol]" !== Object.prototype.toString.call(t)) return !1;
    if ("[object Symbol]" !== Object.prototype.toString.call(n)) return !1;
    for (t in e[t] = 42, e) return !1;
    if ("function" == typeof Object.keys && 0 !== Object.keys(e).length) return !1;
    if ("function" == typeof Object.getOwnPropertyNames && 0 !== Object.getOwnPropertyNames(e).length) return !1;
    var r = Object.getOwnPropertySymbols(e);
    if (1 !== r.length || r[0] !== t) return !1;
    if (!Object.prototype.propertyIsEnumerable.call(e, t)) return !1;
    if ("function" == typeof Object.getOwnPropertyDescriptor) {
      var o = Object.getOwnPropertyDescriptor(e, t);
      if (42 !== o.value || !0 !== o.enumerable) return !1
    }
    return !0
  },
  vl = {
    foo: {}
  },
  wl = Object,
  Sl = Object.prototype.toString,
  xl = Math.max,
  Al = function (e, t) {
    for (var n = [], r = 0; r < e.length; r += 1) n[r] = e[r];
    for (var o = 0; o < t.length; o += 1) n[o + e.length] = t[o];
    return n
  },
  _l = function (e) {
    var t = this;
    if ("function" != typeof t || "[object Function]" !== Sl.apply(t)) throw new TypeError("Function.prototype.bind called on incompatible " + t);
    for (var n, r = function (e, t) {
        for (var n = [], r = t || 0, o = 0; r < e.length; r += 1, o += 1) n[o] = e[r];
        return n
      }(arguments, 1), o = xl(0, t.length - r.length), i = [], a = 0; a < o; a++) i[a] = "$" + a;
    if (n = Function("binder", "return function (" + function (e, t) {
        for (var n = "", r = 0; r < e.length; r += 1) n += e[r], r + 1 < e.length && (n += t);
        return n
      }(i, ",") + "){ return binder.apply(this,arguments); }")((function () {
        if (this instanceof n) {
          var o = t.apply(this, Al(r, arguments));
          return Object(o) === o ? o : this
        }
        return t.apply(e, Al(r, arguments))
      })), t.prototype) {
      var s = function () {};
      s.prototype = t.prototype, n.prototype = new s, s.prototype = null
    }
    return n
  },
  Pl = Function.prototype.bind || _l,
  kl = Function.prototype.call,
  Tl = Object.prototype.hasOwnProperty,
  El = Pl.call(kl, Tl),
  Il = SyntaxError,
  Ol = Function,
  Cl = TypeError,
  Bl = function (e) {
    try {
      return Ol('"use strict"; return (' + e + ").constructor;")()
    } catch (Vs) {}
  },
  jl = Object.getOwnPropertyDescriptor;
if (jl) try {
  jl({}, "")
} catch (Vs) {
  jl = null
}
var Dl = function () {
    throw new Cl
  },
  Nl = jl ? function () {
    try {
      return Dl
    } catch (e) {
      try {
        return jl(arguments, "callee").get
      } catch (t) {
        return Dl
      }
    }
  }() : Dl,
  Rl = "function" == typeof ml && "function" == typeof Symbol && "symbol" == typeof ml("foo") && "symbol" == typeof Symbol("bar") && bl(),
  Ll = {
    __proto__: vl
  }.foo === vl.foo && !({
      __proto__: null
    }
    instanceof wl),
  Ml = Object.getPrototypeOf || (Ll ? function (e) {
    return e.__proto__
  } : null),
  Fl = {},
  Ul = "undefined" != typeof Uint8Array && Ml ? Ml(Uint8Array) : yl,
  ql = {
    "%AggregateError%": "undefined" == typeof AggregateError ? yl : AggregateError,
    "%Array%": Array,
    "%ArrayBuffer%": "undefined" == typeof ArrayBuffer ? yl : ArrayBuffer,
    "%ArrayIteratorPrototype%": Rl && Ml ? Ml([][Symbol.iterator]()) : yl,
    "%AsyncFromSyncIteratorPrototype%": yl,
    "%AsyncFunction%": Fl,
    "%AsyncGenerator%": Fl,
    "%AsyncGeneratorFunction%": Fl,
    "%AsyncIteratorPrototype%": Fl,
    "%Atomics%": "undefined" == typeof Atomics ? yl : Atomics,
    "%BigInt%": "undefined" == typeof BigInt ? yl : BigInt,
    "%BigInt64Array%": "undefined" == typeof BigInt64Array ? yl : BigInt64Array,
    "%BigUint64Array%": "undefined" == typeof BigUint64Array ? yl : BigUint64Array,
    "%Boolean%": Boolean,
    "%DataView%": "undefined" == typeof DataView ? yl : DataView,
    "%Date%": Date,
    "%decodeURI%": decodeURI,
    "%decodeURIComponent%": decodeURIComponent,
    "%encodeURI%": encodeURI,
    "%encodeURIComponent%": encodeURIComponent,
    "%Error%": Error,
    "%eval%": eval,
    "%EvalError%": EvalError,
    "%Float32Array%": "undefined" == typeof Float32Array ? yl : Float32Array,
    "%Float64Array%": "undefined" == typeof Float64Array ? yl : Float64Array,
    "%FinalizationRegistry%": "undefined" == typeof FinalizationRegistry ? yl : FinalizationRegistry,
    "%Function%": Ol,
    "%GeneratorFunction%": Fl,
    "%Int8Array%": "undefined" == typeof Int8Array ? yl : Int8Array,
    "%Int16Array%": "undefined" == typeof Int16Array ? yl : Int16Array,
    "%Int32Array%": "undefined" == typeof Int32Array ? yl : Int32Array,
    "%isFinite%": isFinite,
    "%isNaN%": isNaN,
    "%IteratorPrototype%": Rl && Ml ? Ml(Ml([][Symbol.iterator]())) : yl,
    "%JSON%": "object" == typeof JSON ? JSON : yl,
    "%Map%": "undefined" == typeof Map ? yl : Map,
    "%MapIteratorPrototype%": "undefined" != typeof Map && Rl && Ml ? Ml((new Map)[Symbol.iterator]()) : yl,
    "%Math%": Math,
    "%Number%": Number,
    "%Object%": Object,
    "%parseFloat%": parseFloat,
    "%parseInt%": parseInt,
    "%Promise%": "undefined" == typeof Promise ? yl : Promise,
    "%Proxy%": "undefined" == typeof Proxy ? yl : Proxy,
    "%RangeError%": RangeError,
    "%ReferenceError%": ReferenceError,
    "%Reflect%": "undefined" == typeof Reflect ? yl : Reflect,
    "%RegExp%": RegExp,
    "%Set%": "undefined" == typeof Set ? yl : Set,
    "%SetIteratorPrototype%": "undefined" != typeof Set && Rl && Ml ? Ml((new Set)[Symbol.iterator]()) : yl,
    "%SharedArrayBuffer%": "undefined" == typeof SharedArrayBuffer ? yl : SharedArrayBuffer,
    "%String%": String,
    "%StringIteratorPrototype%": Rl && Ml ? Ml("" [Symbol.iterator]()) : yl,
    "%Symbol%": Rl ? Symbol : yl,
    "%SyntaxError%": Il,
    "%ThrowTypeError%": Nl,
    "%TypedArray%": Ul,
    "%TypeError%": Cl,
    "%Uint8Array%": "undefined" == typeof Uint8Array ? yl : Uint8Array,
    "%Uint8ClampedArray%": "undefined" == typeof Uint8ClampedArray ? yl : Uint8ClampedArray,
    "%Uint16Array%": "undefined" == typeof Uint16Array ? yl : Uint16Array,
    "%Uint32Array%": "undefined" == typeof Uint32Array ? yl : Uint32Array,
    "%URIError%": URIError,
    "%WeakMap%": "undefined" == typeof WeakMap ? yl : WeakMap,
    "%WeakRef%": "undefined" == typeof WeakRef ? yl : WeakRef,
    "%WeakSet%": "undefined" == typeof WeakSet ? yl : WeakSet
  };
if (Ml) try {
  null.error
} catch (Vs) {
  var $l = Ml(Ml(Vs));
  ql["%Error.prototype%"] = $l
}
var zl = function e(t) {
    var n;
    if ("%AsyncFunction%" === t) n = Bl("async function () {}");
    else if ("%GeneratorFunction%" === t) n = Bl("function* () {}");
    else if ("%AsyncGeneratorFunction%" === t) n = Bl("async function* () {}");
    else if ("%AsyncGenerator%" === t) {
      var r = e("%AsyncGeneratorFunction%");
      r && (n = r.prototype)
    } else if ("%AsyncIteratorPrototype%" === t) {
      var o = e("%AsyncGenerator%");
      o && Ml && (n = Ml(o.prototype))
    }
    return ql[t] = n, n
  },
  Ql = {
    "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
    "%ArrayPrototype%": ["Array", "prototype"],
    "%ArrayProto_entries%": ["Array", "prototype", "entries"],
    "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
    "%ArrayProto_keys%": ["Array", "prototype", "keys"],
    "%ArrayProto_values%": ["Array", "prototype", "values"],
    "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
    "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
    "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
    "%BooleanPrototype%": ["Boolean", "prototype"],
    "%DataViewPrototype%": ["DataView", "prototype"],
    "%DatePrototype%": ["Date", "prototype"],
    "%ErrorPrototype%": ["Error", "prototype"],
    "%EvalErrorPrototype%": ["EvalError", "prototype"],
    "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
    "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
    "%FunctionPrototype%": ["Function", "prototype"],
    "%Generator%": ["GeneratorFunction", "prototype"],
    "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
    "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
    "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
    "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
    "%JSONParse%": ["JSON", "parse"],
    "%JSONStringify%": ["JSON", "stringify"],
    "%MapPrototype%": ["Map", "prototype"],
    "%NumberPrototype%": ["Number", "prototype"],
    "%ObjectPrototype%": ["Object", "prototype"],
    "%ObjProto_toString%": ["Object", "prototype", "toString"],
    "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
    "%PromisePrototype%": ["Promise", "prototype"],
    "%PromiseProto_then%": ["Promise", "prototype", "then"],
    "%Promise_all%": ["Promise", "all"],
    "%Promise_reject%": ["Promise", "reject"],
    "%Promise_resolve%": ["Promise", "resolve"],
    "%RangeErrorPrototype%": ["RangeError", "prototype"],
    "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
    "%RegExpPrototype%": ["RegExp", "prototype"],
    "%SetPrototype%": ["Set", "prototype"],
    "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
    "%StringPrototype%": ["String", "prototype"],
    "%SymbolPrototype%": ["Symbol", "prototype"],
    "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
    "%TypedArrayPrototype%": ["TypedArray", "prototype"],
    "%TypeErrorPrototype%": ["TypeError", "prototype"],
    "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
    "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
    "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
    "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
    "%URIErrorPrototype%": ["URIError", "prototype"],
    "%WeakMapPrototype%": ["WeakMap", "prototype"],
    "%WeakSetPrototype%": ["WeakSet", "prototype"]
  },
  Hl = Pl,
  Wl = El,
  Vl = Hl.call(Function.call, Array.prototype.concat),
  Kl = Hl.call(Function.apply, Array.prototype.splice),
  Jl = Hl.call(Function.call, String.prototype.replace),
  Gl = Hl.call(Function.call, String.prototype.slice),
  Yl = Hl.call(Function.call, RegExp.prototype.exec),
  Xl = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,
  Zl = /\\(\\)?/g,
  ef = function (e, t) {
    var n, r = e;
    if (Wl(Ql, r) && (r = "%" + (n = Ql[r])[0] + "%"), Wl(ql, r)) {
      var o = ql[r];
      if (o === Fl && (o = zl(r)), void 0 === o && !t) throw new Cl("intrinsic " + e + " exists, but is not available. Please file an issue!");
      return {
        alias: n,
        name: r,
        value: o
      }
    }
    throw new Il("intrinsic " + e + " does not exist!")
  },
  tf = function (e, t) {
    if ("string" != typeof e || 0 === e.length) throw new Cl("intrinsic name must be a non-empty string");
    if (arguments.length > 1 && "boolean" != typeof t) throw new Cl('"allowMissing" argument must be a boolean');
    if (null === Yl(/^%?[^%]*%?$/, e)) throw new Il("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
    var n = function (e) {
        var t = Gl(e, 0, 1),
          n = Gl(e, -1);
        if ("%" === t && "%" !== n) throw new Il("invalid intrinsic syntax, expected closing `%`");
        if ("%" === n && "%" !== t) throw new Il("invalid intrinsic syntax, expected opening `%`");
        var r = [];
        return Jl(e, Xl, (function (e, t, n, o) {
          r[r.length] = n ? Jl(o, Zl, "$1") : t || e
        })), r
      }(e),
      r = n.length > 0 ? n[0] : "",
      o = ef("%" + r + "%", t),
      i = o.name,
      a = o.value,
      s = !1,
      c = o.alias;
    c && (r = c[0], Kl(n, Vl([0, 1], c)));
    for (var u = 1, l = !0; u < n.length; u += 1) {
      var f = n[u],
        p = Gl(f, 0, 1),
        d = Gl(f, -1);
      if (('"' === p || "'" === p || "`" === p || '"' === d || "'" === d || "`" === d) && p !== d) throw new Il("property names with quotes must have matching quotes");
      if ("constructor" !== f && l || (s = !0), Wl(ql, i = "%" + (r += "." + f) + "%")) a = ql[i];
      else if (null != a) {
        if (!(f in a)) {
          if (!t) throw new Cl("base intrinsic for " + e + " exists, but the property is not available.");
          return
        }
        if (jl && u + 1 >= n.length) {
          var h = jl(a, f);
          a = (l = !!h) && "get" in h && !("originalValue" in h.get) ? h.get : a[f]
        } else l = Wl(a, f), a = a[f];
        l && !s && (ql[i] = a)
      }
    }
    return a
  },
  nf = {},
  rf = {
    get exports() {
      return nf
    },
    set exports(e) {
      nf = e
    }
  },
  of = tf("%Object.defineProperty%", !0),
  af = function () {
    if ( of ) try {
      return of({}, "a", {
        value: 1
      }), !0
    } catch (Vs) {
      return !1
    }
    return !1
  };
af.hasArrayLengthDefineBug = function () {
  if (!af()) return null;
  try {
    return 1 !== of ([], "length", {
      value: 1
    }).length
  } catch (Vs) {
    return !0
  }
};
var sf = af,
  cf = tf("%Object.getOwnPropertyDescriptor%", !0);
if (cf) try {
  cf([], "length")
} catch (Vs) {
  cf = null
}
var uf = cf,
  lf = sf(),
  ff = tf,
  pf = lf && ff("%Object.defineProperty%", !0);
if (pf) try {
  pf({}, "a", {
    value: 1
  })
} catch (Vs) {
  pf = !1
}
var df = ff("%SyntaxError%"),
  hf = ff("%TypeError%"),
  gf = uf,
  yf = tf,
  mf = function (e, t, n) {
    if (!e || "object" != typeof e && "function" != typeof e) throw new hf("`obj` must be an object or a function`");
    if ("string" != typeof t && "symbol" != typeof t) throw new hf("`property` must be a string or a symbol`");
    if (arguments.length > 3 && "boolean" != typeof arguments[3] && null !== arguments[3]) throw new hf("`nonEnumerable`, if provided, must be a boolean or null");
    if (arguments.length > 4 && "boolean" != typeof arguments[4] && null !== arguments[4]) throw new hf("`nonWritable`, if provided, must be a boolean or null");
    if (arguments.length > 5 && "boolean" != typeof arguments[5] && null !== arguments[5]) throw new hf("`nonConfigurable`, if provided, must be a boolean or null");
    if (arguments.length > 6 && "boolean" != typeof arguments[6]) throw new hf("`loose`, if provided, must be a boolean");
    var r = arguments.length > 3 ? arguments[3] : null,
      o = arguments.length > 4 ? arguments[4] : null,
      i = arguments.length > 5 ? arguments[5] : null,
      a = arguments.length > 6 && arguments[6],
      s = !!gf && gf(e, t);
    if (pf) pf(e, t, {
      configurable: null === i && s ? s.configurable : !i,
      enumerable: null === r && s ? s.enumerable : !r,
      value: n,
      writable: null === o && s ? s.writable : !o
    });
    else {
      if (!a && (r || o || i)) throw new df("This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.");
      e[t] = n
    }
  },
  bf = sf(),
  vf = uf,
  wf = yf("%TypeError%"),
  Sf = yf("%Math.floor%"),
  xf = function (e, t) {
    if ("function" != typeof e) throw new wf("`fn` is not a function");
    if ("number" != typeof t || t < 0 || t > 4294967295 || Sf(t) !== t) throw new wf("`length` must be a positive 32-bit integer");
    var n = arguments.length > 2 && !!arguments[2],
      r = !0,
      o = !0;
    if ("length" in e && vf) {
      var i = vf(e, "length");
      i && !i.configurable && (r = !1), i && !i.writable && (o = !1)
    }
    return (r || o || !n) && (bf ? mf(e, "length", t, !0, !0) : mf(e, "length", t)), e
  };
! function (e) {
  var t = Pl,
    n = tf,
    r = xf,
    o = n("%TypeError%"),
    i = n("%Function.prototype.apply%"),
    a = n("%Function.prototype.call%"),
    s = n("%Reflect.apply%", !0) || t.call(a, i),
    c = n("%Object.defineProperty%", !0),
    u = n("%Math.max%");
  if (c) try {
    c({}, "a", {
      value: 1
    })
  } catch (Vs) {
    c = null
  }
  e.exports = function (e) {
    if ("function" != typeof e) throw new o("a function is required");
    var n = s(t, a, arguments);
    return r(n, 1 + u(0, e.length - (arguments.length - 1)), !0)
  };
  var l = function () {
    return s(t, i, arguments)
  };
  c ? c(e.exports, "apply", {
    value: l
  }) : e.exports.apply = l
}(rf);
var Af = tf,
  _f = nf,
  Pf = _f(Af("String.prototype.indexOf"));
const kf = Bc(Object.freeze(Object.defineProperty({
  __proto__: null,
  default: {}
}, Symbol.toStringTag, {
  value: "Module"
})));
var Tf = "function" == typeof Map && Map.prototype,
  Ef = Object.getOwnPropertyDescriptor && Tf ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null,
  If = Tf && Ef && "function" == typeof Ef.get ? Ef.get : null,
  Of = Tf && Map.prototype.forEach,
  Cf = "function" == typeof Set && Set.prototype,
  Bf = Object.getOwnPropertyDescriptor && Cf ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null,
  jf = Cf && Bf && "function" == typeof Bf.get ? Bf.get : null,
  Df = Cf && Set.prototype.forEach,
  Nf = "function" == typeof WeakMap && WeakMap.prototype ? WeakMap.prototype.has : null,
  Rf = "function" == typeof WeakSet && WeakSet.prototype ? WeakSet.prototype.has : null,
  Lf = "function" == typeof WeakRef && WeakRef.prototype ? WeakRef.prototype.deref : null,
  Mf = Boolean.prototype.valueOf,
  Ff = Object.prototype.toString,
  Uf = Function.prototype.toString,
  qf = String.prototype.match,
  $f = String.prototype.slice,
  zf = String.prototype.replace,
  Qf = String.prototype.toUpperCase,
  Hf = String.prototype.toLowerCase,
  Wf = RegExp.prototype.test,
  Vf = Array.prototype.concat,
  Kf = Array.prototype.join,
  Jf = Array.prototype.slice,
  Gf = Math.floor,
  Yf = "function" == typeof BigInt ? BigInt.prototype.valueOf : null,
  Xf = Object.getOwnPropertySymbols,
  Zf = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? Symbol.prototype.toString : null,
  ep = "function" == typeof Symbol && "object" == typeof Symbol.iterator,
  tp = "function" == typeof Symbol && Symbol.toStringTag && (typeof Symbol.toStringTag === ep || "symbol") ? Symbol.toStringTag : null,
  np = Object.prototype.propertyIsEnumerable,
  rp = ("function" == typeof Reflect ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function (e) {
    return e.__proto__
  } : null);

function op(e, t) {
  if (e === 1 / 0 || e === -1 / 0 || e != e || e && e > -1e3 && e < 1e3 || Wf.call(/e/, t)) return t;
  var n = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
  if ("number" == typeof e) {
    var r = e < 0 ? -Gf(-e) : Gf(e);
    if (r !== e) {
      var o = String(r),
        i = $f.call(t, o.length + 1);
      return zf.call(o, n, "$&_") + "." + zf.call(zf.call(i, /([0-9]{3})/g, "$&_"), /_$/, "")
    }
  }
  return zf.call(t, n, "$&_")
}
var ip = kf,
  ap = ip.custom,
  sp = pp(ap) ? ap : null;

function cp(e, t, n) {
  var r = "double" === (n.quoteStyle || t) ? '"' : "'";
  return r + e + r
}

function up(e) {
  return zf.call(String(e), /"/g, "&quot;")
}

function lp(e) {
  return !("[object Array]" !== gp(e) || tp && "object" == typeof e && tp in e)
}

function fp(e) {
  return !("[object RegExp]" !== gp(e) || tp && "object" == typeof e && tp in e)
}

function pp(e) {
  if (ep) return e && "object" == typeof e && e instanceof Symbol;
  if ("symbol" == typeof e) return !0;
  if (!e || "object" != typeof e || !Zf) return !1;
  try {
    return Zf.call(e), !0
  } catch (Vs) {}
  return !1
}
var dp = Object.prototype.hasOwnProperty || function (e) {
  return e in this
};

function hp(e, t) {
  return dp.call(e, t)
}

function gp(e) {
  return Ff.call(e)
}

function yp(e, t) {
  if (e.indexOf) return e.indexOf(t);
  for (var n = 0, r = e.length; n < r; n++)
    if (e[n] === t) return n;
  return -1
}

function mp(e, t) {
  if (e.length > t.maxStringLength) {
    var n = e.length - t.maxStringLength,
      r = "... " + n + " more character" + (n > 1 ? "s" : "");
    return mp($f.call(e, 0, t.maxStringLength), t) + r
  }
  return cp(zf.call(zf.call(e, /(['\\])/g, "\\$1"), /[\x00-\x1f]/g, bp), "single", t)
}

function bp(e) {
  var t = e.charCodeAt(0),
    n = {
      8: "b",
      9: "t",
      10: "n",
      12: "f",
      13: "r"
    } [t];
  return n ? "\\" + n : "\\x" + (t < 16 ? "0" : "") + Qf.call(t.toString(16))
}

function vp(e) {
  return "Object(" + e + ")"
}

function wp(e) {
  return e + " { ? }"
}

function Sp(e, t, n, r) {
  return e + " (" + t + ") {" + (r ? xp(n, r) : Kf.call(n, ", ")) + "}"
}

function xp(e, t) {
  if (0 === e.length) return "";
  var n = "\n" + t.prev + t.base;
  return n + Kf.call(e, "," + n) + "\n" + t.prev
}

function Ap(e, t) {
  var n = lp(e),
    r = [];
  if (n) {
    r.length = e.length;
    for (var o = 0; o < e.length; o++) r[o] = hp(e, o) ? t(e[o], e) : ""
  }
  var i, a = "function" == typeof Xf ? Xf(e) : [];
  if (ep) {
    i = {};
    for (var s = 0; s < a.length; s++) i["$" + a[s]] = a[s]
  }
  for (var c in e) hp(e, c) && (n && String(Number(c)) === c && c < e.length || ep && i["$" + c] instanceof Symbol || (Wf.call(/[^\w$]/, c) ? r.push(t(c, e) + ": " + t(e[c], e)) : r.push(c + ": " + t(e[c], e))));
  if ("function" == typeof Xf)
    for (var u = 0; u < a.length; u++) np.call(e, a[u]) && r.push("[" + t(a[u]) + "]: " + t(e[a[u]], e));
  return r
}
var _p, Pp, kp = tf,
  Tp = function (e, t) {
    var n = Af(e, !!t);
    return "function" == typeof n && Pf(e, ".prototype.") > -1 ? _f(n) : n
  },
  Ep = function e(t, n, r, o) {
    var i = n || {};
    if (hp(i, "quoteStyle") && "single" !== i.quoteStyle && "double" !== i.quoteStyle) throw new TypeError('option "quoteStyle" must be "single" or "double"');
    if (hp(i, "maxStringLength") && ("number" == typeof i.maxStringLength ? i.maxStringLength < 0 && i.maxStringLength !== 1 / 0 : null !== i.maxStringLength)) throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
    var a = !hp(i, "customInspect") || i.customInspect;
    if ("boolean" != typeof a && "symbol" !== a) throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
    if (hp(i, "indent") && null !== i.indent && "\t" !== i.indent && !(parseInt(i.indent, 10) === i.indent && i.indent > 0)) throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
    if (hp(i, "numericSeparator") && "boolean" != typeof i.numericSeparator) throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
    var s = i.numericSeparator;
    if (void 0 === t) return "undefined";
    if (null === t) return "null";
    if ("boolean" == typeof t) return t ? "true" : "false";
    if ("string" == typeof t) return mp(t, i);
    if ("number" == typeof t) {
      if (0 === t) return 1 / 0 / t > 0 ? "0" : "-0";
      var c = String(t);
      return s ? op(t, c) : c
    }
    if ("bigint" == typeof t) {
      var u = String(t) + "n";
      return s ? op(t, u) : u
    }
    var l = void 0 === i.depth ? 5 : i.depth;
    if (void 0 === r && (r = 0), r >= l && l > 0 && "object" == typeof t) return lp(t) ? "[Array]" : "[Object]";
    var f = function (e, t) {
      var n;
      if ("\t" === e.indent) n = "\t";
      else {
        if (!("number" == typeof e.indent && e.indent > 0)) return null;
        n = Kf.call(Array(e.indent + 1), " ")
      }
      return {
        base: n,
        prev: Kf.call(Array(t + 1), n)
      }
    }(i, r);
    if (void 0 === o) o = [];
    else if (yp(o, t) >= 0) return "[Circular]";

    function p(t, n, a) {
      if (n && (o = Jf.call(o)).push(n), a) {
        var s = {
          depth: i.depth
        };
        return hp(i, "quoteStyle") && (s.quoteStyle = i.quoteStyle), e(t, s, r + 1, o)
      }
      return e(t, i, r + 1, o)
    }
    if ("function" == typeof t && !fp(t)) {
      var d = function (e) {
          if (e.name) return e.name;
          var t = qf.call(Uf.call(e), /^function\s*([\w$]+)/);
          if (t) return t[1];
          return null
        }(t),
        h = Ap(t, p);
      return "[Function" + (d ? ": " + d : " (anonymous)") + "]" + (h.length > 0 ? " { " + Kf.call(h, ", ") + " }" : "")
    }
    if (pp(t)) {
      var g = ep ? zf.call(String(t), /^(Symbol\(.*\))_[^)]*$/, "$1") : Zf.call(t);
      return "object" != typeof t || ep ? g : vp(g)
    }
    if (function (e) {
        if (!e || "object" != typeof e) return !1;
        if ("undefined" != typeof HTMLElement && e instanceof HTMLElement) return !0;
        return "string" == typeof e.nodeName && "function" == typeof e.getAttribute
      }(t)) {
      for (var y = "<" + Hf.call(String(t.nodeName)), m = t.attributes || [], b = 0; b < m.length; b++) y += " " + m[b].name + "=" + cp(up(m[b].value), "double", i);
      return y += ">", t.childNodes && t.childNodes.length && (y += "..."), y += "</" + Hf.call(String(t.nodeName)) + ">"
    }
    if (lp(t)) {
      if (0 === t.length) return "[]";
      var v = Ap(t, p);
      return f && ! function (e) {
        for (var t = 0; t < e.length; t++)
          if (yp(e[t], "\n") >= 0) return !1;
        return !0
      }(v) ? "[" + xp(v, f) + "]" : "[ " + Kf.call(v, ", ") + " ]"
    }
    if (function (e) {
        return !("[object Error]" !== gp(e) || tp && "object" == typeof e && tp in e)
      }(t)) {
      var w = Ap(t, p);
      return "cause" in Error.prototype || !("cause" in t) || np.call(t, "cause") ? 0 === w.length ? "[" + String(t) + "]" : "{ [" + String(t) + "] " + Kf.call(w, ", ") + " }" : "{ [" + String(t) + "] " + Kf.call(Vf.call("[cause]: " + p(t.cause), w), ", ") + " }"
    }
    if ("object" == typeof t && a) {
      if (sp && "function" == typeof t[sp] && ip) return ip(t, {
        depth: l - r
      });
      if ("symbol" !== a && "function" == typeof t.inspect) return t.inspect()
    }
    if (function (e) {
        if (!If || !e || "object" != typeof e) return !1;
        try {
          If.call(e);
          try {
            jf.call(e)
          } catch (y) {
            return !0
          }
          return e instanceof Map
        } catch (Vs) {}
        return !1
      }(t)) {
      var S = [];
      return Of && Of.call(t, (function (e, n) {
        S.push(p(n, t, !0) + " => " + p(e, t))
      })), Sp("Map", If.call(t), S, f)
    }
    if (function (e) {
        if (!jf || !e || "object" != typeof e) return !1;
        try {
          jf.call(e);
          try {
            If.call(e)
          } catch (t) {
            return !0
          }
          return e instanceof Set
        } catch (Vs) {}
        return !1
      }(t)) {
      var x = [];
      return Df && Df.call(t, (function (e) {
        x.push(p(e, t))
      })), Sp("Set", jf.call(t), x, f)
    }
    if (function (e) {
        if (!Nf || !e || "object" != typeof e) return !1;
        try {
          Nf.call(e, Nf);
          try {
            Rf.call(e, Rf)
          } catch (y) {
            return !0
          }
          return e instanceof WeakMap
        } catch (Vs) {}
        return !1
      }(t)) return wp("WeakMap");
    if (function (e) {
        if (!Rf || !e || "object" != typeof e) return !1;
        try {
          Rf.call(e, Rf);
          try {
            Nf.call(e, Nf)
          } catch (y) {
            return !0
          }
          return e instanceof WeakSet
        } catch (Vs) {}
        return !1
      }(t)) return wp("WeakSet");
    if (function (e) {
        if (!Lf || !e || "object" != typeof e) return !1;
        try {
          return Lf.call(e), !0
        } catch (Vs) {}
        return !1
      }(t)) return wp("WeakRef");
    if (function (e) {
        return !("[object Number]" !== gp(e) || tp && "object" == typeof e && tp in e)
      }(t)) return vp(p(Number(t)));
    if (function (e) {
        if (!e || "object" != typeof e || !Yf) return !1;
        try {
          return Yf.call(e), !0
        } catch (Vs) {}
        return !1
      }(t)) return vp(p(Yf.call(t)));
    if (function (e) {
        return !("[object Boolean]" !== gp(e) || tp && "object" == typeof e && tp in e)
      }(t)) return vp(Mf.call(t));
    if (function (e) {
        return !("[object String]" !== gp(e) || tp && "object" == typeof e && tp in e)
      }(t)) return vp(p(String(t)));
    if ("undefined" != typeof window && t === window) return "{ [object Window] }";
    if (t === Oc) return "{ [object globalThis] }";
    if (! function (e) {
        return !("[object Date]" !== gp(e) || tp && "object" == typeof e && tp in e)
      }(t) && !fp(t)) {
      var A = Ap(t, p),
        _ = rp ? rp(t) === Object.prototype : t instanceof Object || t.constructor === Object,
        P = t instanceof Object ? "" : "null prototype",
        k = !_ && tp && Object(t) === t && tp in t ? $f.call(gp(t), 8, -1) : P ? "Object" : "",
        T = (_ || "function" != typeof t.constructor ? "" : t.constructor.name ? t.constructor.name + " " : "") + (k || P ? "[" + Kf.call(Vf.call([], k || [], P || []), ": ") + "] " : "");
      return 0 === A.length ? T + "{}" : f ? T + "{" + xp(A, f) + "}" : T + "{ " + Kf.call(A, ", ") + " }"
    }
    return String(t)
  },
  Ip = kp("%TypeError%"),
  Op = kp("%WeakMap%", !0),
  Cp = kp("%Map%", !0),
  Bp = Tp("WeakMap.prototype.get", !0),
  jp = Tp("WeakMap.prototype.set", !0),
  Dp = Tp("WeakMap.prototype.has", !0),
  Np = Tp("Map.prototype.get", !0),
  Rp = Tp("Map.prototype.set", !0),
  Lp = Tp("Map.prototype.has", !0),
  Mp = function (e, t) {
    for (var n, r = e; null !== (n = r.next); r = n)
      if (n.key === t) return r.next = n.next, n.next = e.next, e.next = n, n
  },
  Fp = String.prototype.replace,
  Up = /%20/g,
  qp = "RFC3986",
  $p = {
    default: qp,
    formatters: {
      RFC1738: function (e) {
        return Fp.call(e, Up, "+")
      },
      RFC3986: function (e) {
        return String(e)
      }
    },
    RFC1738: "RFC1738",
    RFC3986: qp
  },
  zp = $p,
  Qp = Object.prototype.hasOwnProperty,
  Hp = Array.isArray,
  Wp = function () {
    for (var e = [], t = 0; t < 256; ++t) e.push("%" + ((t < 16 ? "0" : "") + t.toString(16)).toUpperCase());
    return e
  }(),
  Vp = function (e, t) {
    for (var n = t && t.plainObjects ? Object.create(null) : {}, r = 0; r < e.length; ++r) void 0 !== e[r] && (n[r] = e[r]);
    return n
  },
  Kp = {
    arrayToObject: Vp,
    assign: function (e, t) {
      return Object.keys(t).reduce((function (e, n) {
        return e[n] = t[n], e
      }), e)
    },
    combine: function (e, t) {
      return [].concat(e, t)
    },
    compact: function (e) {
      for (var t = [{
          obj: {
            o: e
          },
          prop: "o"
        }], n = [], r = 0; r < t.length; ++r)
        for (var o = t[r], i = o.obj[o.prop], a = Object.keys(i), s = 0; s < a.length; ++s) {
          var c = a[s],
            u = i[c];
          "object" == typeof u && null !== u && -1 === n.indexOf(u) && (t.push({
            obj: i,
            prop: c
          }), n.push(u))
        }
      return function (e) {
        for (; e.length > 1;) {
          var t = e.pop(),
            n = t.obj[t.prop];
          if (Hp(n)) {
            for (var r = [], o = 0; o < n.length; ++o) void 0 !== n[o] && r.push(n[o]);
            t.obj[t.prop] = r
          }
        }
      }(t), e
    },
    decode: function (e, t, n) {
      var r = e.replace(/\+/g, " ");
      if ("iso-8859-1" === n) return r.replace(/%[0-9a-f]{2}/gi, unescape);
      try {
        return decodeURIComponent(r)
      } catch (Vs) {
        return r
      }
    },
    encode: function (e, t, n, r, o) {
      if (0 === e.length) return e;
      var i = e;
      if ("symbol" == typeof e ? i = Symbol.prototype.toString.call(e) : "string" != typeof e && (i = String(e)), "iso-8859-1" === n) return escape(i).replace(/%u[0-9a-f]{4}/gi, (function (e) {
        return "%26%23" + parseInt(e.slice(2), 16) + "%3B"
      }));
      for (var a = "", s = 0; s < i.length; ++s) {
        var c = i.charCodeAt(s);
        45 === c || 46 === c || 95 === c || 126 === c || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || o === zp.RFC1738 && (40 === c || 41 === c) ? a += i.charAt(s) : c < 128 ? a += Wp[c] : c < 2048 ? a += Wp[192 | c >> 6] + Wp[128 | 63 & c] : c < 55296 || c >= 57344 ? a += Wp[224 | c >> 12] + Wp[128 | c >> 6 & 63] + Wp[128 | 63 & c] : (s += 1, c = 65536 + ((1023 & c) << 10 | 1023 & i.charCodeAt(s)), a += Wp[240 | c >> 18] + Wp[128 | c >> 12 & 63] + Wp[128 | c >> 6 & 63] + Wp[128 | 63 & c])
      }
      return a
    },
    isBuffer: function (e) {
      return !(!e || "object" != typeof e) && !!(e.constructor && e.constructor.isBuffer && e.constructor.isBuffer(e))
    },
    isRegExp: function (e) {
      return "[object RegExp]" === Object.prototype.toString.call(e)
    },
    maybeMap: function (e, t) {
      if (Hp(e)) {
        for (var n = [], r = 0; r < e.length; r += 1) n.push(t(e[r]));
        return n
      }
      return t(e)
    },
    merge: function e(t, n, r) {
      if (!n) return t;
      if ("object" != typeof n) {
        if (Hp(t)) t.push(n);
        else {
          if (!t || "object" != typeof t) return [t, n];
          (r && (r.plainObjects || r.allowPrototypes) || !Qp.call(Object.prototype, n)) && (t[n] = !0)
        }
        return t
      }
      if (!t || "object" != typeof t) return [t].concat(n);
      var o = t;
      return Hp(t) && !Hp(n) && (o = Vp(t, r)), Hp(t) && Hp(n) ? (n.forEach((function (n, o) {
        if (Qp.call(t, o)) {
          var i = t[o];
          i && "object" == typeof i && n && "object" == typeof n ? t[o] = e(i, n, r) : t.push(n)
        } else t[o] = n
      })), t) : Object.keys(n).reduce((function (t, o) {
        var i = n[o];
        return Qp.call(t, o) ? t[o] = e(t[o], i, r) : t[o] = i, t
      }), o)
    }
  },
  Jp = function () {
    var e, t, n, r = {
      assert: function (e) {
        if (!r.has(e)) throw new Ip("Side channel does not contain " + Ep(e))
      },
      get: function (r) {
        if (Op && r && ("object" == typeof r || "function" == typeof r)) {
          if (e) return Bp(e, r)
        } else if (Cp) {
          if (t) return Np(t, r)
        } else if (n) return function (e, t) {
          var n = Mp(e, t);
          return n && n.value
        }(n, r)
      },
      has: function (r) {
        if (Op && r && ("object" == typeof r || "function" == typeof r)) {
          if (e) return Dp(e, r)
        } else if (Cp) {
          if (t) return Lp(t, r)
        } else if (n) return function (e, t) {
          return !!Mp(e, t)
        }(n, r);
        return !1
      },
      set: function (r, o) {
        Op && r && ("object" == typeof r || "function" == typeof r) ? (e || (e = new Op), jp(e, r, o)) : Cp ? (t || (t = new Cp), Rp(t, r, o)) : (n || (n = {
          key: {},
          next: null
        }), function (e, t, n) {
          var r = Mp(e, t);
          r ? r.value = n : e.next = {
            key: t,
            next: e.next,
            value: n
          }
        }(n, r, o))
      }
    };
    return r
  },
  Gp = Kp,
  Yp = $p,
  Xp = Object.prototype.hasOwnProperty,
  Zp = {
    brackets: function (e) {
      return e + "[]"
    },
    comma: "comma",
    indices: function (e, t) {
      return e + "[" + t + "]"
    },
    repeat: function (e) {
      return e
    }
  },
  ed = Array.isArray,
  td = String.prototype.split,
  nd = Array.prototype.push,
  rd = function (e, t) {
    nd.apply(e, ed(t) ? t : [t])
  },
  od = Date.prototype.toISOString,
  id = Yp.default,
  ad = {
    addQueryPrefix: !1,
    allowDots: !1,
    charset: "utf-8",
    charsetSentinel: !1,
    delimiter: "&",
    encode: !0,
    encoder: Gp.encode,
    encodeValuesOnly: !1,
    format: id,
    formatter: Yp.formatters[id],
    indices: !1,
    serializeDate: function (e) {
      return od.call(e)
    },
    skipNulls: !1,
    strictNullHandling: !1
  },
  sd = {},
  cd = function e(t, n, r, o, i, a, s, c, u, l, f, p, d, h, g, y) {
    for (var m, b = t, v = y, w = 0, S = !1; void 0 !== (v = v.get(sd)) && !S;) {
      var x = v.get(t);
      if (w += 1, void 0 !== x) {
        if (x === w) throw new RangeError("Cyclic object value");
        S = !0
      }
      void 0 === v.get(sd) && (w = 0)
    }
    if ("function" == typeof c ? b = c(n, b) : b instanceof Date ? b = f(b) : "comma" === r && ed(b) && (b = Gp.maybeMap(b, (function (e) {
        return e instanceof Date ? f(e) : e
      }))), null === b) {
      if (i) return s && !h ? s(n, ad.encoder, g, "key", p) : n;
      b = ""
    }
    if ("string" == typeof (m = b) || "number" == typeof m || "boolean" == typeof m || "symbol" == typeof m || "bigint" == typeof m || Gp.isBuffer(b)) {
      if (s) {
        var A = h ? n : s(n, ad.encoder, g, "key", p);
        if ("comma" === r && h) {
          for (var _ = td.call(String(b), ","), P = "", k = 0; k < _.length; ++k) P += (0 === k ? "" : ",") + d(s(_[k], ad.encoder, g, "value", p));
          return [d(A) + (o && ed(b) && 1 === _.length ? "[]" : "") + "=" + P]
        }
        return [d(A) + "=" + d(s(b, ad.encoder, g, "value", p))]
      }
      return [d(n) + "=" + d(String(b))]
    }
    var T, E = [];
    if (void 0 === b) return E;
    if ("comma" === r && ed(b)) T = [{
      value: b.length > 0 ? b.join(",") || null : void 0
    }];
    else if (ed(c)) T = c;
    else {
      var I = Object.keys(b);
      T = u ? I.sort(u) : I
    }
    for (var O = o && ed(b) && 1 === b.length ? n + "[]" : n, C = 0; C < T.length; ++C) {
      var B = T[C],
        j = "object" == typeof B && void 0 !== B.value ? B.value : b[B];
      if (!a || null !== j) {
        var D = ed(b) ? "function" == typeof r ? r(O, B) : O : O + (l ? "." + B : "[" + B + "]");
        y.set(t, w);
        var N = Jp();
        N.set(sd, y), rd(E, e(j, D, r, o, i, a, s, c, u, l, f, p, d, h, g, N))
      }
    }
    return E
  },
  ud = Kp,
  ld = Object.prototype.hasOwnProperty,
  fd = Array.isArray,
  pd = {
    allowDots: !1,
    allowPrototypes: !1,
    allowSparse: !1,
    arrayLimit: 20,
    charset: "utf-8",
    charsetSentinel: !1,
    comma: !1,
    decoder: ud.decode,
    delimiter: "&",
    depth: 5,
    ignoreQueryPrefix: !1,
    interpretNumericEntities: !1,
    parameterLimit: 1e3,
    parseArrays: !0,
    plainObjects: !1,
    strictNullHandling: !1
  },
  hd = function (e) {
    return e.replace(/&#(\d+);/g, (function (e, t) {
      return String.fromCharCode(parseInt(t, 10))
    }))
  },
  gd = function (e, t) {
    return e && "string" == typeof e && t.comma && e.indexOf(",") > -1 ? e.split(",") : e
  },
  yd = function (e, t, n, r) {
    if (e) {
      var o = n.allowDots ? e.replace(/\.([^.[]+)/g, "[$1]") : e,
        i = /(\[[^[\]]*])/g,
        a = n.depth > 0 && /(\[[^[\]]*])/.exec(o),
        s = a ? o.slice(0, a.index) : o,
        c = [];
      if (s) {
        if (!n.plainObjects && ld.call(Object.prototype, s) && !n.allowPrototypes) return;
        c.push(s)
      }
      for (var u = 0; n.depth > 0 && null !== (a = i.exec(o)) && u < n.depth;) {
        if (u += 1, !n.plainObjects && ld.call(Object.prototype, a[1].slice(1, -1)) && !n.allowPrototypes) return;
        c.push(a[1])
      }
      return a && c.push("[" + o.slice(a.index) + "]"),
        function (e, t, n, r) {
          for (var o = r ? t : gd(t, n), i = e.length - 1; i >= 0; --i) {
            var a, s = e[i];
            if ("[]" === s && n.parseArrays) a = [].concat(o);
            else {
              a = n.plainObjects ? Object.create(null) : {};
              var c = "[" === s.charAt(0) && "]" === s.charAt(s.length - 1) ? s.slice(1, -1) : s,
                u = parseInt(c, 10);
              n.parseArrays || "" !== c ? !isNaN(u) && s !== c && String(u) === c && u >= 0 && n.parseArrays && u <= n.arrayLimit ? (a = [])[u] = o : "__proto__" !== c && (a[c] = o) : a = {
                0: o
              }
            }
            o = a
          }
          return o
        }(c, t, n, r)
    }
  },
  md = function (e, t) {
    var n, r = e,
      o = function (e) {
        if (!e) return ad;
        if (null !== e.encoder && void 0 !== e.encoder && "function" != typeof e.encoder) throw new TypeError("Encoder has to be a function.");
        var t = e.charset || ad.charset;
        if (void 0 !== e.charset && "utf-8" !== e.charset && "iso-8859-1" !== e.charset) throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
        var n = Yp.default;
        if (void 0 !== e.format) {
          if (!Xp.call(Yp.formatters, e.format)) throw new TypeError("Unknown format option provided.");
          n = e.format
        }
        var r = Yp.formatters[n],
          o = ad.filter;
        return ("function" == typeof e.filter || ed(e.filter)) && (o = e.filter), {
          addQueryPrefix: "boolean" == typeof e.addQueryPrefix ? e.addQueryPrefix : ad.addQueryPrefix,
          allowDots: void 0 === e.allowDots ? ad.allowDots : !!e.allowDots,
          charset: t,
          charsetSentinel: "boolean" == typeof e.charsetSentinel ? e.charsetSentinel : ad.charsetSentinel,
          delimiter: void 0 === e.delimiter ? ad.delimiter : e.delimiter,
          encode: "boolean" == typeof e.encode ? e.encode : ad.encode,
          encoder: "function" == typeof e.encoder ? e.encoder : ad.encoder,
          encodeValuesOnly: "boolean" == typeof e.encodeValuesOnly ? e.encodeValuesOnly : ad.encodeValuesOnly,
          filter: o,
          format: n,
          formatter: r,
          serializeDate: "function" == typeof e.serializeDate ? e.serializeDate : ad.serializeDate,
          skipNulls: "boolean" == typeof e.skipNulls ? e.skipNulls : ad.skipNulls,
          sort: "function" == typeof e.sort ? e.sort : null,
          strictNullHandling: "boolean" == typeof e.strictNullHandling ? e.strictNullHandling : ad.strictNullHandling
        }
      }(t);
    "function" == typeof o.filter ? r = (0, o.filter)("", r) : ed(o.filter) && (n = o.filter);
    var i, a = [];
    if ("object" != typeof r || null === r) return "";
    i = t && t.arrayFormat in Zp ? t.arrayFormat : t && "indices" in t ? t.indices ? "indices" : "repeat" : "indices";
    var s = Zp[i];
    if (t && "commaRoundTrip" in t && "boolean" != typeof t.commaRoundTrip) throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
    var c = "comma" === s && t && t.commaRoundTrip;
    n || (n = Object.keys(r)), o.sort && n.sort(o.sort);
    for (var u = Jp(), l = 0; l < n.length; ++l) {
      var f = n[l];
      o.skipNulls && null === r[f] || rd(a, cd(r[f], f, s, c, o.strictNullHandling, o.skipNulls, o.encode ? o.encoder : null, o.filter, o.sort, o.allowDots, o.serializeDate, o.format, o.formatter, o.encodeValuesOnly, o.charset, u))
    }
    var p = a.join(o.delimiter),
      d = !0 === o.addQueryPrefix ? "?" : "";
    return o.charsetSentinel && ("iso-8859-1" === o.charset ? d += "utf8=%26%2310003%3B&" : d += "utf8=%E2%9C%93&"), p.length > 0 ? d + p : ""
  },
  bd = function (e, t) {
    var n = function (e) {
      if (!e) return pd;
      if (null !== e.decoder && void 0 !== e.decoder && "function" != typeof e.decoder) throw new TypeError("Decoder has to be a function.");
      if (void 0 !== e.charset && "utf-8" !== e.charset && "iso-8859-1" !== e.charset) throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
      var t = void 0 === e.charset ? pd.charset : e.charset;
      return {
        allowDots: void 0 === e.allowDots ? pd.allowDots : !!e.allowDots,
        allowPrototypes: "boolean" == typeof e.allowPrototypes ? e.allowPrototypes : pd.allowPrototypes,
        allowSparse: "boolean" == typeof e.allowSparse ? e.allowSparse : pd.allowSparse,
        arrayLimit: "number" == typeof e.arrayLimit ? e.arrayLimit : pd.arrayLimit,
        charset: t,
        charsetSentinel: "boolean" == typeof e.charsetSentinel ? e.charsetSentinel : pd.charsetSentinel,
        comma: "boolean" == typeof e.comma ? e.comma : pd.comma,
        decoder: "function" == typeof e.decoder ? e.decoder : pd.decoder,
        delimiter: "string" == typeof e.delimiter || ud.isRegExp(e.delimiter) ? e.delimiter : pd.delimiter,
        depth: "number" == typeof e.depth || !1 === e.depth ? +e.depth : pd.depth,
        ignoreQueryPrefix: !0 === e.ignoreQueryPrefix,
        interpretNumericEntities: "boolean" == typeof e.interpretNumericEntities ? e.interpretNumericEntities : pd.interpretNumericEntities,
        parameterLimit: "number" == typeof e.parameterLimit ? e.parameterLimit : pd.parameterLimit,
        parseArrays: !1 !== e.parseArrays,
        plainObjects: "boolean" == typeof e.plainObjects ? e.plainObjects : pd.plainObjects,
        strictNullHandling: "boolean" == typeof e.strictNullHandling ? e.strictNullHandling : pd.strictNullHandling
      }
    }(t);
    if ("" === e || null == e) return n.plainObjects ? Object.create(null) : {};
    for (var r = "string" == typeof e ? function (e, t) {
        var n, r = {},
          o = t.ignoreQueryPrefix ? e.replace(/^\?/, "") : e,
          i = t.parameterLimit === 1 / 0 ? void 0 : t.parameterLimit,
          a = o.split(t.delimiter, i),
          s = -1,
          c = t.charset;
        if (t.charsetSentinel)
          for (n = 0; n < a.length; ++n) 0 === a[n].indexOf("utf8=") && ("utf8=%E2%9C%93" === a[n] ? c = "utf-8" : "utf8=%26%2310003%3B" === a[n] && (c = "iso-8859-1"), s = n, n = a.length);
        for (n = 0; n < a.length; ++n)
          if (n !== s) {
            var u, l, f = a[n],
              p = f.indexOf("]="),
              d = -1 === p ? f.indexOf("=") : p + 1; - 1 === d ? (u = t.decoder(f, pd.decoder, c, "key"), l = t.strictNullHandling ? null : "") : (u = t.decoder(f.slice(0, d), pd.decoder, c, "key"), l = ud.maybeMap(gd(f.slice(d + 1), t), (function (e) {
              return t.decoder(e, pd.decoder, c, "value")
            }))), l && t.interpretNumericEntities && "iso-8859-1" === c && (l = hd(l)), f.indexOf("[]=") > -1 && (l = fd(l) ? [l] : l), ld.call(r, u) ? r[u] = ud.combine(r[u], l) : r[u] = l
          } return r
      }(e, n) : e, o = n.plainObjects ? Object.create(null) : {}, i = Object.keys(r), a = 0; a < i.length; ++a) {
      var s = i[a],
        c = yd(s, r[s], n, "string" == typeof e);
      o = ud.merge(o, c, n)
    }
    return !0 === n.allowSparse ? o : ud.compact(o)
  },
  vd = {
    formats: $p,
    parse: bd,
    stringify: md
  },
  wd = {};
({
  get exports() {
    return wd
  },
  set exports(e) {
    wd = e
  }
}).exports = (_p = "month", Pp = "quarter", function (e, t) {
  var n = t.prototype;
  n.quarter = function (e) {
    return this.$utils().u(e) ? Math.ceil((this.month() + 1) / 3) : this.month(this.month() % 3 + 3 * (e - 1))
  };
  var r = n.add;
  n.add = function (e, t) {
    return e = Number(e), this.$utils().p(t) === Pp ? this.add(3 * e, _p) : r.bind(this)(e, t)
  };
  var o = n.startOf;
  n.startOf = function (e, t) {
    var n = this.$utils(),
      r = !!n.u(t) || t;
    if (n.p(e) === Pp) {
      var i = this.quarter() - 1;
      return r ? this.month(3 * i).startOf(_p).startOf("day") : this.month(3 * i + 2).endOf(_p).endOf("day")
    }
    return o.bind(this)(e, t)
  }
});
const Sd = wd;
var xd = {};
({
  get exports() {
    return xd
  },
  set exports(e) {
    xd = e
  }
}).exports = function () {
  var e = 1e3,
    t = 6e4,
    n = 36e5,
    r = "millisecond",
    o = "second",
    i = "minute",
    a = "hour",
    s = "day",
    c = "week",
    u = "month",
    l = "quarter",
    f = "year",
    p = "date",
    d = "Invalid Date",
    h = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
    g = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,
    y = {
      name: "en",
      weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
      months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
      ordinal: function (e) {
        var t = ["th", "st", "nd", "rd"],
          n = e % 100;
        return "[" + e + (t[(n - 20) % 10] || t[n] || t[0]) + "]"
      }
    },
    m = function (e, t, n) {
      var r = String(e);
      return !r || r.length >= t ? e : "" + Array(t + 1 - r.length).join(n) + e
    },
    b = {
      s: m,
      z: function (e) {
        var t = -e.utcOffset(),
          n = Math.abs(t),
          r = Math.floor(n / 60),
          o = n % 60;
        return (t <= 0 ? "+" : "-") + m(r, 2, "0") + ":" + m(o, 2, "0")
      },
      m: function e(t, n) {
        if (t.date() < n.date()) return -e(n, t);
        var r = 12 * (n.year() - t.year()) + (n.month() - t.month()),
          o = t.clone().add(r, u),
          i = n - o < 0,
          a = t.clone().add(r + (i ? -1 : 1), u);
        return +(-(r + (n - o) / (i ? o - a : a - o)) || 0)
      },
      a: function (e) {
        return e < 0 ? Math.ceil(e) || 0 : Math.floor(e)
      },
      p: function (e) {
        return {
          M: u,
          y: f,
          w: c,
          d: s,
          D: p,
          h: a,
          m: i,
          s: o,
          ms: r,
          Q: l
        } [e] || String(e || "").toLowerCase().replace(/s$/, "")
      },
      u: function (e) {
        return void 0 === e
      }
    },
    v = "en",
    w = {};
  w[v] = y;
  var S = "$isDayjsObject",
    x = function (e) {
      return e instanceof k || !(!e || !e[S])
    },
    A = function e(t, n, r) {
      var o;
      if (!t) return v;
      if ("string" == typeof t) {
        var i = t.toLowerCase();
        w[i] && (o = i), n && (w[i] = n, o = i);
        var a = t.split("-");
        if (!o && a.length > 1) return e(a[0])
      } else {
        var s = t.name;
        w[s] = t, o = s
      }
      return !r && o && (v = o), o || !r && v
    },
    _ = function (e, t) {
      if (x(e)) return e.clone();
      var n = "object" == typeof t ? t : {};
      return n.date = e, n.args = arguments, new k(n)
    },
    P = b;
  P.l = A, P.i = x, P.w = function (e, t) {
    return _(e, {
      locale: t.$L,
      utc: t.$u,
      x: t.$x,
      $offset: t.$offset
    })
  };
  var k = function () {
      function y(e) {
        this.$L = A(e.locale, null, !0), this.parse(e), this.$x = this.$x || e.x || {}, this[S] = !0
      }
      var m = y.prototype;
      return m.parse = function (e) {
        this.$d = function (e) {
          var t = e.date,
            n = e.utc;
          if (null === t) return new Date(NaN);
          if (P.u(t)) return new Date;
          if (t instanceof Date) return new Date(t);
          if ("string" == typeof t && !/Z$/i.test(t)) {
            var r = t.match(h);
            if (r) {
              var o = r[2] - 1 || 0,
                i = (r[7] || "0").substring(0, 3);
              return n ? new Date(Date.UTC(r[1], o, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, i)) : new Date(r[1], o, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, i)
            }
          }
          return new Date(t)
        }(e), this.init()
      }, m.init = function () {
        var e = this.$d;
        this.$y = e.getFullYear(), this.$M = e.getMonth(), this.$D = e.getDate(), this.$W = e.getDay(), this.$H = e.getHours(), this.$m = e.getMinutes(), this.$s = e.getSeconds(), this.$ms = e.getMilliseconds()
      }, m.$utils = function () {
        return P
      }, m.isValid = function () {
        return !(this.$d.toString() === d)
      }, m.isSame = function (e, t) {
        var n = _(e);
        return this.startOf(t) <= n && n <= this.endOf(t)
      }, m.isAfter = function (e, t) {
        return _(e) < this.startOf(t)
      }, m.isBefore = function (e, t) {
        return this.endOf(t) < _(e)
      }, m.$g = function (e, t, n) {
        return P.u(e) ? this[t] : this.set(n, e)
      }, m.unix = function () {
        return Math.floor(this.valueOf() / 1e3)
      }, m.valueOf = function () {
        return this.$d.getTime()
      }, m.startOf = function (e, t) {
        var n = this,
          r = !!P.u(t) || t,
          l = P.p(e),
          d = function (e, t) {
            var o = P.w(n.$u ? Date.UTC(n.$y, t, e) : new Date(n.$y, t, e), n);
            return r ? o : o.endOf(s)
          },
          h = function (e, t) {
            return P.w(n.toDate()[e].apply(n.toDate("s"), (r ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(t)), n)
          },
          g = this.$W,
          y = this.$M,
          m = this.$D,
          b = "set" + (this.$u ? "UTC" : "");
        switch (l) {
          case f:
            return r ? d(1, 0) : d(31, 11);
          case u:
            return r ? d(1, y) : d(0, y + 1);
          case c:
            var v = this.$locale().weekStart || 0,
              w = (g < v ? g + 7 : g) - v;
            return d(r ? m - w : m + (6 - w), y);
          case s:
          case p:
            return h(b + "Hours", 0);
          case a:
            return h(b + "Minutes", 1);
          case i:
            return h(b + "Seconds", 2);
          case o:
            return h(b + "Milliseconds", 3);
          default:
            return this.clone()
        }
      }, m.endOf = function (e) {
        return this.startOf(e, !1)
      }, m.$set = function (e, t) {
        var n, c = P.p(e),
          l = "set" + (this.$u ? "UTC" : ""),
          d = (n = {}, n[s] = l + "Date", n[p] = l + "Date", n[u] = l + "Month", n[f] = l + "FullYear", n[a] = l + "Hours", n[i] = l + "Minutes", n[o] = l + "Seconds", n[r] = l + "Milliseconds", n)[c],
          h = c === s ? this.$D + (t - this.$W) : t;
        if (c === u || c === f) {
          var g = this.clone().set(p, 1);
          g.$d[d](h), g.init(), this.$d = g.set(p, Math.min(this.$D, g.daysInMonth())).$d
        } else d && this.$d[d](h);
        return this.init(), this
      }, m.set = function (e, t) {
        return this.clone().$set(e, t)
      }, m.get = function (e) {
        return this[P.p(e)]()
      }, m.add = function (r, l) {
        var p, d = this;
        r = Number(r);
        var h = P.p(l),
          g = function (e) {
            var t = _(d);
            return P.w(t.date(t.date() + Math.round(e * r)), d)
          };
        if (h === u) return this.set(u, this.$M + r);
        if (h === f) return this.set(f, this.$y + r);
        if (h === s) return g(1);
        if (h === c) return g(7);
        var y = (p = {}, p[i] = t, p[a] = n, p[o] = e, p)[h] || 1,
          m = this.$d.getTime() + r * y;
        return P.w(m, this)
      }, m.subtract = function (e, t) {
        return this.add(-1 * e, t)
      }, m.format = function (e) {
        var t = this,
          n = this.$locale();
        if (!this.isValid()) return n.invalidDate || d;
        var r = e || "YYYY-MM-DDTHH:mm:ssZ",
          o = P.z(this),
          i = this.$H,
          a = this.$m,
          s = this.$M,
          c = n.weekdays,
          u = n.months,
          l = n.meridiem,
          f = function (e, n, o, i) {
            return e && (e[n] || e(t, r)) || o[n].slice(0, i)
          },
          p = function (e) {
            return P.s(i % 12 || 12, e, "0")
          },
          h = l || function (e, t, n) {
            var r = e < 12 ? "AM" : "PM";
            return n ? r.toLowerCase() : r
          };
        return r.replace(g, (function (e, r) {
          return r || function (e) {
            switch (e) {
              case "YY":
                return String(t.$y).slice(-2);
              case "YYYY":
                return P.s(t.$y, 4, "0");
              case "M":
                return s + 1;
              case "MM":
                return P.s(s + 1, 2, "0");
              case "MMM":
                return f(n.monthsShort, s, u, 3);
              case "MMMM":
                return f(u, s);
              case "D":
                return t.$D;
              case "DD":
                return P.s(t.$D, 2, "0");
              case "d":
                return String(t.$W);
              case "dd":
                return f(n.weekdaysMin, t.$W, c, 2);
              case "ddd":
                return f(n.weekdaysShort, t.$W, c, 3);
              case "dddd":
                return c[t.$W];
              case "H":
                return String(i);
              case "HH":
                return P.s(i, 2, "0");
              case "h":
                return p(1);
              case "hh":
                return p(2);
              case "a":
                return h(i, a, !0);
              case "A":
                return h(i, a, !1);
              case "m":
                return String(a);
              case "mm":
                return P.s(a, 2, "0");
              case "s":
                return String(t.$s);
              case "ss":
                return P.s(t.$s, 2, "0");
              case "SSS":
                return P.s(t.$ms, 3, "0");
              case "Z":
                return o
            }
            return null
          }(e) || o.replace(":", "")
        }))
      }, m.utcOffset = function () {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15)
      }, m.diff = function (r, p, d) {
        var h, g = this,
          y = P.p(p),
          m = _(r),
          b = (m.utcOffset() - this.utcOffset()) * t,
          v = this - m,
          w = function () {
            return P.m(g, m)
          };
        switch (y) {
          case f:
            h = w() / 12;
            break;
          case u:
            h = w();
            break;
          case l:
            h = w() / 3;
            break;
          case c:
            h = (v - b) / 6048e5;
            break;
          case s:
            h = (v - b) / 864e5;
            break;
          case a:
            h = v / n;
            break;
          case i:
            h = v / t;
            break;
          case o:
            h = v / e;
            break;
          default:
            h = v
        }
        return d ? h : P.a(h)
      }, m.daysInMonth = function () {
        return this.endOf(u).$D
      }, m.$locale = function () {
        return w[this.$L]
      }, m.locale = function (e, t) {
        if (!e) return this.$L;
        var n = this.clone(),
          r = A(e, t, !0);
        return r && (n.$L = r), n
      }, m.clone = function () {
        return P.w(this.$d, this)
      }, m.toDate = function () {
        return new Date(this.valueOf())
      }, m.toJSON = function () {
        return this.isValid() ? this.toISOString() : null
      }, m.toISOString = function () {
        return this.$d.toISOString()
      }, m.toString = function () {
        return this.$d.toUTCString()
      }, y
    }(),
    T = k.prototype;
  return _.prototype = T, [
    ["$ms", r],
    ["$s", o],
    ["$m", i],
    ["$H", a],
    ["$W", s],
    ["$M", u],
    ["$y", f],
    ["$D", p]
  ].forEach((function (e) {
    T[e[1]] = function (t) {
      return this.$g(t, e[0], e[1])
    }
  })), _.extend = function (e, t) {
    return e.$i || (e(t, k, _), e.$i = !0), _
  }, _.locale = A, _.isDayjs = x, _.unix = function (e) {
    return _(1e3 * e)
  }, _.en = w[v], _.Ls = w, _.p = {}, _
}();
const Ad = xd;
var _d = function (e, t) {
    return function () {
      for (var n = new Array(arguments.length), r = 0; r < n.length; r++) n[r] = arguments[r];
      return e.apply(t, n)
    }
  },
  Pd = Object.prototype.toString;

function kd(e) {
  return "[object Array]" === Pd.call(e)
}

function Td(e) {
  return void 0 === e
}

function Ed(e) {
  return null !== e && "object" == typeof e
}

function Id(e) {
  return "[object Function]" === Pd.call(e)
}

function Od(e, t) {
  if (null != e)
    if ("object" != typeof e && (e = [e]), kd(e))
      for (var n = 0, r = e.length; n < r; n++) t.call(null, e[n], n, e);
    else
      for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && t.call(null, e[o], o, e)
}
var Cd = {
    isArray: kd,
    isArrayBuffer: function (e) {
      return "[object ArrayBuffer]" === Pd.call(e)
    },
    isBuffer: function (e) {
      return null !== e && !Td(e) && null !== e.constructor && !Td(e.constructor) && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e)
    },
    isFormData: function (e) {
      return "undefined" != typeof FormData && e instanceof FormData
    },
    isArrayBufferView: function (e) {
      return "undefined" != typeof ArrayBuffer && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && e.buffer instanceof ArrayBuffer
    },
    isString: function (e) {
      return "string" == typeof e
    },
    isNumber: function (e) {
      return "number" == typeof e
    },
    isObject: Ed,
    isUndefined: Td,
    isDate: function (e) {
      return "[object Date]" === Pd.call(e)
    },
    isFile: function (e) {
      return "[object File]" === Pd.call(e)
    },
    isBlob: function (e) {
      return "[object Blob]" === Pd.call(e)
    },
    isFunction: Id,
    isStream: function (e) {
      return Ed(e) && Id(e.pipe)
    },
    isURLSearchParams: function (e) {
      return "undefined" != typeof URLSearchParams && e instanceof URLSearchParams
    },
    isStandardBrowserEnv: function () {
      return ("undefined" == typeof navigator || "ReactNative" !== navigator.product && "NativeScript" !== navigator.product && "NS" !== navigator.product) && ("undefined" != typeof window && "undefined" != typeof document)
    },
    forEach: Od,
    merge: function e() {
      var t = {};

      function n(n, r) {
        "object" == typeof t[r] && "object" == typeof n ? t[r] = e(t[r], n) : t[r] = n
      }
      for (var r = 0, o = arguments.length; r < o; r++) Od(arguments[r], n);
      return t
    },
    deepMerge: function e() {
      var t = {};

      function n(n, r) {
        "object" == typeof t[r] && "object" == typeof n ? t[r] = e(t[r], n) : t[r] = "object" == typeof n ? e({}, n) : n
      }
      for (var r = 0, o = arguments.length; r < o; r++) Od(arguments[r], n);
      return t
    },
    extend: function (e, t, n) {
      return Od(t, (function (t, r) {
        e[r] = n && "function" == typeof t ? _d(t, n) : t
      })), e
    },
    trim: function (e) {
      return e.replace(/^\s*/, "").replace(/\s*$/, "")
    }
  },
  Bd = function (e, t, n, r, o) {
    return e.config = t, n && (e.code = n), e.request = r, e.response = o, e.isAxiosError = !0, e.toJSON = function () {
      return {
        message: this.message,
        name: this.name,
        description: this.description,
        number: this.number,
        fileName: this.fileName,
        lineNumber: this.lineNumber,
        columnNumber: this.columnNumber,
        stack: this.stack,
        config: this.config,
        code: this.code
      }
    }, e
  },
  jd = function (e, t, n, r, o) {
    var i = new Error(e);
    return Bd(i, t, n, r, o)
  },
  Dd = jd,
  Nd = Cd;

function Rd(e) {
  return encodeURIComponent(e).replace(/%40/gi, "@").replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]")
}
var Ld = function (e, t, n) {
    if (!t) return e;
    var r;
    if (n) r = n(t);
    else if (Nd.isURLSearchParams(t)) r = t.toString();
    else {
      var o = [];
      Nd.forEach(t, (function (e, t) {
        null != e && (Nd.isArray(e) ? t += "[]" : e = [e], Nd.forEach(e, (function (e) {
          Nd.isDate(e) ? e = e.toISOString() : Nd.isObject(e) && (e = JSON.stringify(e)), o.push(Rd(t) + "=" + Rd(e))
        })))
      })), r = o.join("&")
    }
    if (r) {
      var i = e.indexOf("#"); - 1 !== i && (e = e.slice(0, i)), e += (-1 === e.indexOf("?") ? "?" : "&") + r
    }
    return e
  },
  Md = function (e) {
    return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e)
  },
  Fd = function (e, t) {
    return t ? e.replace(/\/+$/, "") + "/" + t.replace(/^\/+/, "") : e
  },
  Ud = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
var qd = "wechat";

function $d(e, t) {
  var n;
  return e = "object" == typeof (n = e) && null !== n ? e : Object.create(null), new Proxy(e, {
    get: (e, n, r) => "key" === n ? Reflect.get(e, n, r) : Reflect.get(e, n, r) || Reflect.get(t, n, r)
  })
}

function zd(e, {
  storage: t,
  serializer: n,
  key: r,
  debug: o
}) {
  try {
    const o = null == t ? void 0 : t.getItem(r);
    o && e.$patch(null == n ? void 0 : n.deserialize(o))
  } catch (i) {
    o && console.error(i)
  }
}

function Qd(e, {
  storage: t,
  serializer: n,
  key: r,
  paths: o,
  debug: i
}) {
  try {
    const i = Array.isArray(o) ? function (e, t) {
      return t.reduce(((t, n) => {
        const r = n.split(".");
        return function (e, t, n) {
          return t.slice(0, -1).reduce(((e, t) => /^(__proto__)$/.test(t) ? {} : e[t] = e[t] || {}), e)[t[t.length - 1]] = n, e
        }(t, r, function (e, t) {
          return t.reduce(((e, t) => null == e ? void 0 : e[t]), e)
        }(e, r))
      }), {})
    }(e, o) : e;
    t.setItem(r, n.serialize(i))
  } catch (a) {
    i && console.error(a)
  }
}
var Hd = function (e = {}) {
  return t => {
    const {
      auto: n = !1
    } = e, {
      options: {
        persist: r = n
      },
      store: o,
      pinia: i
    } = t;
    if (!r) return;
    if (!(o.$id in i.state.value)) {
      const e = i._s.get(o.$id.replace("__hot:", ""));
      return void(e && Promise.resolve().then((() => e.$persist())))
    }
    const a = (Array.isArray(r) ? r.map((t => $d(t, e))) : [$d(r, e)]).map((({
      storage: t = localStorage,
      beforeRestore: n = null,
      afterRestore: r = null,
      serializer: i = {
        serialize: JSON.stringify,
        deserialize: JSON.parse
      },
      key: a = o.$id,
      paths: s = null,
      debug: c = !1
    }) => {
      var u;
      return {
        storage: t,
        beforeRestore: n,
        afterRestore: r,
        serializer: i,
        key: (null != (u = e.key) ? u : e => e)("string" == typeof a ? a : a(o.$id)),
        paths: s,
        debug: c
      }
    }));
    o.$persist = () => {
      a.forEach((e => {
        Qd(o.$state, e)
      }))
    }, o.$hydrate = ({
      runHooks: e = !0
    } = {}) => {
      a.forEach((n => {
        const {
          beforeRestore: r,
          afterRestore: i
        } = n;
        e && (null == r || r(t)), zd(o, n), e && (null == i || i(t))
      }))
    }, a.forEach((e => {
      const {
        beforeRestore: n,
        afterRestore: r
      } = e;
      null == n || n(t), zd(o, e), null == r || r(t), o.$subscribe(((t, n) => {
        Qd(n, e)
      }), {
        detached: !0
      })
    }))
  }
}();
const Wd = {
    props: {
      customStyle: {
        type: [Object, String],
        default: () => ({})
      },
      customClass: {
        type: String,
        default: ""
      },
      url: {
        type: String,
        default: ""
      },
      linkType: {
        type: String,
        default: "navigateTo"
      }
    },
    data: () => ({}),
    onLoad() {
      this.$u.getRect = this.$uGetRect
    },
    created() {
      this.$u.getRect = this.$uGetRect
    },
    computed: {
      $u: () => Dn.$u.deepMerge(Dn.$u, {
        props: void 0,
        http: void 0,
        mixin: void 0
      }),
      bem: () => function (e, t, n) {
        const r = `u-${e}--`,
          o = {};
        return t && t.map((e => {
          o[r + this[e]] = !0
        })), n && n.map((e => {
          this[e] ? o[r + e] = this[e] : delete o[r + e]
        })), Object.keys(o)
      }
    },
    methods: {
      openPage(e = "url") {
        const t = this[e];
        t && this.$u.route({
          type: this.linkType,
          url: t
        })
      },
      $uGetRect(e, t) {
        return new Promise((n => {
          Dn.createSelectorQuery().in(this)[t ? "selectAll" : "select"](e).boundingClientRect((e => {
            t && Array.isArray(e) && e.length && n(e), !t && e && n(e)
          })).exec()
        }))
      },
      getParentData(e = "") {
        this.parent || (this.parent = {}), this.parent = Dn.$u.$parent.call(this, e), this.parent.children && -1 === this.parent.children.indexOf(this) && this.parent.children.push(this), this.parent && this.parentData && Object.keys(this.parentData).map((e => {
          this.parentData[e] = this.parent[e]
        }))
      },
      preventEvent(e) {
        e && "function" == typeof e.stopPropagation && e.stopPropagation()
      },
      noop(e) {
        this.preventEvent(e)
      }
    },
    onReachBottom() {
      Dn.$emit("uOnReachBottom")
    },
    beforeDestroy() {
      if (this.parent && Dn.$u.test.array(this.parent.children)) {
        const e = this.parent.children;
        e.map(((t, n) => {
          t === this && e.splice(n, 1)
        }))
      }
    }
  },
  Vd = {
    options: {
      virtualHost: !0
    }
  },
  {
    toString: Kd
  } = Object.prototype;

function Jd(e) {
  return "[object Array]" === Kd.call(e)
}

function Gd(e, t) {
  if (null != e)
    if ("object" != typeof e && (e = [e]), Jd(e))
      for (let n = 0, r = e.length; n < r; n++) t.call(null, e[n], n, e);
    else
      for (const n in e) Object.prototype.hasOwnProperty.call(e, n) && t.call(null, e[n], n, e)
}

function Yd() {
  const e = {};

  function t(t, n) {
    "object" == typeof e[n] && "object" == typeof t ? e[n] = Yd(e[n], t) : e[n] = "object" == typeof t ? Yd({}, t) : t
  }
  for (let n = 0, r = arguments.length; n < r; n++) Gd(arguments[n], t);
  return e
}

function Xd(e) {
  return void 0 === e
}

function Zd(e) {
  return encodeURIComponent(e).replace(/%40/gi, "@").replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]")
}

function eh(e, t) {
  if (!t) return e;
  let n;
  if (r = t, "undefined" != typeof URLSearchParams && r instanceof URLSearchParams) n = t.toString();
  else {
    const e = [];
    Gd(t, ((t, n) => {
      null != t && (Jd(t) ? n = `${n}[]` : t = [t], Gd(t, (t => {
        ! function (e) {
          return "[object Date]" === Kd.call(e)
        }(t) ? function (e) {
          return null !== e && "object" == typeof e
        }(t) && (t = JSON.stringify(t)) : t = t.toISOString(), e.push(`${Zd(n)}=${Zd(t)}`)
      })))
    })), n = e.join("&")
  }
  var r;
  if (n) {
    const t = e.indexOf("#"); - 1 !== t && (e = e.slice(0, t)), e += (-1 === e.indexOf("?") ? "?" : "&") + n
  }
  return e
}
const th = (e, t) => {
    const n = {};
    return e.forEach((e => {
      Xd(t[e]) || (n[e] = t[e])
    })), n
  },
  nh = e => (e => new Promise(((t, n) => {
    const r = eh((o = e.baseURL, i = e.url, o && !/^([a-z][a-z\d+\-.]*:)?\/\//i.test(i) ? function (e, t) {
      return t ? `${e.replace(/\/+$/,"")}/${t.replace(/^\/+/,"")}` : e
    }(o, i) : i), e.params);
    var o, i;
    const a = {
      url: r,
      header: e.header,
      complete: o => {
        e.fullPath = r, o.config = e;
        try {
          "string" == typeof o.data && (o.data = JSON.parse(o.data))
        } catch (Vs) {}! function (e, t, n) {
          const {
            validateStatus: r
          } = n.config, o = n.statusCode;
          !o || r && !r(o) ? t(n) : e(n)
        }(t, n, o)
      }
    };
    let s;
    if ("UPLOAD" === e.method) {
      delete a.header["content-type"], delete a.header["Content-Type"];
      const t = {
          filePath: e.filePath,
          name: e.name
        },
        n = ["formData"];
      s = Dn.uploadFile({
        ...a,
        ...t,
        ...th(n, e)
      })
    } else if ("DOWNLOAD" === e.method) s = Dn.downloadFile(a);
    else {
      const t = ["data", "method", "timeout", "dataType", "responseType"];
      s = Dn.request({
        ...a,
        ...th(t, e)
      })
    }
    e.getTask && e.getTask(s, e)
  })))(e);

function rh() {
  this.handlers = []
}
rh.prototype.use = function (e, t) {
  return this.handlers.push({
    fulfilled: e,
    rejected: t
  }), this.handlers.length - 1
}, rh.prototype.eject = function (e) {
  this.handlers[e] && (this.handlers[e] = null)
}, rh.prototype.forEach = function (e) {
  this.handlers.forEach((t => {
    null !== t && e(t)
  }))
};
const oh = (e, t, n) => {
    const r = {};
    return e.forEach((e => {
      Xd(n[e]) ? Xd(t[e]) || (r[e] = t[e]) : r[e] = n[e]
    })), r
  },
  ih = {
    baseURL: "",
    header: {},
    method: "GET",
    dataType: "json",
    responseType: "text",
    custom: {},
    timeout: 6e4,
    validateStatus: function (e) {
      return e >= 200 && e < 300
    }
  };
var ah = function () {
  function e(e, t) {
    return null != t && e instanceof t
  }
  var t, n, r;
  try {
    t = Map
  } catch (s) {
    t = function () {}
  }
  try {
    n = Set
  } catch (s) {
    n = function () {}
  }
  try {
    r = Promise
  } catch (s) {
    r = function () {}
  }

  function o(i, s, c, u, l) {
    "object" == typeof s && (c = s.depth, u = s.prototype, l = s.includeNonEnumerable, s = s.circular);
    var f = [],
      p = [],
      d = "undefined" != typeof Buffer;
    return void 0 === s && (s = !0), void 0 === c && (c = 1 / 0),
      function i(c, h) {
        if (null === c) return null;
        if (0 === h) return c;
        var g, y;
        if ("object" != typeof c) return c;
        if (e(c, t)) g = new t;
        else if (e(c, n)) g = new n;
        else if (e(c, r)) g = new r((function (e, t) {
          c.then((function (t) {
            e(i(t, h - 1))
          }), (function (e) {
            t(i(e, h - 1))
          }))
        }));
        else if (o.__isArray(c)) g = [];
        else if (o.__isRegExp(c)) g = new RegExp(c.source, a(c)), c.lastIndex && (g.lastIndex = c.lastIndex);
        else if (o.__isDate(c)) g = new Date(c.getTime());
        else {
          if (d && Buffer.isBuffer(c)) return Buffer.from ? g = Buffer.from(c) : (g = new Buffer(c.length), c.copy(g)), g;
          e(c, Error) ? g = Object.create(c) : void 0 === u ? (y = Object.getPrototypeOf(c), g = Object.create(y)) : (g = Object.create(u), y = u)
        }
        if (s) {
          var m = f.indexOf(c);
          if (-1 != m) return p[m];
          f.push(c), p.push(g)
        }
        for (var b in e(c, t) && c.forEach((function (e, t) {
            var n = i(t, h - 1),
              r = i(e, h - 1);
            g.set(n, r)
          })), e(c, n) && c.forEach((function (e) {
            var t = i(e, h - 1);
            g.add(t)
          })), c) {
          Object.getOwnPropertyDescriptor(c, b) && (g[b] = i(c[b], h - 1));
          try {
            if ("undefined" === Object.getOwnPropertyDescriptor(c, b).set) continue;
            g[b] = i(c[b], h - 1)
          } catch (Vs) {
            if (Vs instanceof TypeError) continue;
            if (Vs instanceof ReferenceError) continue
          }
        }
        if (Object.getOwnPropertySymbols) {
          var v = Object.getOwnPropertySymbols(c);
          for (b = 0; b < v.length; b++) {
            var w = v[b];
            (!(x = Object.getOwnPropertyDescriptor(c, w)) || x.enumerable || l) && (g[w] = i(c[w], h - 1), Object.defineProperty(g, w, x))
          }
        }
        if (l) {
          var S = Object.getOwnPropertyNames(c);
          for (b = 0; b < S.length; b++) {
            var x, A = S[b];
            (x = Object.getOwnPropertyDescriptor(c, A)) && x.enumerable || (g[A] = i(c[A], h - 1), Object.defineProperty(g, A, x))
          }
        }
        return g
      }(i, c)
  }

  function i(e) {
    return Object.prototype.toString.call(e)
  }

  function a(e) {
    var t = "";
    return e.global && (t += "g"), e.ignoreCase && (t += "i"), e.multiline && (t += "m"), t
  }
  return o.clonePrototype = function (e) {
    if (null === e) return null;
    var t = function () {};
    return t.prototype = e, new t
  }, o.__objToStr = i, o.__isDate = function (e) {
    return "object" == typeof e && "[object Date]" === i(e)
  }, o.__isArray = function (e) {
    return "object" == typeof e && "[object Array]" === i(e)
  }, o.__isRegExp = function (e) {
    return "object" == typeof e && "[object RegExp]" === i(e)
  }, o.__getRegExpFlags = a, o
}();
const sh = (new class {
  constructor() {
    this.config = {
      type: "navigateTo",
      url: "",
      delta: 1,
      params: {},
      animationType: "pop-in",
      animationDuration: 300,
      intercept: !1
    }, this.route = this.route.bind(this)
  }
  addRootPath(e) {
    return "/" === e[0] ? e : `/${e}`
  }
  mixinParam(e, t) {
    e = e && this.addRootPath(e);
    let n = "";
    return /.*\/.*\?.*=.*/.test(e) ? (n = Dn.$u.queryParams(t, !1), e + `&${n}`) : (n = Dn.$u.queryParams(t), e + n)
  }
  async route(e = {}, t = {}) {
    let n = {};
    if ("string" == typeof e ? (n.url = this.mixinParam(e, t), n.type = "navigateTo") : (n = Dn.$u.deepMerge(this.config, e), n.url = this.mixinParam(e.url, e.params)), n.url !== Dn.$u.page())
      if (t.intercept && (this.config.intercept = t.intercept), n.params = t, n = Dn.$u.deepMerge(this.config, n), "function" == typeof Dn.$u.routeIntercept) {
        await new Promise(((e, t) => {
          Dn.$u.routeIntercept(n, e)
        })) && this.openPage(n)
      } else this.openPage(n)
  }
  openPage(e) {
    const {
      url: t,
      type: n,
      delta: r,
      animationType: o,
      animationDuration: i
    } = e;
    "navigateTo" != e.type && "to" != e.type || Dn.navigateTo({
      url: t,
      animationType: o,
      animationDuration: i
    }), "redirectTo" != e.type && "redirect" != e.type || Dn.redirectTo({
      url: t
    }), "switchTab" != e.type && "tab" != e.type || Dn.switchTab({
      url: t
    }), "reLaunch" != e.type && "launch" != e.type || Dn.reLaunch({
      url: t
    }), "navigateBack" != e.type && "back" != e.type || Dn.navigateBack({
      delta: r
    })
  }
}).route;

function ch(e, t = !0) {
  if ((e = String(e).toLowerCase()) && /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/.test(e)) {
    if (4 === e.length) {
      let t = "#";
      for (let n = 1; n < 4; n += 1) t += e.slice(n, n + 1).concat(e.slice(n, n + 1));
      e = t
    }
    const n = [];
    for (let t = 1; t < 7; t += 2) n.push(parseInt(`0x${e.slice(t,t+2)}`));
    return t ? `rgb(${n[0]},${n[1]},${n[2]})` : n
  }
  if (/^(rgb|RGB)/.test(e)) {
    return e.replace(/(?:\(|\)|rgb|RGB)*/g, "").split(",").map((e => Number(e)))
  }
  return e
}

function uh(e) {
  const t = e;
  if (/^(rgb|RGB)/.test(t)) {
    const e = t.replace(/(?:\(|\)|rgb|RGB)*/g, "").split(",");
    let n = "#";
    for (let t = 0; t < e.length; t++) {
      let r = Number(e[t]).toString(16);
      r = 1 == String(r).length ? `0${r}` : r, "0" === r && (r += r), n += r
    }
    return 7 !== n.length && (n = t), n
  }
  if (!/^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/.test(t)) return t; {
    const e = t.replace(/#/, "").split("");
    if (6 === e.length) return t;
    if (3 === e.length) {
      let t = "#";
      for (let n = 0; n < e.length; n += 1) t += e[n] + e[n];
      return t
    }
  }
}
const lh = {
  colorGradient: function (e = "rgb(0, 0, 0)", t = "rgb(255, 255, 255)", n = 10) {
    const r = ch(e, !1),
      o = r[0],
      i = r[1],
      a = r[2],
      s = ch(t, !1),
      c = (s[0] - o) / n,
      u = (s[1] - i) / n,
      l = (s[2] - a) / n,
      f = [];
    for (let p = 0; p < n; p++) {
      let r = uh(`rgb(${Math.round(c*p+o)},${Math.round(u*p+i)},${Math.round(l*p+a)})`);
      0 === p && (r = uh(e)), p === n - 1 && (r = uh(t)), f.push(r)
    }
    return f
  },
  hexToRgb: ch,
  rgbToHex: uh,
  colorToRgba: function (e, t) {
    e = uh(e);
    let n = String(e).toLowerCase();
    if (n && /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/.test(n)) {
      if (4 === n.length) {
        let e = "#";
        for (let t = 1; t < 4; t += 1) e += n.slice(t, t + 1).concat(n.slice(t, t + 1));
        n = e
      }
      const e = [];
      for (let t = 1; t < 7; t += 2) e.push(parseInt(`0x${n.slice(t,t+2)}`));
      return `rgba(${e.join(",")},${t})`
    }
    return n
  }
};

function fh(e) {
  return /^[\+-]?(\d+\.?\d*|\.\d+|\d\.\d+e\+\d+)$/.test(e)
}

function ph(e) {
  switch (typeof e) {
    case "undefined":
      return !0;
    case "string":
      if (0 == e.replace(/(^[ \t\n\r]*)|([ \t\n\r]*$)/g, "").length) return !0;
      break;
    case "boolean":
      if (!e) return !0;
      break;
    case "number":
      if (0 === e || isNaN(e)) return !0;
      break;
    case "object":
      if (null === e || 0 === e.length) return !0;
      for (const t in e) return !1;
      return !0
  }
  return !1
}

function dh(e) {
  return "[object Object]" === Object.prototype.toString.call(e)
}

function hh(e) {
  return "function" == typeof e
}
const gh = {
  email: function (e) {
    return /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/.test(e)
  },
  mobile: function (e) {
    return /^1[23456789]\d{9}$/.test(e)
  },
  url: function (e) {
    return /^((https|http|ftp|rtsp|mms):\/\/)(([0-9a-zA-Z_!~*'().&=+$%-]+: )?[0-9a-zA-Z_!~*'().&=+$%-]+@)?(([0-9]{1,3}.){3}[0-9]{1,3}|([0-9a-zA-Z_!~*'()-]+.)*([0-9a-zA-Z][0-9a-zA-Z-]{0,61})?[0-9a-zA-Z].[a-zA-Z]{2,6})(:[0-9]{1,4})?((\/?)|(\/[0-9a-zA-Z_!~*'().;?:@&=+$,%#-]+)+\/?)$/.test(e)
  },
  date: function (e) {
    return !!e && (fh(e) && (e = +e), !/Invalid|NaN/.test(new Date(e).toString()))
  },
  dateISO: function (e) {
    return /^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])$/.test(e)
  },
  number: fh,
  digits: function (e) {
    return /^\d+$/.test(e)
  },
  idCard: function (e) {
    return /^[1-9]\d{5}[1-9]\d{3}((0\d)|(1[0-2]))(([0|1|2]\d)|3[0-1])\d{3}([0-9]|X)$/.test(e)
  },
  carNo: function (e) {
    const t = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}(([0-9]{5}[DF]$)|([DF][A-HJ-NP-Z0-9][0-9]{4}$))/,
      n = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9挂学警港澳]{1}$/;
    return 7 === e.length ? n.test(e) : 8 === e.length && t.test(e)
  },
  amount: function (e) {
    return /^[1-9]\d*(,\d{3})*(\.\d{1,2})?$|^0\.\d{1,2}$/.test(e)
  },
  chinese: function (e) {
    return /^[\u4e00-\u9fa5]+$/gi.test(e)
  },
  letter: function (e) {
    return /^[a-zA-Z]*$/.test(e)
  },
  enOrNum: function (e) {
    return /^[0-9a-zA-Z]*$/g.test(e)
  },
  contains: function (e, t) {
    return e.indexOf(t) >= 0
  },
  range: function (e, t) {
    return e >= t[0] && e <= t[1]
  },
  rangeLength: function (e, t) {
    return e.length >= t[0] && e.length <= t[1]
  },
  empty: ph,
  isEmpty: ph,
  jsonString: function (e) {
    if ("string" == typeof e) try {
      const t = JSON.parse(e);
      return !("object" != typeof t || !t)
    } catch (Vs) {
      return !1
    }
    return !1
  },
  landline: function (e) {
    return /^\d{3,4}-\d{7,8}(-\d{3,4})?$/.test(e)
  },
  object: dh,
  array: function (e) {
    return "function" == typeof Array.isArray ? Array.isArray(e) : "[object Array]" === Object.prototype.toString.call(e)
  },
  code: function (e, t = 6) {
    return new RegExp(`^\\d{${t}}$`).test(e)
  },
  func: hh,
  promise: function (e) {
    return dh(e) && hh(e.then) && hh(e.catch)
  },
  video: function (e) {
    return /\.(mp4|mpg|mpeg|dat|asf|avi|rm|rmvb|mov|wmv|flv|mkv|m3u8)/i.test(e)
  },
  image: function (e) {
    const t = e.split("?")[0];
    return /\.(jpeg|jpg|gif|png|svg|webp|jfif|bmp|dpg)/i.test(t)
  },
  regExp: function (e) {
    return e && "[object RegExp]" === Object.prototype.toString.call(e)
  },
  string: function (e) {
    return "string" == typeof e
  }
};
let yh, mh = null;

function bh(e, t = 15) {
  return +parseFloat(Number(e).toPrecision(t))
}

function vh(e) {
  const t = e.toString().split(/[eE]/),
    n = (t[0].split(".")[1] || "").length - +(t[1] || 0);
  return n > 0 ? n : 0
}

function wh(e) {
  if (-1 === e.toString().indexOf("e")) return Number(e.toString().replace(".", ""));
  const t = vh(e);
  return t > 0 ? bh(Number(e) * Math.pow(10, t)) : Number(e)
}

function Sh(e) {
  (e > Number.MAX_SAFE_INTEGER || e < Number.MIN_SAFE_INTEGER) && console.warn(`${e} 超出了精度限制，结果可能不正确`)
}

function xh(e, t) {
  const [n, r, ...o] = e;
  let i = t(n, r);
  return o.forEach((e => {
    i = t(i, e)
  })), i
}

function Ah(...e) {
  if (e.length > 2) return xh(e, Ah);
  const [t, n] = e, r = wh(t), o = wh(n), i = vh(t) + vh(n), a = r * o;
  return Sh(a), a / Math.pow(10, i)
}

function _h(...e) {
  if (e.length > 2) return xh(e, _h);
  const [t, n] = e, r = wh(t), o = wh(n);
  return Sh(r), Sh(o), Ah(r / o, bh(Math.pow(10, vh(n) - vh(t))))
}

function Ph(e) {
  if ([null, void 0, NaN, !1].includes(e)) return e;
  if ("object" != typeof e && "function" != typeof e) return e;
  const t = gh.array(e) ? [] : {};
  for (const n in e) e.hasOwnProperty(n) && (t[n] = "object" == typeof e[n] ? Ph(e[n]) : e[n]);
  return t
}

function kh(e = null, t = "yyyy-mm-dd") {
  let n;
  n = e ? /^\d{10}$/.test(e.toString().trim()) ? new Date(1e3 * e) : "string" == typeof e && /^\d+$/.test(e.trim()) ? new Date(Number(e)) : new Date("string" == typeof e ? e.replace(/-/g, "/") : e) : new Date;
  const r = {
    y: n.getFullYear().toString(),
    m: (n.getMonth() + 1).toString().padStart(2, "0"),
    d: n.getDate().toString().padStart(2, "0"),
    h: n.getHours().toString().padStart(2, "0"),
    M: n.getMinutes().toString().padStart(2, "0"),
    s: n.getSeconds().toString().padStart(2, "0")
  };
  for (const o in r) {
    const [e] = new RegExp(`${o}+`).exec(t) || [];
    if (e) {
      const n = "y" === o && 2 === e.length ? 2 : 0;
      t = t.replace(e, r[o].slice(n))
    }
  }
  return t
}

function Th(e, t = "both") {
  return e = String(e), "both" == t ? e.replace(/^\s+|\s+$/g, "") : "left" == t ? e.replace(/^\s*/, "") : "right" == t ? e.replace(/(\s*$)/g, "") : "all" == t ? e.replace(/\s+/g, "") : e
}
String.prototype.padStart || (String.prototype.padStart = function (e, t = " ") {
  if ("[object String]" !== Object.prototype.toString.call(t)) throw new TypeError("fillString must be String");
  const n = this;
  if (n.length >= e) return String(n);
  const r = e - n.length;
  let o = Math.ceil(r / t.length);
  for (; o >>= 1;) t += t, 1 === o && (t += t);
  return t.slice(0, r) + n
});
const Eh = {
    range: function (e = 0, t = 0, n = 0) {
      return Math.max(e, Math.min(t, Number(n)))
    },
    getPx: function (e, t = !1) {
      return gh.number(e) ? t ? `${e}px` : Number(e) : /(rpx|upx)$/.test(e) ? t ? `${Dn.upx2px(parseInt(e))}px` : Number(Dn.upx2px(parseInt(e))) : t ? `${parseInt(e)}px` : parseInt(e)
    },
    sleep: function (e = 30) {
      return new Promise((t => {
        setTimeout((() => {
          t()
        }), e)
      }))
    },
    os: function () {
      return Dn.getSystemInfoSync().platform.toLowerCase()
    },
    sys: function () {
      return Dn.getSystemInfoSync()
    },
    random: function (e, t) {
      if (e >= 0 && t > 0 && t >= e) {
        const n = t - e + 1;
        return Math.floor(Math.random() * n + e)
      }
      return 0
    },
    guid: function (e = 32, t = !0, n = null) {
      const r = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),
        o = [];
      if (n = n || r.length, e)
        for (let i = 0; i < e; i++) o[i] = r[0 | Math.random() * n];
      else {
        let e;
        o[8] = o[13] = o[18] = o[23] = "-", o[14] = "4";
        for (let t = 0; t < 36; t++) o[t] || (e = 0 | 16 * Math.random(), o[t] = r[19 == t ? 3 & e | 8 : e])
      }
      return t ? (o.shift(), `u${o.join("")}`) : o.join("")
    },
    $parent: function (e = void 0) {
      let t = this.$parent;
      for (; t;) {
        if (!t.$options || t.$options.name === e) return t;
        t = t.$parent
      }
      return !1
    },
    addStyle: function (e, t = "object") {
      if (gh.empty(e) || "object" == typeof e && "object" === t || "string" === t && "string" == typeof e) return e;
      if ("object" === t) {
        const t = (e = Th(e)).split(";"),
          n = {};
        for (let e = 0; e < t.length; e++)
          if (t[e]) {
            const r = t[e].split(":");
            n[Th(r[0])] = Th(r[1])
          } return n
      }
      let n = "";
      for (const r in e) {
        n += `${r.replace(/([A-Z])/g,"-$1").toLowerCase()}:${e[r]};`
      }
      return Th(n)
    },
    addUnit: function (e = "auto", t = "") {
      return t || (t = Dn.$u.config.unit || "px"), e = String(e), gh.number(e) ? `${e}${t}` : e
    },
    deepClone: Ph,
    deepMerge: function e(t = {}, n = {}) {
      if ("object" != typeof (t = Ph(t)) || "object" != typeof n) return !1;
      for (const r in n) n.hasOwnProperty(r) && (r in t ? null == n[r] || "object" != typeof t[r] || "object" != typeof n[r] ? t[r] = n[r] : t[r].concat && n[r].concat ? t[r] = t[r].concat(n[r]) : t[r] = e(t[r], n[r]) : t[r] = n[r]);
      return t
    },
    error: function (e) {},
    randomArray: function (e = []) {
      return e.sort((() => Math.random() - .5))
    },
    timeFormat: kh,
    timeFrom: function (e = null, t = "yyyy-mm-dd") {
      null == e && (e = Number(new Date)), 10 == (e = parseInt(e)).toString().length && (e *= 1e3);
      let n = (new Date).getTime() - e;
      n = parseInt(n / 1e3);
      let r = "";
      switch (!0) {
        case n < 300:
          r = "刚刚";
          break;
        case n >= 300 && n < 3600:
          r = `${parseInt(n/60)}分钟前`;
          break;
        case n >= 3600 && n < 86400:
          r = `${parseInt(n/3600)}小时前`;
          break;
        case n >= 86400 && n < 2592e3:
          r = `${parseInt(n/86400)}天前`;
          break;
        default:
          r = !1 === t ? n >= 2592e3 && n < 31536e3 ? `${parseInt(n/2592e3)}个月前` : `${parseInt(n/31536e3)}年前` : kh(e, t)
      }
      return r
    },
    trim: Th,
    queryParams: function (e = {}, t = !0, n = "brackets") {
      const r = t ? "?" : "",
        o = []; - 1 == ["indices", "brackets", "repeat", "comma"].indexOf(n) && (n = "brackets");
      for (const i in e) {
        const t = e[i];
        if (!(["", void 0, null].indexOf(t) >= 0))
          if (t.constructor === Array) switch (n) {
            case "indices":
              for (let n = 0; n < t.length; n++) o.push(`${i}[${n}]=${t[n]}`);
              break;
            case "brackets":
            default:
              t.forEach((e => {
                o.push(`${i}[]=${e}`)
              }));
              break;
            case "repeat":
              t.forEach((e => {
                o.push(`${i}=${e}`)
              }));
              break;
            case "comma":
              let e = "";
              t.forEach((t => {
                e += (e ? "," : "") + t
              })), o.push(`${i}=${e}`)
          } else o.push(`${i}=${t}`)
      }
      return o.length ? r + o.join("&") : ""
    },
    toast: function (e, t = 2e3) {
      Dn.showToast({
        title: String(e),
        icon: "none",
        duration: t
      })
    },
    type2icon: function (e = "success", t = !1) {
      -1 == ["primary", "info", "error", "warning", "success"].indexOf(e) && (e = "success");
      let n = "";
      switch (e) {
        case "primary":
        case "info":
          n = "info-circle";
          break;
        case "error":
          n = "close-circle";
          break;
        case "warning":
          n = "error-circle";
          break;
        default:
          n = "checkmark-circle"
      }
      return t && (n += "-fill"), n
    },
    priceFormat: function (e, t = 0, n = ".", r = ",") {
      e = `${e}`.replace(/[^0-9+-Ee.]/g, "");
      const o = isFinite(+e) ? +e : 0,
        i = isFinite(+t) ? Math.abs(t) : 0,
        a = void 0 === r ? "," : r,
        s = void 0 === n ? "." : n;
      let c = "";
      c = (i ? function (e, t) {
        const n = Math.pow(10, t);
        let r = _h(Math.round(Math.abs(Ah(e, n))), n);
        return e < 0 && 0 !== r && (r = Ah(r, -1)), r
      }(o, i) + "" : `${Math.round(o)}`).split(".");
      const u = /(-?\d+)(\d{3})/;
      for (; u.test(c[0]);) c[0] = c[0].replace(u, `$1${a}$2`);
      return (c[1] || "").length < i && (c[1] = c[1] || "", c[1] += new Array(i - c[1].length + 1).join("0")), c.join(s)
    },
    getDuration: function (e, t = !0) {
      const n = parseInt(e);
      return t ? /s$/.test(e) ? e : e > 30 ? `${e}ms` : `${e}s` : /ms$/.test(e) ? n : /s$/.test(e) ? n > 30 ? n : 1e3 * n : n
    },
    padZero: function (e) {
      return `00${e}`.slice(-2)
    },
    formValidate: function (e, t) {
      const n = Dn.$u.$parent.call(e, "u-form-item"),
        r = Dn.$u.$parent.call(e, "u-form");
      n && r && r.validateField(n.prop, (() => {}), t)
    },
    getProperty: function (e, t) {
      if (e) {
        if ("string" != typeof t || "" === t) return "";
        if (-1 !== t.indexOf(".")) {
          const n = t.split(".");
          let r = e[n[0]] || {};
          for (let e = 1; e < n.length; e++) r && (r = r[n[e]]);
          return r
        }
        return e[t]
      }
    },
    setProperty: function (e, t, n) {
      if (!e) return;
      const r = function (e, t, n) {
        if (1 !== t.length)
          for (; t.length > 1;) {
            const o = t[0];
            e[o] && "object" == typeof e[o] || (e[o] = {}), t.shift(), r(e[o], t, n)
          } else e[t[0]] = n
      };
      if ("string" != typeof t || "" === t);
      else if (-1 !== t.indexOf(".")) {
        const o = t.split(".");
        r(e, o, n)
      } else e[t] = n
    },
    page: function () {
      const e = getCurrentPages();
      return `/${e[e.length-1].route||""}`
    },
    pages: function () {
      return getCurrentPages()
    },
    setConfig: function ({
      props: e = {},
      config: t = {},
      color: n = {},
      zIndex: r = {}
    }) {
      const {
        deepMerge: o
      } = Dn.$u;
      Dn.$u.config = o(Dn.$u.config, t), Dn.$u.props = o(Dn.$u.props, e), Dn.$u.color = o(Dn.$u.color, n), Dn.$u.zIndex = o(Dn.$u.zIndex, r)
    }
  },
  Ih = {
    v: "3",
    version: "3",
    type: ["primary", "success", "info", "error", "warning"],
    color: {
      "u-primary": "#2979ff",
      "u-warning": "#ff9900",
      "u-success": "#19be6b",
      "u-error": "#fa3534",
      "u-info": "#909399",
      "u-main-color": "#303133",
      "u-content-color": "#606266",
      "u-tips-color": "#909399",
      "u-light-color": "#c0c4cc"
    },
    unit: "px"
  },
  Oh = {
    calendar: {
      title: "日期选择",
      showTitle: !0,
      showSubtitle: !0,
      mode: "single",
      startText: "开始",
      endText: "结束",
      customList: () => [],
      color: "#3c9cff",
      minDate: 0,
      maxDate: 0,
      defaultDate: null,
      maxCount: Number.MAX_SAFE_INTEGER,
      rowHeight: 56,
      formatter: null,
      showLunar: !1,
      showMark: !0,
      confirmText: "确定",
      confirmDisabledText: "确定",
      show: !1,
      closeOnClickOverlay: !1,
      readonly: !1,
      showConfirm: !0,
      maxRange: Number.MAX_SAFE_INTEGER,
      rangePrompt: "",
      showRangePrompt: !0,
      allowSameDay: !1,
      round: 0,
      monthNum: 3
    }
  },
  Ch = {
    datetimePicker: {
      show: !1,
      popupMode: "bottom",
      showToolbar: !0,
      value: "",
      title: "",
      mode: "datetime",
      maxDate: new Date((new Date).getFullYear() + 10, 0, 1).getTime(),
      minDate: new Date((new Date).getFullYear() - 10, 0, 1).getTime(),
      minHour: 0,
      maxHour: 23,
      minMinute: 0,
      maxMinute: 59,
      filter: null,
      formatter: null,
      loading: !1,
      itemHeight: 44,
      cancelText: "取消",
      confirmText: "确认",
      cancelColor: "#909193",
      confirmColor: "#3c9cff",
      visibleItemCount: 5,
      closeOnClickOverlay: !1,
      defaultIndex: () => []
    }
  },
  {
    color: Bh
  } = Ih,
  jh = {
    icon: {
      name: "",
      color: Bh["u-content-color"],
      size: "16px",
      bold: !1,
      index: "",
      hoverClass: "",
      customPrefix: "uicon",
      label: "",
      labelPos: "right",
      labelSize: "15px",
      labelColor: Bh["u-content-color"],
      space: "3px",
      imgMode: "",
      width: "",
      height: "",
      top: 0,
      stop: !1
    }
  },
  {
    color: Dh
  } = Ih,
  Nh = {
    link: {
      color: Dh["u-primary"],
      fontSize: 15,
      underLine: !1,
      href: "",
      mpTips: "链接已复制，请在浏览器打开",
      lineColor: "",
      text: ""
    }
  },
  {
    color: Rh
  } = Ih,
  Lh = {
    primary: "#3c9cff",
    info: "#909399",
    default: "#909399",
    warning: "#f9ae3d",
    error: "#f56c6c",
    success: "#5ac725",
    mainColor: "#303133",
    contentColor: "#606266",
    tipsColor: "#909399",
    lightColor: "#c0c4cc",
    borderColor: "#e4e7ed"
  },
  Mh = {
    actionSheet: {
      show: !1,
      title: "",
      description: "",
      actions: () => [],
      index: "",
      cancelText: "",
      closeOnClickAction: !0,
      safeAreaInsetBottom: !0,
      openType: "",
      closeOnClickOverlay: !0,
      round: 0
    },
    album: {
      urls: () => [],
      keyName: "",
      singleSize: 180,
      multipleSize: 70,
      space: 6,
      singleMode: "scaleToFill",
      multipleMode: "aspectFill",
      maxCount: 9,
      previewFullImage: !0,
      rowCount: 3,
      showMore: !0
    },
    alert: {
      title: "",
      type: "warning",
      description: "",
      closable: !1,
      showIcon: !1,
      effect: "light",
      center: !1,
      fontSize: 14
    },
    avatar: {
      src: "",
      shape: "circle",
      size: 40,
      mode: "scaleToFill",
      text: "",
      bgColor: "#c0c4cc",
      color: "#ffffff",
      fontSize: 18,
      icon: "",
      mpAvatar: !1,
      randomBgColor: !1,
      defaultUrl: "",
      colorIndex: "",
      name: ""
    },
    avatarGroup: {
      urls: () => [],
      maxCount: 5,
      shape: "circle",
      mode: "scaleToFill",
      showMore: !0,
      size: 40,
      keyName: "",
      gap: .5,
      extraValue: 0
    },
    backtop: {
      mode: "circle",
      icon: "arrow-upward",
      text: "",
      duration: 100,
      scrollTop: 0,
      top: 400,
      bottom: 100,
      right: 20,
      zIndex: 9,
      iconStyle: () => ({
        color: "#909399",
        fontSize: "19px"
      })
    },
    badge: {
      isDot: !1,
      value: "",
      show: !0,
      max: 999,
      type: "error",
      showZero: !1,
      bgColor: null,
      color: null,
      shape: "circle",
      numberType: "overflow",
      offset: () => [],
      inverted: !1,
      absolute: !1
    },
    button: {
      hairline: !1,
      type: "info",
      size: "normal",
      shape: "square",
      plain: !1,
      disabled: !1,
      loading: !1,
      loadingText: "",
      loadingMode: "spinner",
      loadingSize: 15,
      openType: "",
      formType: "",
      appParameter: "",
      hoverStopPropagation: !0,
      lang: "en",
      sessionFrom: "",
      sendMessageTitle: "",
      sendMessagePath: "",
      sendMessageImg: "",
      showMessageCard: !1,
      dataName: "",
      throttleTime: 0,
      hoverStartTime: 0,
      hoverStayTime: 200,
      text: "",
      icon: "",
      iconColor: "",
      color: ""
    },
    ...Oh,
    carKeyboard: {
      random: !1
    },
    cell: {
      customClass: "",
      title: "",
      label: "",
      value: "",
      icon: "",
      disabled: !1,
      border: !0,
      center: !1,
      url: "",
      linkType: "navigateTo",
      clickable: !1,
      isLink: !1,
      required: !1,
      arrowDirection: "",
      iconStyle: {},
      rightIconStyle: {},
      rightIcon: "arrow-right",
      titleStyle: {},
      size: "",
      stop: !0,
      name: ""
    },
    cellGroup: {
      title: "",
      border: !0,
      customStyle: {}
    },
    checkbox: {
      name: "",
      shape: "",
      size: "",
      checkbox: !1,
      disabled: "",
      activeColor: "",
      inactiveColor: "",
      iconSize: "",
      iconColor: "",
      label: "",
      labelSize: "",
      labelColor: "",
      labelDisabled: ""
    },
    checkboxGroup: {
      name: "",
      value: () => [],
      shape: "square",
      disabled: !1,
      activeColor: "#2979ff",
      inactiveColor: "#c8c9cc",
      size: 18,
      placement: "row",
      labelSize: 14,
      labelColor: "#303133",
      labelDisabled: !1,
      iconColor: "#ffffff",
      iconSize: 12,
      iconPlacement: "left",
      borderBottom: !1
    },
    circleProgress: {
      percentage: 30
    },
    code: {
      seconds: 60,
      startText: "获取验证码",
      changeText: "X秒重新获取",
      endText: "重新获取",
      keepRunning: !1,
      uniqueKey: ""
    },
    codeInput: {
      adjustPosition: !0,
      maxlength: 6,
      dot: !1,
      mode: "box",
      hairline: !1,
      space: 10,
      value: "",
      focus: !1,
      bold: !1,
      color: "#606266",
      fontSize: 18,
      size: 35,
      disabledKeyboard: !1,
      borderColor: "#c9cacc",
      disabledDot: !0
    },
    col: {
      span: 12,
      offset: 0,
      justify: "start",
      align: "stretch",
      textAlign: "left"
    },
    collapse: {
      value: null,
      accordion: !1,
      border: !0
    },
    collapseItem: {
      title: "",
      value: "",
      label: "",
      disabled: !1,
      isLink: !0,
      clickable: !0,
      border: !0,
      align: "left",
      name: "",
      icon: "",
      duration: 300
    },
    columnNotice: {
      text: "",
      icon: "volume",
      mode: "",
      color: "#f9ae3d",
      bgColor: "#fdf6ec",
      fontSize: 14,
      speed: 80,
      step: !1,
      duration: 1500,
      disableTouch: !0
    },
    countDown: {
      time: 0,
      format: "HH:mm:ss",
      autoStart: !0,
      millisecond: !1
    },
    countTo: {
      startVal: 0,
      endVal: 0,
      duration: 2e3,
      autoplay: !0,
      decimals: 0,
      useEasing: !0,
      decimal: ".",
      color: "#606266",
      fontSize: 22,
      bold: !1,
      separator: ""
    },
    ...Ch,
    divider: {
      dashed: !1,
      hairline: !0,
      dot: !1,
      textPosition: "center",
      text: "",
      textSize: 14,
      textColor: "#909399",
      lineColor: "#dcdfe6"
    },
    empty: {
      icon: "",
      text: "",
      textColor: "#c0c4cc",
      textSize: 14,
      iconColor: "#c0c4cc",
      iconSize: 90,
      mode: "data",
      width: 160,
      height: 160,
      show: !0,
      marginTop: 0
    },
    form: {
      model: () => ({}),
      rules: () => ({}),
      errorType: "message",
      borderBottom: !0,
      labelPosition: "left",
      labelWidth: 45,
      labelAlign: "left",
      labelStyle: () => ({})
    },
    formItem: {
      label: "",
      prop: "",
      borderBottom: "",
      labelWidth: "",
      rightIcon: "",
      leftIcon: "",
      required: !1,
      leftIconStyle: ""
    },
    gap: {
      bgColor: "transparent",
      height: 20,
      marginTop: 0,
      marginBottom: 0,
      customStyle: {}
    },
    grid: {
      col: 3,
      border: !1,
      align: "left"
    },
    gridItem: {
      name: null,
      bgColor: "transparent"
    },
    ...jh,
    image: {
      src: "",
      mode: "aspectFill",
      width: "300",
      height: "225",
      shape: "square",
      radius: 0,
      lazyLoad: !0,
      showMenuByLongpress: !0,
      loadingIcon: "photo",
      errorIcon: "error-circle",
      showLoading: !0,
      showError: !0,
      fade: !0,
      webp: !1,
      duration: 500,
      bgColor: "#f3f4f6"
    },
    indexAnchor: {
      text: "",
      color: "#606266",
      size: 14,
      bgColor: "#dedede",
      height: 32
    },
    indexList: {
      inactiveColor: "#606266",
      activeColor: "#5677fc",
      indexList: () => [],
      sticky: !0,
      customNavHeight: 0
    },
    input: {
      value: "",
      type: "text",
      fixed: !1,
      disabled: !1,
      disabledColor: "#f5f7fa",
      clearable: !1,
      password: !1,
      maxlength: -1,
      placeholder: null,
      placeholderClass: "input-placeholder",
      placeholderStyle: "color: #c0c4cc",
      showWordLimit: !1,
      confirmType: "done",
      confirmHold: !1,
      holdKeyboard: !1,
      focus: !1,
      autoBlur: !1,
      disableDefaultPadding: !1,
      cursor: -1,
      cursorSpacing: 30,
      selectionStart: -1,
      selectionEnd: -1,
      adjustPosition: !0,
      inputAlign: "left",
      fontSize: "15px",
      color: "#303133",
      prefixIcon: "",
      prefixIconStyle: "",
      suffixIcon: "",
      suffixIconStyle: "",
      border: "surround",
      readonly: !1,
      shape: "square",
      formatter: null
    },
    keyboard: {
      mode: "number",
      dotDisabled: !1,
      tooltip: !0,
      showTips: !0,
      tips: "",
      showCancel: !0,
      showConfirm: !0,
      random: !1,
      safeAreaInsetBottom: !0,
      closeOnClickOverlay: !0,
      show: !1,
      overlay: !0,
      zIndex: 10075,
      cancelText: "取消",
      confirmText: "确定",
      autoChange: !1
    },
    line: {
      color: "#d6d7d9",
      length: "100%",
      direction: "row",
      hairline: !0,
      margin: 0,
      dashed: !1
    },
    lineProgress: {
      activeColor: "#19be6b",
      inactiveColor: "#ececec",
      percentage: 0,
      showText: !0,
      height: 12
    },
    ...Nh,
    list: {
      showScrollbar: !1,
      lowerThreshold: 50,
      upperThreshold: 0,
      scrollTop: 0,
      offsetAccuracy: 10,
      enableFlex: !1,
      pagingEnabled: !1,
      scrollable: !0,
      scrollIntoView: "",
      scrollWithAnimation: !1,
      enableBackToTop: !1,
      height: 0,
      width: 0,
      preLoadScreen: 1
    },
    listItem: {
      anchor: ""
    },
    ...{
      loadingIcon: {
        show: !0,
        color: Rh["u-tips-color"],
        textColor: Rh["u-tips-color"],
        vertical: !1,
        mode: "spinner",
        size: 24,
        textSize: 15,
        text: "",
        timingFunction: "ease-in-out",
        duration: 1200,
        inactiveColor: ""
      }
    },
    loadingPage: {
      loadingText: "正在加载",
      image: "",
      loadingMode: "circle",
      loading: !1,
      bgColor: "#ffffff",
      color: "#C8C8C8",
      fontSize: 19,
      iconSize: 28,
      loadingColor: "#C8C8C8"
    },
    loadmore: {
      status: "loadmore",
      bgColor: "transparent",
      icon: !0,
      fontSize: 14,
      iconSize: 17,
      color: "#606266",
      loadingIcon: "spinner",
      loadmoreText: "加载更多",
      loadingText: "正在加载...",
      nomoreText: "没有更多了",
      isDot: !1,
      iconColor: "#b7b7b7",
      marginTop: 10,
      marginBottom: 10,
      height: "auto",
      line: !1,
      lineColor: "#E6E8EB",
      dashed: !1
    },
    modal: {
      show: !1,
      title: "",
      content: "",
      confirmText: "确认",
      cancelText: "取消",
      showConfirmButton: !0,
      showCancelButton: !1,
      confirmColor: "#2979ff",
      cancelColor: "#606266",
      buttonReverse: !1,
      zoom: !0,
      asyncClose: !1,
      closeOnClickOverlay: !1,
      negativeTop: 0,
      width: "650rpx",
      confirmButtonShape: ""
    },
    ...{
      navbar: {
        safeAreaInsetTop: !0,
        placeholder: !1,
        fixed: !0,
        border: !1,
        leftIcon: "arrow-left",
        leftText: "",
        rightText: "",
        rightIcon: "",
        title: "",
        bgColor: "#ffffff",
        titleWidth: "400rpx",
        height: "44px",
        leftIconSize: 20,
        leftIconColor: Lh.mainColor,
        autoBack: !1,
        titleStyle: ""
      }
    },
    noNetwork: {
      tips: "哎呀，网络信号丢失",
      zIndex: "",
      image: "data:image/png;base64,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"
    },
    noticeBar: {
      text: () => [],
      direction: "row",
      step: !1,
      icon: "volume",
      mode: "",
      color: "#f9ae3d",
      bgColor: "#fdf6ec",
      speed: 80,
      fontSize: 14,
      duration: 2e3,
      disableTouch: !0,
      url: "",
      linkType: "navigateTo"
    },
    notify: {
      top: 0,
      type: "primary",
      color: "#ffffff",
      bgColor: "",
      message: "",
      duration: 3e3,
      fontSize: 15,
      safeAreaInsetTop: !1
    },
    ...{
      numberBox: {
        name: "",
        value: 0,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        step: 1,
        integer: !1,
        disabled: !1,
        disabledInput: !1,
        asyncChange: !1,
        inputWidth: 35,
        showMinus: !0,
        showPlus: !0,
        decimalLength: null,
        longPress: !0,
        color: "#323233",
        buttonSize: 30,
        bgColor: "#EBECEE",
        cursorSpacing: 100,
        disableMinus: !1,
        disablePlus: !1,
        iconStyle: ""
      }
    },
    numberKeyboard: {
      mode: "number",
      dotDisabled: !1,
      random: !1
    },
    overlay: {
      show: !1,
      zIndex: 10070,
      duration: 300,
      opacity: .5
    },
    parse: {
      copyLink: !0,
      errorImg: "",
      lazyLoad: !1,
      loadingImg: "",
      pauseVideo: !0,
      previewImg: !0,
      setTitle: !0,
      showImgMenu: !0
    },
    picker: {
      show: !1,
      popupMode: "bottom",
      showToolbar: !0,
      title: "",
      columns: () => [],
      loading: !1,
      itemHeight: 44,
      cancelText: "取消",
      confirmText: "确定",
      cancelColor: "#909193",
      confirmColor: "#3c9cff",
      visibleItemCount: 5,
      keyName: "text",
      closeOnClickOverlay: !1,
      defaultIndex: () => [],
      immediateChange: !1
    },
    popup: {
      show: !1,
      overlay: !0,
      mode: "bottom",
      duration: 300,
      closeable: !1,
      overlayStyle: () => {},
      closeOnClickOverlay: !0,
      zIndex: 10075,
      safeAreaInsetBottom: !0,
      safeAreaInsetTop: !1,
      closeIconPos: "top-right",
      round: 0,
      zoom: !0,
      bgColor: "",
      overlayOpacity: .5
    },
    radio: {
      name: "",
      shape: "",
      disabled: "",
      labelDisabled: "",
      activeColor: "",
      inactiveColor: "",
      iconSize: "",
      labelSize: "",
      label: "",
      labelColor: "",
      size: "",
      iconColor: "",
      placement: ""
    },
    radioGroup: {
      value: "",
      disabled: !1,
      shape: "circle",
      activeColor: "#2979ff",
      inactiveColor: "#c8c9cc",
      name: "",
      size: 18,
      placement: "row",
      label: "",
      labelColor: "#303133",
      labelSize: 14,
      labelDisabled: !1,
      iconColor: "#ffffff",
      iconSize: 12,
      borderBottom: !1,
      iconPlacement: "left"
    },
    rate: {
      value: 1,
      count: 5,
      disabled: !1,
      size: 18,
      inactiveColor: "#b2b2b2",
      activeColor: "#FA3534",
      gutter: 4,
      minCount: 1,
      allowHalf: !1,
      activeIcon: "star-fill",
      inactiveIcon: "star",
      touchable: !0
    },
    readMore: {
      showHeight: 400,
      toggle: !1,
      closeText: "展开阅读全文",
      openText: "收起",
      color: "#2979ff",
      fontSize: 14,
      textIndent: "2em",
      name: ""
    },
    row: {
      gutter: 0,
      justify: "start",
      align: "center"
    },
    rowNotice: {
      text: "",
      icon: "volume",
      mode: "",
      color: "#f9ae3d",
      bgColor: "#fdf6ec",
      fontSize: 14,
      speed: 80
    },
    scrollList: {
      indicatorWidth: 50,
      indicatorBarWidth: 20,
      indicator: !0,
      indicatorColor: "#f2f2f2",
      indicatorActiveColor: "#3c9cff",
      indicatorStyle: ""
    },
    search: {
      shape: "round",
      bgColor: "#f2f2f2",
      placeholder: "请输入关键字",
      clearabled: !0,
      focus: !1,
      showAction: !0,
      actionStyle: () => ({}),
      actionText: "搜索",
      inputAlign: "left",
      inputStyle: () => ({}),
      disabled: !1,
      borderColor: "transparent",
      searchIconColor: "#909399",
      searchIconSize: 22,
      color: "#606266",
      placeholderColor: "#909399",
      searchIcon: "search",
      margin: "0",
      animation: !1,
      value: "",
      maxlength: "-1",
      height: 32,
      label: null
    },
    section: {
      title: "",
      subTitle: "更多",
      right: !0,
      fontSize: 15,
      bold: !0,
      color: "#303133",
      subColor: "#909399",
      showLine: !0,
      lineColor: "",
      arrow: !0
    },
    skeleton: {
      loading: !0,
      animate: !0,
      rows: 0,
      rowsWidth: "100%",
      rowsHeight: 18,
      title: !0,
      titleWidth: "50%",
      titleHeight: 18,
      avatar: !1,
      avatarSize: 32,
      avatarShape: "circle"
    },
    slider: {
      value: 0,
      blockSize: 18,
      min: 0,
      max: 100,
      step: 1,
      activeColor: "#2979ff",
      inactiveColor: "#c0c4cc",
      blockColor: "#ffffff",
      showValue: !1,
      disabled: !1,
      blockStyle: () => {}
    },
    statusBar: {
      bgColor: "transparent"
    },
    steps: {
      direction: "row",
      current: 0,
      activeColor: "#3c9cff",
      inactiveColor: "#969799",
      activeIcon: "",
      inactiveIcon: "",
      dot: !1
    },
    stepsItem: {
      title: "",
      desc: "",
      iconSize: 17,
      error: !1
    },
    sticky: {
      offsetTop: 0,
      customNavHeight: 0,
      disabled: !1,
      bgColor: "transparent",
      zIndex: "",
      index: ""
    },
    subsection: {
      list: [],
      current: 0,
      activeColor: "#3c9cff",
      inactiveColor: "#303133",
      mode: "button",
      fontSize: 12,
      bold: !0,
      bgColor: "#eeeeef",
      keyName: "name"
    },
    swipeAction: {
      autoClose: !0
    },
    swipeActionItem: {
      show: !1,
      name: "",
      disabled: !1,
      threshold: 20,
      autoClose: !0,
      options: [],
      duration: 300
    },
    swiper: {
      list: () => [],
      indicator: !1,
      indicatorActiveColor: "#FFFFFF",
      indicatorInactiveColor: "rgba(255, 255, 255, 0.35)",
      indicatorStyle: "",
      indicatorMode: "line",
      autoplay: !0,
      current: 0,
      currentItemId: "",
      interval: 3e3,
      duration: 300,
      circular: !1,
      previousMargin: 0,
      nextMargin: 0,
      acceleration: !1,
      displayMultipleItems: 1,
      easingFunction: "default",
      keyName: "url",
      imgMode: "aspectFill",
      height: 130,
      bgColor: "#f3f4f6",
      radius: 4,
      loading: !1,
      showTitle: !1
    },
    swiperIndicator: {
      length: 0,
      current: 0,
      indicatorActiveColor: "",
      indicatorInactiveColor: "",
      indicatorMode: "line"
    },
    switch: {
      loading: !1,
      disabled: !1,
      size: 25,
      activeColor: "#2979ff",
      inactiveColor: "#ffffff",
      value: !1,
      activeValue: !0,
      inactiveValue: !1,
      asyncChange: !1,
      space: 0
    },
    tabbar: {
      value: null,
      safeAreaInsetBottom: !0,
      border: !0,
      zIndex: 1,
      activeColor: "#1989fa",
      inactiveColor: "#7d7e80",
      fixed: !0,
      placeholder: !0
    },
    tabbarItem: {
      name: null,
      icon: "",
      badge: null,
      dot: !1,
      text: "",
      badgeStyle: "top: 6px;right:2px;"
    },
    tabs: {
      duration: 300,
      list: () => [],
      lineColor: "#3c9cff",
      activeStyle: () => ({
        color: "#303133"
      }),
      inactiveStyle: () => ({
        color: "#606266"
      }),
      lineWidth: 20,
      lineHeight: 3,
      lineBgSize: "cover",
      itemStyle: () => ({
        height: "44px"
      }),
      scrollable: !0,
      current: 0,
      keyName: "name"
    },
    tag: {
      type: "primary",
      disabled: !1,
      size: "medium",
      shape: "square",
      text: "",
      bgColor: "",
      color: "",
      borderColor: "",
      closeColor: "#C6C7CB",
      name: "",
      plainFill: !1,
      plain: !1,
      closable: !1,
      show: !0,
      icon: ""
    },
    text: {
      type: "",
      show: !0,
      text: "",
      prefixIcon: "",
      suffixIcon: "",
      mode: "",
      href: "",
      format: "",
      call: !1,
      openType: "",
      bold: !1,
      block: !1,
      lines: "",
      color: "#303133",
      size: 15,
      iconStyle: () => ({
        fontSize: "15px"
      }),
      decoration: "none",
      margin: 0,
      lineHeight: "",
      align: "left",
      wordWrap: "normal"
    },
    textarea: {
      value: "",
      placeholder: "",
      placeholderClass: "textarea-placeholder",
      placeholderStyle: "color: #c0c4cc",
      height: 70,
      confirmType: "done",
      disabled: !1,
      count: !1,
      focus: !1,
      autoHeight: !1,
      fixed: !1,
      cursorSpacing: 0,
      cursor: "",
      showConfirmBar: !0,
      selectionStart: -1,
      selectionEnd: -1,
      adjustPosition: !0,
      disableDefaultPadding: !1,
      holdKeyboard: !1,
      maxlength: 140,
      border: "surround",
      formatter: null
    },
    toast: {
      zIndex: 10090,
      loading: !1,
      text: "",
      icon: "",
      type: "",
      loadingMode: "",
      show: "",
      overlay: !1,
      position: "center",
      params: () => {},
      duration: 2e3,
      isTab: !1,
      url: "",
      callback: null,
      back: !1
    },
    toolbar: {
      show: !0,
      cancelText: "取消",
      confirmText: "确认",
      cancelColor: "#909193",
      confirmColor: "#3c9cff",
      title: ""
    },
    tooltip: {
      text: "",
      copyText: "",
      size: 14,
      color: "#606266",
      bgColor: "transparent",
      direction: "top",
      zIndex: 10071,
      showCopy: !0,
      buttons: () => [],
      overlay: !0,
      showToast: !0
    },
    transition: {
      show: !1,
      mode: "fade",
      duration: "300",
      timingFunction: "ease-out"
    },
    ...{
      upload: {
        accept: "image",
        capture: () => ["album", "camera"],
        compressed: !0,
        camera: "back",
        maxDuration: 60,
        uploadIcon: "camera-fill",
        uploadIconColor: "#D3D4D6",
        useBeforeRead: !1,
        previewFullImage: !0,
        maxCount: 52,
        disabled: !1,
        imageMode: "aspectFill",
        name: "",
        sizeType: () => ["original", "compressed"],
        multiple: !1,
        deletable: !0,
        maxSize: Number.MAX_VALUE,
        fileList: () => [],
        uploadText: "",
        width: 80,
        height: 80,
        previewImage: !0
      }
    }
  };
let Fh = "none";
Fh = "vue3", Fh = "mp", Fh = "weixin";
const Uh = {
  route: sh,
  date: Eh.timeFormat,
  colorGradient: lh.colorGradient,
  hexToRgb: lh.hexToRgb,
  rgbToHex: lh.rgbToHex,
  colorToRgba: lh.colorToRgba,
  test: gh,
  type: ["primary", "success", "error", "warning", "info"],
  http: new class {
    constructor(e = {}) {
      var t;
      t = e, "[object Object]" !== Object.prototype.toString.call(t) && (e = {}, console.warn("设置全局参数必须接收一个Object")), this.config = ah({
        ...ih,
        ...e
      }), this.interceptors = {
        request: new rh,
        response: new rh
      }
    }
    setConfig(e) {
      this.config = e(this.config)
    }
    middleware(e) {
      e = ((e, t = {}) => {
        const n = t.method || e.method || "GET";
        let r = {
          baseURL: e.baseURL || "",
          method: n,
          url: t.url || "",
          params: t.params || {},
          custom: {
            ...e.custom || {},
            ...t.custom || {}
          },
          header: Yd(e.header || {}, t.header || {})
        };
        if (r = {
            ...r,
            ...oh(["getTask", "validateStatus"], e, t)
          }, "DOWNLOAD" === n);
        else if ("UPLOAD" === n) delete r.header["content-type"], delete r.header["Content-Type"], ["filePath", "name", "formData"].forEach((e => {
          Xd(t[e]) || (r[e] = t[e])
        }));
        else {
          const n = ["data", "timeout", "dataType", "responseType"];
          r = {
            ...r,
            ...oh(n, e, t)
          }
        }
        return r
      })(this.config, e);
      const t = [nh, void 0];
      let n = Promise.resolve(e);
      for (this.interceptors.request.forEach((e => {
          t.unshift(e.fulfilled, e.rejected)
        })), this.interceptors.response.forEach((e => {
          t.push(e.fulfilled, e.rejected)
        })); t.length;) n = n.then(t.shift(), t.shift());
      return n
    }
    request(e = {}) {
      return this.middleware(e)
    }
    get(e, t = {}) {
      return this.middleware({
        url: e,
        method: "GET",
        ...t
      })
    }
    post(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "POST",
        ...n
      })
    }
    put(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "PUT",
        ...n
      })
    }
    delete(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "DELETE",
        ...n
      })
    }
    connect(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "CONNECT",
        ...n
      })
    }
    head(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "HEAD",
        ...n
      })
    }
    options(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "OPTIONS",
        ...n
      })
    }
    trace(e, t, n = {}) {
      return this.middleware({
        url: e,
        data: t,
        method: "TRACE",
        ...n
      })
    }
    upload(e, t = {}) {
      return t.url = e, t.method = "UPLOAD", this.middleware(t)
    }
    download(e, t = {}) {
      return t.url = e, t.method = "DOWNLOAD", this.middleware(t)
    }
  },
  config: Ih,
  zIndex: {
    toast: 10090,
    noNetwork: 10080,
    popup: 10075,
    mask: 10070,
    navbar: 980,
    topTips: 975,
    sticky: 970,
    indexListSticky: 965
  },
  debounce: function (e, t = 500, n = !1) {
    if (null !== mh && clearTimeout(mh), n) {
      const n = !mh;
      mh = setTimeout((() => {
        mh = null
      }), t), n && "function" == typeof e && e()
    } else mh = setTimeout((() => {
      "function" == typeof e && e()
    }), t)
  },
  throttle: function (e, t = 500, n = !0) {
    n ? yh || (yh = !0, "function" == typeof e && e(), setTimeout((() => {
      yh = !1
    }), t)) : yh || (yh = !0, setTimeout((() => {
      yh = !1, "function" == typeof e && e()
    }), t))
  },
  mixin: Wd,
  mpMixin: Vd,
  props: Mh,
  ...Eh,
  color: Lh,
  platform: "weixin"
};
Dn.$u = Uh;
const qh = {
  install: e => {
    e.config.globalProperties.$u = Uh, e.config.globalProperties.$nextTick = e => {
      e()
    }, e.mixin(Wd)
  }
};
var $h, zh;
/**
 * @license
 * Lodash <https://lodash.com/>
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
exports.lodashExports = {}, $h = {
    get exports() {
      return exports.lodashExports
    },
    set exports(e) {
      exports.lodashExports = e
    }
  }, zh = exports.lodashExports,
  function () {
    var e, t = "Expected a function",
      n = "__lodash_hash_undefined__",
      r = "__lodash_placeholder__",
      o = 16,
      i = 32,
      a = 64,
      s = 128,
      c = 256,
      u = 1 / 0,
      l = 9007199254740991,
      f = NaN,
      p = 4294967295,
      d = [
        ["ary", s],
        ["bind", 1],
        ["bindKey", 2],
        ["curry", 8],
        ["curryRight", o],
        ["flip", 512],
        ["partial", i],
        ["partialRight", a],
        ["rearg", c]
      ],
      h = "[object Arguments]",
      g = "[object Array]",
      y = "[object Boolean]",
      m = "[object Date]",
      b = "[object Error]",
      v = "[object Function]",
      w = "[object GeneratorFunction]",
      S = "[object Map]",
      x = "[object Number]",
      A = "[object Object]",
      _ = "[object Promise]",
      P = "[object RegExp]",
      k = "[object Set]",
      T = "[object String]",
      E = "[object Symbol]",
      I = "[object WeakMap]",
      O = "[object ArrayBuffer]",
      C = "[object DataView]",
      B = "[object Float32Array]",
      j = "[object Float64Array]",
      D = "[object Int8Array]",
      N = "[object Int16Array]",
      R = "[object Int32Array]",
      L = "[object Uint8Array]",
      M = "[object Uint8ClampedArray]",
      F = "[object Uint16Array]",
      U = "[object Uint32Array]",
      q = /\b__p \+= '';/g,
      $ = /\b(__p \+=) '' \+/g,
      z = /(__e\(.*?\)|\b__t\)) \+\n'';/g,
      Q = /&(?:amp|lt|gt|quot|#39);/g,
      H = /[&<>"']/g,
      W = RegExp(Q.source),
      V = RegExp(H.source),
      K = /<%-([\s\S]+?)%>/g,
      J = /<%([\s\S]+?)%>/g,
      G = /<%=([\s\S]+?)%>/g,
      Y = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
      X = /^\w*$/,
      Z = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
      ee = /[\\^$.*+?()[\]{}|]/g,
      te = RegExp(ee.source),
      ne = /^\s+/,
      re = /\s/,
      oe = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,
      ie = /\{\n\/\* \[wrapped with (.+)\] \*/,
      ae = /,? & /,
      se = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g,
      ce = /[()=,{}\[\]\/\s]/,
      ue = /\\(\\)?/g,
      le = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,
      fe = /\w*$/,
      pe = /^[-+]0x[0-9a-f]+$/i,
      de = /^0b[01]+$/i,
      he = /^\[object .+?Constructor\]$/,
      ge = /^0o[0-7]+$/i,
      ye = /^(?:0|[1-9]\d*)$/,
      me = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g,
      be = /($^)/,
      ve = /['\n\r\u2028\u2029\\]/g,
      we = "\\ud800-\\udfff",
      Se = "\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff",
      xe = "\\u2700-\\u27bf",
      Ae = "a-z\\xdf-\\xf6\\xf8-\\xff",
      _e = "A-Z\\xc0-\\xd6\\xd8-\\xde",
      Pe = "\\ufe0e\\ufe0f",
      ke = "\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000",
      Te = "['’]",
      Ee = "[" + we + "]",
      Ie = "[" + ke + "]",
      Oe = "[" + Se + "]",
      Ce = "\\d+",
      Be = "[" + xe + "]",
      je = "[" + Ae + "]",
      De = "[^" + we + ke + Ce + xe + Ae + _e + "]",
      Ne = "\\ud83c[\\udffb-\\udfff]",
      Re = "[^" + we + "]",
      Le = "(?:\\ud83c[\\udde6-\\uddff]){2}",
      Me = "[\\ud800-\\udbff][\\udc00-\\udfff]",
      Fe = "[" + _e + "]",
      Ue = "\\u200d",
      qe = "(?:" + je + "|" + De + ")",
      $e = "(?:" + Fe + "|" + De + ")",
      ze = "(?:['’](?:d|ll|m|re|s|t|ve))?",
      Qe = "(?:['’](?:D|LL|M|RE|S|T|VE))?",
      He = "(?:" + Oe + "|" + Ne + ")?",
      We = "[" + Pe + "]?",
      Ve = We + He + "(?:" + Ue + "(?:" + [Re, Le, Me].join("|") + ")" + We + He + ")*",
      Ke = "(?:" + [Be, Le, Me].join("|") + ")" + Ve,
      Je = "(?:" + [Re + Oe + "?", Oe, Le, Me, Ee].join("|") + ")",
      Ge = RegExp(Te, "g"),
      Ye = RegExp(Oe, "g"),
      Xe = RegExp(Ne + "(?=" + Ne + ")|" + Je + Ve, "g"),
      Ze = RegExp([Fe + "?" + je + "+" + ze + "(?=" + [Ie, Fe, "$"].join("|") + ")", $e + "+" + Qe + "(?=" + [Ie, Fe + qe, "$"].join("|") + ")", Fe + "?" + qe + "+" + ze, Fe + "+" + Qe, "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", Ce, Ke].join("|"), "g"),
      et = RegExp("[" + Ue + we + Se + Pe + "]"),
      tt = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/,
      nt = ["Array", "Buffer", "DataView", "Date", "Error", "Float32Array", "Float64Array", "Function", "Int8Array", "Int16Array", "Int32Array", "Map", "Math", "Object", "Promise", "RegExp", "Set", "String", "Symbol", "TypeError", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "_", "clearTimeout", "isFinite", "parseInt", "setTimeout"],
      rt = -1,
      ot = {};
    ot[B] = ot[j] = ot[D] = ot[N] = ot[R] = ot[L] = ot[M] = ot[F] = ot[U] = !0, ot[h] = ot[g] = ot[O] = ot[y] = ot[C] = ot[m] = ot[b] = ot[v] = ot[S] = ot[x] = ot[A] = ot[P] = ot[k] = ot[T] = ot[I] = !1;
    var it = {};
    it[h] = it[g] = it[O] = it[C] = it[y] = it[m] = it[B] = it[j] = it[D] = it[N] = it[R] = it[S] = it[x] = it[A] = it[P] = it[k] = it[T] = it[E] = it[L] = it[M] = it[F] = it[U] = !0, it[b] = it[v] = it[I] = !1;
    var at = {
        "\\": "\\",
        "'": "'",
        "\n": "n",
        "\r": "r",
        "\u2028": "u2028",
        "\u2029": "u2029"
      },
      st = parseFloat,
      ct = parseInt,
      ut = "object" == typeof Oc && Oc && Oc.Object === Object && Oc,
      lt = "object" == typeof self && self && self.Object === Object && self,
      ft = ut || lt || Function("return this")(),
      pt = zh && !zh.nodeType && zh,
      dt = pt && $h && !$h.nodeType && $h,
      ht = dt && dt.exports === pt,
      gt = ht && ut.process,
      yt = function () {
        try {
          var e = dt && dt.require && dt.require("util").types;
          return e || gt && gt.binding && gt.binding("util")
        } catch (Vs) {}
      }(),
      mt = yt && yt.isArrayBuffer,
      bt = yt && yt.isDate,
      vt = yt && yt.isMap,
      wt = yt && yt.isRegExp,
      St = yt && yt.isSet,
      xt = yt && yt.isTypedArray;

    function At(e, t, n) {
      switch (n.length) {
        case 0:
          return e.call(t);
        case 1:
          return e.call(t, n[0]);
        case 2:
          return e.call(t, n[0], n[1]);
        case 3:
          return e.call(t, n[0], n[1], n[2])
      }
      return e.apply(t, n)
    }

    function _t(e, t, n, r) {
      for (var o = -1, i = null == e ? 0 : e.length; ++o < i;) {
        var a = e[o];
        t(r, a, n(a), e)
      }
      return r
    }

    function Pt(e, t) {
      for (var n = -1, r = null == e ? 0 : e.length; ++n < r && !1 !== t(e[n], n, e););
      return e
    }

    function kt(e, t) {
      for (var n = null == e ? 0 : e.length; n-- && !1 !== t(e[n], n, e););
      return e
    }

    function Tt(e, t) {
      for (var n = -1, r = null == e ? 0 : e.length; ++n < r;)
        if (!t(e[n], n, e)) return !1;
      return !0
    }

    function Et(e, t) {
      for (var n = -1, r = null == e ? 0 : e.length, o = 0, i = []; ++n < r;) {
        var a = e[n];
        t(a, n, e) && (i[o++] = a)
      }
      return i
    }

    function It(e, t) {
      return !(null == e || !e.length) && Ft(e, t, 0) > -1
    }

    function Ot(e, t, n) {
      for (var r = -1, o = null == e ? 0 : e.length; ++r < o;)
        if (n(t, e[r])) return !0;
      return !1
    }

    function Ct(e, t) {
      for (var n = -1, r = null == e ? 0 : e.length, o = Array(r); ++n < r;) o[n] = t(e[n], n, e);
      return o
    }

    function Bt(e, t) {
      for (var n = -1, r = t.length, o = e.length; ++n < r;) e[o + n] = t[n];
      return e
    }

    function jt(e, t, n, r) {
      var o = -1,
        i = null == e ? 0 : e.length;
      for (r && i && (n = e[++o]); ++o < i;) n = t(n, e[o], o, e);
      return n
    }

    function Dt(e, t, n, r) {
      var o = null == e ? 0 : e.length;
      for (r && o && (n = e[--o]); o--;) n = t(n, e[o], o, e);
      return n
    }

    function Nt(e, t) {
      for (var n = -1, r = null == e ? 0 : e.length; ++n < r;)
        if (t(e[n], n, e)) return !0;
      return !1
    }
    var Rt = zt("length");

    function Lt(e, t, n) {
      var r;
      return n(e, (function (e, n, o) {
        if (t(e, n, o)) return r = n, !1
      })), r
    }

    function Mt(e, t, n, r) {
      for (var o = e.length, i = n + (r ? 1 : -1); r ? i-- : ++i < o;)
        if (t(e[i], i, e)) return i;
      return -1
    }

    function Ft(e, t, n) {
      return t == t ? function (e, t, n) {
        for (var r = n - 1, o = e.length; ++r < o;)
          if (e[r] === t) return r;
        return -1
      }(e, t, n) : Mt(e, qt, n)
    }

    function Ut(e, t, n, r) {
      for (var o = n - 1, i = e.length; ++o < i;)
        if (r(e[o], t)) return o;
      return -1
    }

    function qt(e) {
      return e != e
    }

    function $t(e, t) {
      var n = null == e ? 0 : e.length;
      return n ? Wt(e, t) / n : f
    }

    function zt(t) {
      return function (n) {
        return null == n ? e : n[t]
      }
    }

    function Qt(t) {
      return function (n) {
        return null == t ? e : t[n]
      }
    }

    function Ht(e, t, n, r, o) {
      return o(e, (function (e, o, i) {
        n = r ? (r = !1, e) : t(n, e, o, i)
      })), n
    }

    function Wt(t, n) {
      for (var r, o = -1, i = t.length; ++o < i;) {
        var a = n(t[o]);
        a !== e && (r = r === e ? a : r + a)
      }
      return r
    }

    function Vt(e, t) {
      for (var n = -1, r = Array(e); ++n < e;) r[n] = t(n);
      return r
    }

    function Kt(e) {
      return e ? e.slice(0, fn(e) + 1).replace(ne, "") : e
    }

    function Jt(e) {
      return function (t) {
        return e(t)
      }
    }

    function Gt(e, t) {
      return Ct(t, (function (t) {
        return e[t]
      }))
    }

    function Yt(e, t) {
      return e.has(t)
    }

    function Xt(e, t) {
      for (var n = -1, r = e.length; ++n < r && Ft(t, e[n], 0) > -1;);
      return n
    }

    function Zt(e, t) {
      for (var n = e.length; n-- && Ft(t, e[n], 0) > -1;);
      return n
    }
    var en = Qt({
        "À": "A",
        "Á": "A",
        "Â": "A",
        "Ã": "A",
        "Ä": "A",
        "Å": "A",
        "à": "a",
        "á": "a",
        "â": "a",
        "ã": "a",
        "ä": "a",
        "å": "a",
        "Ç": "C",
        "ç": "c",
        "Ð": "D",
        "ð": "d",
        "È": "E",
        "É": "E",
        "Ê": "E",
        "Ë": "E",
        "è": "e",
        "é": "e",
        "ê": "e",
        "ë": "e",
        "Ì": "I",
        "Í": "I",
        "Î": "I",
        "Ï": "I",
        "ì": "i",
        "í": "i",
        "î": "i",
        "ï": "i",
        "Ñ": "N",
        "ñ": "n",
        "Ò": "O",
        "Ó": "O",
        "Ô": "O",
        "Õ": "O",
        "Ö": "O",
        "Ø": "O",
        "ò": "o",
        "ó": "o",
        "ô": "o",
        "õ": "o",
        "ö": "o",
        "ø": "o",
        "Ù": "U",
        "Ú": "U",
        "Û": "U",
        "Ü": "U",
        "ù": "u",
        "ú": "u",
        "û": "u",
        "ü": "u",
        "Ý": "Y",
        "ý": "y",
        "ÿ": "y",
        "Æ": "Ae",
        "æ": "ae",
        "Þ": "Th",
        "þ": "th",
        "ß": "ss",
        "Ā": "A",
        "Ă": "A",
        "Ą": "A",
        "ā": "a",
        "ă": "a",
        "ą": "a",
        "Ć": "C",
        "Ĉ": "C",
        "Ċ": "C",
        "Č": "C",
        "ć": "c",
        "ĉ": "c",
        "ċ": "c",
        "č": "c",
        "Ď": "D",
        "Đ": "D",
        "ď": "d",
        "đ": "d",
        "Ē": "E",
        "Ĕ": "E",
        "Ė": "E",
        "Ę": "E",
        "Ě": "E",
        "ē": "e",
        "ĕ": "e",
        "ė": "e",
        "ę": "e",
        "ě": "e",
        "Ĝ": "G",
        "Ğ": "G",
        "Ġ": "G",
        "Ģ": "G",
        "ĝ": "g",
        "ğ": "g",
        "ġ": "g",
        "ģ": "g",
        "Ĥ": "H",
        "Ħ": "H",
        "ĥ": "h",
        "ħ": "h",
        "Ĩ": "I",
        "Ī": "I",
        "Ĭ": "I",
        "Į": "I",
        "İ": "I",
        "ĩ": "i",
        "ī": "i",
        "ĭ": "i",
        "į": "i",
        "ı": "i",
        "Ĵ": "J",
        "ĵ": "j",
        "Ķ": "K",
        "ķ": "k",
        "ĸ": "k",
        "Ĺ": "L",
        "Ļ": "L",
        "Ľ": "L",
        "Ŀ": "L",
        "Ł": "L",
        "ĺ": "l",
        "ļ": "l",
        "ľ": "l",
        "ŀ": "l",
        "ł": "l",
        "Ń": "N",
        "Ņ": "N",
        "Ň": "N",
        "Ŋ": "N",
        "ń": "n",
        "ņ": "n",
        "ň": "n",
        "ŋ": "n",
        "Ō": "O",
        "Ŏ": "O",
        "Ő": "O",
        "ō": "o",
        "ŏ": "o",
        "ő": "o",
        "Ŕ": "R",
        "Ŗ": "R",
        "Ř": "R",
        "ŕ": "r",
        "ŗ": "r",
        "ř": "r",
        "Ś": "S",
        "Ŝ": "S",
        "Ş": "S",
        "Š": "S",
        "ś": "s",
        "ŝ": "s",
        "ş": "s",
        "š": "s",
        "Ţ": "T",
        "Ť": "T",
        "Ŧ": "T",
        "ţ": "t",
        "ť": "t",
        "ŧ": "t",
        "Ũ": "U",
        "Ū": "U",
        "Ŭ": "U",
        "Ů": "U",
        "Ű": "U",
        "Ų": "U",
        "ũ": "u",
        "ū": "u",
        "ŭ": "u",
        "ů": "u",
        "ű": "u",
        "ų": "u",
        "Ŵ": "W",
        "ŵ": "w",
        "Ŷ": "Y",
        "ŷ": "y",
        "Ÿ": "Y",
        "Ź": "Z",
        "Ż": "Z",
        "Ž": "Z",
        "ź": "z",
        "ż": "z",
        "ž": "z",
        "Ĳ": "IJ",
        "ĳ": "ij",
        "Œ": "Oe",
        "œ": "oe",
        "ŉ": "'n",
        "ſ": "s"
      }),
      tn = Qt({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      });

    function nn(e) {
      return "\\" + at[e]
    }

    function rn(e) {
      return et.test(e)
    }

    function on(e) {
      var t = -1,
        n = Array(e.size);
      return e.forEach((function (e, r) {
        n[++t] = [r, e]
      })), n
    }

    function an(e, t) {
      return function (n) {
        return e(t(n))
      }
    }

    function sn(e, t) {
      for (var n = -1, o = e.length, i = 0, a = []; ++n < o;) {
        var s = e[n];
        s !== t && s !== r || (e[n] = r, a[i++] = n)
      }
      return a
    }

    function cn(e) {
      var t = -1,
        n = Array(e.size);
      return e.forEach((function (e) {
        n[++t] = e
      })), n
    }

    function un(e) {
      return rn(e) ? function (e) {
        for (var t = Xe.lastIndex = 0; Xe.test(e);) ++t;
        return t
      }(e) : Rt(e)
    }

    function ln(e) {
      return rn(e) ? function (e) {
        return e.match(Xe) || []
      }(e) : function (e) {
        return e.split("")
      }(e)
    }

    function fn(e) {
      for (var t = e.length; t-- && re.test(e.charAt(t)););
      return t
    }
    var pn = Qt({
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'"
      }),
      dn = function re(we) {
        var Se, xe = (we = null == we ? ft : dn.defaults(ft.Object(), we, dn.pick(ft, nt))).Array,
          Ae = we.Date,
          _e = we.Error,
          Pe = we.Function,
          ke = we.Math,
          Te = we.Object,
          Ee = we.RegExp,
          Ie = we.String,
          Oe = we.TypeError,
          Ce = xe.prototype,
          Be = Pe.prototype,
          je = Te.prototype,
          De = we["__core-js_shared__"],
          Ne = Be.toString,
          Re = je.hasOwnProperty,
          Le = 0,
          Me = (Se = /[^.]+$/.exec(De && De.keys && De.keys.IE_PROTO || "")) ? "Symbol(src)_1." + Se : "",
          Fe = je.toString,
          Ue = Ne.call(Te),
          qe = ft._,
          $e = Ee("^" + Ne.call(Re).replace(ee, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"),
          ze = ht ? we.Buffer : e,
          Qe = we.Symbol,
          He = we.Uint8Array,
          We = ze ? ze.allocUnsafe : e,
          Ve = an(Te.getPrototypeOf, Te),
          Ke = Te.create,
          Je = je.propertyIsEnumerable,
          Xe = Ce.splice,
          et = Qe ? Qe.isConcatSpreadable : e,
          at = Qe ? Qe.iterator : e,
          ut = Qe ? Qe.toStringTag : e,
          lt = function () {
            try {
              var e = pi(Te, "defineProperty");
              return e({}, "", {}), e
            } catch (Vs) {}
          }(),
          pt = we.clearTimeout !== ft.clearTimeout && we.clearTimeout,
          dt = Ae && Ae.now !== ft.Date.now && Ae.now,
          gt = we.setTimeout !== ft.setTimeout && we.setTimeout,
          yt = ke.ceil,
          Rt = ke.floor,
          Qt = Te.getOwnPropertySymbols,
          hn = ze ? ze.isBuffer : e,
          gn = we.isFinite,
          yn = Ce.join,
          mn = an(Te.keys, Te),
          bn = ke.max,
          vn = ke.min,
          wn = Ae.now,
          Sn = we.parseInt,
          xn = ke.random,
          An = Ce.reverse,
          _n = pi(we, "DataView"),
          Pn = pi(we, "Map"),
          kn = pi(we, "Promise"),
          Tn = pi(we, "Set"),
          En = pi(we, "WeakMap"),
          In = pi(Te, "create"),
          On = En && new En,
          Cn = {},
          Bn = qi(_n),
          jn = qi(Pn),
          Dn = qi(kn),
          Nn = qi(Tn),
          Rn = qi(En),
          Ln = Qe ? Qe.prototype : e,
          Mn = Ln ? Ln.valueOf : e,
          Fn = Ln ? Ln.toString : e;

        function Un(e) {
          if (os(e) && !Va(e) && !(e instanceof Qn)) {
            if (e instanceof zn) return e;
            if (Re.call(e, "__wrapped__")) return $i(e)
          }
          return new zn(e)
        }
        var qn = function () {
          function t() {}
          return function (n) {
            if (!rs(n)) return {};
            if (Ke) return Ke(n);
            t.prototype = n;
            var r = new t;
            return t.prototype = e, r
          }
        }();

        function $n() {}

        function zn(t, n) {
          this.__wrapped__ = t, this.__actions__ = [], this.__chain__ = !!n, this.__index__ = 0, this.__values__ = e
        }

        function Qn(e) {
          this.__wrapped__ = e, this.__actions__ = [], this.__dir__ = 1, this.__filtered__ = !1, this.__iteratees__ = [], this.__takeCount__ = p, this.__views__ = []
        }

        function Hn(e) {
          var t = -1,
            n = null == e ? 0 : e.length;
          for (this.clear(); ++t < n;) {
            var r = e[t];
            this.set(r[0], r[1])
          }
        }

        function Wn(e) {
          var t = -1,
            n = null == e ? 0 : e.length;
          for (this.clear(); ++t < n;) {
            var r = e[t];
            this.set(r[0], r[1])
          }
        }

        function Vn(e) {
          var t = -1,
            n = null == e ? 0 : e.length;
          for (this.clear(); ++t < n;) {
            var r = e[t];
            this.set(r[0], r[1])
          }
        }

        function Kn(e) {
          var t = -1,
            n = null == e ? 0 : e.length;
          for (this.__data__ = new Vn; ++t < n;) this.add(e[t])
        }

        function Jn(e) {
          var t = this.__data__ = new Wn(e);
          this.size = t.size
        }

        function Gn(e, t) {
          var n = Va(e),
            r = !n && Wa(e),
            o = !n && !r && Ya(e),
            i = !n && !r && !o && ps(e),
            a = n || r || o || i,
            s = a ? Vt(e.length, Ie) : [],
            c = s.length;
          for (var u in e) !t && !Re.call(e, u) || a && ("length" == u || o && ("offset" == u || "parent" == u) || i && ("buffer" == u || "byteLength" == u || "byteOffset" == u) || vi(u, c)) || s.push(u);
          return s
        }

        function Yn(t) {
          var n = t.length;
          return n ? t[Kr(0, n - 1)] : e
        }

        function Xn(e, t) {
          return Ni(Oo(e), sr(t, 0, e.length))
        }

        function Zn(e) {
          return Ni(Oo(e))
        }

        function er(t, n, r) {
          (r !== e && !za(t[n], r) || r === e && !(n in t)) && ir(t, n, r)
        }

        function tr(t, n, r) {
          var o = t[n];
          Re.call(t, n) && za(o, r) && (r !== e || n in t) || ir(t, n, r)
        }

        function nr(e, t) {
          for (var n = e.length; n--;)
            if (za(e[n][0], t)) return n;
          return -1
        }

        function rr(e, t, n, r) {
          return pr(e, (function (e, o, i) {
            t(r, e, n(e), i)
          })), r
        }

        function or(e, t) {
          return e && Co(t, Ds(t), e)
        }

        function ir(e, t, n) {
          "__proto__" == t && lt ? lt(e, t, {
            configurable: !0,
            enumerable: !0,
            value: n,
            writable: !0
          }) : e[t] = n
        }

        function ar(t, n) {
          for (var r = -1, o = n.length, i = xe(o), a = null == t; ++r < o;) i[r] = a ? e : Is(t, n[r]);
          return i
        }

        function sr(t, n, r) {
          return t == t && (r !== e && (t = t <= r ? t : r), n !== e && (t = t >= n ? t : n)), t
        }

        function cr(t, n, r, o, i, a) {
          var s, c = 1 & n,
            u = 2 & n,
            l = 4 & n;
          if (r && (s = i ? r(t, o, i, a) : r(t)), s !== e) return s;
          if (!rs(t)) return t;
          var f = Va(t);
          if (f) {
            if (s = function (e) {
                var t = e.length,
                  n = new e.constructor(t);
                return t && "string" == typeof e[0] && Re.call(e, "index") && (n.index = e.index, n.input = e.input), n
              }(t), !c) return Oo(t, s)
          } else {
            var p = gi(t),
              d = p == v || p == w;
            if (Ya(t)) return _o(t, c);
            if (p == A || p == h || d && !i) {
              if (s = u || d ? {} : mi(t), !c) return u ? function (e, t) {
                return Co(e, hi(e), t)
              }(t, function (e, t) {
                return e && Co(t, Ns(t), e)
              }(s, t)) : function (e, t) {
                return Co(e, di(e), t)
              }(t, or(s, t))
            } else {
              if (!it[p]) return i ? t : {};
              s = function (e, t, n) {
                var r, o = e.constructor;
                switch (t) {
                  case O:
                    return Po(e);
                  case y:
                  case m:
                    return new o(+e);
                  case C:
                    return function (e, t) {
                      var n = t ? Po(e.buffer) : e.buffer;
                      return new e.constructor(n, e.byteOffset, e.byteLength)
                    }(e, n);
                  case B:
                  case j:
                  case D:
                  case N:
                  case R:
                  case L:
                  case M:
                  case F:
                  case U:
                    return ko(e, n);
                  case S:
                    return new o;
                  case x:
                  case T:
                    return new o(e);
                  case P:
                    return function (e) {
                      var t = new e.constructor(e.source, fe.exec(e));
                      return t.lastIndex = e.lastIndex, t
                    }(e);
                  case k:
                    return new o;
                  case E:
                    return r = e, Mn ? Te(Mn.call(r)) : {}
                }
              }(t, p, c)
            }
          }
          a || (a = new Jn);
          var g = a.get(t);
          if (g) return g;
          a.set(t, s), us(t) ? t.forEach((function (e) {
            s.add(cr(e, n, r, e, t, a))
          })) : is(t) && t.forEach((function (e, o) {
            s.set(o, cr(e, n, r, o, t, a))
          }));
          var b = f ? e : (l ? u ? ii : oi : u ? Ns : Ds)(t);
          return Pt(b || t, (function (e, o) {
            b && (e = t[o = e]), tr(s, o, cr(e, n, r, o, t, a))
          })), s
        }

        function ur(t, n, r) {
          var o = r.length;
          if (null == t) return !o;
          for (t = Te(t); o--;) {
            var i = r[o],
              a = n[i],
              s = t[i];
            if (s === e && !(i in t) || !a(s)) return !1
          }
          return !0
        }

        function lr(n, r, o) {
          if ("function" != typeof n) throw new Oe(t);
          return Ci((function () {
            n.apply(e, o)
          }), r)
        }

        function fr(e, t, n, r) {
          var o = -1,
            i = It,
            a = !0,
            s = e.length,
            c = [],
            u = t.length;
          if (!s) return c;
          n && (t = Ct(t, Jt(n))), r ? (i = Ot, a = !1) : t.length >= 200 && (i = Yt, a = !1, t = new Kn(t));
          e: for (; ++o < s;) {
            var l = e[o],
              f = null == n ? l : n(l);
            if (l = r || 0 !== l ? l : 0, a && f == f) {
              for (var p = u; p--;)
                if (t[p] === f) continue e;
              c.push(l)
            } else i(t, f, r) || c.push(l)
          }
          return c
        }
        Un.templateSettings = {
          escape: K,
          evaluate: J,
          interpolate: G,
          variable: "",
          imports: {
            _: Un
          }
        }, Un.prototype = $n.prototype, Un.prototype.constructor = Un, zn.prototype = qn($n.prototype), zn.prototype.constructor = zn, Qn.prototype = qn($n.prototype), Qn.prototype.constructor = Qn, Hn.prototype.clear = function () {
          this.__data__ = In ? In(null) : {}, this.size = 0
        }, Hn.prototype.delete = function (e) {
          var t = this.has(e) && delete this.__data__[e];
          return this.size -= t ? 1 : 0, t
        }, Hn.prototype.get = function (t) {
          var r = this.__data__;
          if (In) {
            var o = r[t];
            return o === n ? e : o
          }
          return Re.call(r, t) ? r[t] : e
        }, Hn.prototype.has = function (t) {
          var n = this.__data__;
          return In ? n[t] !== e : Re.call(n, t)
        }, Hn.prototype.set = function (t, r) {
          var o = this.__data__;
          return this.size += this.has(t) ? 0 : 1, o[t] = In && r === e ? n : r, this
        }, Wn.prototype.clear = function () {
          this.__data__ = [], this.size = 0
        }, Wn.prototype.delete = function (e) {
          var t = this.__data__,
            n = nr(t, e);
          return !(n < 0 || (n == t.length - 1 ? t.pop() : Xe.call(t, n, 1), --this.size, 0))
        }, Wn.prototype.get = function (t) {
          var n = this.__data__,
            r = nr(n, t);
          return r < 0 ? e : n[r][1]
        }, Wn.prototype.has = function (e) {
          return nr(this.__data__, e) > -1
        }, Wn.prototype.set = function (e, t) {
          var n = this.__data__,
            r = nr(n, e);
          return r < 0 ? (++this.size, n.push([e, t])) : n[r][1] = t, this
        }, Vn.prototype.clear = function () {
          this.size = 0, this.__data__ = {
            hash: new Hn,
            map: new(Pn || Wn),
            string: new Hn
          }
        }, Vn.prototype.delete = function (e) {
          var t = li(this, e).delete(e);
          return this.size -= t ? 1 : 0, t
        }, Vn.prototype.get = function (e) {
          return li(this, e).get(e)
        }, Vn.prototype.has = function (e) {
          return li(this, e).has(e)
        }, Vn.prototype.set = function (e, t) {
          var n = li(this, e),
            r = n.size;
          return n.set(e, t), this.size += n.size == r ? 0 : 1, this
        }, Kn.prototype.add = Kn.prototype.push = function (e) {
          return this.__data__.set(e, n), this
        }, Kn.prototype.has = function (e) {
          return this.__data__.has(e)
        }, Jn.prototype.clear = function () {
          this.__data__ = new Wn, this.size = 0
        }, Jn.prototype.delete = function (e) {
          var t = this.__data__,
            n = t.delete(e);
          return this.size = t.size, n
        }, Jn.prototype.get = function (e) {
          return this.__data__.get(e)
        }, Jn.prototype.has = function (e) {
          return this.__data__.has(e)
        }, Jn.prototype.set = function (e, t) {
          var n = this.__data__;
          if (n instanceof Wn) {
            var r = n.__data__;
            if (!Pn || r.length < 199) return r.push([e, t]), this.size = ++n.size, this;
            n = this.__data__ = new Vn(r)
          }
          return n.set(e, t), this.size = n.size, this
        };
        var pr = Do(wr),
          dr = Do(Sr, !0);

        function hr(e, t) {
          var n = !0;
          return pr(e, (function (e, r, o) {
            return n = !!t(e, r, o)
          })), n
        }

        function gr(t, n, r) {
          for (var o = -1, i = t.length; ++o < i;) {
            var a = t[o],
              s = n(a);
            if (null != s && (c === e ? s == s && !fs(s) : r(s, c))) var c = s,
              u = a
          }
          return u
        }

        function yr(e, t) {
          var n = [];
          return pr(e, (function (e, r, o) {
            t(e, r, o) && n.push(e)
          })), n
        }

        function mr(e, t, n, r, o) {
          var i = -1,
            a = e.length;
          for (n || (n = bi), o || (o = []); ++i < a;) {
            var s = e[i];
            t > 0 && n(s) ? t > 1 ? mr(s, t - 1, n, r, o) : Bt(o, s) : r || (o[o.length] = s)
          }
          return o
        }
        var br = No(),
          vr = No(!0);

        function wr(e, t) {
          return e && br(e, t, Ds)
        }

        function Sr(e, t) {
          return e && vr(e, t, Ds)
        }

        function xr(e, t) {
          return Et(t, (function (t) {
            return es(e[t])
          }))
        }

        function Ar(t, n) {
          for (var r = 0, o = (n = wo(n, t)).length; null != t && r < o;) t = t[Ui(n[r++])];
          return r && r == o ? t : e
        }

        function _r(e, t, n) {
          var r = t(e);
          return Va(e) ? r : Bt(r, n(e))
        }

        function Pr(t) {
          return null == t ? t === e ? "[object Undefined]" : "[object Null]" : ut && ut in Te(t) ? function (t) {
            var n = Re.call(t, ut),
              r = t[ut];
            try {
              t[ut] = e;
              var o = !0
            } catch (Vs) {}
            var i = Fe.call(t);
            return o && (n ? t[ut] = r : delete t[ut]), i
          }(t) : function (e) {
            return Fe.call(e)
          }(t)
        }

        function kr(e, t) {
          return e > t
        }

        function Tr(e, t) {
          return null != e && Re.call(e, t)
        }

        function Er(e, t) {
          return null != e && t in Te(e)
        }

        function Ir(t, n, r) {
          for (var o = r ? Ot : It, i = t[0].length, a = t.length, s = a, c = xe(a), u = 1 / 0, l = []; s--;) {
            var f = t[s];
            s && n && (f = Ct(f, Jt(n))), u = vn(f.length, u), c[s] = !r && (n || i >= 120 && f.length >= 120) ? new Kn(s && f) : e
          }
          f = t[0];
          var p = -1,
            d = c[0];
          e: for (; ++p < i && l.length < u;) {
            var h = f[p],
              g = n ? n(h) : h;
            if (h = r || 0 !== h ? h : 0, !(d ? Yt(d, g) : o(l, g, r))) {
              for (s = a; --s;) {
                var y = c[s];
                if (!(y ? Yt(y, g) : o(t[s], g, r))) continue e
              }
              d && d.push(g), l.push(h)
            }
          }
          return l
        }

        function Or(t, n, r) {
          var o = null == (t = Ei(t, n = wo(n, t))) ? t : t[Ui(Zi(n))];
          return null == o ? e : At(o, t, r)
        }

        function Cr(e) {
          return os(e) && Pr(e) == h
        }

        function Br(t, n, r, o, i) {
          return t === n || (null == t || null == n || !os(t) && !os(n) ? t != t && n != n : function (t, n, r, o, i, a) {
            var s = Va(t),
              c = Va(n),
              u = s ? g : gi(t),
              l = c ? g : gi(n),
              f = (u = u == h ? A : u) == A,
              p = (l = l == h ? A : l) == A,
              d = u == l;
            if (d && Ya(t)) {
              if (!Ya(n)) return !1;
              s = !0, f = !1
            }
            if (d && !f) return a || (a = new Jn), s || ps(t) ? ni(t, n, r, o, i, a) : function (e, t, n, r, o, i, a) {
              switch (n) {
                case C:
                  if (e.byteLength != t.byteLength || e.byteOffset != t.byteOffset) return !1;
                  e = e.buffer, t = t.buffer;
                case O:
                  return !(e.byteLength != t.byteLength || !i(new He(e), new He(t)));
                case y:
                case m:
                case x:
                  return za(+e, +t);
                case b:
                  return e.name == t.name && e.message == t.message;
                case P:
                case T:
                  return e == t + "";
                case S:
                  var s = on;
                case k:
                  var c = 1 & r;
                  if (s || (s = cn), e.size != t.size && !c) return !1;
                  var u = a.get(e);
                  if (u) return u == t;
                  r |= 2, a.set(e, t);
                  var l = ni(s(e), s(t), r, o, i, a);
                  return a.delete(e), l;
                case E:
                  if (Mn) return Mn.call(e) == Mn.call(t)
              }
              return !1
            }(t, n, u, r, o, i, a);
            if (!(1 & r)) {
              var v = f && Re.call(t, "__wrapped__"),
                w = p && Re.call(n, "__wrapped__");
              if (v || w) {
                var _ = v ? t.value() : t,
                  I = w ? n.value() : n;
                return a || (a = new Jn), i(_, I, r, o, a)
              }
            }
            return !!d && (a || (a = new Jn), function (t, n, r, o, i, a) {
              var s = 1 & r,
                c = oi(t),
                u = c.length,
                l = oi(n),
                f = l.length;
              if (u != f && !s) return !1;
              for (var p = u; p--;) {
                var d = c[p];
                if (!(s ? d in n : Re.call(n, d))) return !1
              }
              var h = a.get(t),
                g = a.get(n);
              if (h && g) return h == n && g == t;
              var y = !0;
              a.set(t, n), a.set(n, t);
              for (var m = s; ++p < u;) {
                var b = t[d = c[p]],
                  v = n[d];
                if (o) var w = s ? o(v, b, d, n, t, a) : o(b, v, d, t, n, a);
                if (!(w === e ? b === v || i(b, v, r, o, a) : w)) {
                  y = !1;
                  break
                }
                m || (m = "constructor" == d)
              }
              if (y && !m) {
                var S = t.constructor,
                  x = n.constructor;
                S == x || !("constructor" in t) || !("constructor" in n) || "function" == typeof S && S instanceof S && "function" == typeof x && x instanceof x || (y = !1)
              }
              return a.delete(t), a.delete(n), y
            }(t, n, r, o, i, a))
          }(t, n, r, o, Br, i))
        }

        function jr(t, n, r, o) {
          var i = r.length,
            a = i,
            s = !o;
          if (null == t) return !a;
          for (t = Te(t); i--;) {
            var c = r[i];
            if (s && c[2] ? c[1] !== t[c[0]] : !(c[0] in t)) return !1
          }
          for (; ++i < a;) {
            var u = (c = r[i])[0],
              l = t[u],
              f = c[1];
            if (s && c[2]) {
              if (l === e && !(u in t)) return !1
            } else {
              var p = new Jn;
              if (o) var d = o(l, f, u, t, n, p);
              if (!(d === e ? Br(f, l, 3, o, p) : d)) return !1
            }
          }
          return !0
        }

        function Dr(e) {
          return !(!rs(e) || (t = e, Me && Me in t)) && (es(e) ? $e : he).test(qi(e));
          var t
        }

        function Nr(e) {
          return "function" == typeof e ? e : null == e ? sc : "object" == typeof e ? Va(e) ? qr(e[0], e[1]) : Ur(e) : yc(e)
        }

        function Rr(e) {
          if (!_i(e)) return mn(e);
          var t = [];
          for (var n in Te(e)) Re.call(e, n) && "constructor" != n && t.push(n);
          return t
        }

        function Lr(e) {
          if (!rs(e)) return function (e) {
            var t = [];
            if (null != e)
              for (var n in Te(e)) t.push(n);
            return t
          }(e);
          var t = _i(e),
            n = [];
          for (var r in e)("constructor" != r || !t && Re.call(e, r)) && n.push(r);
          return n
        }

        function Mr(e, t) {
          return e < t
        }

        function Fr(e, t) {
          var n = -1,
            r = Ja(e) ? xe(e.length) : [];
          return pr(e, (function (e, o, i) {
            r[++n] = t(e, o, i)
          })), r
        }

        function Ur(e) {
          var t = fi(e);
          return 1 == t.length && t[0][2] ? ki(t[0][0], t[0][1]) : function (n) {
            return n === e || jr(n, e, t)
          }
        }

        function qr(t, n) {
          return Si(t) && Pi(n) ? ki(Ui(t), n) : function (r) {
            var o = Is(r, t);
            return o === e && o === n ? Os(r, t) : Br(n, o, 3)
          }
        }

        function $r(t, n, r, o, i) {
          t !== n && br(n, (function (a, s) {
            if (i || (i = new Jn), rs(a)) ! function (t, n, r, o, i, a, s) {
              var c = Ii(t, r),
                u = Ii(n, r),
                l = s.get(u);
              if (l) er(t, r, l);
              else {
                var f = a ? a(c, u, r + "", t, n, s) : e,
                  p = f === e;
                if (p) {
                  var d = Va(u),
                    h = !d && Ya(u),
                    g = !d && !h && ps(u);
                  f = u, d || h || g ? Va(c) ? f = c : Ga(c) ? f = Oo(c) : h ? (p = !1, f = _o(u, !0)) : g ? (p = !1, f = ko(u, !0)) : f = [] : ss(u) || Wa(u) ? (f = c, Wa(c) ? f = ws(c) : rs(c) && !es(c) || (f = mi(u))) : p = !1
                }
                p && (s.set(u, f), i(f, u, o, a, s), s.delete(u)), er(t, r, f)
              }
            }(t, n, s, r, $r, o, i);
            else {
              var c = o ? o(Ii(t, s), a, s + "", t, n, i) : e;
              c === e && (c = a), er(t, s, c)
            }
          }), Ns)
        }

        function zr(t, n) {
          var r = t.length;
          if (r) return vi(n += n < 0 ? r : 0, r) ? t[n] : e
        }

        function Qr(e, t, n) {
          t = t.length ? Ct(t, (function (e) {
            return Va(e) ? function (t) {
              return Ar(t, 1 === e.length ? e[0] : e)
            } : e
          })) : [sc];
          var r = -1;
          return t = Ct(t, Jt(ui())),
            function (e, t) {
              var n = e.length;
              for (e.sort(t); n--;) e[n] = e[n].value;
              return e
            }(Fr(e, (function (e, n, o) {
              return {
                criteria: Ct(t, (function (t) {
                  return t(e)
                })),
                index: ++r,
                value: e
              }
            })), (function (e, t) {
              return function (e, t, n) {
                for (var r = -1, o = e.criteria, i = t.criteria, a = o.length, s = n.length; ++r < a;) {
                  var c = To(o[r], i[r]);
                  if (c) return r >= s ? c : c * ("desc" == n[r] ? -1 : 1)
                }
                return e.index - t.index
              }(e, t, n)
            }))
        }

        function Hr(e, t, n) {
          for (var r = -1, o = t.length, i = {}; ++r < o;) {
            var a = t[r],
              s = Ar(e, a);
            n(s, a) && Zr(i, wo(a, e), s)
          }
          return i
        }

        function Wr(e, t, n, r) {
          var o = r ? Ut : Ft,
            i = -1,
            a = t.length,
            s = e;
          for (e === t && (t = Oo(t)), n && (s = Ct(e, Jt(n))); ++i < a;)
            for (var c = 0, u = t[i], l = n ? n(u) : u;
              (c = o(s, l, c, r)) > -1;) s !== e && Xe.call(s, c, 1), Xe.call(e, c, 1);
          return e
        }

        function Vr(e, t) {
          for (var n = e ? t.length : 0, r = n - 1; n--;) {
            var o = t[n];
            if (n == r || o !== i) {
              var i = o;
              vi(o) ? Xe.call(e, o, 1) : fo(e, o)
            }
          }
          return e
        }

        function Kr(e, t) {
          return e + Rt(xn() * (t - e + 1))
        }

        function Jr(e, t) {
          var n = "";
          if (!e || t < 1 || t > l) return n;
          do {
            t % 2 && (n += e), (t = Rt(t / 2)) && (e += e)
          } while (t);
          return n
        }

        function Gr(e, t) {
          return Bi(Ti(e, t, sc), e + "")
        }

        function Yr(e) {
          return Yn(zs(e))
        }

        function Xr(e, t) {
          var n = zs(e);
          return Ni(n, sr(t, 0, n.length))
        }

        function Zr(t, n, r, o) {
          if (!rs(t)) return t;
          for (var i = -1, a = (n = wo(n, t)).length, s = a - 1, c = t; null != c && ++i < a;) {
            var u = Ui(n[i]),
              l = r;
            if ("__proto__" === u || "constructor" === u || "prototype" === u) return t;
            if (i != s) {
              var f = c[u];
              (l = o ? o(f, u, c) : e) === e && (l = rs(f) ? f : vi(n[i + 1]) ? [] : {})
            }
            tr(c, u, l), c = c[u]
          }
          return t
        }
        var eo = On ? function (e, t) {
            return On.set(e, t), e
          } : sc,
          to = lt ? function (e, t) {
            return lt(e, "toString", {
              configurable: !0,
              enumerable: !1,
              value: oc(t),
              writable: !0
            })
          } : sc;

        function no(e) {
          return Ni(zs(e))
        }

        function ro(e, t, n) {
          var r = -1,
            o = e.length;
          t < 0 && (t = -t > o ? 0 : o + t), (n = n > o ? o : n) < 0 && (n += o), o = t > n ? 0 : n - t >>> 0, t >>>= 0;
          for (var i = xe(o); ++r < o;) i[r] = e[r + t];
          return i
        }

        function oo(e, t) {
          var n;
          return pr(e, (function (e, r, o) {
            return !(n = t(e, r, o))
          })), !!n
        }

        function io(e, t, n) {
          var r = 0,
            o = null == e ? r : e.length;
          if ("number" == typeof t && t == t && o <= 2147483647) {
            for (; r < o;) {
              var i = r + o >>> 1,
                a = e[i];
              null !== a && !fs(a) && (n ? a <= t : a < t) ? r = i + 1 : o = i
            }
            return o
          }
          return ao(e, t, sc, n)
        }

        function ao(t, n, r, o) {
          var i = 0,
            a = null == t ? 0 : t.length;
          if (0 === a) return 0;
          for (var s = (n = r(n)) != n, c = null === n, u = fs(n), l = n === e; i < a;) {
            var f = Rt((i + a) / 2),
              p = r(t[f]),
              d = p !== e,
              h = null === p,
              g = p == p,
              y = fs(p);
            if (s) var m = o || g;
            else m = l ? g && (o || d) : c ? g && d && (o || !h) : u ? g && d && !h && (o || !y) : !h && !y && (o ? p <= n : p < n);
            m ? i = f + 1 : a = f
          }
          return vn(a, 4294967294)
        }

        function so(e, t) {
          for (var n = -1, r = e.length, o = 0, i = []; ++n < r;) {
            var a = e[n],
              s = t ? t(a) : a;
            if (!n || !za(s, c)) {
              var c = s;
              i[o++] = 0 === a ? 0 : a
            }
          }
          return i
        }

        function co(e) {
          return "number" == typeof e ? e : fs(e) ? f : +e
        }

        function uo(e) {
          if ("string" == typeof e) return e;
          if (Va(e)) return Ct(e, uo) + "";
          if (fs(e)) return Fn ? Fn.call(e) : "";
          var t = e + "";
          return "0" == t && 1 / e == -1 / 0 ? "-0" : t
        }

        function lo(e, t, n) {
          var r = -1,
            o = It,
            i = e.length,
            a = !0,
            s = [],
            c = s;
          if (n) a = !1, o = Ot;
          else if (i >= 200) {
            var u = t ? null : Go(e);
            if (u) return cn(u);
            a = !1, o = Yt, c = new Kn
          } else c = t ? [] : s;
          e: for (; ++r < i;) {
            var l = e[r],
              f = t ? t(l) : l;
            if (l = n || 0 !== l ? l : 0, a && f == f) {
              for (var p = c.length; p--;)
                if (c[p] === f) continue e;
              t && c.push(f), s.push(l)
            } else o(c, f, n) || (c !== s && c.push(f), s.push(l))
          }
          return s
        }

        function fo(e, t) {
          return null == (e = Ei(e, t = wo(t, e))) || delete e[Ui(Zi(t))]
        }

        function po(e, t, n, r) {
          return Zr(e, t, n(Ar(e, t)), r)
        }

        function ho(e, t, n, r) {
          for (var o = e.length, i = r ? o : -1;
            (r ? i-- : ++i < o) && t(e[i], i, e););
          return n ? ro(e, r ? 0 : i, r ? i + 1 : o) : ro(e, r ? i + 1 : 0, r ? o : i)
        }

        function go(e, t) {
          var n = e;
          return n instanceof Qn && (n = n.value()), jt(t, (function (e, t) {
            return t.func.apply(t.thisArg, Bt([e], t.args))
          }), n)
        }

        function yo(e, t, n) {
          var r = e.length;
          if (r < 2) return r ? lo(e[0]) : [];
          for (var o = -1, i = xe(r); ++o < r;)
            for (var a = e[o], s = -1; ++s < r;) s != o && (i[o] = fr(i[o] || a, e[s], t, n));
          return lo(mr(i, 1), t, n)
        }

        function mo(t, n, r) {
          for (var o = -1, i = t.length, a = n.length, s = {}; ++o < i;) {
            var c = o < a ? n[o] : e;
            r(s, t[o], c)
          }
          return s
        }

        function bo(e) {
          return Ga(e) ? e : []
        }

        function vo(e) {
          return "function" == typeof e ? e : sc
        }

        function wo(e, t) {
          return Va(e) ? e : Si(e, t) ? [e] : Fi(Ss(e))
        }
        var So = Gr;

        function xo(t, n, r) {
          var o = t.length;
          return r = r === e ? o : r, !n && r >= o ? t : ro(t, n, r)
        }
        var Ao = pt || function (e) {
          return ft.clearTimeout(e)
        };

        function _o(e, t) {
          if (t) return e.slice();
          var n = e.length,
            r = We ? We(n) : new e.constructor(n);
          return e.copy(r), r
        }

        function Po(e) {
          var t = new e.constructor(e.byteLength);
          return new He(t).set(new He(e)), t
        }

        function ko(e, t) {
          var n = t ? Po(e.buffer) : e.buffer;
          return new e.constructor(n, e.byteOffset, e.length)
        }

        function To(t, n) {
          if (t !== n) {
            var r = t !== e,
              o = null === t,
              i = t == t,
              a = fs(t),
              s = n !== e,
              c = null === n,
              u = n == n,
              l = fs(n);
            if (!c && !l && !a && t > n || a && s && u && !c && !l || o && s && u || !r && u || !i) return 1;
            if (!o && !a && !l && t < n || l && r && i && !o && !a || c && r && i || !s && i || !u) return -1
          }
          return 0
        }

        function Eo(e, t, n, r) {
          for (var o = -1, i = e.length, a = n.length, s = -1, c = t.length, u = bn(i - a, 0), l = xe(c + u), f = !r; ++s < c;) l[s] = t[s];
          for (; ++o < a;)(f || o < i) && (l[n[o]] = e[o]);
          for (; u--;) l[s++] = e[o++];
          return l
        }

        function Io(e, t, n, r) {
          for (var o = -1, i = e.length, a = -1, s = n.length, c = -1, u = t.length, l = bn(i - s, 0), f = xe(l + u), p = !r; ++o < l;) f[o] = e[o];
          for (var d = o; ++c < u;) f[d + c] = t[c];
          for (; ++a < s;)(p || o < i) && (f[d + n[a]] = e[o++]);
          return f
        }

        function Oo(e, t) {
          var n = -1,
            r = e.length;
          for (t || (t = xe(r)); ++n < r;) t[n] = e[n];
          return t
        }

        function Co(t, n, r, o) {
          var i = !r;
          r || (r = {});
          for (var a = -1, s = n.length; ++a < s;) {
            var c = n[a],
              u = o ? o(r[c], t[c], c, r, t) : e;
            u === e && (u = t[c]), i ? ir(r, c, u) : tr(r, c, u)
          }
          return r
        }

        function Bo(e, t) {
          return function (n, r) {
            var o = Va(n) ? _t : rr,
              i = t ? t() : {};
            return o(n, e, ui(r, 2), i)
          }
        }

        function jo(t) {
          return Gr((function (n, r) {
            var o = -1,
              i = r.length,
              a = i > 1 ? r[i - 1] : e,
              s = i > 2 ? r[2] : e;
            for (a = t.length > 3 && "function" == typeof a ? (i--, a) : e, s && wi(r[0], r[1], s) && (a = i < 3 ? e : a, i = 1), n = Te(n); ++o < i;) {
              var c = r[o];
              c && t(n, c, o, a)
            }
            return n
          }))
        }

        function Do(e, t) {
          return function (n, r) {
            if (null == n) return n;
            if (!Ja(n)) return e(n, r);
            for (var o = n.length, i = t ? o : -1, a = Te(n);
              (t ? i-- : ++i < o) && !1 !== r(a[i], i, a););
            return n
          }
        }

        function No(e) {
          return function (t, n, r) {
            for (var o = -1, i = Te(t), a = r(t), s = a.length; s--;) {
              var c = a[e ? s : ++o];
              if (!1 === n(i[c], c, i)) break
            }
            return t
          }
        }

        function Ro(t) {
          return function (n) {
            var r = rn(n = Ss(n)) ? ln(n) : e,
              o = r ? r[0] : n.charAt(0),
              i = r ? xo(r, 1).join("") : n.slice(1);
            return o[t]() + i
          }
        }

        function Lo(e) {
          return function (t) {
            return jt(tc(Ws(t).replace(Ge, "")), e, "")
          }
        }

        function Mo(e) {
          return function () {
            var t = arguments;
            switch (t.length) {
              case 0:
                return new e;
              case 1:
                return new e(t[0]);
              case 2:
                return new e(t[0], t[1]);
              case 3:
                return new e(t[0], t[1], t[2]);
              case 4:
                return new e(t[0], t[1], t[2], t[3]);
              case 5:
                return new e(t[0], t[1], t[2], t[3], t[4]);
              case 6:
                return new e(t[0], t[1], t[2], t[3], t[4], t[5]);
              case 7:
                return new e(t[0], t[1], t[2], t[3], t[4], t[5], t[6])
            }
            var n = qn(e.prototype),
              r = e.apply(n, t);
            return rs(r) ? r : n
          }
        }

        function Fo(t) {
          return function (n, r, o) {
            var i = Te(n);
            if (!Ja(n)) {
              var a = ui(r, 3);
              n = Ds(n), r = function (e) {
                return a(i[e], e, i)
              }
            }
            var s = t(n, r, o);
            return s > -1 ? i[a ? n[s] : s] : e
          }
        }

        function Uo(n) {
          return ri((function (r) {
            var o = r.length,
              i = o,
              a = zn.prototype.thru;
            for (n && r.reverse(); i--;) {
              var s = r[i];
              if ("function" != typeof s) throw new Oe(t);
              if (a && !c && "wrapper" == si(s)) var c = new zn([], !0)
            }
            for (i = c ? i : o; ++i < o;) {
              var u = si(s = r[i]),
                l = "wrapper" == u ? ai(s) : e;
              c = l && xi(l[0]) && 424 == l[1] && !l[4].length && 1 == l[9] ? c[si(l[0])].apply(c, l[3]) : 1 == s.length && xi(s) ? c[u]() : c.thru(s)
            }
            return function () {
              var e = arguments,
                t = e[0];
              if (c && 1 == e.length && Va(t)) return c.plant(t).value();
              for (var n = 0, i = o ? r[n].apply(this, e) : t; ++n < o;) i = r[n].call(this, i);
              return i
            }
          }))
        }

        function qo(t, n, r, o, i, a, c, u, l, f) {
          var p = n & s,
            d = 1 & n,
            h = 2 & n,
            g = 24 & n,
            y = 512 & n,
            m = h ? e : Mo(t);
          return function s() {
            for (var b = arguments.length, v = xe(b), w = b; w--;) v[w] = arguments[w];
            if (g) var S = ci(s),
              x = function (e, t) {
                for (var n = e.length, r = 0; n--;) e[n] === t && ++r;
                return r
              }(v, S);
            if (o && (v = Eo(v, o, i, g)), a && (v = Io(v, a, c, g)), b -= x, g && b < f) {
              var A = sn(v, S);
              return Ko(t, n, qo, s.placeholder, r, v, A, u, l, f - b)
            }
            var _ = d ? r : this,
              P = h ? _[t] : t;
            return b = v.length, u ? v = function (t, n) {
              for (var r = t.length, o = vn(n.length, r), i = Oo(t); o--;) {
                var a = n[o];
                t[o] = vi(a, r) ? i[a] : e
              }
              return t
            }(v, u) : y && b > 1 && v.reverse(), p && l < b && (v.length = l), this && this !== ft && this instanceof s && (P = m || Mo(P)), P.apply(_, v)
          }
        }

        function $o(e, t) {
          return function (n, r) {
            return function (e, t, n, r) {
              return wr(e, (function (e, o, i) {
                t(r, n(e), o, i)
              })), r
            }(n, e, t(r), {})
          }
        }

        function zo(t, n) {
          return function (r, o) {
            var i;
            if (r === e && o === e) return n;
            if (r !== e && (i = r), o !== e) {
              if (i === e) return o;
              "string" == typeof r || "string" == typeof o ? (r = uo(r), o = uo(o)) : (r = co(r), o = co(o)), i = t(r, o)
            }
            return i
          }
        }

        function Qo(e) {
          return ri((function (t) {
            return t = Ct(t, Jt(ui())), Gr((function (n) {
              var r = this;
              return e(t, (function (e) {
                return At(e, r, n)
              }))
            }))
          }))
        }

        function Ho(t, n) {
          var r = (n = n === e ? " " : uo(n)).length;
          if (r < 2) return r ? Jr(n, t) : n;
          var o = Jr(n, yt(t / un(n)));
          return rn(n) ? xo(ln(o), 0, t).join("") : o.slice(0, t)
        }

        function Wo(t) {
          return function (n, r, o) {
            return o && "number" != typeof o && wi(n, r, o) && (r = o = e), n = ys(n), r === e ? (r = n, n = 0) : r = ys(r),
              function (e, t, n, r) {
                for (var o = -1, i = bn(yt((t - e) / (n || 1)), 0), a = xe(i); i--;) a[r ? i : ++o] = e, e += n;
                return a
              }(n, r, o = o === e ? n < r ? 1 : -1 : ys(o), t)
          }
        }

        function Vo(e) {
          return function (t, n) {
            return "string" == typeof t && "string" == typeof n || (t = vs(t), n = vs(n)), e(t, n)
          }
        }

        function Ko(t, n, r, o, s, c, u, l, f, p) {
          var d = 8 & n;
          n |= d ? i : a, 4 & (n &= ~(d ? a : i)) || (n &= -4);
          var h = [t, n, s, d ? c : e, d ? u : e, d ? e : c, d ? e : u, l, f, p],
            g = r.apply(e, h);
          return xi(t) && Oi(g, h), g.placeholder = o, ji(g, t, n)
        }

        function Jo(e) {
          var t = ke[e];
          return function (e, n) {
            if (e = vs(e), (n = null == n ? 0 : vn(ms(n), 292)) && gn(e)) {
              var r = (Ss(e) + "e").split("e");
              return +((r = (Ss(t(r[0] + "e" + (+r[1] + n))) + "e").split("e"))[0] + "e" + (+r[1] - n))
            }
            return t(e)
          }
        }
        var Go = Tn && 1 / cn(new Tn([, -0]))[1] == u ? function (e) {
          return new Tn(e)
        } : pc;

        function Yo(e) {
          return function (t) {
            var n = gi(t);
            return n == S ? on(t) : n == k ? function (e) {
              var t = -1,
                n = Array(e.size);
              return e.forEach((function (e) {
                n[++t] = [e, e]
              })), n
            }(t) : function (e, t) {
              return Ct(t, (function (t) {
                return [t, e[t]]
              }))
            }(t, e(t))
          }
        }

        function Xo(n, u, l, f, p, d, h, g) {
          var y = 2 & u;
          if (!y && "function" != typeof n) throw new Oe(t);
          var m = f ? f.length : 0;
          if (m || (u &= -97, f = p = e), h = h === e ? h : bn(ms(h), 0), g = g === e ? g : ms(g), m -= p ? p.length : 0, u & a) {
            var b = f,
              v = p;
            f = p = e
          }
          var w = y ? e : ai(n),
            S = [n, u, l, f, p, b, v, d, h, g];
          if (w && function (e, t) {
              var n = e[1],
                o = t[1],
                i = n | o,
                a = i < 131,
                u = o == s && 8 == n || o == s && n == c && e[7].length <= t[8] || 384 == o && t[7].length <= t[8] && 8 == n;
              if (!a && !u) return e;
              1 & o && (e[2] = t[2], i |= 1 & n ? 0 : 4);
              var l = t[3];
              if (l) {
                var f = e[3];
                e[3] = f ? Eo(f, l, t[4]) : l, e[4] = f ? sn(e[3], r) : t[4]
              }(l = t[5]) && (f = e[5], e[5] = f ? Io(f, l, t[6]) : l, e[6] = f ? sn(e[5], r) : t[6]), (l = t[7]) && (e[7] = l), o & s && (e[8] = null == e[8] ? t[8] : vn(e[8], t[8])), null == e[9] && (e[9] = t[9]), e[0] = t[0], e[1] = i
            }(S, w), n = S[0], u = S[1], l = S[2], f = S[3], p = S[4], !(g = S[9] = S[9] === e ? y ? 0 : n.length : bn(S[9] - m, 0)) && 24 & u && (u &= -25), u && 1 != u) x = 8 == u || u == o ? function (t, n, r) {
            var o = Mo(t);
            return function i() {
              for (var a = arguments.length, s = xe(a), c = a, u = ci(i); c--;) s[c] = arguments[c];
              var l = a < 3 && s[0] !== u && s[a - 1] !== u ? [] : sn(s, u);
              return (a -= l.length) < r ? Ko(t, n, qo, i.placeholder, e, s, l, e, e, r - a) : At(this && this !== ft && this instanceof i ? o : t, this, s)
            }
          }(n, u, g) : u != i && 33 != u || p.length ? qo.apply(e, S) : function (e, t, n, r) {
            var o = 1 & t,
              i = Mo(e);
            return function t() {
              for (var a = -1, s = arguments.length, c = -1, u = r.length, l = xe(u + s), f = this && this !== ft && this instanceof t ? i : e; ++c < u;) l[c] = r[c];
              for (; s--;) l[c++] = arguments[++a];
              return At(f, o ? n : this, l)
            }
          }(n, u, l, f);
          else var x = function (e, t, n) {
            var r = 1 & t,
              o = Mo(e);
            return function t() {
              return (this && this !== ft && this instanceof t ? o : e).apply(r ? n : this, arguments)
            }
          }(n, u, l);
          return ji((w ? eo : Oi)(x, S), n, u)
        }

        function Zo(t, n, r, o) {
          return t === e || za(t, je[r]) && !Re.call(o, r) ? n : t
        }

        function ei(t, n, r, o, i, a) {
          return rs(t) && rs(n) && (a.set(n, t), $r(t, n, e, ei, a), a.delete(n)), t
        }

        function ti(t) {
          return ss(t) ? e : t
        }

        function ni(t, n, r, o, i, a) {
          var s = 1 & r,
            c = t.length,
            u = n.length;
          if (c != u && !(s && u > c)) return !1;
          var l = a.get(t),
            f = a.get(n);
          if (l && f) return l == n && f == t;
          var p = -1,
            d = !0,
            h = 2 & r ? new Kn : e;
          for (a.set(t, n), a.set(n, t); ++p < c;) {
            var g = t[p],
              y = n[p];
            if (o) var m = s ? o(y, g, p, n, t, a) : o(g, y, p, t, n, a);
            if (m !== e) {
              if (m) continue;
              d = !1;
              break
            }
            if (h) {
              if (!Nt(n, (function (e, t) {
                  if (!Yt(h, t) && (g === e || i(g, e, r, o, a))) return h.push(t)
                }))) {
                d = !1;
                break
              }
            } else if (g !== y && !i(g, y, r, o, a)) {
              d = !1;
              break
            }
          }
          return a.delete(t), a.delete(n), d
        }

        function ri(t) {
          return Bi(Ti(t, e, Ki), t + "")
        }

        function oi(e) {
          return _r(e, Ds, di)
        }

        function ii(e) {
          return _r(e, Ns, hi)
        }
        var ai = On ? function (e) {
          return On.get(e)
        } : pc;

        function si(e) {
          for (var t = e.name + "", n = Cn[t], r = Re.call(Cn, t) ? n.length : 0; r--;) {
            var o = n[r],
              i = o.func;
            if (null == i || i == e) return o.name
          }
          return t
        }

        function ci(e) {
          return (Re.call(Un, "placeholder") ? Un : e).placeholder
        }

        function ui() {
          var e = Un.iteratee || cc;
          return e = e === cc ? Nr : e, arguments.length ? e(arguments[0], arguments[1]) : e
        }

        function li(e, t) {
          var n, r, o = e.__data__;
          return ("string" == (r = typeof (n = t)) || "number" == r || "symbol" == r || "boolean" == r ? "__proto__" !== n : null === n) ? o["string" == typeof t ? "string" : "hash"] : o.map
        }

        function fi(e) {
          for (var t = Ds(e), n = t.length; n--;) {
            var r = t[n],
              o = e[r];
            t[n] = [r, o, Pi(o)]
          }
          return t
        }

        function pi(t, n) {
          var r = function (t, n) {
            return null == t ? e : t[n]
          }(t, n);
          return Dr(r) ? r : e
        }
        var di = Qt ? function (e) {
            return null == e ? [] : (e = Te(e), Et(Qt(e), (function (t) {
              return Je.call(e, t)
            })))
          } : vc,
          hi = Qt ? function (e) {
            for (var t = []; e;) Bt(t, di(e)), e = Ve(e);
            return t
          } : vc,
          gi = Pr;

        function yi(e, t, n) {
          for (var r = -1, o = (t = wo(t, e)).length, i = !1; ++r < o;) {
            var a = Ui(t[r]);
            if (!(i = null != e && n(e, a))) break;
            e = e[a]
          }
          return i || ++r != o ? i : !!(o = null == e ? 0 : e.length) && ns(o) && vi(a, o) && (Va(e) || Wa(e))
        }

        function mi(e) {
          return "function" != typeof e.constructor || _i(e) ? {} : qn(Ve(e))
        }

        function bi(e) {
          return Va(e) || Wa(e) || !!(et && e && e[et])
        }

        function vi(e, t) {
          var n = typeof e;
          return !!(t = null == t ? l : t) && ("number" == n || "symbol" != n && ye.test(e)) && e > -1 && e % 1 == 0 && e < t
        }

        function wi(e, t, n) {
          if (!rs(n)) return !1;
          var r = typeof t;
          return !!("number" == r ? Ja(n) && vi(t, n.length) : "string" == r && t in n) && za(n[t], e)
        }

        function Si(e, t) {
          if (Va(e)) return !1;
          var n = typeof e;
          return !("number" != n && "symbol" != n && "boolean" != n && null != e && !fs(e)) || X.test(e) || !Y.test(e) || null != t && e in Te(t)
        }

        function xi(e) {
          var t = si(e),
            n = Un[t];
          if ("function" != typeof n || !(t in Qn.prototype)) return !1;
          if (e === n) return !0;
          var r = ai(n);
          return !!r && e === r[0]
        }(_n && gi(new _n(new ArrayBuffer(1))) != C || Pn && gi(new Pn) != S || kn && gi(kn.resolve()) != _ || Tn && gi(new Tn) != k || En && gi(new En) != I) && (gi = function (t) {
          var n = Pr(t),
            r = n == A ? t.constructor : e,
            o = r ? qi(r) : "";
          if (o) switch (o) {
            case Bn:
              return C;
            case jn:
              return S;
            case Dn:
              return _;
            case Nn:
              return k;
            case Rn:
              return I
          }
          return n
        });
        var Ai = De ? es : wc;

        function _i(e) {
          var t = e && e.constructor;
          return e === ("function" == typeof t && t.prototype || je)
        }

        function Pi(e) {
          return e == e && !rs(e)
        }

        function ki(t, n) {
          return function (r) {
            return null != r && r[t] === n && (n !== e || t in Te(r))
          }
        }

        function Ti(t, n, r) {
          return n = bn(n === e ? t.length - 1 : n, 0),
            function () {
              for (var e = arguments, o = -1, i = bn(e.length - n, 0), a = xe(i); ++o < i;) a[o] = e[n + o];
              o = -1;
              for (var s = xe(n + 1); ++o < n;) s[o] = e[o];
              return s[n] = r(a), At(t, this, s)
            }
        }

        function Ei(e, t) {
          return t.length < 2 ? e : Ar(e, ro(t, 0, -1))
        }

        function Ii(e, t) {
          if (("constructor" !== t || "function" != typeof e[t]) && "__proto__" != t) return e[t]
        }
        var Oi = Di(eo),
          Ci = gt || function (e, t) {
            return ft.setTimeout(e, t)
          },
          Bi = Di(to);

        function ji(e, t, n) {
          var r = t + "";
          return Bi(e, function (e, t) {
            var n = t.length;
            if (!n) return e;
            var r = n - 1;
            return t[r] = (n > 1 ? "& " : "") + t[r], t = t.join(n > 2 ? ", " : " "), e.replace(oe, "{\n/* [wrapped with " + t + "] */\n")
          }(r, function (e, t) {
            return Pt(d, (function (n) {
              var r = "_." + n[0];
              t & n[1] && !It(e, r) && e.push(r)
            })), e.sort()
          }(function (e) {
            var t = e.match(ie);
            return t ? t[1].split(ae) : []
          }(r), n)))
        }

        function Di(t) {
          var n = 0,
            r = 0;
          return function () {
            var o = wn(),
              i = 16 - (o - r);
            if (r = o, i > 0) {
              if (++n >= 800) return arguments[0]
            } else n = 0;
            return t.apply(e, arguments)
          }
        }

        function Ni(t, n) {
          var r = -1,
            o = t.length,
            i = o - 1;
          for (n = n === e ? o : n; ++r < n;) {
            var a = Kr(r, i),
              s = t[a];
            t[a] = t[r], t[r] = s
          }
          return t.length = n, t
        }
        var Ri, Li, Mi, Fi = (Ri = function (e) {
          var t = [];
          return 46 === e.charCodeAt(0) && t.push(""), e.replace(Z, (function (e, n, r, o) {
            t.push(r ? o.replace(ue, "$1") : n || e)
          })), t
        }, Li = La(Ri, (function (e) {
          return 500 === Mi.size && Mi.clear(), e
        })), Mi = Li.cache, Li);

        function Ui(e) {
          if ("string" == typeof e || fs(e)) return e;
          var t = e + "";
          return "0" == t && 1 / e == -1 / 0 ? "-0" : t
        }

        function qi(e) {
          if (null != e) {
            try {
              return Ne.call(e)
            } catch (Vs) {}
            try {
              return e + ""
            } catch (Vs) {}
          }
          return ""
        }

        function $i(e) {
          if (e instanceof Qn) return e.clone();
          var t = new zn(e.__wrapped__, e.__chain__);
          return t.__actions__ = Oo(e.__actions__), t.__index__ = e.__index__, t.__values__ = e.__values__, t
        }
        var zi = Gr((function (e, t) {
            return Ga(e) ? fr(e, mr(t, 1, Ga, !0)) : []
          })),
          Qi = Gr((function (t, n) {
            var r = Zi(n);
            return Ga(r) && (r = e), Ga(t) ? fr(t, mr(n, 1, Ga, !0), ui(r, 2)) : []
          })),
          Hi = Gr((function (t, n) {
            var r = Zi(n);
            return Ga(r) && (r = e), Ga(t) ? fr(t, mr(n, 1, Ga, !0), e, r) : []
          }));

        function Wi(e, t, n) {
          var r = null == e ? 0 : e.length;
          if (!r) return -1;
          var o = null == n ? 0 : ms(n);
          return o < 0 && (o = bn(r + o, 0)), Mt(e, ui(t, 3), o)
        }

        function Vi(t, n, r) {
          var o = null == t ? 0 : t.length;
          if (!o) return -1;
          var i = o - 1;
          return r !== e && (i = ms(r), i = r < 0 ? bn(o + i, 0) : vn(i, o - 1)), Mt(t, ui(n, 3), i, !0)
        }

        function Ki(e) {
          return null != e && e.length ? mr(e, 1) : []
        }

        function Ji(t) {
          return t && t.length ? t[0] : e
        }
        var Gi = Gr((function (e) {
            var t = Ct(e, bo);
            return t.length && t[0] === e[0] ? Ir(t) : []
          })),
          Yi = Gr((function (t) {
            var n = Zi(t),
              r = Ct(t, bo);
            return n === Zi(r) ? n = e : r.pop(), r.length && r[0] === t[0] ? Ir(r, ui(n, 2)) : []
          })),
          Xi = Gr((function (t) {
            var n = Zi(t),
              r = Ct(t, bo);
            return (n = "function" == typeof n ? n : e) && r.pop(), r.length && r[0] === t[0] ? Ir(r, e, n) : []
          }));

        function Zi(t) {
          var n = null == t ? 0 : t.length;
          return n ? t[n - 1] : e
        }
        var ea = Gr(ta);

        function ta(e, t) {
          return e && e.length && t && t.length ? Wr(e, t) : e
        }
        var na = ri((function (e, t) {
          var n = null == e ? 0 : e.length,
            r = ar(e, t);
          return Vr(e, Ct(t, (function (e) {
            return vi(e, n) ? +e : e
          })).sort(To)), r
        }));

        function ra(e) {
          return null == e ? e : An.call(e)
        }
        var oa = Gr((function (e) {
            return lo(mr(e, 1, Ga, !0))
          })),
          ia = Gr((function (t) {
            var n = Zi(t);
            return Ga(n) && (n = e), lo(mr(t, 1, Ga, !0), ui(n, 2))
          })),
          aa = Gr((function (t) {
            var n = Zi(t);
            return n = "function" == typeof n ? n : e, lo(mr(t, 1, Ga, !0), e, n)
          }));

        function sa(e) {
          if (!e || !e.length) return [];
          var t = 0;
          return e = Et(e, (function (e) {
            if (Ga(e)) return t = bn(e.length, t), !0
          })), Vt(t, (function (t) {
            return Ct(e, zt(t))
          }))
        }

        function ca(t, n) {
          if (!t || !t.length) return [];
          var r = sa(t);
          return null == n ? r : Ct(r, (function (t) {
            return At(n, e, t)
          }))
        }
        var ua = Gr((function (e, t) {
            return Ga(e) ? fr(e, t) : []
          })),
          la = Gr((function (e) {
            return yo(Et(e, Ga))
          })),
          fa = Gr((function (t) {
            var n = Zi(t);
            return Ga(n) && (n = e), yo(Et(t, Ga), ui(n, 2))
          })),
          pa = Gr((function (t) {
            var n = Zi(t);
            return n = "function" == typeof n ? n : e, yo(Et(t, Ga), e, n)
          })),
          da = Gr(sa),
          ha = Gr((function (t) {
            var n = t.length,
              r = n > 1 ? t[n - 1] : e;
            return r = "function" == typeof r ? (t.pop(), r) : e, ca(t, r)
          }));

        function ga(e) {
          var t = Un(e);
          return t.__chain__ = !0, t
        }

        function ya(e, t) {
          return t(e)
        }
        var ma = ri((function (t) {
            var n = t.length,
              r = n ? t[0] : 0,
              o = this.__wrapped__,
              i = function (e) {
                return ar(e, t)
              };
            return !(n > 1 || this.__actions__.length) && o instanceof Qn && vi(r) ? ((o = o.slice(r, +r + (n ? 1 : 0))).__actions__.push({
              func: ya,
              args: [i],
              thisArg: e
            }), new zn(o, this.__chain__).thru((function (t) {
              return n && !t.length && t.push(e), t
            }))) : this.thru(i)
          })),
          ba = Bo((function (e, t, n) {
            Re.call(e, n) ? ++e[n] : ir(e, n, 1)
          })),
          va = Fo(Wi),
          wa = Fo(Vi);

        function Sa(e, t) {
          return (Va(e) ? Pt : pr)(e, ui(t, 3))
        }

        function xa(e, t) {
          return (Va(e) ? kt : dr)(e, ui(t, 3))
        }
        var Aa = Bo((function (e, t, n) {
            Re.call(e, n) ? e[n].push(t) : ir(e, n, [t])
          })),
          _a = Gr((function (e, t, n) {
            var r = -1,
              o = "function" == typeof t,
              i = Ja(e) ? xe(e.length) : [];
            return pr(e, (function (e) {
              i[++r] = o ? At(t, e, n) : Or(e, t, n)
            })), i
          })),
          Pa = Bo((function (e, t, n) {
            ir(e, n, t)
          }));

        function ka(e, t) {
          return (Va(e) ? Ct : Fr)(e, ui(t, 3))
        }
        var Ta = Bo((function (e, t, n) {
            e[n ? 0 : 1].push(t)
          }), (function () {
            return [
              [],
              []
            ]
          })),
          Ea = Gr((function (e, t) {
            if (null == e) return [];
            var n = t.length;
            return n > 1 && wi(e, t[0], t[1]) ? t = [] : n > 2 && wi(t[0], t[1], t[2]) && (t = [t[0]]), Qr(e, mr(t, 1), [])
          })),
          Ia = dt || function () {
            return ft.Date.now()
          };

        function Oa(t, n, r) {
          return n = r ? e : n, n = t && null == n ? t.length : n, Xo(t, s, e, e, e, e, n)
        }

        function Ca(n, r) {
          var o;
          if ("function" != typeof r) throw new Oe(t);
          return n = ms(n),
            function () {
              return --n > 0 && (o = r.apply(this, arguments)), n <= 1 && (r = e), o
            }
        }
        var Ba = Gr((function (e, t, n) {
            var r = 1;
            if (n.length) {
              var o = sn(n, ci(Ba));
              r |= i
            }
            return Xo(e, r, t, n, o)
          })),
          ja = Gr((function (e, t, n) {
            var r = 3;
            if (n.length) {
              var o = sn(n, ci(ja));
              r |= i
            }
            return Xo(t, r, e, n, o)
          }));

        function Da(n, r, o) {
          var i, a, s, c, u, l, f = 0,
            p = !1,
            d = !1,
            h = !0;
          if ("function" != typeof n) throw new Oe(t);

          function g(t) {
            var r = i,
              o = a;
            return i = a = e, f = t, c = n.apply(o, r)
          }

          function y(t) {
            var n = t - l;
            return l === e || n >= r || n < 0 || d && t - f >= s
          }

          function m() {
            var e = Ia();
            if (y(e)) return b(e);
            u = Ci(m, function (e) {
              var t = r - (e - l);
              return d ? vn(t, s - (e - f)) : t
            }(e))
          }

          function b(t) {
            return u = e, h && i ? g(t) : (i = a = e, c)
          }

          function v() {
            var t = Ia(),
              n = y(t);
            if (i = arguments, a = this, l = t, n) {
              if (u === e) return function (e) {
                return f = e, u = Ci(m, r), p ? g(e) : c
              }(l);
              if (d) return Ao(u), u = Ci(m, r), g(l)
            }
            return u === e && (u = Ci(m, r)), c
          }
          return r = vs(r) || 0, rs(o) && (p = !!o.leading, s = (d = "maxWait" in o) ? bn(vs(o.maxWait) || 0, r) : s, h = "trailing" in o ? !!o.trailing : h), v.cancel = function () {
            u !== e && Ao(u), f = 0, i = l = a = u = e
          }, v.flush = function () {
            return u === e ? c : b(Ia())
          }, v
        }
        var Na = Gr((function (e, t) {
            return lr(e, 1, t)
          })),
          Ra = Gr((function (e, t, n) {
            return lr(e, vs(t) || 0, n)
          }));

        function La(e, n) {
          if ("function" != typeof e || null != n && "function" != typeof n) throw new Oe(t);
          var r = function () {
            var t = arguments,
              o = n ? n.apply(this, t) : t[0],
              i = r.cache;
            if (i.has(o)) return i.get(o);
            var a = e.apply(this, t);
            return r.cache = i.set(o, a) || i, a
          };
          return r.cache = new(La.Cache || Vn), r
        }

        function Ma(e) {
          if ("function" != typeof e) throw new Oe(t);
          return function () {
            var t = arguments;
            switch (t.length) {
              case 0:
                return !e.call(this);
              case 1:
                return !e.call(this, t[0]);
              case 2:
                return !e.call(this, t[0], t[1]);
              case 3:
                return !e.call(this, t[0], t[1], t[2])
            }
            return !e.apply(this, t)
          }
        }
        La.Cache = Vn;
        var Fa = So((function (e, t) {
            var n = (t = 1 == t.length && Va(t[0]) ? Ct(t[0], Jt(ui())) : Ct(mr(t, 1), Jt(ui()))).length;
            return Gr((function (r) {
              for (var o = -1, i = vn(r.length, n); ++o < i;) r[o] = t[o].call(this, r[o]);
              return At(e, this, r)
            }))
          })),
          Ua = Gr((function (t, n) {
            var r = sn(n, ci(Ua));
            return Xo(t, i, e, n, r)
          })),
          qa = Gr((function (t, n) {
            var r = sn(n, ci(qa));
            return Xo(t, a, e, n, r)
          })),
          $a = ri((function (t, n) {
            return Xo(t, c, e, e, e, n)
          }));

        function za(e, t) {
          return e === t || e != e && t != t
        }
        var Qa = Vo(kr),
          Ha = Vo((function (e, t) {
            return e >= t
          })),
          Wa = Cr(function () {
            return arguments
          }()) ? Cr : function (e) {
            return os(e) && Re.call(e, "callee") && !Je.call(e, "callee")
          },
          Va = xe.isArray,
          Ka = mt ? Jt(mt) : function (e) {
            return os(e) && Pr(e) == O
          };

        function Ja(e) {
          return null != e && ns(e.length) && !es(e)
        }

        function Ga(e) {
          return os(e) && Ja(e)
        }
        var Ya = hn || wc,
          Xa = bt ? Jt(bt) : function (e) {
            return os(e) && Pr(e) == m
          };

        function Za(e) {
          if (!os(e)) return !1;
          var t = Pr(e);
          return t == b || "[object DOMException]" == t || "string" == typeof e.message && "string" == typeof e.name && !ss(e)
        }

        function es(e) {
          if (!rs(e)) return !1;
          var t = Pr(e);
          return t == v || t == w || "[object AsyncFunction]" == t || "[object Proxy]" == t
        }

        function ts(e) {
          return "number" == typeof e && e == ms(e)
        }

        function ns(e) {
          return "number" == typeof e && e > -1 && e % 1 == 0 && e <= l
        }

        function rs(e) {
          var t = typeof e;
          return null != e && ("object" == t || "function" == t)
        }

        function os(e) {
          return null != e && "object" == typeof e
        }
        var is = vt ? Jt(vt) : function (e) {
          return os(e) && gi(e) == S
        };

        function as(e) {
          return "number" == typeof e || os(e) && Pr(e) == x
        }

        function ss(e) {
          if (!os(e) || Pr(e) != A) return !1;
          var t = Ve(e);
          if (null === t) return !0;
          var n = Re.call(t, "constructor") && t.constructor;
          return "function" == typeof n && n instanceof n && Ne.call(n) == Ue
        }
        var cs = wt ? Jt(wt) : function (e) {
            return os(e) && Pr(e) == P
          },
          us = St ? Jt(St) : function (e) {
            return os(e) && gi(e) == k
          };

        function ls(e) {
          return "string" == typeof e || !Va(e) && os(e) && Pr(e) == T
        }

        function fs(e) {
          return "symbol" == typeof e || os(e) && Pr(e) == E
        }
        var ps = xt ? Jt(xt) : function (e) {
            return os(e) && ns(e.length) && !!ot[Pr(e)]
          },
          ds = Vo(Mr),
          hs = Vo((function (e, t) {
            return e <= t
          }));

        function gs(e) {
          if (!e) return [];
          if (Ja(e)) return ls(e) ? ln(e) : Oo(e);
          if (at && e[at]) return function (e) {
            for (var t, n = []; !(t = e.next()).done;) n.push(t.value);
            return n
          }(e[at]());
          var t = gi(e);
          return (t == S ? on : t == k ? cn : zs)(e)
        }

        function ys(e) {
          return e ? (e = vs(e)) === u || e === -1 / 0 ? 17976931348623157e292 * (e < 0 ? -1 : 1) : e == e ? e : 0 : 0 === e ? e : 0
        }

        function ms(e) {
          var t = ys(e),
            n = t % 1;
          return t == t ? n ? t - n : t : 0
        }

        function bs(e) {
          return e ? sr(ms(e), 0, p) : 0
        }

        function vs(e) {
          if ("number" == typeof e) return e;
          if (fs(e)) return f;
          if (rs(e)) {
            var t = "function" == typeof e.valueOf ? e.valueOf() : e;
            e = rs(t) ? t + "" : t
          }
          if ("string" != typeof e) return 0 === e ? e : +e;
          e = Kt(e);
          var n = de.test(e);
          return n || ge.test(e) ? ct(e.slice(2), n ? 2 : 8) : pe.test(e) ? f : +e
        }

        function ws(e) {
          return Co(e, Ns(e))
        }

        function Ss(e) {
          return null == e ? "" : uo(e)
        }
        var xs = jo((function (e, t) {
            if (_i(t) || Ja(t)) Co(t, Ds(t), e);
            else
              for (var n in t) Re.call(t, n) && tr(e, n, t[n])
          })),
          As = jo((function (e, t) {
            Co(t, Ns(t), e)
          })),
          _s = jo((function (e, t, n, r) {
            Co(t, Ns(t), e, r)
          })),
          Ps = jo((function (e, t, n, r) {
            Co(t, Ds(t), e, r)
          })),
          ks = ri(ar),
          Ts = Gr((function (t, n) {
            t = Te(t);
            var r = -1,
              o = n.length,
              i = o > 2 ? n[2] : e;
            for (i && wi(n[0], n[1], i) && (o = 1); ++r < o;)
              for (var a = n[r], s = Ns(a), c = -1, u = s.length; ++c < u;) {
                var l = s[c],
                  f = t[l];
                (f === e || za(f, je[l]) && !Re.call(t, l)) && (t[l] = a[l])
              }
            return t
          })),
          Es = Gr((function (t) {
            return t.push(e, ei), At(Ls, e, t)
          }));

        function Is(t, n, r) {
          var o = null == t ? e : Ar(t, n);
          return o === e ? r : o
        }

        function Os(e, t) {
          return null != e && yi(e, t, Er)
        }
        var Cs = $o((function (e, t, n) {
            null != t && "function" != typeof t.toString && (t = Fe.call(t)), e[t] = n
          }), oc(sc)),
          Bs = $o((function (e, t, n) {
            null != t && "function" != typeof t.toString && (t = Fe.call(t)), Re.call(e, t) ? e[t].push(n) : e[t] = [n]
          }), ui),
          js = Gr(Or);

        function Ds(e) {
          return Ja(e) ? Gn(e) : Rr(e)
        }

        function Ns(e) {
          return Ja(e) ? Gn(e, !0) : Lr(e)
        }
        var Rs = jo((function (e, t, n) {
            $r(e, t, n)
          })),
          Ls = jo((function (e, t, n, r) {
            $r(e, t, n, r)
          })),
          Ms = ri((function (e, t) {
            var n = {};
            if (null == e) return n;
            var r = !1;
            t = Ct(t, (function (t) {
              return t = wo(t, e), r || (r = t.length > 1), t
            })), Co(e, ii(e), n), r && (n = cr(n, 7, ti));
            for (var o = t.length; o--;) fo(n, t[o]);
            return n
          })),
          Fs = ri((function (e, t) {
            return null == e ? {} : function (e, t) {
              return Hr(e, t, (function (t, n) {
                return Os(e, n)
              }))
            }(e, t)
          }));

        function Us(e, t) {
          if (null == e) return {};
          var n = Ct(ii(e), (function (e) {
            return [e]
          }));
          return t = ui(t), Hr(e, n, (function (e, n) {
            return t(e, n[0])
          }))
        }
        var qs = Yo(Ds),
          $s = Yo(Ns);

        function zs(e) {
          return null == e ? [] : Gt(e, Ds(e))
        }
        var Qs = Lo((function (e, t, n) {
          return t = t.toLowerCase(), e + (n ? Hs(t) : t)
        }));

        function Hs(e) {
          return ec(Ss(e).toLowerCase())
        }

        function Ws(e) {
          return (e = Ss(e)) && e.replace(me, en).replace(Ye, "")
        }
        var Ks = Lo((function (e, t, n) {
            return e + (n ? "-" : "") + t.toLowerCase()
          })),
          Js = Lo((function (e, t, n) {
            return e + (n ? " " : "") + t.toLowerCase()
          })),
          Gs = Ro("toLowerCase"),
          Ys = Lo((function (e, t, n) {
            return e + (n ? "_" : "") + t.toLowerCase()
          })),
          Xs = Lo((function (e, t, n) {
            return e + (n ? " " : "") + ec(t)
          })),
          Zs = Lo((function (e, t, n) {
            return e + (n ? " " : "") + t.toUpperCase()
          })),
          ec = Ro("toUpperCase");

        function tc(t, n, r) {
          return t = Ss(t), (n = r ? e : n) === e ? function (e) {
            return tt.test(e)
          }(t) ? function (e) {
            return e.match(Ze) || []
          }(t) : function (e) {
            return e.match(se) || []
          }(t) : t.match(n) || []
        }
        var nc = Gr((function (t, n) {
            try {
              return At(t, e, n)
            } catch (Vs) {
              return Za(Vs) ? Vs : new _e(Vs)
            }
          })),
          rc = ri((function (e, t) {
            return Pt(t, (function (t) {
              t = Ui(t), ir(e, t, Ba(e[t], e))
            })), e
          }));

        function oc(e) {
          return function () {
            return e
          }
        }
        var ic = Uo(),
          ac = Uo(!0);

        function sc(e) {
          return e
        }

        function cc(e) {
          return Nr("function" == typeof e ? e : cr(e, 1))
        }
        var uc = Gr((function (e, t) {
            return function (n) {
              return Or(n, e, t)
            }
          })),
          lc = Gr((function (e, t) {
            return function (n) {
              return Or(e, n, t)
            }
          }));

        function fc(e, t, n) {
          var r = Ds(t),
            o = xr(t, r);
          null != n || rs(t) && (o.length || !r.length) || (n = t, t = e, e = this, o = xr(t, Ds(t)));
          var i = !(rs(n) && "chain" in n && !n.chain),
            a = es(e);
          return Pt(o, (function (n) {
            var r = t[n];
            e[n] = r, a && (e.prototype[n] = function () {
              var t = this.__chain__;
              if (i || t) {
                var n = e(this.__wrapped__);
                return (n.__actions__ = Oo(this.__actions__)).push({
                  func: r,
                  args: arguments,
                  thisArg: e
                }), n.__chain__ = t, n
              }
              return r.apply(e, Bt([this.value()], arguments))
            })
          })), e
        }

        function pc() {}
        var dc = Qo(Ct),
          hc = Qo(Tt),
          gc = Qo(Nt);

        function yc(e) {
          return Si(e) ? zt(Ui(e)) : function (e) {
            return function (t) {
              return Ar(t, e)
            }
          }(e)
        }
        var mc = Wo(),
          bc = Wo(!0);

        function vc() {
          return []
        }

        function wc() {
          return !1
        }
        var Sc, xc = zo((function (e, t) {
            return e + t
          }), 0),
          Ac = Jo("ceil"),
          _c = zo((function (e, t) {
            return e / t
          }), 1),
          Pc = Jo("floor"),
          kc = zo((function (e, t) {
            return e * t
          }), 1),
          Tc = Jo("round"),
          Ec = zo((function (e, t) {
            return e - t
          }), 0);
        return Un.after = function (e, n) {
          if ("function" != typeof n) throw new Oe(t);
          return e = ms(e),
            function () {
              if (--e < 1) return n.apply(this, arguments)
            }
        }, Un.ary = Oa, Un.assign = xs, Un.assignIn = As, Un.assignInWith = _s, Un.assignWith = Ps, Un.at = ks, Un.before = Ca, Un.bind = Ba, Un.bindAll = rc, Un.bindKey = ja, Un.castArray = function () {
          if (!arguments.length) return [];
          var e = arguments[0];
          return Va(e) ? e : [e]
        }, Un.chain = ga, Un.chunk = function (t, n, r) {
          n = (r ? wi(t, n, r) : n === e) ? 1 : bn(ms(n), 0);
          var o = null == t ? 0 : t.length;
          if (!o || n < 1) return [];
          for (var i = 0, a = 0, s = xe(yt(o / n)); i < o;) s[a++] = ro(t, i, i += n);
          return s
        }, Un.compact = function (e) {
          for (var t = -1, n = null == e ? 0 : e.length, r = 0, o = []; ++t < n;) {
            var i = e[t];
            i && (o[r++] = i)
          }
          return o
        }, Un.concat = function () {
          var e = arguments.length;
          if (!e) return [];
          for (var t = xe(e - 1), n = arguments[0], r = e; r--;) t[r - 1] = arguments[r];
          return Bt(Va(n) ? Oo(n) : [n], mr(t, 1))
        }, Un.cond = function (e) {
          var n = null == e ? 0 : e.length,
            r = ui();
          return e = n ? Ct(e, (function (e) {
            if ("function" != typeof e[1]) throw new Oe(t);
            return [r(e[0]), e[1]]
          })) : [], Gr((function (t) {
            for (var r = -1; ++r < n;) {
              var o = e[r];
              if (At(o[0], this, t)) return At(o[1], this, t)
            }
          }))
        }, Un.conforms = function (e) {
          return function (e) {
            var t = Ds(e);
            return function (n) {
              return ur(n, e, t)
            }
          }(cr(e, 1))
        }, Un.constant = oc, Un.countBy = ba, Un.create = function (e, t) {
          var n = qn(e);
          return null == t ? n : or(n, t)
        }, Un.curry = function t(n, r, o) {
          var i = Xo(n, 8, e, e, e, e, e, r = o ? e : r);
          return i.placeholder = t.placeholder, i
        }, Un.curryRight = function t(n, r, i) {
          var a = Xo(n, o, e, e, e, e, e, r = i ? e : r);
          return a.placeholder = t.placeholder, a
        }, Un.debounce = Da, Un.defaults = Ts, Un.defaultsDeep = Es, Un.defer = Na, Un.delay = Ra, Un.difference = zi, Un.differenceBy = Qi, Un.differenceWith = Hi, Un.drop = function (t, n, r) {
          var o = null == t ? 0 : t.length;
          return o ? ro(t, (n = r || n === e ? 1 : ms(n)) < 0 ? 0 : n, o) : []
        }, Un.dropRight = function (t, n, r) {
          var o = null == t ? 0 : t.length;
          return o ? ro(t, 0, (n = o - (n = r || n === e ? 1 : ms(n))) < 0 ? 0 : n) : []
        }, Un.dropRightWhile = function (e, t) {
          return e && e.length ? ho(e, ui(t, 3), !0, !0) : []
        }, Un.dropWhile = function (e, t) {
          return e && e.length ? ho(e, ui(t, 3), !0) : []
        }, Un.fill = function (t, n, r, o) {
          var i = null == t ? 0 : t.length;
          return i ? (r && "number" != typeof r && wi(t, n, r) && (r = 0, o = i), function (t, n, r, o) {
            var i = t.length;
            for ((r = ms(r)) < 0 && (r = -r > i ? 0 : i + r), (o = o === e || o > i ? i : ms(o)) < 0 && (o += i), o = r > o ? 0 : bs(o); r < o;) t[r++] = n;
            return t
          }(t, n, r, o)) : []
        }, Un.filter = function (e, t) {
          return (Va(e) ? Et : yr)(e, ui(t, 3))
        }, Un.flatMap = function (e, t) {
          return mr(ka(e, t), 1)
        }, Un.flatMapDeep = function (e, t) {
          return mr(ka(e, t), u)
        }, Un.flatMapDepth = function (t, n, r) {
          return r = r === e ? 1 : ms(r), mr(ka(t, n), r)
        }, Un.flatten = Ki, Un.flattenDeep = function (e) {
          return null != e && e.length ? mr(e, u) : []
        }, Un.flattenDepth = function (t, n) {
          return null != t && t.length ? mr(t, n = n === e ? 1 : ms(n)) : []
        }, Un.flip = function (e) {
          return Xo(e, 512)
        }, Un.flow = ic, Un.flowRight = ac, Un.fromPairs = function (e) {
          for (var t = -1, n = null == e ? 0 : e.length, r = {}; ++t < n;) {
            var o = e[t];
            r[o[0]] = o[1]
          }
          return r
        }, Un.functions = function (e) {
          return null == e ? [] : xr(e, Ds(e))
        }, Un.functionsIn = function (e) {
          return null == e ? [] : xr(e, Ns(e))
        }, Un.groupBy = Aa, Un.initial = function (e) {
          return null != e && e.length ? ro(e, 0, -1) : []
        }, Un.intersection = Gi, Un.intersectionBy = Yi, Un.intersectionWith = Xi, Un.invert = Cs, Un.invertBy = Bs, Un.invokeMap = _a, Un.iteratee = cc, Un.keyBy = Pa, Un.keys = Ds, Un.keysIn = Ns, Un.map = ka, Un.mapKeys = function (e, t) {
          var n = {};
          return t = ui(t, 3), wr(e, (function (e, r, o) {
            ir(n, t(e, r, o), e)
          })), n
        }, Un.mapValues = function (e, t) {
          var n = {};
          return t = ui(t, 3), wr(e, (function (e, r, o) {
            ir(n, r, t(e, r, o))
          })), n
        }, Un.matches = function (e) {
          return Ur(cr(e, 1))
        }, Un.matchesProperty = function (e, t) {
          return qr(e, cr(t, 1))
        }, Un.memoize = La, Un.merge = Rs, Un.mergeWith = Ls, Un.method = uc, Un.methodOf = lc, Un.mixin = fc, Un.negate = Ma, Un.nthArg = function (e) {
          return e = ms(e), Gr((function (t) {
            return zr(t, e)
          }))
        }, Un.omit = Ms, Un.omitBy = function (e, t) {
          return Us(e, Ma(ui(t)))
        }, Un.once = function (e) {
          return Ca(2, e)
        }, Un.orderBy = function (t, n, r, o) {
          return null == t ? [] : (Va(n) || (n = null == n ? [] : [n]), Va(r = o ? e : r) || (r = null == r ? [] : [r]), Qr(t, n, r))
        }, Un.over = dc, Un.overArgs = Fa, Un.overEvery = hc, Un.overSome = gc, Un.partial = Ua, Un.partialRight = qa, Un.partition = Ta, Un.pick = Fs, Un.pickBy = Us, Un.property = yc, Un.propertyOf = function (t) {
          return function (n) {
            return null == t ? e : Ar(t, n)
          }
        }, Un.pull = ea, Un.pullAll = ta, Un.pullAllBy = function (e, t, n) {
          return e && e.length && t && t.length ? Wr(e, t, ui(n, 2)) : e
        }, Un.pullAllWith = function (t, n, r) {
          return t && t.length && n && n.length ? Wr(t, n, e, r) : t
        }, Un.pullAt = na, Un.range = mc, Un.rangeRight = bc, Un.rearg = $a, Un.reject = function (e, t) {
          return (Va(e) ? Et : yr)(e, Ma(ui(t, 3)))
        }, Un.remove = function (e, t) {
          var n = [];
          if (!e || !e.length) return n;
          var r = -1,
            o = [],
            i = e.length;
          for (t = ui(t, 3); ++r < i;) {
            var a = e[r];
            t(a, r, e) && (n.push(a), o.push(r))
          }
          return Vr(e, o), n
        }, Un.rest = function (n, r) {
          if ("function" != typeof n) throw new Oe(t);
          return Gr(n, r = r === e ? r : ms(r))
        }, Un.reverse = ra, Un.sampleSize = function (t, n, r) {
          return n = (r ? wi(t, n, r) : n === e) ? 1 : ms(n), (Va(t) ? Xn : Xr)(t, n)
        }, Un.set = function (e, t, n) {
          return null == e ? e : Zr(e, t, n)
        }, Un.setWith = function (t, n, r, o) {
          return o = "function" == typeof o ? o : e, null == t ? t : Zr(t, n, r, o)
        }, Un.shuffle = function (e) {
          return (Va(e) ? Zn : no)(e)
        }, Un.slice = function (t, n, r) {
          var o = null == t ? 0 : t.length;
          return o ? (r && "number" != typeof r && wi(t, n, r) ? (n = 0, r = o) : (n = null == n ? 0 : ms(n), r = r === e ? o : ms(r)), ro(t, n, r)) : []
        }, Un.sortBy = Ea, Un.sortedUniq = function (e) {
          return e && e.length ? so(e) : []
        }, Un.sortedUniqBy = function (e, t) {
          return e && e.length ? so(e, ui(t, 2)) : []
        }, Un.split = function (t, n, r) {
          return r && "number" != typeof r && wi(t, n, r) && (n = r = e), (r = r === e ? p : r >>> 0) ? (t = Ss(t)) && ("string" == typeof n || null != n && !cs(n)) && !(n = uo(n)) && rn(t) ? xo(ln(t), 0, r) : t.split(n, r) : []
        }, Un.spread = function (e, n) {
          if ("function" != typeof e) throw new Oe(t);
          return n = null == n ? 0 : bn(ms(n), 0), Gr((function (t) {
            var r = t[n],
              o = xo(t, 0, n);
            return r && Bt(o, r), At(e, this, o)
          }))
        }, Un.tail = function (e) {
          var t = null == e ? 0 : e.length;
          return t ? ro(e, 1, t) : []
        }, Un.take = function (t, n, r) {
          return t && t.length ? ro(t, 0, (n = r || n === e ? 1 : ms(n)) < 0 ? 0 : n) : []
        }, Un.takeRight = function (t, n, r) {
          var o = null == t ? 0 : t.length;
          return o ? ro(t, (n = o - (n = r || n === e ? 1 : ms(n))) < 0 ? 0 : n, o) : []
        }, Un.takeRightWhile = function (e, t) {
          return e && e.length ? ho(e, ui(t, 3), !1, !0) : []
        }, Un.takeWhile = function (e, t) {
          return e && e.length ? ho(e, ui(t, 3)) : []
        }, Un.tap = function (e, t) {
          return t(e), e
        }, Un.throttle = function (e, n, r) {
          var o = !0,
            i = !0;
          if ("function" != typeof e) throw new Oe(t);
          return rs(r) && (o = "leading" in r ? !!r.leading : o, i = "trailing" in r ? !!r.trailing : i), Da(e, n, {
            leading: o,
            maxWait: n,
            trailing: i
          })
        }, Un.thru = ya, Un.toArray = gs, Un.toPairs = qs, Un.toPairsIn = $s, Un.toPath = function (e) {
          return Va(e) ? Ct(e, Ui) : fs(e) ? [e] : Oo(Fi(Ss(e)))
        }, Un.toPlainObject = ws, Un.transform = function (e, t, n) {
          var r = Va(e),
            o = r || Ya(e) || ps(e);
          if (t = ui(t, 4), null == n) {
            var i = e && e.constructor;
            n = o ? r ? new i : [] : rs(e) && es(i) ? qn(Ve(e)) : {}
          }
          return (o ? Pt : wr)(e, (function (e, r, o) {
            return t(n, e, r, o)
          })), n
        }, Un.unary = function (e) {
          return Oa(e, 1)
        }, Un.union = oa, Un.unionBy = ia, Un.unionWith = aa, Un.uniq = function (e) {
          return e && e.length ? lo(e) : []
        }, Un.uniqBy = function (e, t) {
          return e && e.length ? lo(e, ui(t, 2)) : []
        }, Un.uniqWith = function (t, n) {
          return n = "function" == typeof n ? n : e, t && t.length ? lo(t, e, n) : []
        }, Un.unset = function (e, t) {
          return null == e || fo(e, t)
        }, Un.unzip = sa, Un.unzipWith = ca, Un.update = function (e, t, n) {
          return null == e ? e : po(e, t, vo(n))
        }, Un.updateWith = function (t, n, r, o) {
          return o = "function" == typeof o ? o : e, null == t ? t : po(t, n, vo(r), o)
        }, Un.values = zs, Un.valuesIn = function (e) {
          return null == e ? [] : Gt(e, Ns(e))
        }, Un.without = ua, Un.words = tc, Un.wrap = function (e, t) {
          return Ua(vo(t), e)
        }, Un.xor = la, Un.xorBy = fa, Un.xorWith = pa, Un.zip = da, Un.zipObject = function (e, t) {
          return mo(e || [], t || [], tr)
        }, Un.zipObjectDeep = function (e, t) {
          return mo(e || [], t || [], Zr)
        }, Un.zipWith = ha, Un.entries = qs, Un.entriesIn = $s, Un.extend = As, Un.extendWith = _s, fc(Un, Un), Un.add = xc, Un.attempt = nc, Un.camelCase = Qs, Un.capitalize = Hs, Un.ceil = Ac, Un.clamp = function (t, n, r) {
          return r === e && (r = n, n = e), r !== e && (r = (r = vs(r)) == r ? r : 0), n !== e && (n = (n = vs(n)) == n ? n : 0), sr(vs(t), n, r)
        }, Un.clone = function (e) {
          return cr(e, 4)
        }, Un.cloneDeep = function (e) {
          return cr(e, 5)
        }, Un.cloneDeepWith = function (t, n) {
          return cr(t, 5, n = "function" == typeof n ? n : e)
        }, Un.cloneWith = function (t, n) {
          return cr(t, 4, n = "function" == typeof n ? n : e)
        }, Un.conformsTo = function (e, t) {
          return null == t || ur(e, t, Ds(t))
        }, Un.deburr = Ws, Un.defaultTo = function (e, t) {
          return null == e || e != e ? t : e
        }, Un.divide = _c, Un.endsWith = function (t, n, r) {
          t = Ss(t), n = uo(n);
          var o = t.length,
            i = r = r === e ? o : sr(ms(r), 0, o);
          return (r -= n.length) >= 0 && t.slice(r, i) == n
        }, Un.eq = za, Un.escape = function (e) {
          return (e = Ss(e)) && V.test(e) ? e.replace(H, tn) : e
        }, Un.escapeRegExp = function (e) {
          return (e = Ss(e)) && te.test(e) ? e.replace(ee, "\\$&") : e
        }, Un.every = function (t, n, r) {
          var o = Va(t) ? Tt : hr;
          return r && wi(t, n, r) && (n = e), o(t, ui(n, 3))
        }, Un.find = va, Un.findIndex = Wi, Un.findKey = function (e, t) {
          return Lt(e, ui(t, 3), wr)
        }, Un.findLast = wa, Un.findLastIndex = Vi, Un.findLastKey = function (e, t) {
          return Lt(e, ui(t, 3), Sr)
        }, Un.floor = Pc, Un.forEach = Sa, Un.forEachRight = xa, Un.forIn = function (e, t) {
          return null == e ? e : br(e, ui(t, 3), Ns)
        }, Un.forInRight = function (e, t) {
          return null == e ? e : vr(e, ui(t, 3), Ns)
        }, Un.forOwn = function (e, t) {
          return e && wr(e, ui(t, 3))
        }, Un.forOwnRight = function (e, t) {
          return e && Sr(e, ui(t, 3))
        }, Un.get = Is, Un.gt = Qa, Un.gte = Ha, Un.has = function (e, t) {
          return null != e && yi(e, t, Tr)
        }, Un.hasIn = Os, Un.head = Ji, Un.identity = sc, Un.includes = function (e, t, n, r) {
          e = Ja(e) ? e : zs(e), n = n && !r ? ms(n) : 0;
          var o = e.length;
          return n < 0 && (n = bn(o + n, 0)), ls(e) ? n <= o && e.indexOf(t, n) > -1 : !!o && Ft(e, t, n) > -1
        }, Un.indexOf = function (e, t, n) {
          var r = null == e ? 0 : e.length;
          if (!r) return -1;
          var o = null == n ? 0 : ms(n);
          return o < 0 && (o = bn(r + o, 0)), Ft(e, t, o)
        }, Un.inRange = function (t, n, r) {
          return n = ys(n), r === e ? (r = n, n = 0) : r = ys(r),
            function (e, t, n) {
              return e >= vn(t, n) && e < bn(t, n)
            }(t = vs(t), n, r)
        }, Un.invoke = js, Un.isArguments = Wa, Un.isArray = Va, Un.isArrayBuffer = Ka, Un.isArrayLike = Ja, Un.isArrayLikeObject = Ga, Un.isBoolean = function (e) {
          return !0 === e || !1 === e || os(e) && Pr(e) == y
        }, Un.isBuffer = Ya, Un.isDate = Xa, Un.isElement = function (e) {
          return os(e) && 1 === e.nodeType && !ss(e)
        }, Un.isEmpty = function (e) {
          if (null == e) return !0;
          if (Ja(e) && (Va(e) || "string" == typeof e || "function" == typeof e.splice || Ya(e) || ps(e) || Wa(e))) return !e.length;
          var t = gi(e);
          if (t == S || t == k) return !e.size;
          if (_i(e)) return !Rr(e).length;
          for (var n in e)
            if (Re.call(e, n)) return !1;
          return !0
        }, Un.isEqual = function (e, t) {
          return Br(e, t)
        }, Un.isEqualWith = function (t, n, r) {
          var o = (r = "function" == typeof r ? r : e) ? r(t, n) : e;
          return o === e ? Br(t, n, e, r) : !!o
        }, Un.isError = Za, Un.isFinite = function (e) {
          return "number" == typeof e && gn(e)
        }, Un.isFunction = es, Un.isInteger = ts, Un.isLength = ns, Un.isMap = is, Un.isMatch = function (e, t) {
          return e === t || jr(e, t, fi(t))
        }, Un.isMatchWith = function (t, n, r) {
          return r = "function" == typeof r ? r : e, jr(t, n, fi(n), r)
        }, Un.isNaN = function (e) {
          return as(e) && e != +e
        }, Un.isNative = function (e) {
          if (Ai(e)) throw new _e("Unsupported core-js use. Try https://npms.io/search?q=ponyfill.");
          return Dr(e)
        }, Un.isNil = function (e) {
          return null == e
        }, Un.isNull = function (e) {
          return null === e
        }, Un.isNumber = as, Un.isObject = rs, Un.isObjectLike = os, Un.isPlainObject = ss, Un.isRegExp = cs, Un.isSafeInteger = function (e) {
          return ts(e) && e >= -9007199254740991 && e <= l
        }, Un.isSet = us, Un.isString = ls, Un.isSymbol = fs, Un.isTypedArray = ps, Un.isUndefined = function (t) {
          return t === e
        }, Un.isWeakMap = function (e) {
          return os(e) && gi(e) == I
        }, Un.isWeakSet = function (e) {
          return os(e) && "[object WeakSet]" == Pr(e)
        }, Un.join = function (e, t) {
          return null == e ? "" : yn.call(e, t)
        }, Un.kebabCase = Ks, Un.last = Zi, Un.lastIndexOf = function (t, n, r) {
          var o = null == t ? 0 : t.length;
          if (!o) return -1;
          var i = o;
          return r !== e && (i = (i = ms(r)) < 0 ? bn(o + i, 0) : vn(i, o - 1)), n == n ? function (e, t, n) {
            for (var r = n + 1; r--;)
              if (e[r] === t) return r;
            return r
          }(t, n, i) : Mt(t, qt, i, !0)
        }, Un.lowerCase = Js, Un.lowerFirst = Gs, Un.lt = ds, Un.lte = hs, Un.max = function (t) {
          return t && t.length ? gr(t, sc, kr) : e
        }, Un.maxBy = function (t, n) {
          return t && t.length ? gr(t, ui(n, 2), kr) : e
        }, Un.mean = function (e) {
          return $t(e, sc)
        }, Un.meanBy = function (e, t) {
          return $t(e, ui(t, 2))
        }, Un.min = function (t) {
          return t && t.length ? gr(t, sc, Mr) : e
        }, Un.minBy = function (t, n) {
          return t && t.length ? gr(t, ui(n, 2), Mr) : e
        }, Un.stubArray = vc, Un.stubFalse = wc, Un.stubObject = function () {
          return {}
        }, Un.stubString = function () {
          return ""
        }, Un.stubTrue = function () {
          return !0
        }, Un.multiply = kc, Un.nth = function (t, n) {
          return t && t.length ? zr(t, ms(n)) : e
        }, Un.noConflict = function () {
          return ft._ === this && (ft._ = qe), this
        }, Un.noop = pc, Un.now = Ia, Un.pad = function (e, t, n) {
          e = Ss(e);
          var r = (t = ms(t)) ? un(e) : 0;
          if (!t || r >= t) return e;
          var o = (t - r) / 2;
          return Ho(Rt(o), n) + e + Ho(yt(o), n)
        }, Un.padEnd = function (e, t, n) {
          e = Ss(e);
          var r = (t = ms(t)) ? un(e) : 0;
          return t && r < t ? e + Ho(t - r, n) : e
        }, Un.padStart = function (e, t, n) {
          e = Ss(e);
          var r = (t = ms(t)) ? un(e) : 0;
          return t && r < t ? Ho(t - r, n) + e : e
        }, Un.parseInt = function (e, t, n) {
          return n || null == t ? t = 0 : t && (t = +t), Sn(Ss(e).replace(ne, ""), t || 0)
        }, Un.random = function (t, n, r) {
          if (r && "boolean" != typeof r && wi(t, n, r) && (n = r = e), r === e && ("boolean" == typeof n ? (r = n, n = e) : "boolean" == typeof t && (r = t, t = e)), t === e && n === e ? (t = 0, n = 1) : (t = ys(t), n === e ? (n = t, t = 0) : n = ys(n)), t > n) {
            var o = t;
            t = n, n = o
          }
          if (r || t % 1 || n % 1) {
            var i = xn();
            return vn(t + i * (n - t + st("1e-" + ((i + "").length - 1))), n)
          }
          return Kr(t, n)
        }, Un.reduce = function (e, t, n) {
          var r = Va(e) ? jt : Ht,
            o = arguments.length < 3;
          return r(e, ui(t, 4), n, o, pr)
        }, Un.reduceRight = function (e, t, n) {
          var r = Va(e) ? Dt : Ht,
            o = arguments.length < 3;
          return r(e, ui(t, 4), n, o, dr)
        }, Un.repeat = function (t, n, r) {
          return n = (r ? wi(t, n, r) : n === e) ? 1 : ms(n), Jr(Ss(t), n)
        }, Un.replace = function () {
          var e = arguments,
            t = Ss(e[0]);
          return e.length < 3 ? t : t.replace(e[1], e[2])
        }, Un.result = function (t, n, r) {
          var o = -1,
            i = (n = wo(n, t)).length;
          for (i || (i = 1, t = e); ++o < i;) {
            var a = null == t ? e : t[Ui(n[o])];
            a === e && (o = i, a = r), t = es(a) ? a.call(t) : a
          }
          return t
        }, Un.round = Tc, Un.runInContext = re, Un.sample = function (e) {
          return (Va(e) ? Yn : Yr)(e)
        }, Un.size = function (e) {
          if (null == e) return 0;
          if (Ja(e)) return ls(e) ? un(e) : e.length;
          var t = gi(e);
          return t == S || t == k ? e.size : Rr(e).length
        }, Un.snakeCase = Ys, Un.some = function (t, n, r) {
          var o = Va(t) ? Nt : oo;
          return r && wi(t, n, r) && (n = e), o(t, ui(n, 3))
        }, Un.sortedIndex = function (e, t) {
          return io(e, t)
        }, Un.sortedIndexBy = function (e, t, n) {
          return ao(e, t, ui(n, 2))
        }, Un.sortedIndexOf = function (e, t) {
          var n = null == e ? 0 : e.length;
          if (n) {
            var r = io(e, t);
            if (r < n && za(e[r], t)) return r
          }
          return -1
        }, Un.sortedLastIndex = function (e, t) {
          return io(e, t, !0)
        }, Un.sortedLastIndexBy = function (e, t, n) {
          return ao(e, t, ui(n, 2), !0)
        }, Un.sortedLastIndexOf = function (e, t) {
          if (null != e && e.length) {
            var n = io(e, t, !0) - 1;
            if (za(e[n], t)) return n
          }
          return -1
        }, Un.startCase = Xs, Un.startsWith = function (e, t, n) {
          return e = Ss(e), n = null == n ? 0 : sr(ms(n), 0, e.length), t = uo(t), e.slice(n, n + t.length) == t
        }, Un.subtract = Ec, Un.sum = function (e) {
          return e && e.length ? Wt(e, sc) : 0
        }, Un.sumBy = function (e, t) {
          return e && e.length ? Wt(e, ui(t, 2)) : 0
        }, Un.template = function (t, n, r) {
          var o = Un.templateSettings;
          r && wi(t, n, r) && (n = e), t = Ss(t), n = _s({}, n, o, Zo);
          var i, a, s = _s({}, n.imports, o.imports, Zo),
            c = Ds(s),
            u = Gt(s, c),
            l = 0,
            f = n.interpolate || be,
            p = "__p += '",
            d = Ee((n.escape || be).source + "|" + f.source + "|" + (f === G ? le : be).source + "|" + (n.evaluate || be).source + "|$", "g"),
            h = "//# sourceURL=" + (Re.call(n, "sourceURL") ? (n.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++rt + "]") + "\n";
          t.replace(d, (function (e, n, r, o, s, c) {
            return r || (r = o), p += t.slice(l, c).replace(ve, nn), n && (i = !0, p += "' +\n__e(" + n + ") +\n'"), s && (a = !0, p += "';\n" + s + ";\n__p += '"), r && (p += "' +\n((__t = (" + r + ")) == null ? '' : __t) +\n'"), l = c + e.length, e
          })), p += "';\n";
          var g = Re.call(n, "variable") && n.variable;
          if (g) {
            if (ce.test(g)) throw new _e("Invalid `variable` option passed into `_.template`")
          } else p = "with (obj) {\n" + p + "\n}\n";
          p = (a ? p.replace(q, "") : p).replace($, "$1").replace(z, "$1;"), p = "function(" + (g || "obj") + ") {\n" + (g ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (i ? ", __e = _.escape" : "") + (a ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + p + "return __p\n}";
          var y = nc((function () {
            return Pe(c, h + "return " + p).apply(e, u)
          }));
          if (y.source = p, Za(y)) throw y;
          return y
        }, Un.times = function (e, t) {
          if ((e = ms(e)) < 1 || e > l) return [];
          var n = p,
            r = vn(e, p);
          t = ui(t), e -= p;
          for (var o = Vt(r, t); ++n < e;) t(n);
          return o
        }, Un.toFinite = ys, Un.toInteger = ms, Un.toLength = bs, Un.toLower = function (e) {
          return Ss(e).toLowerCase()
        }, Un.toNumber = vs, Un.toSafeInteger = function (e) {
          return e ? sr(ms(e), -9007199254740991, l) : 0 === e ? e : 0
        }, Un.toString = Ss, Un.toUpper = function (e) {
          return Ss(e).toUpperCase()
        }, Un.trim = function (t, n, r) {
          if ((t = Ss(t)) && (r || n === e)) return Kt(t);
          if (!t || !(n = uo(n))) return t;
          var o = ln(t),
            i = ln(n);
          return xo(o, Xt(o, i), Zt(o, i) + 1).join("")
        }, Un.trimEnd = function (t, n, r) {
          if ((t = Ss(t)) && (r || n === e)) return t.slice(0, fn(t) + 1);
          if (!t || !(n = uo(n))) return t;
          var o = ln(t);
          return xo(o, 0, Zt(o, ln(n)) + 1).join("")
        }, Un.trimStart = function (t, n, r) {
          if ((t = Ss(t)) && (r || n === e)) return t.replace(ne, "");
          if (!t || !(n = uo(n))) return t;
          var o = ln(t);
          return xo(o, Xt(o, ln(n))).join("")
        }, Un.truncate = function (t, n) {
          var r = 30,
            o = "...";
          if (rs(n)) {
            var i = "separator" in n ? n.separator : i;
            r = "length" in n ? ms(n.length) : r, o = "omission" in n ? uo(n.omission) : o
          }
          var a = (t = Ss(t)).length;
          if (rn(t)) {
            var s = ln(t);
            a = s.length
          }
          if (r >= a) return t;
          var c = r - un(o);
          if (c < 1) return o;
          var u = s ? xo(s, 0, c).join("") : t.slice(0, c);
          if (i === e) return u + o;
          if (s && (c += u.length - c), cs(i)) {
            if (t.slice(c).search(i)) {
              var l, f = u;
              for (i.global || (i = Ee(i.source, Ss(fe.exec(i)) + "g")), i.lastIndex = 0; l = i.exec(f);) var p = l.index;
              u = u.slice(0, p === e ? c : p)
            }
          } else if (t.indexOf(uo(i), c) != c) {
            var d = u.lastIndexOf(i);
            d > -1 && (u = u.slice(0, d))
          }
          return u + o
        }, Un.unescape = function (e) {
          return (e = Ss(e)) && W.test(e) ? e.replace(Q, pn) : e
        }, Un.uniqueId = function (e) {
          var t = ++Le;
          return Ss(e) + t
        }, Un.upperCase = Zs, Un.upperFirst = ec, Un.each = Sa, Un.eachRight = xa, Un.first = Ji, fc(Un, (Sc = {}, wr(Un, (function (e, t) {
          Re.call(Un.prototype, t) || (Sc[t] = e)
        })), Sc), {
          chain: !1
        }), Un.VERSION = "4.17.21", Pt(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], (function (e) {
          Un[e].placeholder = Un
        })), Pt(["drop", "take"], (function (t, n) {
          Qn.prototype[t] = function (r) {
            r = r === e ? 1 : bn(ms(r), 0);
            var o = this.__filtered__ && !n ? new Qn(this) : this.clone();
            return o.__filtered__ ? o.__takeCount__ = vn(r, o.__takeCount__) : o.__views__.push({
              size: vn(r, p),
              type: t + (o.__dir__ < 0 ? "Right" : "")
            }), o
          }, Qn.prototype[t + "Right"] = function (e) {
            return this.reverse()[t](e).reverse()
          }
        })), Pt(["filter", "map", "takeWhile"], (function (e, t) {
          var n = t + 1,
            r = 1 == n || 3 == n;
          Qn.prototype[e] = function (e) {
            var t = this.clone();
            return t.__iteratees__.push({
              iteratee: ui(e, 3),
              type: n
            }), t.__filtered__ = t.__filtered__ || r, t
          }
        })), Pt(["head", "last"], (function (e, t) {
          var n = "take" + (t ? "Right" : "");
          Qn.prototype[e] = function () {
            return this[n](1).value()[0]
          }
        })), Pt(["initial", "tail"], (function (e, t) {
          var n = "drop" + (t ? "" : "Right");
          Qn.prototype[e] = function () {
            return this.__filtered__ ? new Qn(this) : this[n](1)
          }
        })), Qn.prototype.compact = function () {
          return this.filter(sc)
        }, Qn.prototype.find = function (e) {
          return this.filter(e).head()
        }, Qn.prototype.findLast = function (e) {
          return this.reverse().find(e)
        }, Qn.prototype.invokeMap = Gr((function (e, t) {
          return "function" == typeof e ? new Qn(this) : this.map((function (n) {
            return Or(n, e, t)
          }))
        })), Qn.prototype.reject = function (e) {
          return this.filter(Ma(ui(e)))
        }, Qn.prototype.slice = function (t, n) {
          t = ms(t);
          var r = this;
          return r.__filtered__ && (t > 0 || n < 0) ? new Qn(r) : (t < 0 ? r = r.takeRight(-t) : t && (r = r.drop(t)), n !== e && (r = (n = ms(n)) < 0 ? r.dropRight(-n) : r.take(n - t)), r)
        }, Qn.prototype.takeRightWhile = function (e) {
          return this.reverse().takeWhile(e).reverse()
        }, Qn.prototype.toArray = function () {
          return this.take(p)
        }, wr(Qn.prototype, (function (t, n) {
          var r = /^(?:filter|find|map|reject)|While$/.test(n),
            o = /^(?:head|last)$/.test(n),
            i = Un[o ? "take" + ("last" == n ? "Right" : "") : n],
            a = o || /^find/.test(n);
          i && (Un.prototype[n] = function () {
            var n = this.__wrapped__,
              s = o ? [1] : arguments,
              c = n instanceof Qn,
              u = s[0],
              l = c || Va(n),
              f = function (e) {
                var t = i.apply(Un, Bt([e], s));
                return o && p ? t[0] : t
              };
            l && r && "function" == typeof u && 1 != u.length && (c = l = !1);
            var p = this.__chain__,
              d = !!this.__actions__.length,
              h = a && !p,
              g = c && !d;
            if (!a && l) {
              n = g ? n : new Qn(this);
              var y = t.apply(n, s);
              return y.__actions__.push({
                func: ya,
                args: [f],
                thisArg: e
              }), new zn(y, p)
            }
            return h && g ? t.apply(this, s) : (y = this.thru(f), h ? o ? y.value()[0] : y.value() : y)
          })
        })), Pt(["pop", "push", "shift", "sort", "splice", "unshift"], (function (e) {
          var t = Ce[e],
            n = /^(?:push|sort|unshift)$/.test(e) ? "tap" : "thru",
            r = /^(?:pop|shift)$/.test(e);
          Un.prototype[e] = function () {
            var e = arguments;
            if (r && !this.__chain__) {
              var o = this.value();
              return t.apply(Va(o) ? o : [], e)
            }
            return this[n]((function (n) {
              return t.apply(Va(n) ? n : [], e)
            }))
          }
        })), wr(Qn.prototype, (function (e, t) {
          var n = Un[t];
          if (n) {
            var r = n.name + "";
            Re.call(Cn, r) || (Cn[r] = []), Cn[r].push({
              name: t,
              func: n
            })
          }
        })), Cn[qo(e, 2).name] = [{
          name: "wrapper",
          func: e
        }], Qn.prototype.clone = function () {
          var e = new Qn(this.__wrapped__);
          return e.__actions__ = Oo(this.__actions__), e.__dir__ = this.__dir__, e.__filtered__ = this.__filtered__, e.__iteratees__ = Oo(this.__iteratees__), e.__takeCount__ = this.__takeCount__, e.__views__ = Oo(this.__views__), e
        }, Qn.prototype.reverse = function () {
          if (this.__filtered__) {
            var e = new Qn(this);
            e.__dir__ = -1, e.__filtered__ = !0
          } else(e = this.clone()).__dir__ *= -1;
          return e
        }, Qn.prototype.value = function () {
          var e = this.__wrapped__.value(),
            t = this.__dir__,
            n = Va(e),
            r = t < 0,
            o = n ? e.length : 0,
            i = function (e, t, n) {
              for (var r = -1, o = n.length; ++r < o;) {
                var i = n[r],
                  a = i.size;
                switch (i.type) {
                  case "drop":
                    e += a;
                    break;
                  case "dropRight":
                    t -= a;
                    break;
                  case "take":
                    t = vn(t, e + a);
                    break;
                  case "takeRight":
                    e = bn(e, t - a)
                }
              }
              return {
                start: e,
                end: t
              }
            }(0, o, this.__views__),
            a = i.start,
            s = i.end,
            c = s - a,
            u = r ? s : a - 1,
            l = this.__iteratees__,
            f = l.length,
            p = 0,
            d = vn(c, this.__takeCount__);
          if (!n || !r && o == c && d == c) return go(e, this.__actions__);
          var h = [];
          e: for (; c-- && p < d;) {
            for (var g = -1, y = e[u += t]; ++g < f;) {
              var m = l[g],
                b = m.iteratee,
                v = m.type,
                w = b(y);
              if (2 == v) y = w;
              else if (!w) {
                if (1 == v) continue e;
                break e
              }
            }
            h[p++] = y
          }
          return h
        }, Un.prototype.at = ma, Un.prototype.chain = function () {
          return ga(this)
        }, Un.prototype.commit = function () {
          return new zn(this.value(), this.__chain__)
        }, Un.prototype.next = function () {
          this.__values__ === e && (this.__values__ = gs(this.value()));
          var t = this.__index__ >= this.__values__.length;
          return {
            done: t,
            value: t ? e : this.__values__[this.__index__++]
          }
        }, Un.prototype.plant = function (t) {
          for (var n, r = this; r instanceof $n;) {
            var o = $i(r);
            o.__index__ = 0, o.__values__ = e, n ? i.__wrapped__ = o : n = o;
            var i = o;
            r = r.__wrapped__
          }
          return i.__wrapped__ = t, n
        }, Un.prototype.reverse = function () {
          var t = this.__wrapped__;
          if (t instanceof Qn) {
            var n = t;
            return this.__actions__.length && (n = new Qn(this)), (n = n.reverse()).__actions__.push({
              func: ya,
              args: [ra],
              thisArg: e
            }), new zn(n, this.__chain__)
          }
          return this.thru(ra)
        }, Un.prototype.toJSON = Un.prototype.valueOf = Un.prototype.value = function () {
          return go(this.__wrapped__, this.__actions__)
        }, Un.prototype.first = Un.prototype.head, at && (Un.prototype[at] = function () {
          return this
        }), Un
      }();
    dt ? ((dt.exports = dn)._ = dn, pt._ = dn) : ft._ = dn
  }.call(Oc);
const Qh = e({
  __proto__: null,
  default: exports.lodashExports
}, [exports.lodashExports]);

function Hh(e, t, n) {
  return e(n = {
    path: t,
    exports: {},
    require: function (e, t) {
      return function () {
        throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs")
      }(null == t && n.path)
    }
  }, n.exports), n.exports
}
var Wh = Hh((function (e, t) {
    var n;
    e.exports = (n = n || function (e, t) {
      var n = Object.create || function () {
          function e() {}
          return function (t) {
            var n;
            return e.prototype = t, n = new e, e.prototype = null, n
          }
        }(),
        r = {},
        o = r.lib = {},
        i = o.Base = {
          extend: function (e) {
            var t = n(this);
            return e && t.mixIn(e), t.hasOwnProperty("init") && this.init !== t.init || (t.init = function () {
              t.$super.init.apply(this, arguments)
            }), t.init.prototype = t, t.$super = this, t
          },
          create: function () {
            var e = this.extend();
            return e.init.apply(e, arguments), e
          },
          init: function () {},
          mixIn: function (e) {
            for (var t in e) e.hasOwnProperty(t) && (this[t] = e[t]);
            e.hasOwnProperty("toString") && (this.toString = e.toString)
          },
          clone: function () {
            return this.init.prototype.extend(this)
          }
        },
        a = o.WordArray = i.extend({
          init: function (e, t) {
            e = this.words = e || [], this.sigBytes = null != t ? t : 4 * e.length
          },
          toString: function (e) {
            return (e || c).stringify(this)
          },
          concat: function (e) {
            var t = this.words,
              n = e.words,
              r = this.sigBytes,
              o = e.sigBytes;
            if (this.clamp(), r % 4)
              for (var i = 0; i < o; i++) {
                var a = n[i >>> 2] >>> 24 - i % 4 * 8 & 255;
                t[r + i >>> 2] |= a << 24 - (r + i) % 4 * 8
              } else
                for (i = 0; i < o; i += 4) t[r + i >>> 2] = n[i >>> 2];
            return this.sigBytes += o, this
          },
          clamp: function () {
            var t = this.words,
              n = this.sigBytes;
            t[n >>> 2] &= 4294967295 << 32 - n % 4 * 8, t.length = e.ceil(n / 4)
          },
          clone: function () {
            var e = i.clone.call(this);
            return e.words = this.words.slice(0), e
          },
          random: function (t) {
            for (var n, r = [], o = function (t) {
                var n = 987654321,
                  r = 4294967295;
                return function () {
                  var o = ((n = 36969 * (65535 & n) + (n >> 16) & r) << 16) + (t = 18e3 * (65535 & t) + (t >> 16) & r) & r;
                  return o /= 4294967296, (o += .5) * (e.random() > .5 ? 1 : -1)
                }
              }, i = 0; i < t; i += 4) {
              var s = o(4294967296 * (n || e.random()));
              n = 987654071 * s(), r.push(4294967296 * s() | 0)
            }
            return new a.init(r, t)
          }
        }),
        s = r.enc = {},
        c = s.Hex = {
          stringify: function (e) {
            for (var t = e.words, n = e.sigBytes, r = [], o = 0; o < n; o++) {
              var i = t[o >>> 2] >>> 24 - o % 4 * 8 & 255;
              r.push((i >>> 4).toString(16)), r.push((15 & i).toString(16))
            }
            return r.join("")
          },
          parse: function (e) {
            for (var t = e.length, n = [], r = 0; r < t; r += 2) n[r >>> 3] |= parseInt(e.substr(r, 2), 16) << 24 - r % 8 * 4;
            return new a.init(n, t / 2)
          }
        },
        u = s.Latin1 = {
          stringify: function (e) {
            for (var t = e.words, n = e.sigBytes, r = [], o = 0; o < n; o++) {
              var i = t[o >>> 2] >>> 24 - o % 4 * 8 & 255;
              r.push(String.fromCharCode(i))
            }
            return r.join("")
          },
          parse: function (e) {
            for (var t = e.length, n = [], r = 0; r < t; r++) n[r >>> 2] |= (255 & e.charCodeAt(r)) << 24 - r % 4 * 8;
            return new a.init(n, t)
          }
        },
        l = s.Utf8 = {
          stringify: function (e) {
            try {
              return decodeURIComponent(escape(u.stringify(e)))
            } catch (t) {
              throw new Error("Malformed UTF-8 data")
            }
          },
          parse: function (e) {
            return u.parse(unescape(encodeURIComponent(e)))
          }
        },
        f = o.BufferedBlockAlgorithm = i.extend({
          reset: function () {
            this._data = new a.init, this._nDataBytes = 0
          },
          _append: function (e) {
            "string" == typeof e && (e = l.parse(e)), this._data.concat(e), this._nDataBytes += e.sigBytes
          },
          _process: function (t) {
            var n = this._data,
              r = n.words,
              o = n.sigBytes,
              i = this.blockSize,
              s = o / (4 * i),
              c = (s = t ? e.ceil(s) : e.max((0 | s) - this._minBufferSize, 0)) * i,
              u = e.min(4 * c, o);
            if (c) {
              for (var l = 0; l < c; l += i) this._doProcessBlock(r, l);
              var f = r.splice(0, c);
              n.sigBytes -= u
            }
            return new a.init(f, u)
          },
          clone: function () {
            var e = i.clone.call(this);
            return e._data = this._data.clone(), e
          },
          _minBufferSize: 0
        });
      o.Hasher = f.extend({
        cfg: i.extend(),
        init: function (e) {
          this.cfg = this.cfg.extend(e), this.reset()
        },
        reset: function () {
          f.reset.call(this), this._doReset()
        },
        update: function (e) {
          return this._append(e), this._process(), this
        },
        finalize: function (e) {
          return e && this._append(e), this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (e) {
          return function (t, n) {
            return new e.init(n).finalize(t)
          }
        },
        _createHmacHelper: function (e) {
          return function (t, n) {
            return new p.HMAC.init(e, n).finalize(t)
          }
        }
      });
      var p = r.algo = {};
      return r
    }(Math), n)
  })),
  Vh = Wh,
  Kh = (Hh((function (e, t) {
    var n;
    e.exports = (n = Vh, function (e) {
      var t = n,
        r = t.lib,
        o = r.WordArray,
        i = r.Hasher,
        a = t.algo,
        s = [];
      ! function () {
        for (var t = 0; t < 64; t++) s[t] = 4294967296 * e.abs(e.sin(t + 1)) | 0
      }();
      var c = a.MD5 = i.extend({
        _doReset: function () {
          this._hash = new o.init([1732584193, 4023233417, 2562383102, 271733878])
        },
        _doProcessBlock: function (e, t) {
          for (var n = 0; n < 16; n++) {
            var r = t + n,
              o = e[r];
            e[r] = 16711935 & (o << 8 | o >>> 24) | 4278255360 & (o << 24 | o >>> 8)
          }
          var i = this._hash.words,
            a = e[t + 0],
            c = e[t + 1],
            d = e[t + 2],
            h = e[t + 3],
            g = e[t + 4],
            y = e[t + 5],
            m = e[t + 6],
            b = e[t + 7],
            v = e[t + 8],
            w = e[t + 9],
            S = e[t + 10],
            x = e[t + 11],
            A = e[t + 12],
            _ = e[t + 13],
            P = e[t + 14],
            k = e[t + 15],
            T = i[0],
            E = i[1],
            I = i[2],
            O = i[3];
          T = u(T, E, I, O, a, 7, s[0]), O = u(O, T, E, I, c, 12, s[1]), I = u(I, O, T, E, d, 17, s[2]), E = u(E, I, O, T, h, 22, s[3]), T = u(T, E, I, O, g, 7, s[4]), O = u(O, T, E, I, y, 12, s[5]), I = u(I, O, T, E, m, 17, s[6]), E = u(E, I, O, T, b, 22, s[7]), T = u(T, E, I, O, v, 7, s[8]), O = u(O, T, E, I, w, 12, s[9]), I = u(I, O, T, E, S, 17, s[10]), E = u(E, I, O, T, x, 22, s[11]), T = u(T, E, I, O, A, 7, s[12]), O = u(O, T, E, I, _, 12, s[13]), I = u(I, O, T, E, P, 17, s[14]), T = l(T, E = u(E, I, O, T, k, 22, s[15]), I, O, c, 5, s[16]), O = l(O, T, E, I, m, 9, s[17]), I = l(I, O, T, E, x, 14, s[18]), E = l(E, I, O, T, a, 20, s[19]), T = l(T, E, I, O, y, 5, s[20]), O = l(O, T, E, I, S, 9, s[21]), I = l(I, O, T, E, k, 14, s[22]), E = l(E, I, O, T, g, 20, s[23]), T = l(T, E, I, O, w, 5, s[24]), O = l(O, T, E, I, P, 9, s[25]), I = l(I, O, T, E, h, 14, s[26]), E = l(E, I, O, T, v, 20, s[27]), T = l(T, E, I, O, _, 5, s[28]), O = l(O, T, E, I, d, 9, s[29]), I = l(I, O, T, E, b, 14, s[30]), T = f(T, E = l(E, I, O, T, A, 20, s[31]), I, O, y, 4, s[32]), O = f(O, T, E, I, v, 11, s[33]), I = f(I, O, T, E, x, 16, s[34]), E = f(E, I, O, T, P, 23, s[35]), T = f(T, E, I, O, c, 4, s[36]), O = f(O, T, E, I, g, 11, s[37]), I = f(I, O, T, E, b, 16, s[38]), E = f(E, I, O, T, S, 23, s[39]), T = f(T, E, I, O, _, 4, s[40]), O = f(O, T, E, I, a, 11, s[41]), I = f(I, O, T, E, h, 16, s[42]), E = f(E, I, O, T, m, 23, s[43]), T = f(T, E, I, O, w, 4, s[44]), O = f(O, T, E, I, A, 11, s[45]), I = f(I, O, T, E, k, 16, s[46]), T = p(T, E = f(E, I, O, T, d, 23, s[47]), I, O, a, 6, s[48]), O = p(O, T, E, I, b, 10, s[49]), I = p(I, O, T, E, P, 15, s[50]), E = p(E, I, O, T, y, 21, s[51]), T = p(T, E, I, O, A, 6, s[52]), O = p(O, T, E, I, h, 10, s[53]), I = p(I, O, T, E, S, 15, s[54]), E = p(E, I, O, T, c, 21, s[55]), T = p(T, E, I, O, v, 6, s[56]), O = p(O, T, E, I, k, 10, s[57]), I = p(I, O, T, E, m, 15, s[58]), E = p(E, I, O, T, _, 21, s[59]), T = p(T, E, I, O, g, 6, s[60]), O = p(O, T, E, I, x, 10, s[61]), I = p(I, O, T, E, d, 15, s[62]), E = p(E, I, O, T, w, 21, s[63]), i[0] = i[0] + T | 0, i[1] = i[1] + E | 0, i[2] = i[2] + I | 0, i[3] = i[3] + O | 0
        },
        _doFinalize: function () {
          var t = this._data,
            n = t.words,
            r = 8 * this._nDataBytes,
            o = 8 * t.sigBytes;
          n[o >>> 5] |= 128 << 24 - o % 32;
          var i = e.floor(r / 4294967296),
            a = r;
          n[15 + (o + 64 >>> 9 << 4)] = 16711935 & (i << 8 | i >>> 24) | 4278255360 & (i << 24 | i >>> 8), n[14 + (o + 64 >>> 9 << 4)] = 16711935 & (a << 8 | a >>> 24) | 4278255360 & (a << 24 | a >>> 8), t.sigBytes = 4 * (n.length + 1), this._process();
          for (var s = this._hash, c = s.words, u = 0; u < 4; u++) {
            var l = c[u];
            c[u] = 16711935 & (l << 8 | l >>> 24) | 4278255360 & (l << 24 | l >>> 8)
          }
          return s
        },
        clone: function () {
          var e = i.clone.call(this);
          return e._hash = this._hash.clone(), e
        }
      });

      function u(e, t, n, r, o, i, a) {
        var s = e + (t & n | ~t & r) + o + a;
        return (s << i | s >>> 32 - i) + t
      }

      function l(e, t, n, r, o, i, a) {
        var s = e + (t & r | n & ~r) + o + a;
        return (s << i | s >>> 32 - i) + t
      }

      function f(e, t, n, r, o, i, a) {
        var s = e + (t ^ n ^ r) + o + a;
        return (s << i | s >>> 32 - i) + t
      }

      function p(e, t, n, r, o, i, a) {
        var s = e + (n ^ (t | ~r)) + o + a;
        return (s << i | s >>> 32 - i) + t
      }
      t.MD5 = i._createHelper(c), t.HmacMD5 = i._createHmacHelper(c)
    }(Math), n.MD5)
  })), Hh((function (e, t) {
    var n, r, o;
    e.exports = (r = (n = Vh).lib.Base, o = n.enc.Utf8, void(n.algo.HMAC = r.extend({
      init: function (e, t) {
        e = this._hasher = new e.init, "string" == typeof t && (t = o.parse(t));
        var n = e.blockSize,
          r = 4 * n;
        t.sigBytes > r && (t = e.finalize(t)), t.clamp();
        for (var i = this._oKey = t.clone(), a = this._iKey = t.clone(), s = i.words, c = a.words, u = 0; u < n; u++) s[u] ^= 1549556828, c[u] ^= 909522486;
        i.sigBytes = a.sigBytes = r, this.reset()
      },
      reset: function () {
        var e = this._hasher;
        e.reset(), e.update(this._iKey)
      },
      update: function (e) {
        return this._hasher.update(e), this
      },
      finalize: function (e) {
        var t = this._hasher,
          n = t.finalize(e);
        return t.reset(), t.finalize(this._oKey.clone().concat(n))
      }
    })))
  })), Hh((function (e, t) {
    e.exports = Vh.HmacMD5
  }))),
  Jh = Hh((function (e, t) {
    e.exports = Vh.enc.Utf8
  })),
  Gh = Hh((function (e, t) {
    var n, r, o;
    e.exports = (o = (r = n = Vh).lib.WordArray, r.enc.Base64 = {
      stringify: function (e) {
        var t = e.words,
          n = e.sigBytes,
          r = this._map;
        e.clamp();
        for (var o = [], i = 0; i < n; i += 3)
          for (var a = (t[i >>> 2] >>> 24 - i % 4 * 8 & 255) << 16 | (t[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 255) << 8 | t[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 255, s = 0; s < 4 && i + .75 * s < n; s++) o.push(r.charAt(a >>> 6 * (3 - s) & 63));
        var c = r.charAt(64);
        if (c)
          for (; o.length % 4;) o.push(c);
        return o.join("")
      },
      parse: function (e) {
        var t = e.length,
          n = this._map,
          r = this._reverseMap;
        if (!r) {
          r = this._reverseMap = [];
          for (var i = 0; i < n.length; i++) r[n.charCodeAt(i)] = i
        }
        var a = n.charAt(64);
        if (a) {
          var s = e.indexOf(a); - 1 !== s && (t = s)
        }
        return function (e, t, n) {
          for (var r = [], i = 0, a = 0; a < t; a++)
            if (a % 4) {
              var s = n[e.charCodeAt(a - 1)] << a % 4 * 2,
                c = n[e.charCodeAt(a)] >>> 6 - a % 4 * 2;
              r[i >>> 2] |= (s | c) << 24 - i % 4 * 8, i++
            } return o.create(r, i)
        }(e, t, r)
      },
      _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    }, n.enc.Base64)
  }));
const Yh = "FUNCTION",
  Xh = "pending",
  Zh = "rejected";

function eg(e) {
  return Object.prototype.toString.call(e).slice(8, -1).toLowerCase()
}

function tg(e) {
  return "object" === eg(e)
}

function ng(e) {
  return "function" == typeof e
}

function rg(e) {
  return function () {
    try {
      return e.apply(e, arguments)
    } catch (t) {
      console.error(t)
    }
  }
}
const og = "REJECTED",
  ig = "NOT_PENDING";
class ag {
  constructor({
    createPromise: e,
    retryRule: t = og
  } = {}) {
    this.createPromise = e, this.status = null, this.promise = null, this.retryRule = t
  }
  get needRetry() {
    if (!this.status) return !0;
    switch (this.retryRule) {
      case og:
        return this.status === Zh;
      case ig:
        return this.status !== Xh
    }
  }
  exec() {
    return this.needRetry ? (this.status = Xh, this.promise = this.createPromise().then((e => (this.status = "fulfilled", Promise.resolve(e))), (e => (this.status = Zh, Promise.reject(e)))), this.promise) : this.promise
  }
}

function sg(e) {
  return e && "string" == typeof e ? JSON.parse(e) : e
}
const cg = sg([]),
  ug = "mp-weixin";
sg("");
const lg = sg("[]") || [];
let fg = "";
try {
  fg = "__UNI__4EB86B2"
} catch (Vs) {}
let pg = {};

function dg(e, t = {}) {
  var n, r;
  return n = pg, r = e, Object.prototype.hasOwnProperty.call(n, r) || (pg[e] = t), pg[e]
}
const hg = ["invoke", "success", "fail", "complete"],
  gg = dg("_globalUniCloudInterceptor");

function yg(e, t) {
  gg[e] || (gg[e] = {}), tg(t) && Object.keys(t).forEach((n => {
    hg.indexOf(n) > -1 && function (e, t, n) {
      let r = gg[e][t];
      r || (r = gg[e][t] = []), -1 === r.indexOf(n) && ng(n) && r.push(n)
    }(e, n, t[n])
  }))
}

function mg(e, t) {
  gg[e] || (gg[e] = {}), tg(t) ? Object.keys(t).forEach((n => {
    hg.indexOf(n) > -1 && function (e, t, n) {
      const r = gg[e][t];
      if (!r) return;
      const o = r.indexOf(n);
      o > -1 && r.splice(o, 1)
    }(e, n, t[n])
  })) : delete gg[e]
}

function bg(e, t) {
  return e && 0 !== e.length ? e.reduce(((e, n) => e.then((() => n(t)))), Promise.resolve()) : Promise.resolve()
}

function vg(e, t) {
  return gg[e] && gg[e][t] || []
}

function wg(e) {
  yg("callObject", e)
}
const Sg = dg("_globalUniCloudListener"),
  xg = "response",
  Ag = "needLogin",
  _g = "refreshToken",
  Pg = "clientdb",
  kg = "cloudfunction",
  Tg = "cloudobject";

function Eg(e) {
  return Sg[e] || (Sg[e] = []), Sg[e]
}

function Ig(e, t) {
  const n = Eg(e);
  n.includes(t) || n.push(t)
}

function Og(e, t) {
  const n = Eg(e),
    r = n.indexOf(t); - 1 !== r && n.splice(r, 1)
}

function Cg(e, t) {
  const n = Eg(e);
  for (let r = 0; r < n.length; r++)(0, n[r])(t)
}
let Bg, jg = !1;

function Dg() {
  return Bg || (Bg = new Promise((e => {
    jg && e(),
      function t() {
        if ("function" == typeof getCurrentPages) {
          const t = getCurrentPages();
          t && t[0] && (jg = !0, e())
        }
        jg || setTimeout((() => {
          t()
        }), 30)
      }()
  })), Bg)
}

function Ng(e) {
  const t = {};
  for (const n in e) {
    const r = e[n];
    ng(r) && (t[n] = rg(r))
  }
  return t
}
class Rg extends Error {
  constructor(e) {
    super(e.message), this.errMsg = e.message || e.errMsg || "unknown system error", this.code = this.errCode = e.code || e.errCode || "SYSTEM_ERROR", this.errSubject = this.subject = e.subject || e.errSubject, this.cause = e.cause, this.requestId = e.requestId
  }
  toJson(e = 0) {
    if (!(e >= 10)) return e++, {
      errCode: this.errCode,
      errMsg: this.errMsg,
      errSubject: this.errSubject,
      cause: this.cause && this.cause.toJson ? this.cause.toJson(e) : this.cause
    }
  }
}
var Lg = {
  request: e => Dn.request(e),
  uploadFile: e => Dn.uploadFile(e),
  setStorageSync: (e, t) => Dn.setStorageSync(e, t),
  getStorageSync: e => Dn.getStorageSync(e),
  removeStorageSync: e => Dn.removeStorageSync(e),
  clearStorageSync: () => Dn.clearStorageSync()
};

function Mg(e) {
  return e && Mg(e.__v_raw) || e
}

function Fg() {
  return {
    token: Lg.getStorageSync("uni_id_token") || Lg.getStorageSync("uniIdToken"),
    tokenExpired: Lg.getStorageSync("uni_id_token_expired")
  }
}

function Ug({
  token: e,
  tokenExpired: t
} = {}) {
  e && Lg.setStorageSync("uni_id_token", e), t && Lg.setStorageSync("uni_id_token_expired", t)
}
let qg, $g;

function zg() {
  return qg || (qg = Dn.getSystemInfoSync()), qg
}

function Qg() {
  let e, t;
  try {
    if (Dn.getLaunchOptionsSync) {
      if (Dn.getLaunchOptionsSync.toString().indexOf("not yet implemented") > -1) return;
      const {
        scene: n,
        channel: r
      } = Dn.getLaunchOptionsSync();
      e = r, t = n
    }
  } catch (n) {}
  return {
    channel: e,
    scene: t
  }
}

function Hg() {
  const e = Dn.getLocale && Dn.getLocale() || "en";
  if ($g) return {
    ...$g,
    locale: e,
    LOCALE: e
  };
  const t = zg(),
    {
      deviceId: n,
      osName: r,
      uniPlatform: o,
      appId: i
    } = t,
    a = ["pixelRatio", "brand", "model", "system", "language", "version", "platform", "host", "SDKVersion", "swanNativeVersion", "app", "AppPlatform", "fontSizeSetting"];
  for (let s = 0; s < a.length; s++) delete t[a[s]];
  return $g = {
    PLATFORM: o,
    OS: r,
    APPID: i,
    DEVICEID: n,
    ...Qg(),
    ...t
  }, {
    ...$g,
    locale: e,
    LOCALE: e
  }
}
var Wg = function (e, t) {
    let n = "";
    return Object.keys(e).sort().forEach((function (t) {
      e[t] && (n = n + "&" + t + "=" + e[t])
    })), n = n.slice(1), Kh(n, t).toString()
  },
  Vg = function (e, t) {
    return new Promise(((n, r) => {
      t(Object.assign(e, {
        complete(e) {
          e || (e = {});
          const t = e.data && e.data.header && e.data.header["x-serverless-request-id"] || e.header && e.header["request-id"];
          if (!e.statusCode || e.statusCode >= 400) return r(new Rg({
            code: "SYS_ERR",
            message: e.errMsg || "request:fail",
            requestId: t
          }));
          const o = e.data;
          if (o.error) return r(new Rg({
            code: o.error.code,
            message: o.error.message,
            requestId: t
          }));
          o.result = o.data, o.requestId = t, delete o.data, n(o)
        }
      }))
    }))
  },
  Kg = function (e) {
    return Gh.stringify(Jh.parse(e))
  },
  Jg = class {
    constructor(e) {
      ["spaceId", "clientSecret"].forEach((t => {
        if (!Object.prototype.hasOwnProperty.call(e, t)) throw new Error(`${t} required`)
      })), this.config = Object.assign({}, {
        endpoint: 0 === e.spaceId.indexOf("mp-") ? "https://api.next.bspapp.com" : "https://api.bspapp.com"
      }, e), this.config.provider = "aliyun", this.config.requestUrl = this.config.endpoint + "/client", this.config.envType = this.config.envType || "public", this.config.accessTokenKey = "access_token_" + this.config.spaceId, this.adapter = Lg, this._getAccessTokenPromiseHub = new ag({
        createPromise: () => this.requestAuth(this.setupRequest({
          method: "serverless.auth.user.anonymousAuthorize",
          params: "{}"
        }, "auth")).then((e => {
          if (!e.result || !e.result.accessToken) throw new Rg({
            code: "AUTH_FAILED",
            message: "获取accessToken失败"
          });
          this.setAccessToken(e.result.accessToken)
        })),
        retryRule: ig
      })
    }
    get hasAccessToken() {
      return !!this.accessToken
    }
    setAccessToken(e) {
      this.accessToken = e
    }
    requestWrapped(e) {
      return Vg(e, this.adapter.request)
    }
    requestAuth(e) {
      return this.requestWrapped(e)
    }
    request(e, t) {
      return Promise.resolve().then((() => this.hasAccessToken ? t ? this.requestWrapped(e) : this.requestWrapped(e).catch((t => new Promise(((e, n) => {
        !t || "GATEWAY_INVALID_TOKEN" !== t.code && "InvalidParameter.InvalidToken" !== t.code ? n(t) : e()
      })).then((() => this.getAccessToken())).then((() => {
        const t = this.rebuildRequest(e);
        return this.request(t, !0)
      })))) : this.getAccessToken().then((() => {
        const t = this.rebuildRequest(e);
        return this.request(t, !0)
      }))))
    }
    rebuildRequest(e) {
      const t = Object.assign({}, e);
      return t.data.token = this.accessToken, t.header["x-basement-token"] = this.accessToken, t.header["x-serverless-sign"] = Wg(t.data, this.config.clientSecret), t
    }
    setupRequest(e, t) {
      const n = Object.assign({}, e, {
          spaceId: this.config.spaceId,
          timestamp: Date.now()
        }),
        r = {
          "Content-Type": "application/json"
        };
      return "auth" !== t && (n.token = this.accessToken, r["x-basement-token"] = this.accessToken), r["x-serverless-sign"] = Wg(n, this.config.clientSecret), {
        url: this.config.requestUrl,
        method: "POST",
        data: n,
        dataType: "json",
        header: r
      }
    }
    getAccessToken() {
      return this._getAccessTokenPromiseHub.exec()
    }
    async authorize() {
      await this.getAccessToken()
    }
    callFunction(e) {
      const t = {
        method: "serverless.function.runtime.invoke",
        params: JSON.stringify({
          functionTarget: e.name,
          functionArgs: e.data || {}
        })
      };
      return this.request(this.setupRequest(t))
    }
    getOSSUploadOptionsFromPath(e) {
      const t = {
        method: "serverless.file.resource.generateProximalSign",
        params: JSON.stringify(e)
      };
      return this.request(this.setupRequest(t))
    }
    uploadFileToOSS({
      url: e,
      formData: t,
      name: n,
      filePath: r,
      fileType: o,
      onUploadProgress: i
    }) {
      return new Promise(((a, s) => {
        const c = this.adapter.uploadFile({
          url: e,
          formData: t,
          name: n,
          filePath: r,
          fileType: o,
          header: {
            "X-OSS-server-side-encrpytion": "AES256"
          },
          success(e) {
            e && e.statusCode < 400 ? a(e) : s(new Rg({
              code: "UPLOAD_FAILED",
              message: "文件上传失败"
            }))
          },
          fail(e) {
            s(new Rg({
              code: e.code || "UPLOAD_FAILED",
              message: e.message || e.errMsg || "文件上传失败"
            }))
          }
        });
        "function" == typeof i && c && "function" == typeof c.onProgressUpdate && c.onProgressUpdate((e => {
          i({
            loaded: e.totalBytesSent,
            total: e.totalBytesExpectedToSend
          })
        }))
      }))
    }
    reportOSSUpload(e) {
      const t = {
        method: "serverless.file.resource.report",
        params: JSON.stringify(e)
      };
      return this.request(this.setupRequest(t))
    }
    async uploadFile({
      filePath: e,
      cloudPath: t,
      fileType: n = "image",
      cloudPathAsRealPath: r = !1,
      onUploadProgress: o,
      config: i
    }) {
      if ("string" !== eg(t)) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath必须为字符串类型"
      });
      if (!(t = t.trim())) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath不可为空"
      });
      if (/:\/\//.test(t)) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath不合法"
      });
      const a = i && i.envType || this.config.envType;
      if (r && ("/" !== t[0] && (t = "/" + t), t.indexOf("\\") > -1)) throw new Rg({
        code: "INVALID_PARAM",
        message: "使用cloudPath作为路径时，cloudPath不可包含“\\”"
      });
      const s = (await this.getOSSUploadOptionsFromPath({
          env: a,
          filename: r ? t.split("/").pop() : t,
          fileId: r ? t : void 0
        })).result,
        c = "https://" + s.cdnDomain + "/" + s.ossPath,
        {
          securityToken: u,
          accessKeyId: l,
          signature: f,
          host: p,
          ossPath: d,
          id: h,
          policy: g,
          ossCallbackUrl: y
        } = s,
        m = {
          "Cache-Control": "max-age=2592000",
          "Content-Disposition": "attachment",
          OSSAccessKeyId: l,
          Signature: f,
          host: p,
          id: h,
          key: d,
          policy: g,
          success_action_status: 200
        };
      if (u && (m["x-oss-security-token"] = u), y) {
        const e = JSON.stringify({
          callbackUrl: y,
          callbackBody: JSON.stringify({
            fileId: h,
            spaceId: this.config.spaceId
          }),
          callbackBodyType: "application/json"
        });
        m.callback = Kg(e)
      }
      const b = {
        url: "https://" + s.host,
        formData: m,
        fileName: "file",
        name: "file",
        filePath: e,
        fileType: n
      };
      if (await this.uploadFileToOSS(Object.assign({}, b, {
          onUploadProgress: o
        })), y) return {
        success: !0,
        filePath: e,
        fileID: c
      };
      if ((await this.reportOSSUpload({
          id: h
        })).success) return {
        success: !0,
        filePath: e,
        fileID: c
      };
      throw new Rg({
        code: "UPLOAD_FAILED",
        message: "文件上传失败"
      })
    }
    getTempFileURL({
      fileList: e
    } = {}) {
      return new Promise(((t, n) => {
        Array.isArray(e) && 0 !== e.length || n(new Rg({
          code: "INVALID_PARAM",
          message: "fileList的元素必须是非空的字符串"
        })), t({
          fileList: e.map((e => ({
            fileID: e,
            tempFileURL: e
          })))
        })
      }))
    }
    async getFileInfo({
      fileList: e
    } = {}) {
      if (!Array.isArray(e) || 0 === e.length) throw new Rg({
        code: "INVALID_PARAM",
        message: "fileList的元素必须是非空的字符串"
      });
      const t = {
        method: "serverless.file.resource.info",
        params: JSON.stringify({
          id: e.map((e => e.split("?")[0])).join(",")
        })
      };
      return {
        fileList: (await this.request(this.setupRequest(t))).result
      }
    }
  },
  Gg = {
    init(e) {
      const t = new Jg(e),
        n = {
          signInAnonymously: function () {
            return t.authorize()
          },
          getLoginState: function () {
            return Promise.resolve(!1)
          }
        };
      return t.auth = function () {
        return n
      }, t.customAuth = t.auth, t
    }
  };
const Yg = "undefined" != typeof location && "http:" === location.protocol ? "http:" : "https:";
var Xg;
! function (e) {
  e.local = "local", e.none = "none", e.session = "session"
}(Xg || (Xg = {}));
var Zg = function () {},
  ey = Hh((function (e, t) {
    var n;
    e.exports = (n = Vh, function (e) {
      var t = n,
        r = t.lib,
        o = r.WordArray,
        i = r.Hasher,
        a = t.algo,
        s = [],
        c = [];
      ! function () {
        function t(t) {
          for (var n = e.sqrt(t), r = 2; r <= n; r++)
            if (!(t % r)) return !1;
          return !0
        }

        function n(e) {
          return 4294967296 * (e - (0 | e)) | 0
        }
        for (var r = 2, o = 0; o < 64;) t(r) && (o < 8 && (s[o] = n(e.pow(r, .5))), c[o] = n(e.pow(r, 1 / 3)), o++), r++
      }();
      var u = [],
        l = a.SHA256 = i.extend({
          _doReset: function () {
            this._hash = new o.init(s.slice(0))
          },
          _doProcessBlock: function (e, t) {
            for (var n = this._hash.words, r = n[0], o = n[1], i = n[2], a = n[3], s = n[4], l = n[5], f = n[6], p = n[7], d = 0; d < 64; d++) {
              if (d < 16) u[d] = 0 | e[t + d];
              else {
                var h = u[d - 15],
                  g = (h << 25 | h >>> 7) ^ (h << 14 | h >>> 18) ^ h >>> 3,
                  y = u[d - 2],
                  m = (y << 15 | y >>> 17) ^ (y << 13 | y >>> 19) ^ y >>> 10;
                u[d] = g + u[d - 7] + m + u[d - 16]
              }
              var b = r & o ^ r & i ^ o & i,
                v = (r << 30 | r >>> 2) ^ (r << 19 | r >>> 13) ^ (r << 10 | r >>> 22),
                w = p + ((s << 26 | s >>> 6) ^ (s << 21 | s >>> 11) ^ (s << 7 | s >>> 25)) + (s & l ^ ~s & f) + c[d] + u[d];
              p = f, f = l, l = s, s = a + w | 0, a = i, i = o, o = r, r = w + (v + b) | 0
            }
            n[0] = n[0] + r | 0, n[1] = n[1] + o | 0, n[2] = n[2] + i | 0, n[3] = n[3] + a | 0, n[4] = n[4] + s | 0, n[5] = n[5] + l | 0, n[6] = n[6] + f | 0, n[7] = n[7] + p | 0
          },
          _doFinalize: function () {
            var t = this._data,
              n = t.words,
              r = 8 * this._nDataBytes,
              o = 8 * t.sigBytes;
            return n[o >>> 5] |= 128 << 24 - o % 32, n[14 + (o + 64 >>> 9 << 4)] = e.floor(r / 4294967296), n[15 + (o + 64 >>> 9 << 4)] = r, t.sigBytes = 4 * n.length, this._process(), this._hash
          },
          clone: function () {
            var e = i.clone.call(this);
            return e._hash = this._hash.clone(), e
          }
        });
      t.SHA256 = i._createHelper(l), t.HmacSHA256 = i._createHmacHelper(l)
    }(Math), n.SHA256)
  })),
  ty = ey,
  ny = Hh((function (e, t) {
    e.exports = Vh.HmacSHA256
  }));
const ry = () => {
  let e;
  if (!Promise) {
    e = () => {}, e.promise = {};
    const t = () => {
      throw new Rg({
        message: 'Your Node runtime does support ES6 Promises. Set "global.Promise" to your preferred implementation of promises.'
      })
    };
    return Object.defineProperty(e.promise, "then", {
      get: t
    }), Object.defineProperty(e.promise, "catch", {
      get: t
    }), e
  }
  const t = new Promise(((t, n) => {
    e = (e, r) => e ? n(e) : t(r)
  }));
  return e.promise = t, e
};

function oy(e) {
  return void 0 === e
}

function iy(e) {
  return "[object Null]" === Object.prototype.toString.call(e)
}
var ay;
! function (e) {
  e.WEB = "web", e.WX_MP = "wx_mp"
}(ay || (ay = {}));
const sy = {
    adapter: null,
    runtime: void 0
  },
  cy = ["anonymousUuidKey"];
class uy extends Zg {
  constructor() {
    super(), sy.adapter.root.tcbObject || (sy.adapter.root.tcbObject = {})
  }
  setItem(e, t) {
    sy.adapter.root.tcbObject[e] = t
  }
  getItem(e) {
    return sy.adapter.root.tcbObject[e]
  }
  removeItem(e) {
    delete sy.adapter.root.tcbObject[e]
  }
  clear() {
    delete sy.adapter.root.tcbObject
  }
}

function ly(e, t) {
  switch (e) {
    case "local":
      return t.localStorage || new uy;
    case "none":
      return new uy;
    default:
      return t.sessionStorage || new uy
  }
}
class fy {
  constructor(e) {
    if (!this._storage) {
      this._persistence = sy.adapter.primaryStorage || e.persistence, this._storage = ly(this._persistence, sy.adapter);
      const t = `access_token_${e.env}`,
        n = `access_token_expire_${e.env}`,
        r = `refresh_token_${e.env}`,
        o = `anonymous_uuid_${e.env}`,
        i = `login_type_${e.env}`,
        a = `user_info_${e.env}`;
      this.keys = {
        accessTokenKey: t,
        accessTokenExpireKey: n,
        refreshTokenKey: r,
        anonymousUuidKey: o,
        loginTypeKey: i,
        userInfoKey: a
      }
    }
  }
  updatePersistence(e) {
    if (e === this._persistence) return;
    const t = "local" === this._persistence;
    this._persistence = e;
    const n = ly(e, sy.adapter);
    for (const r in this.keys) {
      const e = this.keys[r];
      if (t && cy.includes(r)) continue;
      const o = this._storage.getItem(e);
      oy(o) || iy(o) || (n.setItem(e, o), this._storage.removeItem(e))
    }
    this._storage = n
  }
  setStore(e, t, n) {
    if (!this._storage) return;
    const r = {
        version: n || "localCachev1",
        content: t
      },
      o = JSON.stringify(r);
    try {
      this._storage.setItem(e, o)
    } catch (i) {
      throw i
    }
  }
  getStore(e, t) {
    try {
      if (!this._storage) return
    } catch (r) {
      return ""
    }
    t = t || "localCachev1";
    const n = this._storage.getItem(e);
    return n && n.indexOf(t) >= 0 ? JSON.parse(n).content : ""
  }
  removeStore(e) {
    this._storage.removeItem(e)
  }
}
const py = {},
  dy = {};

function hy(e) {
  return py[e]
}
class gy {
  constructor(e, t) {
    this.data = t || null, this.name = e
  }
}
class yy extends gy {
  constructor(e, t) {
    super("error", {
      error: e,
      data: t
    }), this.error = e
  }
}
const by = new class {
  constructor() {
    this._listeners = {}
  }
  on(e, t) {
    return function (e, t, n) {
      n[e] = n[e] || [], n[e].push(t)
    }(e, t, this._listeners), this
  }
  off(e, t) {
    return function (e, t, n) {
      if (n && n[e]) {
        const r = n[e].indexOf(t); - 1 !== r && n[e].splice(r, 1)
      }
    }(e, t, this._listeners), this
  }
  fire(e, t) {
    if (e instanceof yy) return console.error(e.error), this;
    const n = "string" == typeof e ? new gy(e, t || {}) : e,
      r = n.name;
    if (this._listens(r)) {
      n.target = this;
      const e = this._listeners[r] ? [...this._listeners[r]] : [];
      for (const t of e) t.call(this, n)
    }
    return this
  }
  _listens(e) {
    return this._listeners[e] && this._listeners[e].length > 0
  }
};

function vy(e, t) {
  by.on(e, t)
}

function wy(e, t = {}) {
  by.fire(e, t)
}

function Sy(e, t) {
  by.off(e, t)
}
const xy = "loginStateChanged",
  Ay = "loginStateExpire",
  _y = "loginTypeChanged",
  Py = "anonymousConverted",
  ky = "refreshAccessToken";
var Ty;
! function (e) {
  e.ANONYMOUS = "ANONYMOUS", e.WECHAT = "WECHAT", e.WECHAT_PUBLIC = "WECHAT-PUBLIC", e.WECHAT_OPEN = "WECHAT-OPEN", e.CUSTOM = "CUSTOM", e.EMAIL = "EMAIL", e.USERNAME = "USERNAME", e.NULL = "NULL"
}(Ty || (Ty = {}));
const Ey = ["auth.getJwt", "auth.logout", "auth.signInWithTicket", "auth.signInAnonymously", "auth.signIn", "auth.fetchAccessTokenWithRefreshToken", "auth.signUpWithEmailAndPassword", "auth.activateEndUserMail", "auth.sendPasswordResetEmail", "auth.resetPasswordWithToken", "auth.isUsernameRegistered"],
  Iy = {
    "X-SDK-Version": "1.3.5"
  };

function Oy(e, t, n) {
  const r = e[t];
  e[t] = function (t) {
    const o = {},
      i = {};
    n.forEach((n => {
      const {
        data: r,
        headers: a
      } = n.call(e, t);
      Object.assign(o, r), Object.assign(i, a)
    }));
    const a = t.data;
    return a && (() => {
      var e;
      if (e = a, "[object FormData]" !== Object.prototype.toString.call(e)) t.data = {
        ...a,
        ...o
      };
      else
        for (const t in o) a.append(t, o[t])
    })(), t.headers = {
      ...t.headers || {},
      ...i
    }, r.call(e, t)
  }
}

function Cy() {
  const e = Math.random().toString(16).slice(2);
  return {
    data: {
      seqId: e
    },
    headers: {
      ...Iy,
      "x-seqid": e
    }
  }
}
class By {
  constructor(e = {}) {
    var t;
    this.config = e, this._reqClass = new sy.adapter.reqClass({
      timeout: this.config.timeout,
      timeoutMsg: `请求在${this.config.timeout/1e3}s内未完成，已中断`,
      restrictedMethods: ["post"]
    }), this._cache = hy(this.config.env), this._localCache = (t = this.config.env, dy[t]), Oy(this._reqClass, "post", [Cy]), Oy(this._reqClass, "upload", [Cy]), Oy(this._reqClass, "download", [Cy])
  }
  async post(e) {
    return await this._reqClass.post(e)
  }
  async upload(e) {
    return await this._reqClass.upload(e)
  }
  async download(e) {
    return await this._reqClass.download(e)
  }
  async refreshAccessToken() {
    let e, t;
    this._refreshAccessTokenPromise || (this._refreshAccessTokenPromise = this._refreshAccessToken());
    try {
      e = await this._refreshAccessTokenPromise
    } catch (n) {
      t = n
    }
    if (this._refreshAccessTokenPromise = null, this._shouldRefreshAccessTokenHook = null, t) throw t;
    return e
  }
  async _refreshAccessToken() {
    const {
      accessTokenKey: e,
      accessTokenExpireKey: t,
      refreshTokenKey: n,
      loginTypeKey: r,
      anonymousUuidKey: o
    } = this._cache.keys;
    this._cache.removeStore(e), this._cache.removeStore(t);
    let i = this._cache.getStore(n);
    if (!i) throw new Rg({
      message: "未登录CloudBase"
    });
    const a = {
        refresh_token: i
      },
      s = await this.request("auth.fetchAccessTokenWithRefreshToken", a);
    if (s.data.code) {
      const {
        code: e
      } = s.data;
      if ("SIGN_PARAM_INVALID" === e || "REFRESH_TOKEN_EXPIRED" === e || "INVALID_REFRESH_TOKEN" === e) {
        if (this._cache.getStore(r) === Ty.ANONYMOUS && "INVALID_REFRESH_TOKEN" === e) {
          const e = this._cache.getStore(o),
            t = this._cache.getStore(n),
            r = await this.send("auth.signInAnonymously", {
              anonymous_uuid: e,
              refresh_token: t
            });
          return this.setRefreshToken(r.refresh_token), this._refreshAccessToken()
        }
        wy(Ay), this._cache.removeStore(n)
      }
      throw new Rg({
        code: s.data.code,
        message: `刷新access token失败：${s.data.code}`
      })
    }
    if (s.data.access_token) return wy(ky), this._cache.setStore(e, s.data.access_token), this._cache.setStore(t, s.data.access_token_expire + Date.now()), {
      accessToken: s.data.access_token,
      accessTokenExpire: s.data.access_token_expire
    };
    s.data.refresh_token && (this._cache.removeStore(n), this._cache.setStore(n, s.data.refresh_token), this._refreshAccessToken())
  }
  async getAccessToken() {
    const {
      accessTokenKey: e,
      accessTokenExpireKey: t,
      refreshTokenKey: n
    } = this._cache.keys;
    if (!this._cache.getStore(n)) throw new Rg({
      message: "refresh token不存在，登录状态异常"
    });
    let r = this._cache.getStore(e),
      o = this._cache.getStore(t),
      i = !0;
    return this._shouldRefreshAccessTokenHook && !(await this._shouldRefreshAccessTokenHook(r, o)) && (i = !1), (!r || !o || o < Date.now()) && i ? this.refreshAccessToken() : {
      accessToken: r,
      accessTokenExpire: o
    }
  }
  async request(e, t, n) {
    const r = `x-tcb-trace_${this.config.env}`;
    let o = "application/x-www-form-urlencoded";
    const i = {
      action: e,
      env: this.config.env,
      dataVersion: "2019-08-16",
      ...t
    };
    if (-1 === Ey.indexOf(e)) {
      const {
        refreshTokenKey: e
      } = this._cache.keys;
      this._cache.getStore(e) && (i.access_token = (await this.getAccessToken()).accessToken)
    }
    let a;
    if ("storage.uploadFile" === e) {
      a = new FormData;
      for (let e in a) a.hasOwnProperty(e) && void 0 !== a[e] && a.append(e, i[e]);
      o = "multipart/form-data"
    } else {
      o = "application/json", a = {};
      for (let e in i) void 0 !== i[e] && (a[e] = i[e])
    }
    let s = {
      headers: {
        "content-type": o
      }
    };
    n && n.onUploadProgress && (s.onUploadProgress = n.onUploadProgress);
    const c = this._localCache.getStore(r);
    c && (s.headers["X-TCB-Trace"] = c);
    const {
      parse: u,
      inQuery: l,
      search: f
    } = t;
    let p = {
      env: this.config.env
    };
    u && (p.parse = !0), l && (p = {
      ...l,
      ...p
    });
    let d = function (e, t, n = {}) {
      const r = /\?/.test(t);
      let o = "";
      for (let i in n) "" === o ? !r && (t += "?") : o += "&", o += `${i}=${encodeURIComponent(n[i])}`;
      return /^http(s)?\:\/\//.test(t += o) ? t : `${e}${t}`
    }(Yg, "//tcb-api.tencentcloudapi.com/web", p);
    f && (d += f);
    const h = await this.post({
        url: d,
        data: a,
        ...s
      }),
      g = h.header && h.header["x-tcb-trace"];
    if (g && this._localCache.setStore(r, g), 200 !== Number(h.status) && 200 !== Number(h.statusCode) || !h.data) throw new Rg({
      code: "NETWORK_ERROR",
      message: "network request error"
    });
    return h
  }
  async send(e, t = {}) {
    const n = await this.request(e, t, {
      onUploadProgress: t.onUploadProgress
    });
    if ("ACCESS_TOKEN_EXPIRED" === n.data.code && -1 === Ey.indexOf(e)) {
      await this.refreshAccessToken();
      const n = await this.request(e, t, {
        onUploadProgress: t.onUploadProgress
      });
      if (n.data.code) throw new Rg({
        code: n.data.code,
        message: n.data.message
      });
      return n.data
    }
    if (n.data.code) throw new Rg({
      code: n.data.code,
      message: n.data.message
    });
    return n.data
  }
  setRefreshToken(e) {
    const {
      accessTokenKey: t,
      accessTokenExpireKey: n,
      refreshTokenKey: r
    } = this._cache.keys;
    this._cache.removeStore(t), this._cache.removeStore(n), this._cache.setStore(r, e)
  }
}
const jy = {};

function Dy(e) {
  return jy[e]
}
class Ny {
  constructor(e) {
    this.config = e, this._cache = hy(e.env), this._request = Dy(e.env)
  }
  setRefreshToken(e) {
    const {
      accessTokenKey: t,
      accessTokenExpireKey: n,
      refreshTokenKey: r
    } = this._cache.keys;
    this._cache.removeStore(t), this._cache.removeStore(n), this._cache.setStore(r, e)
  }
  setAccessToken(e, t) {
    const {
      accessTokenKey: n,
      accessTokenExpireKey: r
    } = this._cache.keys;
    this._cache.setStore(n, e), this._cache.setStore(r, t)
  }
  async refreshUserInfo() {
    const {
      data: e
    } = await this._request.send("auth.getUserInfo", {});
    return this.setLocalUserInfo(e), e
  }
  setLocalUserInfo(e) {
    const {
      userInfoKey: t
    } = this._cache.keys;
    this._cache.setStore(t, e)
  }
}
class Ry {
  constructor(e) {
    if (!e) throw new Rg({
      code: "PARAM_ERROR",
      message: "envId is not defined"
    });
    this._envId = e, this._cache = hy(this._envId), this._request = Dy(this._envId), this.setUserInfo()
  }
  linkWithTicket(e) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "ticket must be string"
    });
    return this._request.send("auth.linkWithTicket", {
      ticket: e
    })
  }
  linkWithRedirect(e) {
    e.signInWithRedirect()
  }
  updatePassword(e, t) {
    return this._request.send("auth.updatePassword", {
      oldPassword: t,
      newPassword: e
    })
  }
  updateEmail(e) {
    return this._request.send("auth.updateEmail", {
      newEmail: e
    })
  }
  updateUsername(e) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "username must be a string"
    });
    return this._request.send("auth.updateUsername", {
      username: e
    })
  }
  async getLinkedUidList() {
    const {
      data: e
    } = await this._request.send("auth.getLinkedUidList", {});
    let t = !1;
    const {
      users: n
    } = e;
    return n.forEach((e => {
      e.wxOpenId && e.wxPublicId && (t = !0)
    })), {
      users: n,
      hasPrimaryUid: t
    }
  }
  setPrimaryUid(e) {
    return this._request.send("auth.setPrimaryUid", {
      uid: e
    })
  }
  unlink(e) {
    return this._request.send("auth.unlink", {
      platform: e
    })
  }
  async update(e) {
    const {
      nickName: t,
      gender: n,
      avatarUrl: r,
      province: o,
      country: i,
      city: a
    } = e, {
      data: s
    } = await this._request.send("auth.updateUserInfo", {
      nickName: t,
      gender: n,
      avatarUrl: r,
      province: o,
      country: i,
      city: a
    });
    this.setLocalUserInfo(s)
  }
  async refresh() {
    const {
      data: e
    } = await this._request.send("auth.getUserInfo", {});
    return this.setLocalUserInfo(e), e
  }
  setUserInfo() {
    const {
      userInfoKey: e
    } = this._cache.keys, t = this._cache.getStore(e);
    ["uid", "loginType", "openid", "wxOpenId", "wxPublicId", "unionId", "qqMiniOpenId", "email", "hasPassword", "customUserId", "nickName", "gender", "avatarUrl"].forEach((e => {
      this[e] = t[e]
    })), this.location = {
      country: t.country,
      province: t.province,
      city: t.city
    }
  }
  setLocalUserInfo(e) {
    const {
      userInfoKey: t
    } = this._cache.keys;
    this._cache.setStore(t, e), this.setUserInfo()
  }
}
class Ly {
  constructor(e) {
    if (!e) throw new Rg({
      code: "PARAM_ERROR",
      message: "envId is not defined"
    });
    this._cache = hy(e);
    const {
      refreshTokenKey: t,
      accessTokenKey: n,
      accessTokenExpireKey: r
    } = this._cache.keys, o = this._cache.getStore(t), i = this._cache.getStore(n), a = this._cache.getStore(r);
    this.credential = {
      refreshToken: o,
      accessToken: i,
      accessTokenExpire: a
    }, this.user = new Ry(e)
  }
  get isAnonymousAuth() {
    return this.loginType === Ty.ANONYMOUS
  }
  get isCustomAuth() {
    return this.loginType === Ty.CUSTOM
  }
  get isWeixinAuth() {
    return this.loginType === Ty.WECHAT || this.loginType === Ty.WECHAT_OPEN || this.loginType === Ty.WECHAT_PUBLIC
  }
  get loginType() {
    return this._cache.getStore(this._cache.keys.loginTypeKey)
  }
}
class My extends Ny {
  async signIn() {
    this._cache.updatePersistence("local");
    const {
      anonymousUuidKey: e,
      refreshTokenKey: t
    } = this._cache.keys, n = this._cache.getStore(e) || void 0, r = this._cache.getStore(t) || void 0, o = await this._request.send("auth.signInAnonymously", {
      anonymous_uuid: n,
      refresh_token: r
    });
    if (o.uuid && o.refresh_token) {
      this._setAnonymousUUID(o.uuid), this.setRefreshToken(o.refresh_token), await this._request.refreshAccessToken(), wy(xy), wy(_y, {
        env: this.config.env,
        loginType: Ty.ANONYMOUS,
        persistence: "local"
      });
      const e = new Ly(this.config.env);
      return await e.user.refresh(), e
    }
    throw new Rg({
      message: "匿名登录失败"
    })
  }
  async linkAndRetrieveDataWithTicket(e) {
    const {
      anonymousUuidKey: t,
      refreshTokenKey: n
    } = this._cache.keys, r = this._cache.getStore(t), o = this._cache.getStore(n), i = await this._request.send("auth.linkAndRetrieveDataWithTicket", {
      anonymous_uuid: r,
      refresh_token: o,
      ticket: e
    });
    if (i.refresh_token) return this._clearAnonymousUUID(), this.setRefreshToken(i.refresh_token), await this._request.refreshAccessToken(), wy(Py, {
      env: this.config.env
    }), wy(_y, {
      loginType: Ty.CUSTOM,
      persistence: "local"
    }), {
      credential: {
        refreshToken: i.refresh_token
      }
    };
    throw new Rg({
      message: "匿名转化失败"
    })
  }
  _setAnonymousUUID(e) {
    const {
      anonymousUuidKey: t,
      loginTypeKey: n
    } = this._cache.keys;
    this._cache.removeStore(t), this._cache.setStore(t, e), this._cache.setStore(n, Ty.ANONYMOUS)
  }
  _clearAnonymousUUID() {
    this._cache.removeStore(this._cache.keys.anonymousUuidKey)
  }
}
class Fy extends Ny {
  async signIn(e) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "ticket must be a string"
    });
    const {
      refreshTokenKey: t
    } = this._cache.keys, n = await this._request.send("auth.signInWithTicket", {
      ticket: e,
      refresh_token: this._cache.getStore(t) || ""
    });
    if (n.refresh_token) return this.setRefreshToken(n.refresh_token), await this._request.refreshAccessToken(), wy(xy), wy(_y, {
      env: this.config.env,
      loginType: Ty.CUSTOM,
      persistence: this.config.persistence
    }), await this.refreshUserInfo(), new Ly(this.config.env);
    throw new Rg({
      message: "自定义登录失败"
    })
  }
}
class Uy extends Ny {
  async signIn(e, t) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "email must be a string"
    });
    const {
      refreshTokenKey: n
    } = this._cache.keys, r = await this._request.send("auth.signIn", {
      loginType: "EMAIL",
      email: e,
      password: t,
      refresh_token: this._cache.getStore(n) || ""
    }), {
      refresh_token: o,
      access_token: i,
      access_token_expire: a
    } = r;
    if (o) return this.setRefreshToken(o), i && a ? this.setAccessToken(i, a) : await this._request.refreshAccessToken(), await this.refreshUserInfo(), wy(xy), wy(_y, {
      env: this.config.env,
      loginType: Ty.EMAIL,
      persistence: this.config.persistence
    }), new Ly(this.config.env);
    throw r.code ? new Rg({
      code: r.code,
      message: `邮箱登录失败: ${r.message}`
    }) : new Rg({
      message: "邮箱登录失败"
    })
  }
  async activate(e) {
    return this._request.send("auth.activateEndUserMail", {
      token: e
    })
  }
  async resetPasswordWithToken(e, t) {
    return this._request.send("auth.resetPasswordWithToken", {
      token: e,
      newPassword: t
    })
  }
}
class qy extends Ny {
  async signIn(e, t) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "username must be a string"
    });
    "string" != typeof t && (t = "", console.warn("password is empty"));
    const {
      refreshTokenKey: n
    } = this._cache.keys, r = await this._request.send("auth.signIn", {
      loginType: Ty.USERNAME,
      username: e,
      password: t,
      refresh_token: this._cache.getStore(n) || ""
    }), {
      refresh_token: o,
      access_token_expire: i,
      access_token: a
    } = r;
    if (o) return this.setRefreshToken(o), a && i ? this.setAccessToken(a, i) : await this._request.refreshAccessToken(), await this.refreshUserInfo(), wy(xy), wy(_y, {
      env: this.config.env,
      loginType: Ty.USERNAME,
      persistence: this.config.persistence
    }), new Ly(this.config.env);
    throw r.code ? new Rg({
      code: r.code,
      message: `用户名密码登录失败: ${r.message}`
    }) : new Rg({
      message: "用户名密码登录失败"
    })
  }
}
class $y {
  constructor(e) {
    this.config = e, this._cache = hy(e.env), this._request = Dy(e.env), this._onAnonymousConverted = this._onAnonymousConverted.bind(this), this._onLoginTypeChanged = this._onLoginTypeChanged.bind(this), vy(_y, this._onLoginTypeChanged)
  }
  get currentUser() {
    const e = this.hasLoginState();
    return e && e.user || null
  }
  get loginType() {
    return this._cache.getStore(this._cache.keys.loginTypeKey)
  }
  anonymousAuthProvider() {
    return new My(this.config)
  }
  customAuthProvider() {
    return new Fy(this.config)
  }
  emailAuthProvider() {
    return new Uy(this.config)
  }
  usernameAuthProvider() {
    return new qy(this.config)
  }
  async signInAnonymously() {
    return new My(this.config).signIn()
  }
  async signInWithEmailAndPassword(e, t) {
    return new Uy(this.config).signIn(e, t)
  }
  signInWithUsernameAndPassword(e, t) {
    return new qy(this.config).signIn(e, t)
  }
  async linkAndRetrieveDataWithTicket(e) {
    return this._anonymousAuthProvider || (this._anonymousAuthProvider = new My(this.config)), vy(Py, this._onAnonymousConverted), await this._anonymousAuthProvider.linkAndRetrieveDataWithTicket(e)
  }
  async signOut() {
    if (this.loginType === Ty.ANONYMOUS) throw new Rg({
      message: "匿名用户不支持登出操作"
    });
    const {
      refreshTokenKey: e,
      accessTokenKey: t,
      accessTokenExpireKey: n
    } = this._cache.keys, r = this._cache.getStore(e);
    if (!r) return;
    const o = await this._request.send("auth.logout", {
      refresh_token: r
    });
    return this._cache.removeStore(e), this._cache.removeStore(t), this._cache.removeStore(n), wy(xy), wy(_y, {
      env: this.config.env,
      loginType: Ty.NULL,
      persistence: this.config.persistence
    }), o
  }
  async signUpWithEmailAndPassword(e, t) {
    return this._request.send("auth.signUpWithEmailAndPassword", {
      email: e,
      password: t
    })
  }
  async sendPasswordResetEmail(e) {
    return this._request.send("auth.sendPasswordResetEmail", {
      email: e
    })
  }
  onLoginStateChanged(e) {
    vy(xy, (() => {
      const t = this.hasLoginState();
      e.call(this, t)
    }));
    const t = this.hasLoginState();
    e.call(this, t)
  }
  onLoginStateExpired(e) {
    vy(Ay, e.bind(this))
  }
  onAccessTokenRefreshed(e) {
    vy(ky, e.bind(this))
  }
  onAnonymousConverted(e) {
    vy(Py, e.bind(this))
  }
  onLoginTypeChanged(e) {
    vy(_y, (() => {
      const t = this.hasLoginState();
      e.call(this, t)
    }))
  }
  async getAccessToken() {
    return {
      accessToken: (await this._request.getAccessToken()).accessToken,
      env: this.config.env
    }
  }
  hasLoginState() {
    const {
      refreshTokenKey: e
    } = this._cache.keys;
    return this._cache.getStore(e) ? new Ly(this.config.env) : null
  }
  async isUsernameRegistered(e) {
    if ("string" != typeof e) throw new Rg({
      code: "PARAM_ERROR",
      message: "username must be a string"
    });
    const {
      data: t
    } = await this._request.send("auth.isUsernameRegistered", {
      username: e
    });
    return t && t.isRegistered
  }
  getLoginState() {
    return Promise.resolve(this.hasLoginState())
  }
  async signInWithTicket(e) {
    return new Fy(this.config).signIn(e)
  }
  shouldRefreshAccessToken(e) {
    this._request._shouldRefreshAccessTokenHook = e.bind(this)
  }
  getUserInfo() {
    return this._request.send("auth.getUserInfo", {}).then((e => e.code ? e : {
      ...e.data,
      requestId: e.seqId
    }))
  }
  getAuthHeader() {
    const {
      refreshTokenKey: e,
      accessTokenKey: t
    } = this._cache.keys, n = this._cache.getStore(e);
    return {
      "x-cloudbase-credentials": this._cache.getStore(t) + "/@@/" + n
    }
  }
  _onAnonymousConverted(e) {
    const {
      env: t
    } = e.data;
    t === this.config.env && this._cache.updatePersistence(this.config.persistence)
  }
  _onLoginTypeChanged(e) {
    const {
      loginType: t,
      persistence: n,
      env: r
    } = e.data;
    r === this.config.env && (this._cache.updatePersistence(n), this._cache.setStore(this._cache.keys.loginTypeKey, t))
  }
}
const zy = function (e, t) {
    t = t || ry();
    const n = Dy(this.config.env),
      {
        cloudPath: r,
        filePath: o,
        onUploadProgress: i,
        fileType: a = "image"
      } = e;
    return n.send("storage.getUploadMetadata", {
      path: r
    }).then((e => {
      const {
        data: {
          url: s,
          authorization: c,
          token: u,
          fileId: l,
          cosFileId: f
        },
        requestId: p
      } = e, d = {
        key: r,
        signature: c,
        "x-cos-meta-fileid": f,
        success_action_status: "201",
        "x-cos-security-token": u
      };
      n.upload({
        url: s,
        data: d,
        file: o,
        name: r,
        fileType: a,
        onUploadProgress: i
      }).then((e => {
        201 === e.statusCode ? t(null, {
          fileID: l,
          requestId: p
        }) : t(new Rg({
          code: "STORAGE_REQUEST_FAIL",
          message: `STORAGE_REQUEST_FAIL: ${e.data}`
        }))
      })).catch((e => {
        t(e)
      }))
    })).catch((e => {
      t(e)
    })), t.promise
  },
  Qy = function (e, t) {
    t = t || ry();
    const n = Dy(this.config.env),
      {
        cloudPath: r
      } = e;
    return n.send("storage.getUploadMetadata", {
      path: r
    }).then((e => {
      t(null, e)
    })).catch((e => {
      t(e)
    })), t.promise
  },
  Hy = function ({
    fileList: e
  }, t) {
    if (t = t || ry(), !e || !Array.isArray(e)) return {
      code: "INVALID_PARAM",
      message: "fileList必须是非空的数组"
    };
    for (let r of e)
      if (!r || "string" != typeof r) return {
        code: "INVALID_PARAM",
        message: "fileList的元素必须是非空的字符串"
      };
    const n = {
      fileid_list: e
    };
    return Dy(this.config.env).send("storage.batchDeleteFile", n).then((e => {
      e.code ? t(null, e) : t(null, {
        fileList: e.data.delete_list,
        requestId: e.requestId
      })
    })).catch((e => {
      t(e)
    })), t.promise
  },
  Wy = function ({
    fileList: e
  }, t) {
    t = t || ry(), e && Array.isArray(e) || t(null, {
      code: "INVALID_PARAM",
      message: "fileList必须是非空的数组"
    });
    let n = [];
    for (let o of e) "object" == typeof o ? (o.hasOwnProperty("fileID") && o.hasOwnProperty("maxAge") || t(null, {
      code: "INVALID_PARAM",
      message: "fileList的元素必须是包含fileID和maxAge的对象"
    }), n.push({
      fileid: o.fileID,
      max_age: o.maxAge
    })) : "string" == typeof o ? n.push({
      fileid: o
    }) : t(null, {
      code: "INVALID_PARAM",
      message: "fileList的元素必须是字符串"
    });
    const r = {
      file_list: n
    };
    return Dy(this.config.env).send("storage.batchGetDownloadUrl", r).then((e => {
      e.code ? t(null, e) : t(null, {
        fileList: e.data.download_list,
        requestId: e.requestId
      })
    })).catch((e => {
      t(e)
    })), t.promise
  },
  Vy = async function ({
    fileID: e
  }, t) {
    const n = (await Wy.call(this, {
      fileList: [{
        fileID: e,
        maxAge: 600
      }]
    })).fileList[0];
    if ("SUCCESS" !== n.code) return t ? t(n) : new Promise((e => {
      e(n)
    }));
    const r = Dy(this.config.env);
    let o = n.download_url;
    if (o = encodeURI(o), !t) return r.download({
      url: o
    });
    t(await r.download({
      url: o
    }))
  }, Ky = function ({
    name: e,
    data: t,
    query: n,
    parse: r,
    search: o
  }, i) {
    const a = i || ry();
    let s;
    try {
      s = t ? JSON.stringify(t) : ""
    } catch (u) {
      return Promise.reject(u)
    }
    if (!e) return Promise.reject(new Rg({
      code: "PARAM_ERROR",
      message: "函数名不能为空"
    }));
    const c = {
      inQuery: n,
      parse: r,
      search: o,
      function_name: e,
      request_data: s
    };
    return Dy(this.config.env).send("functions.invokeFunction", c).then((e => {
      if (e.code) a(null, e);
      else {
        let n = e.data.response_data;
        if (r) a(null, {
          result: n,
          requestId: e.requestId
        });
        else try {
          n = JSON.parse(e.data.response_data), a(null, {
            result: n,
            requestId: e.requestId
          })
        } catch (t) {
          a(new Rg({
            message: "response data must be json"
          }))
        }
      }
      return a.promise
    })).catch((e => {
      a(e)
    })), a.promise
  }, Jy = {
    timeout: 15e3,
    persistence: "session"
  }, Gy = {};
class Yy {
  constructor(e) {
    this.config = e || this.config, this.authObj = void 0
  }
  init(e) {
    switch (sy.adapter || (this.requestClient = new sy.adapter.reqClass({
        timeout: e.timeout || 5e3,
        timeoutMsg: `请求在${(e.timeout||5e3)/1e3}s内未完成，已中断`
      })), this.config = {
        ...Jy,
        ...e
      }, !0) {
      case this.config.timeout > 6e5:
        console.warn("timeout大于可配置上限[10分钟]，已重置为上限数值"), this.config.timeout = 6e5;
        break;
      case this.config.timeout < 100:
        console.warn("timeout小于可配置下限[100ms]，已重置为下限数值"), this.config.timeout = 100
    }
    return new Yy(this.config)
  }
  auth({
    persistence: e
  } = {}) {
    if (this.authObj) return this.authObj;
    const t = e || sy.adapter.primaryStorage || Jy.persistence;
    var n;
    return t !== this.config.persistence && (this.config.persistence = t),
      function (e) {
        const {
          env: t
        } = e;
        py[t] = new fy(e), dy[t] = new fy({
          ...e,
          persistence: "local"
        })
      }(this.config), n = this.config, jy[n.env] = new By(n), this.authObj = new $y(this.config), this.authObj
  }
  on(e, t) {
    return vy.apply(this, [e, t])
  }
  off(e, t) {
    return Sy.apply(this, [e, t])
  }
  callFunction(e, t) {
    return Ky.apply(this, [e, t])
  }
  deleteFile(e, t) {
    return Hy.apply(this, [e, t])
  }
  getTempFileURL(e, t) {
    return Wy.apply(this, [e, t])
  }
  downloadFile(e, t) {
    return Vy.apply(this, [e, t])
  }
  uploadFile(e, t) {
    return zy.apply(this, [e, t])
  }
  getUploadMetadata(e, t) {
    return Qy.apply(this, [e, t])
  }
  registerExtension(e) {
    Gy[e.name] = e
  }
  async invokeExtension(e, t) {
    const n = Gy[e];
    if (!n) throw new Rg({
      message: `扩展${e} 必须先注册`
    });
    return await n.invoke(t, this)
  }
  useAdapters(e) {
    const {
      adapter: t,
      runtime: n
    } = function (e) {
      const t = (n = e, "[object Array]" === Object.prototype.toString.call(n) ? e : [e]);
      var n;
      for (const r of t) {
        const {
          isMatch: e,
          genAdapter: t,
          runtime: n
        } = r;
        if (e()) return {
          adapter: t(),
          runtime: n
        }
      }
    }(e) || {};
    t && (sy.adapter = t), n && (sy.runtime = n)
  }
}
var Xy = new Yy;

function Zy(e, t, n) {
  void 0 === n && (n = {});
  var r = /\?/.test(t),
    o = "";
  for (var i in n) "" === o ? !r && (t += "?") : o += "&", o += i + "=" + encodeURIComponent(n[i]);
  return /^http(s)?:\/\//.test(t += o) ? t : "" + e + t
}
class em {
  post(e) {
    const {
      url: t,
      data: n,
      headers: r
    } = e;
    return new Promise(((e, o) => {
      Lg.request({
        url: Zy("https:", t),
        data: n,
        method: "POST",
        header: r,
        success(t) {
          e(t)
        },
        fail(e) {
          o(e)
        }
      })
    }))
  }
  upload(e) {
    return new Promise(((t, n) => {
      const {
        url: r,
        file: o,
        data: i,
        headers: a,
        fileType: s
      } = e, c = Lg.uploadFile({
        url: Zy("https:", r),
        name: "file",
        formData: Object.assign({}, i),
        filePath: o,
        fileType: s,
        header: a,
        success(e) {
          const n = {
            statusCode: e.statusCode,
            data: e.data || {}
          };
          200 === e.statusCode && i.success_action_status && (n.statusCode = parseInt(i.success_action_status, 10)), t(n)
        },
        fail(e) {
          n(new Error(e.errMsg || "uploadFile:fail"))
        }
      });
      "function" == typeof e.onUploadProgress && c && "function" == typeof c.onProgressUpdate && c.onProgressUpdate((t => {
        e.onUploadProgress({
          loaded: t.totalBytesSent,
          total: t.totalBytesExpectedToSend
        })
      }))
    }))
  }
}
const tm = {
  setItem(e, t) {
    Lg.setStorageSync(e, t)
  },
  getItem: e => Lg.getStorageSync(e),
  removeItem(e) {
    Lg.removeStorageSync(e)
  },
  clear() {
    Lg.clearStorageSync()
  }
};
var nm = {
  genAdapter: function () {
    return {
      root: {},
      reqClass: em,
      localStorage: tm,
      primaryStorage: "local"
    }
  },
  isMatch: function () {
    return !0
  },
  runtime: "uni_app"
};
Xy.useAdapters(nm);
const rm = Xy,
  om = rm.init;
rm.init = function (e) {
  e.env = e.spaceId;
  const t = om.call(this, e);
  t.config.provider = "tencent", t.config.spaceId = e.spaceId;
  const n = t.auth;
  return t.auth = function (e) {
    const t = n.call(this, e);
    return ["linkAndRetrieveDataWithTicket", "signInAnonymously", "signOut", "getAccessToken", "getLoginState", "signInWithTicket", "getUserInfo"].forEach((e => {
      var n;
      t[e] = (n = t[e], function (e) {
        e = e || {};
        const {
          success: t,
          fail: r,
          complete: o
        } = Ng(e);
        if (!(t || r || o)) return n.call(this, e);
        n.call(this, e).then((e => {
          t && t(e), o && o(e)
        }), (e => {
          r && r(e), o && o(e)
        }))
      }).bind(t)
    })), t
  }, t.customAuth = t.auth, t
};
var im = rm,
  am = class extends Jg {
    getAccessToken() {
      return new Promise(((e, t) => {
        const n = "Anonymous_Access_token";
        this.setAccessToken(n), e(n)
      }))
    }
    setupRequest(e, t) {
      const n = Object.assign({}, e, {
          spaceId: this.config.spaceId,
          timestamp: Date.now()
        }),
        r = {
          "Content-Type": "application/json"
        };
      "auth" !== t && (n.token = this.accessToken, r["x-basement-token"] = this.accessToken), r["x-serverless-sign"] = Wg(n, this.config.clientSecret);
      const o = Hg();
      r["x-client-info"] = encodeURIComponent(JSON.stringify(o));
      const {
        token: i
      } = Fg();
      return r["x-client-token"] = i, {
        url: this.config.requestUrl,
        method: "POST",
        data: n,
        dataType: "json",
        header: JSON.parse(JSON.stringify(r))
      }
    }
    uploadFileToOSS({
      url: e,
      formData: t,
      name: n,
      filePath: r,
      fileType: o,
      onUploadProgress: i
    }) {
      return new Promise(((a, s) => {
        const c = this.adapter.uploadFile({
          url: e,
          formData: t,
          name: n,
          filePath: r,
          fileType: o,
          success(e) {
            e && e.statusCode < 400 ? a(e) : s(new Rg({
              code: "UPLOAD_FAILED",
              message: "文件上传失败"
            }))
          },
          fail(e) {
            s(new Rg({
              code: e.code || "UPLOAD_FAILED",
              message: e.message || e.errMsg || "文件上传失败"
            }))
          }
        });
        "function" == typeof i && c && "function" == typeof c.onProgressUpdate && c.onProgressUpdate((e => {
          i({
            loaded: e.totalBytesSent,
            total: e.totalBytesExpectedToSend
          })
        }))
      }))
    }
    uploadFile({
      filePath: e,
      cloudPath: t,
      fileType: n = "image",
      onUploadProgress: r
    }) {
      if (!t) throw new Rg({
        code: "CLOUDPATH_REQUIRED",
        message: "cloudPath不可为空"
      });
      let o;
      return this.getOSSUploadOptionsFromPath({
        cloudPath: t
      }).then((t => {
        const {
          url: i,
          formData: a,
          name: s
        } = t.result;
        o = t.result.fileUrl;
        const c = {
          url: i,
          formData: a,
          name: s,
          filePath: e,
          fileType: n
        };
        return this.uploadFileToOSS(Object.assign({}, c, {
          onUploadProgress: r
        }))
      })).then((() => this.reportOSSUpload({
        cloudPath: t
      }))).then((t => new Promise(((n, r) => {
        t.success ? n({
          success: !0,
          filePath: e,
          fileID: o
        }) : r(new Rg({
          code: "UPLOAD_FAILED",
          message: "文件上传失败"
        }))
      }))))
    }
    deleteFile({
      fileList: e
    }) {
      const t = {
        method: "serverless.file.resource.delete",
        params: JSON.stringify({
          fileList: e
        })
      };
      return this.request(this.setupRequest(t)).then((e => {
        if (e.success) return e.result;
        throw new Rg({
          code: "DELETE_FILE_FAILED",
          message: "删除文件失败"
        })
      }))
    }
    getTempFileURL({
      fileList: e,
      maxAge: t
    } = {}) {
      if (!Array.isArray(e) || 0 === e.length) throw new Rg({
        code: "INVALID_PARAM",
        message: "fileList的元素必须是非空的字符串"
      });
      const n = {
        method: "serverless.file.resource.getTempFileURL",
        params: JSON.stringify({
          fileList: e,
          maxAge: t
        })
      };
      return this.request(this.setupRequest(n)).then((e => {
        if (e.success) return {
          fileList: e.result.fileList.map((e => ({
            fileID: e.fileID,
            tempFileURL: e.tempFileURL
          })))
        };
        throw new Rg({
          code: "GET_TEMP_FILE_URL_FAILED",
          message: "获取临时文件链接失败"
        })
      }))
    }
  },
  sm = {
    init(e) {
      const t = new am(e),
        n = {
          signInAnonymously: function () {
            return t.authorize()
          },
          getLoginState: function () {
            return Promise.resolve(!1)
          }
        };
      return t.auth = function () {
        return n
      }, t.customAuth = t.auth, t
    }
  },
  cm = Hh((function (e, t) {
    e.exports = Vh.enc.Hex
  }));

function um(e = "", t = {}) {
  const {
    data: n,
    functionName: r,
    method: o,
    headers: i,
    signHeaderKeys: a = [],
    config: s
  } = t, c = Date.now(), u = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (function (e) {
    var t = 16 * Math.random() | 0;
    return ("x" === e ? t : 3 & t | 8).toString(16)
  })), l = Object.assign({}, i, {
    "x-from-app-id": s.spaceAppId,
    "x-from-env-id": s.spaceId,
    "x-to-env-id": s.spaceId,
    "x-from-instance-id": c,
    "x-from-function-name": r,
    "x-client-timestamp": c,
    "x-alipay-source": "client",
    "x-request-id": u,
    "x-alipay-callid": u
  }), f = ["x-from-app-id", "x-from-env-id", "x-to-env-id", "x-from-instance-id", "x-from-function-name", "x-client-timestamp"].concat(a), [p = "", d = ""] = e.split("?") || [], h = function (e) {
    const t = e.signedHeaders.join(";"),
      n = e.signedHeaders.map((t => `${t.toLowerCase()}:${e.headers[t]}\n`)).join(""),
      r = ty(e.body).toString(cm),
      o = `${e.method.toUpperCase()}\n${e.path}\n${e.query}\n${n}\n${t}\n${r}\n`,
      i = ty(o).toString(cm),
      a = `HMAC-SHA256\n${e.timestamp}\n${i}\n`,
      s = ny(a, e.secretKey).toString(cm);
    return `HMAC-SHA256 Credential=${e.secretId}, SignedHeaders=${t}, Signature=${s}`
  }({
    path: p,
    query: d,
    method: o,
    headers: l,
    timestamp: c,
    body: JSON.stringify(n),
    secretId: s.accessKey,
    secretKey: s.secretKey,
    signedHeaders: f.sort()
  });
  return {
    url: `${s.endpoint}${e}`,
    headers: Object.assign({}, l, {
      Authorization: h
    })
  }
}

function lm({
  url: e,
  data: t,
  method: n = "POST",
  headers: r = {}
}) {
  return new Promise(((o, i) => {
    Lg.request({
      url: e,
      method: n,
      data: t,
      header: r,
      dataType: "json",
      complete: (e = {}) => {
        if (!e.statusCode || e.statusCode >= 400) {
          const {
            errMsg: t
          } = e.data || {};
          return i(new Rg({
            code: "SYS_ERR",
            message: t || e.errMsg || "request:fail",
            requestId: e.requestID
          }))
        }
        o({
          status: e.statusCode,
          data: e.data,
          headers: e.header,
          requestId: e.requestID
        })
      }
    })
  }))
}

function fm(e, t) {
  const {
    path: n,
    data: r,
    method: o = "GET"
  } = e, {
    url: i,
    headers: a
  } = um(n, {
    functionName: "",
    data: r,
    method: o,
    headers: {
      "x-alipay-cloud-mode": "oss",
      "x-data-api-type": "oss",
      "x-expire-timestamp": Date.now() + 6e4
    },
    signHeaderKeys: ["x-data-api-type", "x-expire-timestamp"],
    config: t
  });
  return lm({
    url: i,
    data: r,
    method: o,
    headers: a
  }).then((e => {
    const t = e.data || {};
    if (!t.success) throw new Rg({
      code: e.code,
      message: e.message,
      requestId: e.trace_id
    });
    return t.data || {}
  })).catch((e => {
    throw new Rg({
      code: e.errCode,
      message: e.errMsg,
      requestId: e.requestId
    })
  }))
}

function pm(e = "") {
  const t = e.trim().replace(/^cloud:\/\//, ""),
    n = t.indexOf("/");
  if (n <= 0) throw new Rg({
    code: "INVALID_PARAM",
    message: "fileID不合法"
  });
  const r = t.substring(0, n),
    o = t.substring(n + 1);
  return r !== this.config.spaceId && console.warn("file ".concat(e, " does not belong to env ").concat(this.config.spaceId)), o
}
var dm = class {
    constructor(e) {
      if (["spaceId", "spaceAppId", "accessKey", "secretKey"].forEach((t => {
          if (!Object.prototype.hasOwnProperty.call(e, t)) throw new Error(`${t} required`)
        })), e.endpoint) {
        if ("string" != typeof e.endpoint) throw new Error("endpoint must be string");
        if (!/^https:\/\//.test(e.endpoint)) throw new Error("endpoint must start with https://");
        e.endpoint = e.endpoint.replace(/\/$/, "")
      }
      this.config = Object.assign({}, e, {
        endpoint: e.endpoint || `https://${e.spaceId}.api-hz.cloudbasefunction.cn`
      })
    }
    callFunction(e) {
      return function (e, t) {
        const {
          name: n,
          data: r
        } = e, o = "POST", {
          url: i,
          headers: a
        } = um("/functions/invokeFunction", {
          functionName: n,
          data: r,
          method: o,
          headers: {
            "x-to-function-name": n
          },
          signHeaderKeys: ["x-to-function-name"],
          config: t
        });
        return lm({
          url: i,
          data: r,
          method: o,
          headers: a
        }).then((e => ({
          errCode: 0,
          success: !0,
          requestId: e.requestId,
          result: e.data
        }))).catch((e => {
          throw new Rg({
            code: e.errCode,
            message: e.errMsg,
            requestId: e.requestId
          })
        }))
      }(e, this.config)
    }
    uploadFileToOSS({
      url: e,
      filePath: t,
      fileType: n,
      formData: r,
      onUploadProgress: o
    }) {
      return new Promise(((i, a) => {
        const s = Lg.uploadFile({
          url: e,
          filePath: t,
          fileType: n,
          formData: r,
          name: "file",
          success(e) {
            e && e.statusCode < 400 ? i(e) : a(new Rg({
              code: "UPLOAD_FAILED",
              message: "文件上传失败"
            }))
          },
          fail(e) {
            a(new Rg({
              code: e.code || "UPLOAD_FAILED",
              message: e.message || e.errMsg || "文件上传失败"
            }))
          }
        });
        "function" == typeof o && s && "function" == typeof s.onProgressUpdate && s.onProgressUpdate((e => {
          o({
            loaded: e.totalBytesSent,
            total: e.totalBytesExpectedToSend
          })
        }))
      }))
    }
    async uploadFile({
      filePath: e,
      cloudPath: t = "",
      fileType: n = "image",
      onUploadProgress: r
    }) {
      if ("string" !== eg(t)) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath必须为字符串类型"
      });
      if (!(t = t.trim())) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath不可为空"
      });
      if (/:\/\//.test(t)) throw new Rg({
        code: "INVALID_PARAM",
        message: "cloudPath不合法"
      });
      const o = await fm({
          path: "/".concat(t.replace(/^\//, ""), "?post_url")
        }, this.config),
        {
          file_id: i,
          upload_url: a,
          form_data: s
        } = o,
        c = s && s.reduce(((e, t) => (e[t.key] = t.value, e)), {});
      return this.uploadFileToOSS({
        url: a,
        filePath: e,
        fileType: n,
        formData: c,
        onUploadProgress: r
      }).then((() => ({
        fileID: i
      })))
    }
    async getTempFileURL({
      fileList: e
    }) {
      return new Promise(((t, n) => {
        (!e || e.length < 0) && n(new Rg({
          errCode: "INVALID_PARAM",
          errMsg: "fileList不能为空数组"
        })), e.length > 50 && n(new Rg({
          errCode: "INVALID_PARAM",
          errMsg: "fileList数组长度不能超过50"
        }));
        const r = [];
        for (const o of e) {
          "string" !== eg(o) && n(new Rg({
            errCode: "INVALID_PARAM",
            errMsg: "fileList的元素必须是非空的字符串"
          }));
          const e = pm.call(this, o);
          r.push({
            file_id: e,
            expire: 600
          })
        }
        fm({
          path: "/?download_url",
          data: {
            file_list: r
          },
          method: "POST"
        }, this.config).then((e => {
          const {
            file_list: n = []
          } = e;
          t({
            fileList: n.map((e => ({
              fileID: e.file_id,
              tempFileURL: e.download_url
            })))
          })
        })).catch((e => n(e)))
      }))
    }
  },
  hm = {
    init: e => {
      e.provider = "alipay";
      const t = new dm(e);
      return t.auth = function () {
        return {
          signInAnonymously: function () {
            return Promise.resolve()
          },
          getLoginState: function () {
            return Promise.resolve(!0)
          }
        }
      }, t
    }
  };

function gm({
  data: e
}) {
  let t;
  t = Hg();
  const n = JSON.parse(JSON.stringify(e || {}));
  if (Object.assign(n, {
      clientInfo: t
    }), !n.uniIdToken) {
    const {
      token: e
    } = Fg();
    e && (n.uniIdToken = e)
  }
  return n
}
const ym = [{
  rule: /fc_function_not_found|FUNCTION_NOT_FOUND/,
  content: "，云函数[{functionName}]在云端不存在，请检查此云函数名称是否正确以及该云函数是否已上传到服务空间",
  mode: "append"
}];
var mm = /[\\^$.*+?()[\]{}|]/g,
  bm = RegExp(mm.source);

function vm(e, t, n) {
  return e.replace(new RegExp((r = t) && bm.test(r) ? r.replace(mm, "\\$&") : r, "g"), n);
  var r
}
const wm = "request",
  Sm = "response",
  xm = "both",
  Am = {
    code: 2e4,
    message: "System error"
  },
  _m = {
    code: 20101,
    message: "Invalid client"
  };

function Pm(e) {
  const {
    errSubject: t,
    subject: n,
    errCode: r,
    errMsg: o,
    code: i,
    message: a,
    cause: s
  } = e || {};
  return new Rg({
    subject: t || n || "uni-secure-network",
    code: r || i || Am.code,
    message: o || a,
    cause: s
  })
}
let km;

function Tm({
  secretType: e
} = {}) {
  return e === wm || e === Sm || e === xm
}

function Em({
  name: e,
  data: t = {}
} = {}) {
  return "app" === ug
}

function Im({
  functionName: e,
  result: t,
  logPvd: n
}) {}

function Om(e) {
  const t = e.callFunction,
    n = function (n) {
      const r = n.name;
      n.data = gm.call(e, {
        data: n.data
      });
      const o = {
          aliyun: "aliyun",
          tencent: "tcb",
          tcb: "tcb",
          alipay: "alipay"
        } [this.config.provider],
        i = Tm(n),
        a = Em(n),
        s = i || a;
      return t.call(this, n).then((e => (e.errCode = 0, !s && Im.call(this, {
        functionName: r,
        result: e,
        logPvd: o
      }), Promise.resolve(e))), (e => (!s && Im.call(this, {
        functionName: r,
        result: e,
        logPvd: o
      }), e && e.message && (e.message = function ({
        message: e = "",
        extraInfo: t = {},
        formatter: n = []
      } = {}) {
        for (let r = 0; r < n.length; r++) {
          const {
            rule: o,
            content: i,
            mode: a
          } = n[r], s = e.match(o);
          if (!s) continue;
          let c = i;
          for (let e = 1; e < s.length; e++) c = vm(c, `{$${e}}`, s[e]);
          for (const e in t) c = vm(c, `{${e}}`, t[e]);
          return "replace" === a ? c : e + c
        }
        return e
      }({
        message: `[${n.name}]: ${e.message}`,
        formatter: ym,
        extraInfo: {
          functionName: r
        }
      })), Promise.reject(e))))
    };
  e.callFunction = function (t) {
    const {
      provider: r,
      spaceId: o
    } = e.config, i = t.name;
    let a, s;
    return t.data = t.data || {}, a = n, a = a.bind(e), Em(t) || (s = function ({
      name: e,
      data: t = {}
    }) {
      return "uni-id-co" === e && "secureNetworkHandshakeByWeixin" === t.method
    }(t) ? a.call(e, t) : Tm(t) ? new km({
      secretType: t.secretType,
      uniCloudIns: e
    }).wrapEncryptDataCallFunction(n.bind(e))(t) : function ({
      provider: e,
      spaceId: t,
      functionName: n
    } = {}) {
      const {
        appId: r,
        uniPlatform: o,
        osName: i
      } = zg();
      let a = o;
      "app" === o && (a = i);
      const s = function ({
        provider: e,
        spaceId: t
      } = {}) {
        if (!cg) return {};
        var n;
        e = "tencent" === (n = e) ? "tcb" : n;
        const r = cg.find((n => n.provider === e && n.spaceId === t));
        return r && r.config
      }({
        provider: e,
        spaceId: t
      });
      if (!s || !s.accessControl || !s.accessControl.enable) return !1;
      const c = s.accessControl.function || {},
        u = Object.keys(c);
      if (0 === u.length) return !0;
      const l = function (e, t) {
        let n, r, o;
        for (let i = 0; i < e.length; i++) {
          const a = e[i];
          a !== t ? "*" !== a ? a.split(",").map((e => e.trim())).indexOf(t) > -1 && (r = a) : o = a : n = a
        }
        return n || r || o
      }(u, n);
      if (!l) return !1;
      if ((c[l] || []).find(((e = {}) => e.appId === r && (e.platform || "").toLowerCase() === a.toLowerCase()))) return !0;
      throw console.error(`此应用[appId: ${r}, platform: ${a}]不在云端配置的允许访问的应用列表内，参考：https://uniapp.dcloud.net.cn/uniCloud/secure-network.html#verify-client`), Pm(_m)
    }({
      provider: r,
      spaceId: o,
      functionName: i
    }) ? new km({
      secretType: t.secretType,
      uniCloudIns: e
    }).wrapVerifyClientCallFunction(n.bind(e))(t) : a(t)), Object.defineProperty(s, "result", {
      get: () => (console.warn("当前返回结果为Promise类型，不可直接访问其result属性，详情请参考：https://uniapp.dcloud.net.cn/uniCloud/faq?id=promise"), {})
    }), s
  }
}
km = class {
  constructor() {
    throw Pm({
      message: `Platform ${ug} is not enabled, please check whether secure network module is enabled in your manifest.json`
    })
  }
};
const Cm = Symbol("CLIENT_DB_INTERNAL");

function Bm(e, t) {
  return e.then = "DoNotReturnProxyWithAFunctionNamedThen", e._internalType = Cm, e.inspect = null, e.__v_raw = void 0, new Proxy(e, {
    get(e, n, r) {
      if ("_uniClient" === n) return null;
      if ("symbol" == typeof n) return e[n];
      if (n in e || "string" != typeof n) {
        const t = e[n];
        return "function" == typeof t ? t.bind(e) : t
      }
      return t.get(e, n, r)
    }
  })
}

function jm(e) {
  return {
    on: (t, n) => {
      e[t] = e[t] || [], e[t].indexOf(n) > -1 || e[t].push(n)
    },
    off: (t, n) => {
      e[t] = e[t] || [];
      const r = e[t].indexOf(n); - 1 !== r && e[t].splice(r, 1)
    }
  }
}
const Dm = ["db.Geo", "db.command", "command.aggregate"];

function Nm(e, t) {
  return Dm.indexOf(`${e}.${t}`) > -1
}

function Rm(e) {
  switch (eg(e = Mg(e))) {
    case "array":
      return e.map((e => Rm(e)));
    case "object":
      return e._internalType === Cm || Object.keys(e).forEach((t => {
        e[t] = Rm(e[t])
      })), e;
    case "regexp":
      return {
        $regexp: {
          source: e.source,
          flags: e.flags
        }
      };
    case "date":
      return {
        $date: e.toISOString()
      };
    default:
      return e
  }
}

function Lm(e) {
  return e && e.content && e.content.$method
}
class Mm {
  constructor(e, t, n) {
    this.content = e, this.prevStage = t || null, this.udb = null, this._database = n
  }
  toJSON() {
    let e = this;
    const t = [e.content];
    for (; e.prevStage;) e = e.prevStage, t.push(e.content);
    return {
      $db: t.reverse().map((e => ({
        $method: e.$method,
        $param: Rm(e.$param)
      })))
    }
  }
  toString() {
    return JSON.stringify(this.toJSON())
  }
  getAction() {
    const e = this.toJSON().$db.find((e => "action" === e.$method));
    return e && e.$param && e.$param[0]
  }
  getCommand() {
    return {
      $db: this.toJSON().$db.filter((e => "action" !== e.$method))
    }
  }
  get isAggregate() {
    let e = this;
    for (; e;) {
      const t = Lm(e),
        n = Lm(e.prevStage);
      if ("aggregate" === t && "collection" === n || "pipeline" === t) return !0;
      e = e.prevStage
    }
    return !1
  }
  get isCommand() {
    let e = this;
    for (; e;) {
      if ("command" === Lm(e)) return !0;
      e = e.prevStage
    }
    return !1
  }
  get isAggregateCommand() {
    let e = this;
    for (; e;) {
      const t = Lm(e),
        n = Lm(e.prevStage);
      if ("aggregate" === t && "command" === n) return !0;
      e = e.prevStage
    }
    return !1
  }
  getNextStageFn(e) {
    const t = this;
    return function () {
      return Fm({
        $method: e,
        $param: Rm(Array.from(arguments))
      }, t, t._database)
    }
  }
  get count() {
    return this.isAggregate ? this.getNextStageFn("count") : function () {
      return this._send("count", Array.from(arguments))
    }
  }
  get remove() {
    return this.isCommand ? this.getNextStageFn("remove") : function () {
      return this._send("remove", Array.from(arguments))
    }
  }
  get() {
    return this._send("get", Array.from(arguments))
  }
  get add() {
    return this.isCommand ? this.getNextStageFn("add") : function () {
      return this._send("add", Array.from(arguments))
    }
  }
  update() {
    return this._send("update", Array.from(arguments))
  }
  end() {
    return this._send("end", Array.from(arguments))
  }
  get set() {
    return this.isCommand ? this.getNextStageFn("set") : function () {
      throw new Error("JQL禁止使用set方法")
    }
  }
  _send(e, t) {
    const n = this.getAction(),
      r = this.getCommand();
    return r.$db.push({
      $method: e,
      $param: Rm(t)
    }), this._database._callCloudFunction({
      action: n,
      command: r
    })
  }
}

function Fm(e, t, n) {
  return Bm(new Mm(e, t, n), {
    get(e, t) {
      let r = "db";
      return e && e.content && (r = e.content.$method), Nm(r, t) ? Fm({
        $method: t
      }, e, n) : function () {
        return Fm({
          $method: t,
          $param: Rm(Array.from(arguments))
        }, e, n)
      }
    }
  })
}

function Um({
  path: e,
  method: t
}) {
  return class {
    constructor() {
      this.param = Array.from(arguments)
    }
    toJSON() {
      return {
        $newDb: [...e.map((e => ({
          $method: e
        }))), {
          $method: t,
          $param: this.param
        }]
      }
    }
    toString() {
      return JSON.stringify(this.toJSON())
    }
  }
}

function qm(e, t = {}) {
  return Bm(new e(t), {
    get: (e, t) => Nm("db", t) ? Fm({
      $method: t
    }, null, e) : function () {
      return Fm({
        $method: t,
        $param: Rm(Array.from(arguments))
      }, null, e)
    }
  })
}
class $m extends class {
  constructor({
    uniClient: e = {},
    isJQL: t = !1
  } = {}) {
    this._uniClient = e, this._authCallBacks = {}, this._dbCallBacks = {}, e._isDefault && (this._dbCallBacks = dg("_globalUniCloudDatabaseCallback")), t || (this.auth = jm(this._authCallBacks)), this._isJQL = t, Object.assign(this, jm(this._dbCallBacks)), this.env = Bm({}, {
      get: (e, t) => ({
        $env: t
      })
    }), this.Geo = Bm({}, {
      get: (e, t) => Um({
        path: ["Geo"],
        method: t
      })
    }), this.serverDate = Um({
      path: [],
      method: "serverDate"
    }), this.RegExp = Um({
      path: [],
      method: "RegExp"
    })
  }
  getCloudEnv(e) {
    if ("string" != typeof e || !e.trim()) throw new Error("getCloudEnv参数错误");
    return {
      $env: e.replace("$cloudEnv_", "")
    }
  }
  _callback(e, t) {
    const n = this._dbCallBacks;
    n[e] && n[e].forEach((e => {
      e(...t)
    }))
  }
  _callbackAuth(e, t) {
    const n = this._authCallBacks;
    n[e] && n[e].forEach((e => {
      e(...t)
    }))
  }
  multiSend() {
    const e = Array.from(arguments),
      t = e.map((e => {
        const t = e.getAction(),
          n = e.getCommand();
        if ("getTemp" !== n.$db[n.$db.length - 1].$method) throw new Error("multiSend只支持子命令内使用getTemp");
        return {
          action: t,
          command: n
        }
      }));
    return this._callCloudFunction({
      multiCommand: t,
      queryList: e
    })
  }
} {
  _parseResult(e) {
    return this._isJQL ? e.result : e
  }
  _callCloudFunction({
    action: e,
    command: t,
    multiCommand: n,
    queryList: r
  }) {
    function o(e, t) {
      if (n && r)
        for (let n = 0; n < r.length; n++) {
          const o = r[n];
          o.udb && "function" == typeof o.udb.setResult && (t ? o.udb.setResult(t) : o.udb.setResult(e.result.dataList[n]))
        }
    }
    const i = this,
      a = this._isJQL ? "databaseForJQL" : "database";

    function s(e) {
      return i._callback("error", [e]), bg(vg(a, "fail"), e).then((() => bg(vg(a, "complete"), e))).then((() => (o(null, e), Cg(xg, {
        type: Pg,
        content: e
      }), Promise.reject(e))))
    }
    const c = bg(vg(a, "invoke")),
      u = this._uniClient;
    return c.then((() => u.callFunction({
      name: "DCloud-clientDB",
      type: "CLIENT_DB",
      data: {
        action: e,
        command: t,
        multiCommand: n
      }
    }))).then((e => {
      const {
        code: t,
        message: n,
        token: r,
        tokenExpired: c,
        systemInfo: u = []
      } = e.result;
      if (u)
        for (let o = 0; o < u.length; o++) {
          const {
            level: e,
            message: t,
            detail: n
          } = u[o];
          let r = "[System Info]" + t;
          n && (r = `${r}\n详细信息：${n}`), (console[e] || console.log)(r)
        }
      if (t) return s(new Rg({
        code: t,
        message: n,
        requestId: e.requestId
      }));
      e.result.errCode = e.result.errCode || e.result.code, e.result.errMsg = e.result.errMsg || e.result.message, r && c && (Ug({
        token: r,
        tokenExpired: c
      }), this._callbackAuth("refreshToken", [{
        token: r,
        tokenExpired: c
      }]), this._callback("refreshToken", [{
        token: r,
        tokenExpired: c
      }]), Cg(_g, {
        token: r,
        tokenExpired: c
      }));
      const l = [{
        prop: "affectedDocs",
        tips: "affectedDocs不再推荐使用，请使用inserted/deleted/updated/data.length替代"
      }, {
        prop: "code",
        tips: "code不再推荐使用，请使用errCode替代"
      }, {
        prop: "message",
        tips: "message不再推荐使用，请使用errMsg替代"
      }];
      for (let o = 0; o < l.length; o++) {
        const {
          prop: t,
          tips: n
        } = l[o];
        if (t in e.result) {
          const r = e.result[t];
          Object.defineProperty(e.result, t, {
            get: () => (console.warn(n), r)
          })
        }
      }
      return f = e, bg(vg(a, "success"), f).then((() => bg(vg(a, "complete"), f))).then((() => {
        o(f, null);
        const e = i._parseResult(f);
        return Cg(xg, {
          type: Pg,
          content: e
        }), Promise.resolve(e)
      }));
      var f
    }), (e => (/fc_function_not_found|FUNCTION_NOT_FOUND/g.test(e.message) && console.warn("clientDB未初始化，请在web控制台保存一次schema以开启clientDB"), s(new Rg({
      code: e.code || "SYSTEM_ERROR",
      message: e.message,
      requestId: e.requestId
    })))))
  }
}
const zm = "token无效，跳转登录页面",
  Qm = "token过期，跳转登录页面",
  Hm = {
    TOKEN_INVALID_TOKEN_EXPIRED: Qm,
    TOKEN_INVALID_INVALID_CLIENTID: zm,
    TOKEN_INVALID: zm,
    TOKEN_INVALID_WRONG_TOKEN: zm,
    TOKEN_INVALID_ANONYMOUS_USER: zm
  },
  Wm = {
    "uni-id-token-expired": Qm,
    "uni-id-check-token-failed": zm,
    "uni-id-token-not-exist": zm,
    "uni-id-check-device-feature-failed": zm
  };

function Vm(e, t) {
  let n = "";
  return n = e ? `${e}/${t}` : t, n.replace(/^\//, "")
}

function Km(e = [], t = "") {
  const n = [],
    r = [];
  return e.forEach((e => {
    !0 === e.needLogin ? n.push(Vm(t, e.path)) : !1 === e.needLogin && r.push(Vm(t, e.path))
  })), {
    needLoginPage: n,
    notNeedLoginPage: r
  }
}

function Jm(e) {
  return e.split("?")[0].replace(/^\//, "")
}

function Gm() {
  return function (e) {
    let t = e && e.$page && e.$page.fullPath || "";
    return t ? ("/" !== t.charAt(0) && (t = "/" + t), t) : t
  }(function () {
    const e = getCurrentPages();
    return e[e.length - 1]
  }())
}

function Ym() {
  return Jm(Gm())
}

function Xm(e = "", t = {}) {
  if (!e) return !1;
  if (!(t && t.list && t.list.length)) return !1;
  const n = t.list,
    r = Jm(e);
  return n.some((e => e.pagePath === r))
}
const Zm = !!fc.uniIdRouter,
  {
    loginPage: eb,
    routerNeedLogin: tb,
    resToLogin: nb,
    needLoginPage: rb,
    notNeedLoginPage: ob,
    loginPageInTabBar: ib
  } = function ({
    pages: e = [],
    subPackages: t = [],
    uniIdRouter: n = {},
    tabBar: r = {}
  } = fc) {
    const {
      loginPage: o,
      needLogin: i = [],
      resToLogin: a = !0
    } = n, {
      needLoginPage: s,
      notNeedLoginPage: c
    } = Km(e), {
      needLoginPage: u,
      notNeedLoginPage: l
    } = function (e = []) {
      const t = [],
        n = [];
      return e.forEach((e => {
        const {
          root: r,
          pages: o = []
        } = e, {
          needLoginPage: i,
          notNeedLoginPage: a
        } = Km(o, r);
        t.push(...i), n.push(...a)
      })), {
        needLoginPage: t,
        notNeedLoginPage: n
      }
    }(t);
    return {
      loginPage: o,
      routerNeedLogin: i,
      resToLogin: a,
      needLoginPage: [...s, ...u],
      notNeedLoginPage: [...c, ...l],
      loginPageInTabBar: Xm(o, r)
    }
  }();
if (rb.indexOf(eb) > -1) throw new Error(`Login page [${eb}] should not be "needLogin", please check your pages.json`);

function ab(e) {
  const t = Ym();
  if ("/" === e.charAt(0)) return e;
  const [n, r] = e.split("?"), o = n.replace(/^\//, "").split("/"), i = t.split("/");
  i.pop();
  for (let a = 0; a < o.length; a++) {
    const e = o[a];
    ".." === e ? i.pop() : "." !== e && i.push(e)
  }
  return "" === i[0] && i.shift(), "/" + i.join("/") + (r ? "?" + r : "")
}

function sb({
  redirect: e
}) {
  const t = Jm(e),
    n = Jm(eb);
  return Ym() !== n && t !== n
}

function cb({
  api: e,
  redirect: t
} = {}) {
  if (!t || !sb({
      redirect: t
    })) return;
  const n = (o = t, "/" !== (r = eb).charAt(0) && (r = "/" + r), o ? r.indexOf("?") > -1 ? r + `&uniIdRedirectUrl=${encodeURIComponent(o)}` : r + `?uniIdRedirectUrl=${encodeURIComponent(o)}` : r);
  var r, o;
  ib ? "navigateTo" !== e && "redirectTo" !== e || (e = "switchTab") : "switchTab" === e && (e = "navigateTo");
  const i = {
    navigateTo: Dn.navigateTo,
    redirectTo: Dn.redirectTo,
    switchTab: Dn.switchTab,
    reLaunch: Dn.reLaunch
  };
  setTimeout((() => {
    i[e]({
      url: n
    })
  }))
}

function ub({
  url: e
} = {}) {
  const t = {
      abortLoginPageJump: !1,
      autoToLoginPage: !1
    },
    n = function () {
      const {
        token: e,
        tokenExpired: t
      } = Fg();
      let n;
      if (e) {
        if (t < Date.now()) {
          const e = "uni-id-token-expired";
          n = {
            errCode: e,
            errMsg: Wm[e]
          }
        }
      } else {
        const e = "uni-id-check-token-failed";
        n = {
          errCode: e,
          errMsg: Wm[e]
        }
      }
      return n
    }();
  if (function (e) {
      const t = Jm(ab(e));
      return !(ob.indexOf(t) > -1) && (rb.indexOf(t) > -1 || tb.some((t => {
        return n = e, new RegExp(t).test(n);
        var n
      })))
    }(e) && n) {
    if (n.uniIdRedirectUrl = e, Eg(Ag).length > 0) return setTimeout((() => {
      Cg(Ag, n)
    }), 0), t.abortLoginPageJump = !0, t;
    t.autoToLoginPage = !0
  }
  return t
}

function lb() {
  ! function () {
    const e = Gm(),
      {
        abortLoginPageJump: t,
        autoToLoginPage: n
      } = ub({
        url: e
      });
    t || n && cb({
      api: "redirectTo",
      redirect: e
    })
  }();
  const e = ["navigateTo", "redirectTo", "reLaunch", "switchTab"];
  for (let t = 0; t < e.length; t++) {
    const n = e[t];
    Dn.addInterceptor(n, {
      invoke(e) {
        const {
          abortLoginPageJump: t,
          autoToLoginPage: r
        } = ub({
          url: e.url
        });
        return t ? e : r ? (cb({
          api: n,
          redirect: ab(e.url)
        }), !1) : e
      }
    })
  }
}

function fb() {
  this.onResponse((e => {
    const {
      type: t,
      content: n
    } = e;
    let r = !1;
    switch (t) {
      case "cloudobject":
        r = function (e) {
          if ("object" != typeof e) return !1;
          const {
            errCode: t
          } = e || {};
          return t in Wm
        }(n);
        break;
      case "clientdb":
        r = function (e) {
          if ("object" != typeof e) return !1;
          const {
            errCode: t
          } = e || {};
          return t in Hm
        }(n)
    }
    r && function (e = {}) {
      const t = Eg(Ag);
      Dg().then((() => {
        const n = Gm();
        if (n && sb({
            redirect: n
          })) return t.length > 0 ? Cg(Ag, Object.assign({
          uniIdRedirectUrl: n
        }, e)) : void(eb && cb({
          api: "navigateTo",
          redirect: n
        }))
      }))
    }(n)
  }))
}

function pb(e) {
  var t;
  (t = e).onResponse = function (e) {
      Ig(xg, e)
    }, t.offResponse = function (e) {
      Og(xg, e)
    },
    function (e) {
      e.onNeedLogin = function (e) {
        Ig(Ag, e)
      }, e.offNeedLogin = function (e) {
        Og(Ag, e)
      }, Zm && (dg("_globalUniCloudStatus").needLoginInit || (dg("_globalUniCloudStatus").needLoginInit = !0, Dg().then((() => {
        lb.call(e)
      })), nb && fb.call(e)))
    }(e),
    function (e) {
      e.onRefreshToken = function (e) {
        Ig(_g, e)
      }, e.offRefreshToken = function (e) {
        Og(_g, e)
      }
    }(e)
}
let db;
const hb = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  gb = /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/;

function yb() {
  const e = Fg().token || "",
    t = e.split(".");
  if (!e || 3 !== t.length) return {
    uid: null,
    role: [],
    permission: [],
    tokenExpired: 0
  };
  let n;
  try {
    n = JSON.parse((r = t[1], decodeURIComponent(db(r).split("").map((function (e) {
      return "%" + ("00" + e.charCodeAt(0).toString(16)).slice(-2)
    })).join(""))))
  } catch (o) {
    throw new Error("获取当前用户信息出错，详细错误信息为：" + o.message)
  }
  var r;
  return n.tokenExpired = 1e3 * n.exp, delete n.exp, delete n.iat, n
}
db = "function" != typeof atob ? function (e) {
  if (e = String(e).replace(/[\t\n\f\r ]+/g, ""), !gb.test(e)) throw new Error("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
  var t;
  e += "==".slice(2 - (3 & e.length));
  for (var n, r, o = "", i = 0; i < e.length;) t = hb.indexOf(e.charAt(i++)) << 18 | hb.indexOf(e.charAt(i++)) << 12 | (n = hb.indexOf(e.charAt(i++))) << 6 | (r = hb.indexOf(e.charAt(i++))), o += 64 === n ? String.fromCharCode(t >> 16 & 255) : 64 === r ? String.fromCharCode(t >> 16 & 255, t >> 8 & 255) : String.fromCharCode(t >> 16 & 255, t >> 8 & 255, 255 & t);
  return o
} : atob;
var mb = Hh((function (e, t) {
    Object.defineProperty(t, "__esModule", {
      value: !0
    });
    const n = "chooseAndUploadFile:ok",
      r = "chooseAndUploadFile:fail";

    function o(e, t) {
      return e.tempFiles.forEach(((e, n) => {
        e.name || (e.name = e.path.substring(e.path.lastIndexOf("/") + 1)), t && (e.fileType = t), e.cloudPath = Date.now() + "_" + n + e.name.substring(e.name.lastIndexOf("."))
      })), e.tempFilePaths || (e.tempFilePaths = e.tempFiles.map((e => e.path))), e
    }

    function i(e, t, {
      onChooseFile: r,
      onUploadProgress: o
    }) {
      return t.then((e => {
        if (r) {
          const t = r(e);
          if (void 0 !== t) return Promise.resolve(t).then((t => void 0 === t ? e : t))
        }
        return e
      })).then((t => !1 === t ? {
        errMsg: n,
        tempFilePaths: [],
        tempFiles: []
      } : function (e, t, r = 5, o) {
        (t = Object.assign({}, t)).errMsg = n;
        const i = t.tempFiles,
          a = i.length;
        let s = 0;
        return new Promise((n => {
          for (; s < r;) c();

          function c() {
            const r = s++;
            if (r >= a) return void(!i.find((e => !e.url && !e.errMsg)) && n(t));
            const u = i[r];
            e.uploadFile({
              filePath: u.path,
              cloudPath: u.cloudPath,
              fileType: u.fileType,
              cloudPathAsRealPath: u.cloudPathAsRealPath,
              onUploadProgress(e) {
                e.index = r, e.tempFile = u, e.tempFilePath = u.path, o && o(e)
              }
            }).then((e => {
              u.url = e.fileID, r < a && c()
            })).catch((e => {
              u.errMsg = e.errMsg || e.message, r < a && c()
            }))
          }
        }))
      }(e, t, 5, o)))
    }
    t.initChooseAndUploadFile = function (e) {
      return function (t = {
        type: "all"
      }) {
        return "image" === t.type ? i(e, function (e) {
          const {
            count: t,
            sizeType: n,
            sourceType: i = ["album", "camera"],
            extension: a
          } = e;
          return new Promise(((e, s) => {
            Dn.chooseImage({
              count: t,
              sizeType: n,
              sourceType: i,
              extension: a,
              success(t) {
                e(o(t, "image"))
              },
              fail(e) {
                s({
                  errMsg: e.errMsg.replace("chooseImage:fail", r)
                })
              }
            })
          }))
        }(t), t) : "video" === t.type ? i(e, function (e) {
          const {
            camera: t,
            compressed: n,
            maxDuration: i,
            sourceType: a = ["album", "camera"],
            extension: s
          } = e;
          return new Promise(((e, c) => {
            Dn.chooseVideo({
              camera: t,
              compressed: n,
              maxDuration: i,
              sourceType: a,
              extension: s,
              success(t) {
                const {
                  tempFilePath: n,
                  duration: r,
                  size: i,
                  height: a,
                  width: s
                } = t;
                e(o({
                  errMsg: "chooseVideo:ok",
                  tempFilePaths: [n],
                  tempFiles: [{
                    name: t.tempFile && t.tempFile.name || "",
                    path: n,
                    size: i,
                    type: t.tempFile && t.tempFile.type || "",
                    width: s,
                    height: a,
                    duration: r,
                    fileType: "video",
                    cloudPath: ""
                  }]
                }, "video"))
              },
              fail(e) {
                c({
                  errMsg: e.errMsg.replace("chooseVideo:fail", r)
                })
              }
            })
          }))
        }(t), t) : i(e, function (e) {
          const {
            count: t,
            extension: n
          } = e;
          return new Promise(((e, i) => {
            let a = Dn.chooseFile;
            if (void 0 !== jn && "function" == typeof jn.chooseMessageFile && (a = jn.chooseMessageFile), "function" != typeof a) return i({
              errMsg: r + " 请指定 type 类型，该平台仅支持选择 image 或 video。"
            });
            a({
              type: "all",
              count: t,
              extension: n,
              success(t) {
                e(o(t))
              },
              fail(e) {
                i({
                  errMsg: e.errMsg.replace("chooseFile:fail", r)
                })
              }
            })
          }))
        }(t), t)
      }
    }
  })),
  bb = function (e) {
    return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e
  }(mb);

function vb(e) {
  return {
    props: {
      localdata: {
        type: Array,
        default: () => []
      },
      options: {
        type: [Object, Array],
        default: () => ({})
      },
      spaceInfo: {
        type: Object,
        default: () => ({})
      },
      collection: {
        type: [String, Array],
        default: ""
      },
      action: {
        type: String,
        default: ""
      },
      field: {
        type: String,
        default: ""
      },
      orderby: {
        type: String,
        default: ""
      },
      where: {
        type: [String, Object],
        default: ""
      },
      pageData: {
        type: String,
        default: "add"
      },
      pageCurrent: {
        type: Number,
        default: 1
      },
      pageSize: {
        type: Number,
        default: 20
      },
      getcount: {
        type: [Boolean, String],
        default: !1
      },
      gettree: {
        type: [Boolean, String],
        default: !1
      },
      gettreepath: {
        type: [Boolean, String],
        default: !1
      },
      startwith: {
        type: String,
        default: ""
      },
      limitlevel: {
        type: Number,
        default: 10
      },
      groupby: {
        type: String,
        default: ""
      },
      groupField: {
        type: String,
        default: ""
      },
      distinct: {
        type: [Boolean, String],
        default: !1
      },
      foreignKey: {
        type: String,
        default: ""
      },
      loadtime: {
        type: String,
        default: "auto"
      },
      manual: {
        type: Boolean,
        default: !1
      }
    },
    data: () => ({
      mixinDatacomLoading: !1,
      mixinDatacomHasMore: !1,
      mixinDatacomResData: [],
      mixinDatacomErrorMessage: "",
      mixinDatacomPage: {}
    }),
    created() {
      this.mixinDatacomPage = {
        current: this.pageCurrent,
        size: this.pageSize,
        count: 0
      }, this.$watch((() => {
        var e = [];
        return ["pageCurrent", "pageSize", "localdata", "collection", "action", "field", "orderby", "where", "getont", "getcount", "gettree", "groupby", "groupField", "distinct"].forEach((t => {
          e.push(this[t])
        })), e
      }), ((e, t) => {
        if ("manual" === this.loadtime) return;
        let n = !1;
        const r = [];
        for (let o = 2; o < e.length; o++) e[o] !== t[o] && (r.push(e[o]), n = !0);
        e[0] !== t[0] && (this.mixinDatacomPage.current = this.pageCurrent), this.mixinDatacomPage.size = this.pageSize, this.onMixinDatacomPropsChange(n, r)
      }))
    },
    methods: {
      onMixinDatacomPropsChange(e, t) {},
      mixinDatacomEasyGet({
        getone: e = !1,
        success: t,
        fail: n
      } = {}) {
        this.mixinDatacomLoading || (this.mixinDatacomLoading = !0, this.mixinDatacomErrorMessage = "", this.mixinDatacomGet().then((n => {
          this.mixinDatacomLoading = !1;
          const {
            data: r,
            count: o
          } = n.result;
          this.getcount && (this.mixinDatacomPage.count = o), this.mixinDatacomHasMore = r.length < this.pageSize;
          const i = e ? r.length ? r[0] : void 0 : r;
          this.mixinDatacomResData = i, t && t(i)
        })).catch((e => {
          this.mixinDatacomLoading = !1, this.mixinDatacomErrorMessage = e, n && n(e)
        })))
      },
      mixinDatacomGet(t = {}) {
        let n = e.database(this.spaceInfo);
        const r = t.action || this.action;
        r && (n = n.action(r));
        const o = t.collection || this.collection;
        n = Array.isArray(o) ? n.collection(...o) : n.collection(o);
        const i = t.where || this.where;
        i && Object.keys(i).length && (n = n.where(i));
        const a = t.field || this.field;
        a && (n = n.field(a));
        const s = t.foreignKey || this.foreignKey;
        s && (n = n.foreignKey(s));
        const c = t.groupby || this.groupby;
        c && (n = n.groupBy(c));
        const u = t.groupField || this.groupField;
        u && (n = n.groupField(u)), !0 === (void 0 !== t.distinct ? t.distinct : this.distinct) && (n = n.distinct());
        const l = t.orderby || this.orderby;
        l && (n = n.orderBy(l));
        const f = void 0 !== t.pageCurrent ? t.pageCurrent : this.mixinDatacomPage.current,
          p = void 0 !== t.pageSize ? t.pageSize : this.mixinDatacomPage.size,
          d = void 0 !== t.getcount ? t.getcount : this.getcount,
          h = void 0 !== t.gettree ? t.gettree : this.gettree,
          g = void 0 !== t.gettreepath ? t.gettreepath : this.gettreepath,
          y = {
            getCount: d
          },
          m = {
            limitLevel: void 0 !== t.limitlevel ? t.limitlevel : this.limitlevel,
            startWith: void 0 !== t.startwith ? t.startwith : this.startwith
          };
        return h && (y.getTree = m), g && (y.getTreePath = m), n = n.skip(p * (f - 1)).limit(p).get(y), n
      }
    }
  }
}

function wb(e) {
  return dg("_globalUniCloudSecureNetworkCache__{spaceId}".replace("{spaceId}", e.config.spaceId))
}
async function Sb({
  openid: e,
  callLoginByWeixin: t = !1
} = {}) {
  const n = wb(this);
  if (e && t) throw new Error("[SecureNetwork] openid and callLoginByWeixin cannot be passed at the same time");
  if (e) return n.mpWeixinOpenid = e, {};
  const r = await new Promise(((e, t) => {
      Dn.login({
        success(t) {
          e(t.code)
        },
        fail(e) {
          t(new Error(e.errMsg))
        }
      })
    })),
    o = this.importObject("uni-id-co", {
      customUI: !0
    });
  return await o.secureNetworkHandshakeByWeixin({
    code: r,
    callLoginByWeixin: t
  }), n.mpWeixinCode = r, {
    code: r
  }
}
async function xb(e) {
  const t = wb(this);
  return t.initPromise || (t.initPromise = Sb.call(this, e)), t.initPromise
}

function Ab(e) {
  const t = {
    getSystemInfo: Dn.getSystemInfo,
    getPushClientId: Dn.getPushClientId
  };
  return function (n) {
    return new Promise(((r, o) => {
      t[e]({
        ...n,
        success(e) {
          r(e)
        },
        fail(e) {
          o(e)
        }
      })
    }))
  }
}
class _b extends class {
  constructor() {
    this._callback = {}
  }
  addListener(e, t) {
    this._callback[e] || (this._callback[e] = []), this._callback[e].push(t)
  }
  on(e, t) {
    return this.addListener(e, t)
  }
  removeListener(e, t) {
    if (!t) throw new Error('The "listener" argument must be of type function. Received undefined');
    const n = this._callback[e];
    if (!n) return;
    const r = function (e, t) {
      for (let n = e.length - 1; n >= 0; n--)
        if (e[n] === t) return n;
      return -1
    }(n, t);
    n.splice(r, 1)
  }
  off(e, t) {
    return this.removeListener(e, t)
  }
  removeAllListener(e) {
    delete this._callback[e]
  }
  emit(e, ...t) {
    const n = this._callback[e];
    if (n)
      for (let r = 0; r < n.length; r++) n[r](...t)
  }
} {
  constructor() {
    super(), this._uniPushMessageCallback = this._receivePushMessage.bind(this), this._currentMessageId = -1, this._payloadQueue = []
  }
  init() {
    return Promise.all([Ab("getSystemInfo")(), Ab("getPushClientId")()]).then((([{
      appId: e
    } = {}, {
      cid: t
    } = {}] = []) => {
      if (!e) throw new Error("Invalid appId, please check the manifest.json file");
      if (!t) throw new Error("Invalid push client id");
      this._appId = e, this._pushClientId = t, this._seqId = Date.now() + "-" + Math.floor(9e5 * Math.random() + 1e5), this.emit("open"), this._initMessageListener()
    }), (e => {
      throw this.emit("error", e), this.close(), e
    }))
  }
  async open() {
    return this.init()
  }
  _isUniCloudSSE(e) {
    if ("receive" !== e.type) return !1;
    const t = e && e.data && e.data.payload;
    return !(!t || "UNI_CLOUD_SSE" !== t.channel || t.seqId !== this._seqId)
  }
  _receivePushMessage(e) {
    if (!this._isUniCloudSSE(e)) return;
    const t = e && e.data && e.data.payload,
      {
        action: n,
        messageId: r,
        message: o
      } = t;
    this._payloadQueue.push({
      action: n,
      messageId: r,
      message: o
    }), this._consumMessage()
  }
  _consumMessage() {
    for (;;) {
      const e = this._payloadQueue.find((e => e.messageId === this._currentMessageId + 1));
      if (!e) break;
      this._currentMessageId++, this._parseMessagePayload(e)
    }
  }
  _parseMessagePayload(e) {
    const {
      action: t,
      messageId: n,
      message: r
    } = e;
    "end" === t ? this._end({
      messageId: n,
      message: r
    }) : "message" === t && this._appendMessage({
      messageId: n,
      message: r
    })
  }
  _appendMessage({
    messageId: e,
    message: t
  } = {}) {
    this.emit("message", t)
  }
  _end({
    messageId: e,
    message: t
  } = {}) {
    this.emit("end", t), this.close()
  }
  _initMessageListener() {
    Dn.onPushMessage(this._uniPushMessageCallback)
  }
  _destroy() {
    Dn.offPushMessage(this._uniPushMessageCallback)
  }
  toJSON() {
    return {
      appId: this._appId,
      pushClientId: this._pushClientId,
      seqId: this._seqId
    }
  }
  close() {
    this._destroy(), this.emit("close")
  }
}
const Pb = {
  tcb: im,
  tencent: im,
  aliyun: Gg,
  private: sm,
  alipay: hm
};
let kb = new class {
  init(e) {
    let t = {};
    const n = Pb[e.provider];
    if (!n) throw new Error("未提供正确的provider参数");
    var r;
    return t = n.init(e),
      function (e) {
        e._initPromiseHub || (e._initPromiseHub = new ag({
          createPromise: function () {
            let t = Promise.resolve();
            t = new Promise((e => {
              setTimeout((() => {
                e()
              }), 1)
            }));
            const n = e.auth();
            return t.then((() => n.getLoginState())).then((e => e ? Promise.resolve() : n.signInAnonymously()))
          }
        }))
      }(t), Om(t),
      function (e) {
        const t = e.uploadFile;
        e.uploadFile = function (e) {
          return t.call(this, e)
        }
      }(t), (r = t).database = function (e) {
        if (e && Object.keys(e).length > 0) return r.init(e).database();
        if (this._database) return this._database;
        const t = qm($m, {
          uniClient: r
        });
        return this._database = t, t
      }, r.databaseForJQL = function (e) {
        if (e && Object.keys(e).length > 0) return r.init(e).databaseForJQL();
        if (this._databaseForJQL) return this._databaseForJQL;
        const t = qm($m, {
          uniClient: r,
          isJQL: !0
        });
        return this._databaseForJQL = t, t
      },
      function (e) {
        e.getCurrentUserInfo = yb, e.chooseAndUploadFile = bb.initChooseAndUploadFile(e), Object.assign(e, {
          get mixinDatacom() {
            return vb(e)
          }
        }), e.SSEChannel = _b, e.initSecureNetworkByWeixin = function (e) {
          return function ({
            openid: t,
            callLoginByWeixin: n = !1
          } = {}) {
            return xb.call(e, {
              openid: t,
              callLoginByWeixin: n
            })
          }
        }(e), e.importObject = function (t) {
          return function (n, r = {}) {
            r = function (e, t = {}) {
              return e.customUI = t.customUI || e.customUI, e.parseSystemError = t.parseSystemError || e.parseSystemError, Object.assign(e.loadingOptions, t.loadingOptions), Object.assign(e.errorOptions, t.errorOptions), "object" == typeof t.secretMethods && (e.secretMethods = t.secretMethods), e
            }({
              customUI: !1,
              loadingOptions: {
                title: "加载中...",
                mask: !0
              },
              errorOptions: {
                type: "modal",
                retry: !1
              }
            }, r);
            const {
              customUI: o,
              loadingOptions: i,
              errorOptions: a,
              parseSystemError: s
            } = r, c = !o;
            return new Proxy({}, {
              get: (o, u) => function ({
                fn: e,
                interceptorName: t,
                getCallbackArgs: n
              } = {}) {
                return async function (...r) {
                  const o = n ? n({
                    params: r
                  }) : {};
                  let i, a;
                  try {
                    return await bg(vg(t, "invoke"), {
                      ...o
                    }), i = await e(...r), await bg(vg(t, "success"), {
                      ...o,
                      result: i
                    }), i
                  } catch (s) {
                    throw a = s, await bg(vg(t, "fail"), {
                      ...o,
                      error: a
                    }), a
                  } finally {
                    await bg(vg(t, "complete"), a ? {
                      ...o,
                      error: a
                    } : {
                      ...o,
                      result: i
                    })
                  }
                }
              }({
                fn: async function o(...l) {
                  let f;
                  c && Dn.showLoading({
                    title: i.title,
                    mask: i.mask
                  });
                  const p = {
                    name: n,
                    type: "OBJECT",
                    data: {
                      method: u,
                      params: l
                    }
                  };
                  "object" == typeof r.secretMethods && function (e, t) {
                    const n = t.data.method,
                      r = e.secretMethods || {},
                      o = r[n] || r["*"];
                    o && (t.secretType = o)
                  }(r, p);
                  let d = !1;
                  try {
                    f = await t.callFunction(p)
                  } catch (e) {
                    d = !0, f = {
                      result: new Rg(e)
                    }
                  }
                  const {
                    errSubject: h,
                    errCode: g,
                    errMsg: y,
                    newToken: m
                  } = f.result || {};
                  if (c && Dn.hideLoading(), m && m.token && m.tokenExpired && (Ug(m), Cg(_g, {
                      ...m
                    })), g) {
                    let e = y;
                    if (d && s && (e = (await s({
                        objectName: n,
                        methodName: u,
                        params: l,
                        errSubject: h,
                        errCode: g,
                        errMsg: y
                      })).errMsg || y), c)
                      if ("toast" === a.type) Dn.showToast({
                        title: e,
                        icon: "none"
                      });
                      else {
                        if ("modal" !== a.type) throw new Error(`Invalid errorOptions.type: ${a.type}`); {
                          const {
                            confirm: t
                          } = await async function ({
                            title: e,
                            content: t,
                            showCancel: n,
                            cancelText: r,
                            confirmText: o
                          } = {}) {
                            return new Promise(((i, a) => {
                              Dn.showModal({
                                title: e,
                                content: t,
                                showCancel: n,
                                cancelText: r,
                                confirmText: o,
                                success(e) {
                                  i(e)
                                },
                                fail() {
                                  i({
                                    confirm: !1,
                                    cancel: !0
                                  })
                                }
                              })
                            }))
                          }({
                            title: "提示",
                            content: e,
                            showCancel: a.retry,
                            cancelText: "取消",
                            confirmText: a.retry ? "重试" : "确定"
                          });
                          if (a.retry && t) return o(...l)
                        }
                      } const t = new Rg({
                      subject: h,
                      code: g,
                      message: y,
                      requestId: f.requestId
                    });
                    throw t.detail = f.result, Cg(xg, {
                      type: Tg,
                      content: t
                    }), t
                  }
                  return Cg(xg, {
                    type: Tg,
                    content: f.result
                  }), f.result
                },
                interceptorName: "callObject",
                getCallbackArgs: function ({
                  params: e
                } = {}) {
                  return {
                    objectName: n,
                    methodName: u,
                    params: e
                  }
                }
              })
            })
          }
        }(e)
      }(t), ["callFunction", "uploadFile", "deleteFile", "getTempFileURL", "downloadFile", "chooseAndUploadFile"].forEach((e => {
        if (!t[e]) return;
        const n = t[e];
        var r, o;
        t[e] = function () {
          return n.apply(t, Array.from(arguments))
        }, t[e] = (r = t[e], o = e, function (e) {
          let t = !1;
          if ("callFunction" === o) {
            const n = e && e.type || Yh;
            t = n !== Yh
          }
          const n = "callFunction" === o && !t,
            i = this._initPromiseHub.exec();
          e = e || {};
          const {
            success: a,
            fail: s,
            complete: c
          } = Ng(e), u = i.then((() => t ? Promise.resolve() : bg(vg(o, "invoke"), e))).then((() => r.call(this, e))).then((e => t ? Promise.resolve(e) : bg(vg(o, "success"), e).then((() => bg(vg(o, "complete"), e))).then((() => (n && Cg(xg, {
            type: kg,
            content: e
          }), Promise.resolve(e))))), (e => t ? Promise.reject(e) : bg(vg(o, "fail"), e).then((() => bg(vg(o, "complete"), e))).then((() => (Cg(xg, {
            type: kg,
            content: e
          }), Promise.reject(e))))));
          if (!(a || s || c)) return u;
          u.then((e => {
            a && a(e), c && c(e), n && Cg(xg, {
              type: kg,
              content: e
            })
          }), (e => {
            s && s(e), c && c(e), n && Cg(xg, {
              type: kg,
              content: e
            })
          }))
        }).bind(t)
      })), t.init = this.init, t
  }
};
(() => {
  const e = lg;
  let t = {};
  if (e && 1 === e.length) t = e[0], kb = kb.init(t), kb._isDefault = !0;
  else {
    const t = ["auth", "callFunction", "uploadFile", "deleteFile", "getTempFileURL", "downloadFile", "database", "getCurrentUSerInfo", "importObject"];
    let n;
    n = e && e.length > 0 ? "应用有多个服务空间，请通过uniCloud.init方法指定要使用的服务空间" : "uni-app cli项目内使用uniCloud需要使用HBuilderX的运行菜单运行项目，且需要在uniCloud目录关联服务空间", t.forEach((e => {
      kb[e] = function () {
        return console.error(n), Promise.reject(new Rg({
          code: "SYS_ERR",
          message: n
        }))
      }
    }))
  }
  Object.assign(kb, {
    get mixinDatacom() {
      return vb(kb)
    }
  }), pb(kb), kb.addInterceptor = yg, kb.removeInterceptor = mg, kb.interceptObject = wg
})();
var Tb = kb;
const Eb = {
    props: {
      shape: {
        type: String,
        default: Mh.search.shape
      },
      bgColor: {
        type: String,
        default: Mh.search.bgColor
      },
      placeholder: {
        type: String,
        default: Mh.search.placeholder
      },
      clearabled: {
        type: Boolean,
        default: Mh.search.clearabled
      },
      focus: {
        type: Boolean,
        default: Mh.search.focus
      },
      showAction: {
        type: Boolean,
        default: Mh.search.showAction
      },
      actionStyle: {
        type: Object,
        default: Mh.search.actionStyle
      },
      actionText: {
        type: String,
        default: Mh.search.actionText
      },
      inputAlign: {
        type: String,
        default: Mh.search.inputAlign
      },
      inputStyle: {
        type: Object,
        default: Mh.search.inputStyle
      },
      disabled: {
        type: Boolean,
        default: Mh.search.disabled
      },
      borderColor: {
        type: String,
        default: Mh.search.borderColor
      },
      searchIconColor: {
        type: String,
        default: Mh.search.searchIconColor
      },
      color: {
        type: String,
        default: Mh.search.color
      },
      placeholderColor: {
        type: String,
        default: Mh.search.placeholderColor
      },
      searchIcon: {
        type: String,
        default: Mh.search.searchIcon
      },
      searchIconSize: {
        type: [Number, String],
        default: Mh.search.searchIconSize
      },
      margin: {
        type: String,
        default: Mh.search.margin
      },
      animation: {
        type: Boolean,
        default: Mh.search.animation
      },
      modelValue: {
        type: String,
        default: Mh.search.value
      },
      value: {
        type: String,
        default: Mh.search.value
      },
      maxlength: {
        type: [String, Number],
        default: Mh.search.maxlength
      },
      height: {
        type: [String, Number],
        default: Mh.search.height
      },
      label: {
        type: [String, Number, null],
        default: Mh.search.label
      }
    }
  },
  Ib = {
    props: {
      src: {
        type: String,
        default: Mh.image.src
      },
      mode: {
        type: String,
        default: Mh.image.mode
      },
      width: {
        type: [String, Number],
        default: Mh.image.width
      },
      height: {
        type: [String, Number],
        default: Mh.image.height
      },
      shape: {
        type: String,
        default: Mh.image.shape
      },
      radius: {
        type: [String, Number],
        default: Mh.image.radius
      },
      lazyLoad: {
        type: Boolean,
        default: Mh.image.lazyLoad
      },
      showMenuByLongpress: {
        type: Boolean,
        default: Mh.image.showMenuByLongpress
      },
      loadingIcon: {
        type: String,
        default: Mh.image.loadingIcon
      },
      errorIcon: {
        type: String,
        default: Mh.image.errorIcon
      },
      showLoading: {
        type: Boolean,
        default: Mh.image.showLoading
      },
      showError: {
        type: Boolean,
        default: Mh.image.showError
      },
      fade: {
        type: Boolean,
        default: Mh.image.fade
      },
      webp: {
        type: Boolean,
        default: Mh.image.webp
      },
      duration: {
        type: [String, Number],
        default: Mh.image.duration
      },
      bgColor: {
        type: String,
        default: Mh.image.bgColor
      }
    }
  },
  Ob = {
    props: {
      dashed: {
        type: Boolean,
        default: Mh.divider.dashed
      },
      hairline: {
        type: Boolean,
        default: Mh.divider.hairline
      },
      dot: {
        type: Boolean,
        default: Mh.divider.dot
      },
      textPosition: {
        type: String,
        default: Mh.divider.textPosition
      },
      text: {
        type: [String, Number],
        default: Mh.divider.text
      },
      textSize: {
        type: [String, Number],
        default: Mh.divider.textSize
      },
      textColor: {
        type: String,
        default: Mh.divider.textColor
      },
      lineColor: {
        type: String,
        default: Mh.divider.lineColor
      }
    }
  },
  Cb = {
    props: {
      name: {
        type: String,
        default: Mh.icon.name
      },
      color: {
        type: String,
        default: Mh.icon.color
      },
      size: {
        type: [String, Number],
        default: Mh.icon.size
      },
      bold: {
        type: Boolean,
        default: Mh.icon.bold
      },
      index: {
        type: [String, Number],
        default: Mh.icon.index
      },
      hoverClass: {
        type: String,
        default: Mh.icon.hoverClass
      },
      customPrefix: {
        type: String,
        default: Mh.icon.customPrefix
      },
      label: {
        type: [String, Number],
        default: Mh.icon.label
      },
      labelPos: {
        type: String,
        default: Mh.icon.labelPos
      },
      labelSize: {
        type: [String, Number],
        default: Mh.icon.labelSize
      },
      labelColor: {
        type: String,
        default: Mh.icon.labelColor
      },
      space: {
        type: [String, Number],
        default: Mh.icon.space
      },
      imgMode: {
        type: String,
        default: Mh.icon.imgMode
      },
      width: {
        type: [String, Number],
        default: Mh.icon.width
      },
      height: {
        type: [String, Number],
        default: Mh.icon.height
      },
      top: {
        type: [String, Number],
        default: Mh.icon.top
      },
      stop: {
        type: Boolean,
        default: Mh.icon.stop
      }
    }
  },
  Bb = {
    props: {
      icon: {
        type: String,
        default: Mh.empty.icon
      },
      text: {
        type: String,
        default: Mh.empty.text
      },
      textColor: {
        type: String,
        default: Mh.empty.textColor
      },
      textSize: {
        type: [String, Number],
        default: Mh.empty.textSize
      },
      iconColor: {
        type: String,
        default: Mh.empty.iconColor
      },
      iconSize: {
        type: [String, Number],
        default: Mh.empty.iconSize
      },
      mode: {
        type: String,
        default: Mh.empty.mode
      },
      width: {
        type: [String, Number],
        default: Mh.empty.width
      },
      height: {
        type: [String, Number],
        default: Mh.empty.height
      },
      show: {
        type: Boolean,
        default: Mh.empty.show
      },
      marginTop: {
        type: [String, Number],
        default: Mh.empty.marginTop
      }
    }
  },
  jb = {
    props: {
      label: {
        type: String,
        default: Mh.formItem.label
      },
      prop: {
        type: String,
        default: Mh.formItem.prop
      },
      borderBottom: {
        type: [String, Boolean],
        default: Mh.formItem.borderBottom
      },
      labelWidth: {
        type: [String, Number],
        default: Mh.formItem.labelWidth
      },
      rightIcon: {
        type: String,
        default: Mh.formItem.rightIcon
      },
      leftIcon: {
        type: String,
        default: Mh.formItem.leftIcon
      },
      required: {
        type: Boolean,
        default: Mh.formItem.required
      },
      leftIconStyle: {
        type: [String, Object],
        default: Mh.formItem.leftIconStyle
      }
    }
  },
  Db = {
    props: {
      modelValue: {
        type: [String, Number],
        default: Mh.input.value
      },
      type: {
        type: String,
        default: Mh.input.type
      },
      fixed: {
        type: Boolean,
        default: Mh.input.fixed
      },
      disabled: {
        type: Boolean,
        default: Mh.input.disabled
      },
      disabledColor: {
        type: String,
        default: Mh.input.disabledColor
      },
      clearable: {
        type: Boolean,
        default: Mh.input.clearable
      },
      password: {
        type: Boolean,
        default: Mh.input.password
      },
      maxlength: {
        type: [String, Number],
        default: Mh.input.maxlength
      },
      placeholder: {
        type: String,
        default: Mh.input.placeholder
      },
      placeholderClass: {
        type: String,
        default: Mh.input.placeholderClass
      },
      placeholderStyle: {
        type: [String, Object],
        default: Mh.input.placeholderStyle
      },
      showWordLimit: {
        type: Boolean,
        default: Mh.input.showWordLimit
      },
      confirmType: {
        type: String,
        default: Mh.input.confirmType
      },
      confirmHold: {
        type: Boolean,
        default: Mh.input.confirmHold
      },
      holdKeyboard: {
        type: Boolean,
        default: Mh.input.holdKeyboard
      },
      focus: {
        type: Boolean,
        default: Mh.input.focus
      },
      autoBlur: {
        type: Boolean,
        default: Mh.input.autoBlur
      },
      disableDefaultPadding: {
        type: Boolean,
        default: Mh.input.disableDefaultPadding
      },
      cursor: {
        type: [String, Number],
        default: Mh.input.cursor
      },
      cursorSpacing: {
        type: [String, Number],
        default: Mh.input.cursorSpacing
      },
      selectionStart: {
        type: [String, Number],
        default: Mh.input.selectionStart
      },
      selectionEnd: {
        type: [String, Number],
        default: Mh.input.selectionEnd
      },
      adjustPosition: {
        type: Boolean,
        default: Mh.input.adjustPosition
      },
      inputAlign: {
        type: String,
        default: Mh.input.inputAlign
      },
      fontSize: {
        type: [String, Number],
        default: Mh.input.fontSize
      },
      color: {
        type: String,
        default: Mh.input.color
      },
      prefixIcon: {
        type: String,
        default: Mh.input.prefixIcon
      },
      prefixIconStyle: {
        type: [String, Object],
        default: Mh.input.prefixIconStyle
      },
      suffixIcon: {
        type: String,
        default: Mh.input.suffixIcon
      },
      suffixIconStyle: {
        type: [String, Object],
        default: Mh.input.suffixIconStyle
      },
      border: {
        type: String,
        default: Mh.input.border
      },
      readonly: {
        type: Boolean,
        default: Mh.input.readonly
      },
      shape: {
        type: String,
        default: Mh.input.shape
      },
      formatter: {
        type: [Function, null],
        default: Mh.input.formatter
      },
      ignoreCompositionEvent: {
        type: Boolean,
        default: !0
      }
    }
  },
  Nb = {
    props: {
      name: {
        type: [String, Number, Boolean],
        default: Mh.radio.name
      },
      shape: {
        type: String,
        default: Mh.radio.shape
      },
      disabled: {
        type: [String, Boolean],
        default: Mh.radio.disabled
      },
      labelDisabled: {
        type: [String, Boolean],
        default: Mh.radio.labelDisabled
      },
      activeColor: {
        type: String,
        default: Mh.radio.activeColor
      },
      inactiveColor: {
        type: String,
        default: Mh.radio.inactiveColor
      },
      iconSize: {
        type: [String, Number],
        default: Mh.radio.iconSize
      },
      labelSize: {
        type: [String, Number],
        default: Mh.radio.labelSize
      },
      label: {
        type: [String, Number],
        default: Mh.radio.label
      },
      size: {
        type: [String, Number],
        default: Mh.radio.size
      },
      color: {
        type: String,
        default: Mh.radio.color
      },
      labelColor: {
        type: String,
        default: Mh.radio.labelColor
      },
      iconColor: {
        type: String,
        default: Mh.radio.iconColor
      }
    }
  },
  Rb = {
    props: {
      modelValue: {
        type: [String, Number, Boolean],
        default: Mh.radioGroup.value
      },
      disabled: {
        type: Boolean,
        default: Mh.radioGroup.disabled
      },
      shape: {
        type: String,
        default: Mh.radioGroup.shape
      },
      activeColor: {
        type: String,
        default: Mh.radioGroup.activeColor
      },
      inactiveColor: {
        type: String,
        default: Mh.radioGroup.inactiveColor
      },
      name: {
        type: String,
        default: Mh.radioGroup.name
      },
      size: {
        type: [String, Number],
        default: Mh.radioGroup.size
      },
      placement: {
        type: String,
        default: Mh.radioGroup.placement
      },
      label: {
        type: [String],
        default: Mh.radioGroup.label
      },
      labelColor: {
        type: [String],
        default: Mh.radioGroup.labelColor
      },
      labelSize: {
        type: [String, Number],
        default: Mh.radioGroup.labelSize
      },
      labelDisabled: {
        type: Boolean,
        default: Mh.radioGroup.labelDisabled
      },
      iconColor: {
        type: String,
        default: Mh.radioGroup.iconColor
      },
      iconSize: {
        type: [String, Number],
        default: Mh.radioGroup.iconSize
      },
      borderBottom: {
        type: Boolean,
        default: Mh.radioGroup.borderBottom
      },
      iconPlacement: {
        type: String,
        default: Mh.radio.iconPlacement
      }
    }
  },
  Lb = {
    props: {
      value: {
        type: [String, Number],
        default: Mh.textarea.value
      },
      modelValue: {
        type: [String, Number],
        default: Mh.textarea.value
      },
      placeholder: {
        type: [String, Number],
        default: Mh.textarea.placeholder
      },
      placeholderClass: {
        type: String,
        default: Mh.input.placeholderClass
      },
      placeholderStyle: {
        type: [String, Object],
        default: Mh.input.placeholderStyle
      },
      height: {
        type: [String, Number],
        default: Mh.textarea.height
      },
      confirmType: {
        type: String,
        default: Mh.textarea.confirmType
      },
      disabled: {
        type: Boolean,
        default: Mh.textarea.disabled
      },
      count: {
        type: Boolean,
        default: Mh.textarea.count
      },
      focus: {
        type: Boolean,
        default: Mh.textarea.focus
      },
      autoHeight: {
        type: Boolean,
        default: Mh.textarea.autoHeight
      },
      fixed: {
        type: Boolean,
        default: Mh.textarea.fixed
      },
      cursorSpacing: {
        type: Number,
        default: Mh.textarea.cursorSpacing
      },
      cursor: {
        type: [String, Number],
        default: Mh.textarea.cursor
      },
      showConfirmBar: {
        type: Boolean,
        default: Mh.textarea.showConfirmBar
      },
      selectionStart: {
        type: Number,
        default: Mh.textarea.selectionStart
      },
      selectionEnd: {
        type: Number,
        default: Mh.textarea.selectionEnd
      },
      adjustPosition: {
        type: Boolean,
        default: Mh.textarea.adjustPosition
      },
      disableDefaultPadding: {
        type: Boolean,
        default: Mh.textarea.disableDefaultPadding
      },
      holdKeyboard: {
        type: Boolean,
        default: Mh.textarea.holdKeyboard
      },
      maxlength: {
        type: [String, Number],
        default: Mh.textarea.maxlength
      },
      border: {
        type: String,
        default: Mh.textarea.border
      },
      formatter: {
        type: [Function, null],
        default: Mh.textarea.formatter
      },
      ignoreCompositionEvent: {
        type: Boolean,
        default: !0
      }
    }
  },
  Mb = {
    props: {
      model: {
        type: Object,
        default: Mh.form.model
      },
      rules: {
        type: [Object, Function, Array],
        default: Mh.form.rules
      },
      errorType: {
        type: String,
        default: Mh.form.errorType
      },
      borderBottom: {
        type: Boolean,
        default: Mh.form.borderBottom
      },
      labelPosition: {
        type: String,
        default: Mh.form.labelPosition
      },
      labelWidth: {
        type: [String, Number],
        default: Mh.form.labelWidth
      },
      labelAlign: {
        type: String,
        default: Mh.form.labelAlign
      },
      labelStyle: {
        type: Object,
        default: Mh.form.labelStyle
      }
    }
  },
  Fb = /%[sdj%]/g;
let Ub = function () {};

function qb(e) {
  if (!e || !e.length) return null;
  const t = {};
  return e.forEach((e => {
    const {
      field: n
    } = e;
    t[n] = t[n] || [], t[n].push(e)
  })), t
}

function $b() {
  for (var e = arguments.length, t = new Array(e), n = 0; n < e; n++) t[n] = arguments[n];
  let r = 1;
  const o = t[0],
    i = t.length;
  if ("function" == typeof o) return o.apply(null, t.slice(1));
  if ("string" == typeof o) {
    let e = String(o).replace(Fb, (e => {
      if ("%%" === e) return "%";
      if (r >= i) return e;
      switch (e) {
        case "%s":
          return String(t[r++]);
        case "%d":
          return Number(t[r++]);
        case "%j":
          try {
            return JSON.stringify(t[r++])
          } catch (n) {
            return "[Circular]"
          }
          break;
        default:
          return e
      }
    }));
    for (let n = t[r]; r < i; n = t[++r]) e += ` ${n}`;
    return e
  }
  return o
}

function zb(e, t) {
  return null == e || (!("array" !== t || !Array.isArray(e) || e.length) || !(! function (e) {
    return "string" === e || "url" === e || "hex" === e || "email" === e || "pattern" === e
  }(t) || "string" != typeof e || e))
}

function Qb(e, t, n) {
  let r = 0;
  const o = e.length;
  ! function i(a) {
    if (a && a.length) return void n(a);
    const s = r;
    r += 1, s < o ? t(e[s], i) : n([])
  }([])
}

function Hb(e, t, n, r) {
  if (t.first) {
    const t = new Promise(((t, o) => {
      const i = function (e) {
        const t = [];
        return Object.keys(e).forEach((n => {
          t.push.apply(t, e[n])
        })), t
      }(e);
      Qb(i, n, (function (e) {
        return r(e), e.length ? o({
          errors: e,
          fields: qb(e)
        }) : t()
      }))
    }));
    return t.catch((e => e)), t
  }
  let o = t.firstFields || [];
  !0 === o && (o = Object.keys(e));
  const i = Object.keys(e),
    a = i.length;
  let s = 0;
  const c = [],
    u = new Promise(((t, u) => {
      const l = function (e) {
        if (c.push.apply(c, e), s++, s === a) return r(c), c.length ? u({
          errors: c,
          fields: qb(c)
        }) : t()
      };
      i.length || (r(c), t()), i.forEach((t => {
        const r = e[t]; - 1 !== o.indexOf(t) ? Qb(r, n, l) : function (e, t, n) {
          const r = [];
          let o = 0;
          const i = e.length;

          function a(e) {
            r.push.apply(r, e), o++, o === i && n(r)
          }
          e.forEach((e => {
            t(e, a)
          }))
        }(r, n, l)
      }))
    }));
  return u.catch((e => e)), u
}

function Wb(e) {
  return function (t) {
    return t && t.message ? (t.field = t.field || e.fullField, t) : {
      message: "function" == typeof t ? t() : t,
      field: t.field || e.fullField
    }
  }
}

function Vb(e, t) {
  if (t)
    for (const n in t)
      if (t.hasOwnProperty(n)) {
        const r = t[n];
        "object" == typeof r && "object" == typeof e[n] ? e[n] = {
          ...e[n],
          ...r
        } : e[n] = r
      } return e
}

function Kb(e, t, n, r, o, i) {
  !e.required || n.hasOwnProperty(e.field) && !zb(t, i || e.type) || r.push($b(o.messages.required, e.fullField))
}
"undefined" != typeof process && process.env;
const Jb = {
  email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  url: new RegExp("^(?!mailto:)(?:(?:http|https|ftp)://|//)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$", "i"),
  hex: /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i
};
var Gb = {
  integer: function (e) {
    return /^(-)?\d+$/.test(e)
  },
  float: function (e) {
    return /^(-)?\d+(\.\d+)?$/.test(e)
  },
  array: function (e) {
    return Array.isArray(e)
  },
  regexp: function (e) {
    if (e instanceof RegExp) return !0;
    try {
      return !!new RegExp(e)
    } catch (Vs) {
      return !1
    }
  },
  date: function (e) {
    return "function" == typeof e.getTime && "function" == typeof e.getMonth && "function" == typeof e.getYear
  },
  number: function (e) {
    return !isNaN(e) && "number" == typeof + e
  },
  object: function (e) {
    return "object" == typeof e && !Gb.array(e)
  },
  method: function (e) {
    return "function" == typeof e
  },
  email: function (e) {
    return "string" == typeof e && !!e.match(Jb.email) && e.length < 255
  },
  url: function (e) {
    return "string" == typeof e && !!e.match(Jb.url)
  },
  hex: function (e) {
    return "string" == typeof e && !!e.match(Jb.hex)
  }
};
const Yb = "enum";
const Xb = {
  required: Kb,
  whitespace: function (e, t, n, r, o) {
    (/^\s+$/.test(t) || "" === t) && r.push($b(o.messages.whitespace, e.fullField))
  },
  type: function (e, t, n, r, o) {
    if (e.required && void 0 === t) return void Kb(e, t, n, r, o);
    const i = e.type;
    ["integer", "float", "array", "regexp", "object", "method", "email", "number", "date", "url", "hex"].indexOf(i) > -1 ? Gb[i](t) || r.push($b(o.messages.types[i], e.fullField, e.type)) : i && typeof t !== e.type && r.push($b(o.messages.types[i], e.fullField, e.type))
  },
  range: function (e, t, n, r, o) {
    const i = "number" == typeof e.len,
      a = "number" == typeof e.min,
      s = "number" == typeof e.max,
      c = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    let u = t,
      l = null;
    const f = "number" == typeof t,
      p = "string" == typeof t,
      d = Array.isArray(t);
    if (f ? l = "number" : p ? l = "string" : d && (l = "array"), !l) return !1;
    d && (u = t.length), p && (u = t.replace(c, "_").length), i ? u !== e.len && r.push($b(o.messages[l].len, e.fullField, e.len)) : a && !s && u < e.min ? r.push($b(o.messages[l].min, e.fullField, e.min)) : s && !a && u > e.max ? r.push($b(o.messages[l].max, e.fullField, e.max)) : a && s && (u < e.min || u > e.max) && r.push($b(o.messages[l].range, e.fullField, e.min, e.max))
  },
  enum: function (e, t, n, r, o) {
    e[Yb] = Array.isArray(e[Yb]) ? e[Yb] : [], -1 === e[Yb].indexOf(t) && r.push($b(o.messages[Yb], e.fullField, e[Yb].join(", ")))
  },
  pattern: function (e, t, n, r, o) {
    if (e.pattern)
      if (e.pattern instanceof RegExp) e.pattern.lastIndex = 0, e.pattern.test(t) || r.push($b(o.messages.pattern.mismatch, e.fullField, t, e.pattern));
      else if ("string" == typeof e.pattern) {
      new RegExp(e.pattern).test(t) || r.push($b(o.messages.pattern.mismatch, e.fullField, t, e.pattern))
    }
  }
};

function Zb(e, t, n, r, o) {
  const i = e.type,
    a = [];
  if (e.required || !e.required && r.hasOwnProperty(e.field)) {
    if (zb(t, i) && !e.required) return n();
    Xb.required(e, t, r, a, o, i), zb(t, i) || Xb.type(e, t, r, a, o)
  }
  n(a)
}
const ev = {
  string: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t, "string") && !e.required) return n();
      Xb.required(e, t, r, i, o, "string"), zb(t, "string") || (Xb.type(e, t, r, i, o), Xb.range(e, t, r, i, o), Xb.pattern(e, t, r, i, o), !0 === e.whitespace && Xb.whitespace(e, t, r, i, o))
    }
    n(i)
  },
  method: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && Xb.type(e, t, r, i, o)
    }
    n(i)
  },
  number: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if ("" === t && (t = void 0), zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && (Xb.type(e, t, r, i, o), Xb.range(e, t, r, i, o))
    }
    n(i)
  },
  boolean: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && Xb.type(e, t, r, i, o)
    }
    n(i)
  },
  regexp: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), zb(t) || Xb.type(e, t, r, i, o)
    }
    n(i)
  },
  integer: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && (Xb.type(e, t, r, i, o), Xb.range(e, t, r, i, o))
    }
    n(i)
  },
  float: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && (Xb.type(e, t, r, i, o), Xb.range(e, t, r, i, o))
    }
    n(i)
  },
  array: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t, "array") && !e.required) return n();
      Xb.required(e, t, r, i, o, "array"), zb(t, "array") || (Xb.type(e, t, r, i, o), Xb.range(e, t, r, i, o))
    }
    n(i)
  },
  object: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && Xb.type(e, t, r, i, o)
    }
    n(i)
  },
  enum: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o), void 0 !== t && Xb.enum(e, t, r, i, o)
    }
    n(i)
  },
  pattern: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t, "string") && !e.required) return n();
      Xb.required(e, t, r, i, o), zb(t, "string") || Xb.pattern(e, t, r, i, o)
    }
    n(i)
  },
  date: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      if (Xb.required(e, t, r, i, o), !zb(t)) {
        let n;
        n = "number" == typeof t ? new Date(t) : t, Xb.type(e, n, r, i, o), n && Xb.range(e, n.getTime(), r, i, o)
      }
    }
    n(i)
  },
  url: Zb,
  hex: Zb,
  email: Zb,
  required: function (e, t, n, r, o) {
    const i = [],
      a = Array.isArray(t) ? "array" : typeof t;
    Xb.required(e, t, r, i, o, a), n(i)
  },
  any: function (e, t, n, r, o) {
    const i = [];
    if (e.required || !e.required && r.hasOwnProperty(e.field)) {
      if (zb(t) && !e.required) return n();
      Xb.required(e, t, r, i, o)
    }
    n(i)
  }
};

function tv() {
  return {
    default: "Validation error on field %s",
    required: "%s is required",
    enum: "%s must be one of %s",
    whitespace: "%s cannot be empty",
    date: {
      format: "%s date %s is invalid for format %s",
      parse: "%s date could not be parsed, %s is invalid ",
      invalid: "%s date %s is invalid"
    },
    types: {
      string: "%s is not a %s",
      method: "%s is not a %s (function)",
      array: "%s is not an %s",
      object: "%s is not an %s",
      number: "%s is not a %s",
      date: "%s is not a %s",
      boolean: "%s is not a %s",
      integer: "%s is not an %s",
      float: "%s is not a %s",
      regexp: "%s is not a valid %s",
      email: "%s is not a valid %s",
      url: "%s is not a valid %s",
      hex: "%s is not a valid %s"
    },
    string: {
      len: "%s must be exactly %s characters",
      min: "%s must be at least %s characters",
      max: "%s cannot be longer than %s characters",
      range: "%s must be between %s and %s characters"
    },
    number: {
      len: "%s must equal %s",
      min: "%s cannot be less than %s",
      max: "%s cannot be greater than %s",
      range: "%s must be between %s and %s"
    },
    array: {
      len: "%s must be exactly %s in length",
      min: "%s cannot be less than %s in length",
      max: "%s cannot be greater than %s in length",
      range: "%s must be between %s and %s in length"
    },
    pattern: {
      mismatch: "%s value %s does not match pattern %s"
    },
    clone: function () {
      const e = JSON.parse(JSON.stringify(this));
      return e.clone = this.clone, e
    }
  }
}
const nv = tv();

function rv(e) {
  this.rules = null, this._messages = nv, this.define(e)
}
rv.prototype = {
  messages: function (e) {
    return e && (this._messages = Vb(tv(), e)), this._messages
  },
  define: function (e) {
    if (!e) throw new Error("Cannot configure a schema with no rules");
    if ("object" != typeof e || Array.isArray(e)) throw new Error("Rules must be an object");
    let t, n;
    for (t in this.rules = {}, e) e.hasOwnProperty(t) && (n = e[t], this.rules[t] = Array.isArray(n) ? n : [n])
  },
  validate: function (e, t, n) {
    const r = this;
    void 0 === t && (t = {}), void 0 === n && (n = function () {});
    let o, i, a = e,
      s = t,
      c = n;
    if ("function" == typeof s && (c = s, s = {}), !this.rules || 0 === Object.keys(this.rules).length) return c && c(), Promise.resolve();
    if (s.messages) {
      let e = this.messages();
      e === nv && (e = tv()), Vb(e, s.messages), s.messages = e
    } else s.messages = this.messages();
    const u = {};
    (s.keys || Object.keys(this.rules)).forEach((t => {
      o = r.rules[t], i = a[t], o.forEach((n => {
        let o = n;
        "function" == typeof o.transform && (a === e && (a = {
          ...a
        }), i = a[t] = o.transform(i)), o = "function" == typeof o ? {
          validator: o
        } : {
          ...o
        }, o.validator = r.getValidationMethod(o), o.field = t, o.fullField = o.fullField || t, o.type = r.getType(o), o.validator && (u[t] = u[t] || [], u[t].push({
          rule: o,
          value: i,
          source: a,
          field: t
        }))
      }))
    }));
    const l = {};
    return Hb(u, s, ((e, t) => {
      const {
        rule: n
      } = e;
      let r, o = !("object" !== n.type && "array" !== n.type || "object" != typeof n.fields && "object" != typeof n.defaultField);

      function i(e, t) {
        return {
          ...t,
          fullField: `${n.fullField}.${e}`
        }
      }

      function a(r) {
        void 0 === r && (r = []);
        let a = r;
        if (Array.isArray(a) || (a = [a]), !s.suppressWarning && a.length && rv.warning("async-validator:", a), a.length && n.message && (a = [].concat(n.message)), a = a.map(Wb(n)), s.first && a.length) return l[n.field] = 1, t(a);
        if (o) {
          if (n.required && !e.value) return a = n.message ? [].concat(n.message).map(Wb(n)) : s.error ? [s.error(n, $b(s.messages.required, n.field))] : [], t(a);
          let r = {};
          if (n.defaultField)
            for (const t in e.value) e.value.hasOwnProperty(t) && (r[t] = n.defaultField);
          r = {
            ...r,
            ...e.rule.fields
          };
          for (const e in r)
            if (r.hasOwnProperty(e)) {
              const t = Array.isArray(r[e]) ? r[e] : [r[e]];
              r[e] = t.map(i.bind(null, e))
            } const o = new rv(r);
          o.messages(s.messages), e.rule.options && (e.rule.options.messages = s.messages, e.rule.options.error = s.error), o.validate(e.value, e.rule.options || s, (e => {
            const n = [];
            a && a.length && n.push.apply(n, a), e && e.length && n.push.apply(n, e), t(n.length ? n : null)
          }))
        } else t(a)
      }
      o = o && (n.required || !n.required && e.value), n.field = e.field, n.asyncValidator ? r = n.asyncValidator(n, e.value, a, e.source, s) : n.validator && (r = n.validator(n, e.value, a, e.source, s), !0 === r ? a() : !1 === r ? a(n.message || `${n.field} fails`) : r instanceof Array ? a(r) : r instanceof Error && a(r.message)), r && r.then && r.then((() => a()), (e => a(e)))
    }), (e => {
      ! function (e) {
        let t, n = [],
          r = {};

        function o(e) {
          if (Array.isArray(e)) {
            let t;
            n = (t = n).concat.apply(t, e)
          } else n.push(e)
        }
        for (t = 0; t < e.length; t++) o(e[t]);
        n.length ? r = qb(n) : (n = null, r = null), c(n, r)
      }(e)
    }))
  },
  getType: function (e) {
    if (void 0 === e.type && e.pattern instanceof RegExp && (e.type = "pattern"), "function" != typeof e.validator && e.type && !ev.hasOwnProperty(e.type)) throw new Error($b("Unknown rule type %s", e.type));
    return e.type || "string"
  },
  getValidationMethod: function (e) {
    if ("function" == typeof e.validator) return e.validator;
    const t = Object.keys(e),
      n = t.indexOf("message");
    return -1 !== n && t.splice(n, 1), 1 === t.length && "required" === t[0] ? ev.required : ev[this.getType(e)] || !1
  }
}, rv.register = function (e, t) {
  if ("function" != typeof t) throw new Error("Cannot register a validator by type, validator is not a function");
  ev[e] = t
}, rv.warning = Ub, rv.messages = nv;
const ov = {
  props: {
    show: {
      type: Boolean,
      default: Mh.datetimePicker.show
    },
    popupMode: {
      type: String,
      default: Mh.picker.popupMode
    },
    showToolbar: {
      type: Boolean,
      default: Mh.datetimePicker.showToolbar
    },
    modelValue: {
      type: [String, Number],
      default: Mh.datetimePicker.value
    },
    title: {
      type: String,
      default: Mh.datetimePicker.title
    },
    mode: {
      type: String,
      default: Mh.datetimePicker.mode
    },
    maxDate: {
      type: Number,
      default: Mh.datetimePicker.maxDate
    },
    minDate: {
      type: Number,
      default: Mh.datetimePicker.minDate
    },
    minHour: {
      type: Number,
      default: Mh.datetimePicker.minHour
    },
    maxHour: {
      type: Number,
      default: Mh.datetimePicker.maxHour
    },
    minMinute: {
      type: Number,
      default: Mh.datetimePicker.minMinute
    },
    maxMinute: {
      type: Number,
      default: Mh.datetimePicker.maxMinute
    },
    filter: {
      type: [Function, null],
      default: Mh.datetimePicker.filter
    },
    formatter: {
      type: [Function, null],
      default: Mh.datetimePicker.formatter
    },
    loading: {
      type: Boolean,
      default: Mh.datetimePicker.loading
    },
    itemHeight: {
      type: [String, Number],
      default: Mh.datetimePicker.itemHeight
    },
    cancelText: {
      type: String,
      default: Mh.datetimePicker.cancelText
    },
    confirmText: {
      type: String,
      default: Mh.datetimePicker.confirmText
    },
    cancelColor: {
      type: String,
      default: Mh.datetimePicker.cancelColor
    },
    confirmColor: {
      type: String,
      default: Mh.datetimePicker.confirmColor
    },
    visibleItemCount: {
      type: [String, Number],
      default: Mh.datetimePicker.visibleItemCount
    },
    closeOnClickOverlay: {
      type: Boolean,
      default: Mh.datetimePicker.closeOnClickOverlay
    },
    defaultIndex: {
      type: Array,
      default: Mh.datetimePicker.defaultIndex
    }
  }
};
var iv = 1e3,
  av = 6e4,
  sv = 36e5,
  cv = "millisecond",
  uv = "second",
  lv = "minute",
  fv = "hour",
  pv = "day",
  dv = "week",
  hv = "month",
  gv = "quarter",
  yv = "year",
  mv = "date",
  bv = "Invalid Date",
  vv = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
  wv = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
const Sv = {
  name: "en",
  weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
  months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
  ordinal: function (e) {
    var t = ["th", "st", "nd", "rd"],
      n = e % 100;
    return "[" + e + (t[(n - 20) % 10] || t[n] || t[0]) + "]"
  }
};
var xv = function (e, t, n) {
  var r = String(e);
  return !r || r.length >= t ? e : "" + Array(t + 1 - r.length).join(n) + e
};
const Av = {
  s: xv,
  z: function (e) {
    var t = -e.utcOffset(),
      n = Math.abs(t),
      r = Math.floor(n / 60),
      o = n % 60;
    return (t <= 0 ? "+" : "-") + xv(r, 2, "0") + ":" + xv(o, 2, "0")
  },
  m: function e(t, n) {
    if (t.date() < n.date()) return -e(n, t);
    var r = 12 * (n.year() - t.year()) + (n.month() - t.month()),
      o = t.clone().add(r, hv),
      i = n - o < 0,
      a = t.clone().add(r + (i ? -1 : 1), hv);
    return +(-(r + (n - o) / (i ? o - a : a - o)) || 0)
  },
  a: function (e) {
    return e < 0 ? Math.ceil(e) || 0 : Math.floor(e)
  },
  p: function (e) {
    return {
      M: hv,
      y: yv,
      w: dv,
      d: pv,
      D: mv,
      h: fv,
      m: lv,
      s: uv,
      ms: cv,
      Q: gv
    } [e] || String(e || "").toLowerCase().replace(/s$/, "")
  },
  u: function (e) {
    return void 0 === e
  }
};
var _v = "en",
  Pv = {};
Pv[_v] = Sv;
var kv = "$isDayjsObject",
  Tv = function (e) {
    return e instanceof Cv || !(!e || !e[kv])
  },
  Ev = function e(t, n, r) {
    var o;
    if (!t) return _v;
    if ("string" == typeof t) {
      var i = t.toLowerCase();
      Pv[i] && (o = i), n && (Pv[i] = n, o = i);
      var a = t.split("-");
      if (!o && a.length > 1) return e(a[0])
    } else {
      var s = t.name;
      Pv[s] = t, o = s
    }
    return !r && o && (_v = o), o || !r && _v
  },
  Iv = function (e, t) {
    if (Tv(e)) return e.clone();
    var n = "object" == typeof t ? t : {};
    return n.date = e, n.args = arguments, new Cv(n)
  },
  Ov = Av;
Ov.l = Ev, Ov.i = Tv, Ov.w = function (e, t) {
  return Iv(e, {
    locale: t.$L,
    utc: t.$u,
    x: t.$x,
    $offset: t.$offset
  })
};
var Cv = function () {
    function e(e) {
      this.$L = Ev(e.locale, null, !0), this.parse(e), this.$x = this.$x || e.x || {}, this[kv] = !0
    }
    var t = e.prototype;
    return t.parse = function (e) {
      this.$d = function (e) {
        var t = e.date,
          n = e.utc;
        if (null === t) return new Date(NaN);
        if (Ov.u(t)) return new Date;
        if (t instanceof Date) return new Date(t);
        if ("string" == typeof t && !/Z$/i.test(t)) {
          var r = t.match(vv);
          if (r) {
            var o = r[2] - 1 || 0,
              i = (r[7] || "0").substring(0, 3);
            return n ? new Date(Date.UTC(r[1], o, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, i)) : new Date(r[1], o, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, i)
          }
        }
        return new Date(t)
      }(e), this.init()
    }, t.init = function () {
      var e = this.$d;
      this.$y = e.getFullYear(), this.$M = e.getMonth(), this.$D = e.getDate(), this.$W = e.getDay(), this.$H = e.getHours(), this.$m = e.getMinutes(), this.$s = e.getSeconds(), this.$ms = e.getMilliseconds()
    }, t.$utils = function () {
      return Ov
    }, t.isValid = function () {
      return !(this.$d.toString() === bv)
    }, t.isSame = function (e, t) {
      var n = Iv(e);
      return this.startOf(t) <= n && n <= this.endOf(t)
    }, t.isAfter = function (e, t) {
      return Iv(e) < this.startOf(t)
    }, t.isBefore = function (e, t) {
      return this.endOf(t) < Iv(e)
    }, t.$g = function (e, t, n) {
      return Ov.u(e) ? this[t] : this.set(n, e)
    }, t.unix = function () {
      return Math.floor(this.valueOf() / 1e3)
    }, t.valueOf = function () {
      return this.$d.getTime()
    }, t.startOf = function (e, t) {
      var n = this,
        r = !!Ov.u(t) || t,
        o = Ov.p(e),
        i = function (e, t) {
          var o = Ov.w(n.$u ? Date.UTC(n.$y, t, e) : new Date(n.$y, t, e), n);
          return r ? o : o.endOf(pv)
        },
        a = function (e, t) {
          return Ov.w(n.toDate()[e].apply(n.toDate("s"), (r ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(t)), n)
        },
        s = this.$W,
        c = this.$M,
        u = this.$D,
        l = "set" + (this.$u ? "UTC" : "");
      switch (o) {
        case yv:
          return r ? i(1, 0) : i(31, 11);
        case hv:
          return r ? i(1, c) : i(0, c + 1);
        case dv:
          var f = this.$locale().weekStart || 0,
            p = (s < f ? s + 7 : s) - f;
          return i(r ? u - p : u + (6 - p), c);
        case pv:
        case mv:
          return a(l + "Hours", 0);
        case fv:
          return a(l + "Minutes", 1);
        case lv:
          return a(l + "Seconds", 2);
        case uv:
          return a(l + "Milliseconds", 3);
        default:
          return this.clone()
      }
    }, t.endOf = function (e) {
      return this.startOf(e, !1)
    }, t.$set = function (e, t) {
      var n, r = Ov.p(e),
        o = "set" + (this.$u ? "UTC" : ""),
        i = (n = {}, n[pv] = o + "Date", n[mv] = o + "Date", n[hv] = o + "Month", n[yv] = o + "FullYear", n[fv] = o + "Hours", n[lv] = o + "Minutes", n[uv] = o + "Seconds", n[cv] = o + "Milliseconds", n)[r],
        a = r === pv ? this.$D + (t - this.$W) : t;
      if (r === hv || r === yv) {
        var s = this.clone().set(mv, 1);
        s.$d[i](a), s.init(), this.$d = s.set(mv, Math.min(this.$D, s.daysInMonth())).$d
      } else i && this.$d[i](a);
      return this.init(), this
    }, t.set = function (e, t) {
      return this.clone().$set(e, t)
    }, t.get = function (e) {
      return this[Ov.p(e)]()
    }, t.add = function (e, t) {
      var n, r = this;
      e = Number(e);
      var o = Ov.p(t),
        i = function (t) {
          var n = Iv(r);
          return Ov.w(n.date(n.date() + Math.round(t * e)), r)
        };
      if (o === hv) return this.set(hv, this.$M + e);
      if (o === yv) return this.set(yv, this.$y + e);
      if (o === pv) return i(1);
      if (o === dv) return i(7);
      var a = (n = {}, n[lv] = av, n[fv] = sv, n[uv] = iv, n)[o] || 1,
        s = this.$d.getTime() + e * a;
      return Ov.w(s, this)
    }, t.subtract = function (e, t) {
      return this.add(-1 * e, t)
    }, t.format = function (e) {
      var t = this,
        n = this.$locale();
      if (!this.isValid()) return n.invalidDate || bv;
      var r = e || "YYYY-MM-DDTHH:mm:ssZ",
        o = Ov.z(this),
        i = this.$H,
        a = this.$m,
        s = this.$M,
        c = n.weekdays,
        u = n.months,
        l = n.meridiem,
        f = function (e, n, o, i) {
          return e && (e[n] || e(t, r)) || o[n].slice(0, i)
        },
        p = function (e) {
          return Ov.s(i % 12 || 12, e, "0")
        },
        d = l || function (e, t, n) {
          var r = e < 12 ? "AM" : "PM";
          return n ? r.toLowerCase() : r
        };
      return r.replace(wv, (function (e, r) {
        return r || function (e) {
          switch (e) {
            case "YY":
              return String(t.$y).slice(-2);
            case "YYYY":
              return Ov.s(t.$y, 4, "0");
            case "M":
              return s + 1;
            case "MM":
              return Ov.s(s + 1, 2, "0");
            case "MMM":
              return f(n.monthsShort, s, u, 3);
            case "MMMM":
              return f(u, s);
            case "D":
              return t.$D;
            case "DD":
              return Ov.s(t.$D, 2, "0");
            case "d":
              return String(t.$W);
            case "dd":
              return f(n.weekdaysMin, t.$W, c, 2);
            case "ddd":
              return f(n.weekdaysShort, t.$W, c, 3);
            case "dddd":
              return c[t.$W];
            case "H":
              return String(i);
            case "HH":
              return Ov.s(i, 2, "0");
            case "h":
              return p(1);
            case "hh":
              return p(2);
            case "a":
              return d(i, a, !0);
            case "A":
              return d(i, a, !1);
            case "m":
              return String(a);
            case "mm":
              return Ov.s(a, 2, "0");
            case "s":
              return String(t.$s);
            case "ss":
              return Ov.s(t.$s, 2, "0");
            case "SSS":
              return Ov.s(t.$ms, 3, "0");
            case "Z":
              return o
          }
          return null
        }(e) || o.replace(":", "")
      }))
    }, t.utcOffset = function () {
      return 15 * -Math.round(this.$d.getTimezoneOffset() / 15)
    }, t.diff = function (e, t, n) {
      var r, o = this,
        i = Ov.p(t),
        a = Iv(e),
        s = (a.utcOffset() - this.utcOffset()) * av,
        c = this - a,
        u = function () {
          return Ov.m(o, a)
        };
      switch (i) {
        case yv:
          r = u() / 12;
          break;
        case hv:
          r = u();
          break;
        case gv:
          r = u() / 3;
          break;
        case dv:
          r = (c - s) / 6048e5;
          break;
        case pv:
          r = (c - s) / 864e5;
          break;
        case fv:
          r = c / sv;
          break;
        case lv:
          r = c / av;
          break;
        case uv:
          r = c / iv;
          break;
        default:
          r = c
      }
      return n ? r : Ov.a(r)
    }, t.daysInMonth = function () {
      return this.endOf(hv).$D
    }, t.$locale = function () {
      return Pv[this.$L]
    }, t.locale = function (e, t) {
      if (!e) return this.$L;
      var n = this.clone(),
        r = Ev(e, t, !0);
      return r && (n.$L = r), n
    }, t.clone = function () {
      return Ov.w(this.$d, this)
    }, t.toDate = function () {
      return new Date(this.valueOf())
    }, t.toJSON = function () {
      return this.isValid() ? this.toISOString() : null
    }, t.toISOString = function () {
      return this.$d.toISOString()
    }, t.toString = function () {
      return this.$d.toUTCString()
    }, e
  }(),
  Bv = Cv.prototype;
Iv.prototype = Bv, [
  ["$ms", cv],
  ["$s", uv],
  ["$m", lv],
  ["$H", fv],
  ["$W", pv],
  ["$M", hv],
  ["$y", yv],
  ["$D", mv]
].forEach((function (e) {
  Bv[e[1]] = function (t) {
    return this.$g(t, e[0], e[1])
  }
})), Iv.extend = function (e, t) {
  return e.$i || (e(t, Cv, Iv), e.$i = !0), Iv
}, Iv.locale = Ev, Iv.isDayjs = Tv, Iv.unix = function (e) {
  return Iv(1e3 * e)
}, Iv.en = Pv[_v], Iv.Ls = Pv, Iv.p = {};
const jv = {
    props: {
      type: {
        type: String,
        default: Mh.tag.type
      },
      disabled: {
        type: [Boolean, String],
        default: Mh.tag.disabled
      },
      size: {
        type: String,
        default: Mh.tag.size
      },
      shape: {
        type: String,
        default: Mh.tag.shape
      },
      text: {
        type: [String, Number],
        default: Mh.tag.text
      },
      bgColor: {
        type: String,
        default: Mh.tag.bgColor
      },
      color: {
        type: String,
        default: Mh.tag.color
      },
      borderColor: {
        type: String,
        default: Mh.tag.borderColor
      },
      closeColor: {
        type: String,
        default: Mh.tag.closeColor
      },
      name: {
        type: [String, Number],
        default: Mh.tag.name
      },
      plainFill: {
        type: Boolean,
        default: Mh.tag.plainFill
      },
      plain: {
        type: Boolean,
        default: Mh.tag.plain
      },
      closable: {
        type: Boolean,
        default: Mh.tag.closable
      },
      show: {
        type: Boolean,
        default: Mh.tag.show
      },
      icon: {
        type: String,
        default: Mh.tag.icon
      }
    }
  },
  Dv = {
    props: {
      title: {
        type: String,
        default: Mh.calendar.title
      },
      showTitle: {
        type: Boolean,
        default: Mh.calendar.showTitle
      },
      showSubtitle: {
        type: Boolean,
        default: Mh.calendar.showSubtitle
      },
      mode: {
        type: String,
        default: Mh.calendar.mode
      },
      startText: {
        type: String,
        default: Mh.calendar.startText
      },
      endText: {
        type: String,
        default: Mh.calendar.endText
      },
      customList: {
        type: Array,
        default: Mh.calendar.customList
      },
      color: {
        type: String,
        default: Mh.calendar.color
      },
      minDate: {
        type: [String, Number],
        default: Mh.calendar.minDate
      },
      maxDate: {
        type: [String, Number],
        default: Mh.calendar.maxDate
      },
      defaultDate: {
        type: [Array, String, Date, null],
        default: Mh.calendar.defaultDate
      },
      maxCount: {
        type: [String, Number],
        default: Mh.calendar.maxCount
      },
      rowHeight: {
        type: [String, Number],
        default: Mh.calendar.rowHeight
      },
      formatter: {
        type: [Function, null],
        default: Mh.calendar.formatter
      },
      showLunar: {
        type: Boolean,
        default: Mh.calendar.showLunar
      },
      showMark: {
        type: Boolean,
        default: Mh.calendar.showMark
      },
      confirmText: {
        type: String,
        default: Mh.calendar.confirmText
      },
      confirmDisabledText: {
        type: String,
        default: Mh.calendar.confirmDisabledText
      },
      show: {
        type: Boolean,
        default: Mh.calendar.show
      },
      closeOnClickOverlay: {
        type: Boolean,
        default: Mh.calendar.closeOnClickOverlay
      },
      readonly: {
        type: Boolean,
        default: Mh.calendar.readonly
      },
      showConfirm: {
        type: Boolean,
        default: Mh.calendar.showConfirm
      },
      maxRange: {
        type: [Number, String],
        default: Mh.calendar.maxRange
      },
      rangePrompt: {
        type: String,
        default: Mh.calendar.rangePrompt
      },
      showRangePrompt: {
        type: Boolean,
        default: Mh.calendar.showRangePrompt
      },
      allowSameDay: {
        type: Boolean,
        default: Mh.calendar.allowSameDay
      },
      round: {
        type: [Boolean, String, Number],
        default: Mh.calendar.round
      },
      monthNum: {
        type: [Number, String],
        default: 3
      }
    }
  };
var Nv = {
  lunarInfo: [19416, 19168, 42352, 21717, 53856, 55632, 91476, 22176, 39632, 21970, 19168, 42422, 42192, 53840, 119381, 46400, 54944, 44450, 38320, 84343, 18800, 42160, 46261, 27216, 27968, 109396, 11104, 38256, 21234, 18800, 25958, 54432, 59984, 28309, 23248, 11104, 100067, 37600, 116951, 51536, 54432, 120998, 46416, 22176, 107956, 9680, 37584, 53938, 43344, 46423, 27808, 46416, 86869, 19872, 42416, 83315, 21168, 43432, 59728, 27296, 44710, 43856, 19296, 43748, 42352, 21088, 62051, 55632, 23383, 22176, 38608, 19925, 19152, 42192, 54484, 53840, 54616, 46400, 46752, 103846, 38320, 18864, 43380, 42160, 45690, 27216, 27968, 44870, 43872, 38256, 19189, 18800, 25776, 29859, 59984, 27480, 23232, 43872, 38613, 37600, 51552, 55636, 54432, 55888, 30034, 22176, 43959, 9680, 37584, 51893, 43344, 46240, 47780, 44368, 21977, 19360, 42416, 86390, 21168, 43312, 31060, 27296, 44368, 23378, 19296, 42726, 42208, 53856, 60005, 54576, 23200, 30371, 38608, 19195, 19152, 42192, 118966, 53840, 54560, 56645, 46496, 22224, 21938, 18864, 42359, 42160, 43600, 111189, 27936, 44448, 84835, 37744, 18936, 18800, 25776, 92326, 59984, 27424, 108228, 43744, 41696, 53987, 51552, 54615, 54432, 55888, 23893, 22176, 42704, 21972, 21200, 43448, 43344, 46240, 46758, 44368, 21920, 43940, 42416, 21168, 45683, 26928, 29495, 27296, 44368, 84821, 19296, 42352, 21732, 53600, 59752, 54560, 55968, 92838, 22224, 19168, 43476, 41680, 53584, 62034, 54560],
  solarMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  Gan: ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"],
  Zhi: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
  Animals: ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"],
  solarTerm: ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"],
  sTermInfo: ["9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c3598082c95f8c965cc920f", "97bd0b06bdb0722c965ce1cfcc920f", "b027097bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd0b06bdb0722c965ce1cfcc920f", "b027097bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd0b06bdb0722c965ce1cfcc920f", "b027097bd097c36b0b6fc9274c91aa", "9778397bd19801ec9210c965cc920e", "97b6b97bd19801ec95f8c965cc920f", "97bd09801d98082c95f8e1cfcc920f", "97bd097bd097c36b0b6fc9210c8dc2", "9778397bd197c36c9210c9274c91aa", "97b6b97bd19801ec95f8c965cc920e", "97bd09801d98082c95f8e1cfcc920f", "97bd097bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec95f8c965cc920e", "97bcf97c3598082c95f8e1cfcc920f", "97bd097bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c3598082c95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c3598082c95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd097bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf97c359801ec95f8c965cc920f", "97bd097bd07f595b0b6fc920fb0722", "9778397bd097c36b0b6fc9210c8dc2", "9778397bd19801ec9210c9274c920e", "97b6b97bd19801ec95f8c965cc920f", "97bd07f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c920e", "97b6b97bd19801ec95f8c965cc920f", "97bd07f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bd07f1487f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c965cc920e", "97bcf7f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b97bd19801ec9210c9274c920e", "97bcf7f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c91aa", "97b6b97bd197c36c9210c9274c920e", "97bcf7f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c8dc2", "9778397bd097c36c9210c9274c920e", "97b6b7f0e47f531b0723b0b6fb0722", "7f0e37f5307f595b0b0bc920fb0722", "7f0e397bd097c36b0b6fc9210c8dc2", "9778397bd097c36b0b70c9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e37f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc9210c8dc2", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9274c91aa", "97b6b7f0e47f531b0723b0787b0721", "7f0e27f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c91aa", "97b6b7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "9778397bd097c36b0b6fc9210c8dc2", "977837f0e37f149b0723b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f5307f595b0b0bc920fb0722", "7f0e397bd097c35b0b6fc9210c8dc2", "977837f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e37f1487f595b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc9210c8dc2", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd097c35b0b6fc920fb0722", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14998082b0787b06bd", "7f07e7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0b0bb0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14998082b0723b06bd", "7f07e7f0e37f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722", "7f0e397bd07f595b0b0bc920fb0722", "977837f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f1487f595b0b0bb0b6fb0722", "7f0e37f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e37f1487f531b0b0bb0b6fb0722", "7f0e37f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e37f1487f531b0b0bb0b6fb0722", "7f0e37f0e37f14898082b072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e37f0e37f14898082b072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f149b0723b0787b0721", "7f0e27f1487f531b0b0bb0b6fb0722", "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14998082b0723b06bd", "7f07e7f0e47f149b0723b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722", "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14998082b0723b06bd", "7f07e7f0e37f14998083b0787b0721", "7f0e27f0e47f531b0723b0b6fb0722", "7f0e37f0e366aa89801eb072297c35", "7ec967f0e37f14898082b0723b02d5", "7f07e7f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e36665b66aa89801e9808297c35", "665f67f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b0721", "7f07e7f0e47f531b0723b0b6fb0722", "7f0e36665b66a449801e9808297c35", "665f67f0e37f14898082b0723b02d5", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e36665b66a449801e9808297c35", "665f67f0e37f14898082b072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e26665b66a449801e9808297c35", "665f67f0e37f1489801eb072297c35", "7ec967f0e37f14998082b0787b06bd", "7f07e7f0e47f531b0723b0b6fb0721", "7f0e27f1487f531b0b0bb0b6fb0722"],
  nStr1: ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
  nStr2: ["初", "十", "廿", "卅"],
  nStr3: ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"],
  lYearDays: function (e) {
    var t, n = 348;
    for (t = 32768; t > 8; t >>= 1) n += this.lunarInfo[e - 1900] & t ? 1 : 0;
    return n + this.leapDays(e)
  },
  leapMonth: function (e) {
    return 15 & this.lunarInfo[e - 1900]
  },
  leapDays: function (e) {
    return this.leapMonth(e) ? 65536 & this.lunarInfo[e - 1900] ? 30 : 29 : 0
  },
  monthDays: function (e, t) {
    return t > 12 || t < 1 ? -1 : this.lunarInfo[e - 1900] & 65536 >> t ? 30 : 29
  },
  solarDays: function (e, t) {
    if (t > 12 || t < 1) return -1;
    var n = t - 1;
    return 1 == n ? e % 4 == 0 && e % 100 != 0 || e % 400 == 0 ? 29 : 28 : this.solarMonth[n]
  },
  toGanZhiYear: function (e) {
    var t = (e - 3) % 10,
      n = (e - 3) % 12;
    return 0 == t && (t = 10), 0 == n && (n = 12), this.Gan[t - 1] + this.Zhi[n - 1]
  },
  toAstro: function (e, t) {
    return "魔羯水瓶双鱼白羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯".substr(2 * e - (t < [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22][e - 1] ? 2 : 0), 2) + "座"
  },
  toGanZhi: function (e) {
    return this.Gan[e % 10] + this.Zhi[e % 12]
  },
  getTerm: function (e, t) {
    if (e < 1900 || e > 2100) return -1;
    if (t < 1 || t > 24) return -1;
    var n = this.sTermInfo[e - 1900],
      r = [parseInt("0x" + n.substr(0, 5)).toString(), parseInt("0x" + n.substr(5, 5)).toString(), parseInt("0x" + n.substr(10, 5)).toString(), parseInt("0x" + n.substr(15, 5)).toString(), parseInt("0x" + n.substr(20, 5)).toString(), parseInt("0x" + n.substr(25, 5)).toString()],
      o = [r[0].substr(0, 1), r[0].substr(1, 2), r[0].substr(3, 1), r[0].substr(4, 2), r[1].substr(0, 1), r[1].substr(1, 2), r[1].substr(3, 1), r[1].substr(4, 2), r[2].substr(0, 1), r[2].substr(1, 2), r[2].substr(3, 1), r[2].substr(4, 2), r[3].substr(0, 1), r[3].substr(1, 2), r[3].substr(3, 1), r[3].substr(4, 2), r[4].substr(0, 1), r[4].substr(1, 2), r[4].substr(3, 1), r[4].substr(4, 2), r[5].substr(0, 1), r[5].substr(1, 2), r[5].substr(3, 1), r[5].substr(4, 2)];
    return parseInt(o[t - 1])
  },
  toChinaMonth: function (e) {
    if (e > 12 || e < 1) return -1;
    var t = this.nStr3[e - 1];
    return t += "月"
  },
  toChinaDay: function (e) {
    var t;
    switch (e) {
      case 10:
        t = "初十";
        break;
      case 20:
        t = "二十";
        break;
      case 30:
        t = "三十";
        break;
      default:
        t = this.nStr2[Math.floor(e / 10)], t += this.nStr1[e % 10]
    }
    return t
  },
  getAnimal: function (e) {
    return this.Animals[(e - 4) % 12]
  },
  solar2lunar: function (e, t, n) {
    if (e < 1900 || e > 2100) return -1;
    if (1900 == e && 1 == t && n < 31) return -1;
    if (e) r = new Date(e, parseInt(t) - 1, n);
    else var r = new Date;
    var o, i = 0,
      a = (e = r.getFullYear(), t = r.getMonth() + 1, n = r.getDate(), (Date.UTC(r.getFullYear(), r.getMonth(), r.getDate()) - Date.UTC(1900, 0, 31)) / 864e5);
    for (o = 1900; o < 2101 && a > 0; o++) a -= i = this.lYearDays(o);
    a < 0 && (a += i, o--);
    var s = new Date,
      c = !1;
    s.getFullYear() == e && s.getMonth() + 1 == t && s.getDate() == n && (c = !0);
    var u = r.getDay(),
      l = this.nStr1[u];
    0 == u && (u = 7);
    var f = o,
      p = this.leapMonth(o),
      d = !1;
    for (o = 1; o < 13 && a > 0; o++) p > 0 && o == p + 1 && 0 == d ? (--o, d = !0, i = this.leapDays(f)) : i = this.monthDays(f, o), 1 == d && o == p + 1 && (d = !1), a -= i;
    0 == a && p > 0 && o == p + 1 && (d ? d = !1 : (d = !0, --o)), a < 0 && (a += i, --o);
    var h = o,
      g = a + 1,
      y = t - 1,
      m = this.toGanZhiYear(f),
      b = this.getTerm(e, 2 * t - 1),
      v = this.getTerm(e, 2 * t),
      w = this.toGanZhi(12 * (e - 1900) + t + 11);
    n >= b && (w = this.toGanZhi(12 * (e - 1900) + t + 12));
    var S = !1,
      x = null;
    b == n && (S = !0, x = this.solarTerm[2 * t - 2]), v == n && (S = !0, x = this.solarTerm[2 * t - 1]);
    var A = Date.UTC(e, y, 1, 0, 0, 0, 0) / 864e5 + 25567 + 10,
      _ = this.toGanZhi(A + n - 1),
      P = this.toAstro(t, n);
    return {
      lYear: f,
      lMonth: h,
      lDay: g,
      Animal: this.getAnimal(f),
      IMonthCn: (d ? "闰" : "") + this.toChinaMonth(h),
      IDayCn: this.toChinaDay(g),
      cYear: e,
      cMonth: t,
      cDay: n,
      gzYear: m,
      gzMonth: w,
      gzDay: _,
      isToday: c,
      isLeap: d,
      nWeek: u,
      ncWeek: "星期" + l,
      isTerm: S,
      Term: x,
      astro: P
    }
  },
  lunar2solar: function (e, t, n, r) {
    r = !!r;
    var o = this.leapMonth(e);
    if (this.leapDays(e), r && o != t) return -1;
    if (2100 == e && 12 == t && n > 1 || 1900 == e && 1 == t && n < 31) return -1;
    var i = this.monthDays(e, t),
      a = i;
    if (r && (a = this.leapDays(e, t)), e < 1900 || e > 2100 || n > a) return -1;
    for (var s = 0, c = 1900; c < e; c++) s += this.lYearDays(c);
    var u = 0,
      l = !1;
    for (c = 1; c < t; c++) u = this.leapMonth(e), l || u <= c && u > 0 && (s += this.leapDays(e), l = !0), s += this.monthDays(e, c);
    r && (s += i);
    var f = Date.UTC(1900, 1, 30, 0, 0, 0),
      p = new Date(864e5 * (s + n - 31) + f),
      d = p.getUTCFullYear(),
      h = p.getUTCMonth() + 1,
      g = p.getUTCDate();
    return this.solar2lunar(d, h, g)
  }
};
const Rv = {
  props: {
    show: {
      type: Boolean,
      default: Mh.picker.show
    },
    popupMode: {
      type: String,
      default: Mh.picker.popupMode
    },
    showToolbar: {
      type: Boolean,
      default: Mh.picker.showToolbar
    },
    title: {
      type: String,
      default: Mh.picker.title
    },
    columns: {
      type: Array,
      default: Mh.picker.columns
    },
    loading: {
      type: Boolean,
      default: Mh.picker.loading
    },
    itemHeight: {
      type: [String, Number],
      default: Mh.picker.itemHeight
    },
    cancelText: {
      type: String,
      default: Mh.picker.cancelText
    },
    confirmText: {
      type: String,
      default: Mh.picker.confirmText
    },
    cancelColor: {
      type: String,
      default: Mh.picker.cancelColor
    },
    confirmColor: {
      type: String,
      default: Mh.picker.confirmColor
    },
    visibleItemCount: {
      type: [String, Number],
      default: Mh.picker.visibleItemCount
    },
    keyName: {
      type: String,
      default: Mh.picker.keyName
    },
    closeOnClickOverlay: {
      type: Boolean,
      default: Mh.picker.closeOnClickOverlay
    },
    defaultIndex: {
      type: Array,
      default: Mh.picker.defaultIndex
    },
    immediateChange: {
      type: Boolean,
      default: Mh.picker.immediateChange
    }
  }
};

function Lv(e, t) {
  return ["[object Object]", "[object File]"].includes(Object.prototype.toString.call(e)) ? Object.keys(e).reduce(((n, r) => (t.includes(r) || (n[r] = e[r]), n)), {}) : {}
}

function Mv(e) {
  return e.tempFiles.map((e => ({
    ...Lv(e, ["path"]),
    url: e.path,
    size: e.size
  })))
}
const Fv = {
    watch: {
      accept: {
        immediate: !0,
        handler(e) {}
      }
    }
  },
  Uv = {
    props: {
      accept: {
        type: String,
        default: Mh.upload.accept
      },
      capture: {
        type: [String, Array],
        default: Mh.upload.capture
      },
      compressed: {
        type: Boolean,
        default: Mh.upload.compressed
      },
      camera: {
        type: String,
        default: Mh.upload.camera
      },
      maxDuration: {
        type: Number,
        default: Mh.upload.maxDuration
      },
      uploadIcon: {
        type: String,
        default: Mh.upload.uploadIcon
      },
      uploadIconColor: {
        type: String,
        default: Mh.upload.uploadIconColor
      },
      useBeforeRead: {
        type: Boolean,
        default: Mh.upload.useBeforeRead
      },
      afterRead: {
        type: Function,
        default: null
      },
      beforeRead: {
        type: Function,
        default: null
      },
      previewFullImage: {
        type: Boolean,
        default: Mh.upload.previewFullImage
      },
      maxCount: {
        type: [String, Number],
        default: Mh.upload.maxCount
      },
      disabled: {
        type: Boolean,
        default: Mh.upload.disabled
      },
      imageMode: {
        type: String,
        default: Mh.upload.imageMode
      },
      name: {
        type: String,
        default: Mh.upload.name
      },
      sizeType: {
        type: Array,
        default: Mh.upload.sizeType
      },
      multiple: {
        type: Boolean,
        default: Mh.upload.multiple
      },
      deletable: {
        type: Boolean,
        default: Mh.upload.deletable
      },
      maxSize: {
        type: [String, Number],
        default: Mh.upload.maxSize
      },
      fileList: {
        type: Array,
        default: Mh.upload.fileList
      },
      uploadText: {
        type: String,
        default: Mh.upload.uploadText
      },
      width: {
        type: [String, Number],
        default: Mh.upload.width
      },
      height: {
        type: [String, Number],
        default: Mh.upload.height
      },
      previewImage: {
        type: Boolean,
        default: Mh.upload.previewImage
      }
    }
  },
  qv = {
    props: {
      show: {
        type: Boolean,
        default: Mh.popup.show
      },
      overlay: {
        type: Boolean,
        default: Mh.popup.overlay
      },
      mode: {
        type: String,
        default: Mh.popup.mode
      },
      duration: {
        type: [String, Number],
        default: Mh.popup.duration
      },
      closeable: {
        type: Boolean,
        default: Mh.popup.closeable
      },
      overlayStyle: {
        type: [Object, String],
        default: Mh.popup.overlayStyle
      },
      closeOnClickOverlay: {
        type: Boolean,
        default: Mh.popup.closeOnClickOverlay
      },
      zIndex: {
        type: [String, Number],
        default: Mh.popup.zIndex
      },
      safeAreaInsetBottom: {
        type: Boolean,
        default: Mh.popup.safeAreaInsetBottom
      },
      safeAreaInsetTop: {
        type: Boolean,
        default: Mh.popup.safeAreaInsetTop
      },
      closeIconPos: {
        type: String,
        default: Mh.popup.closeIconPos
      },
      round: {
        type: [Boolean, String, Number],
        default: Mh.popup.round
      },
      zoom: {
        type: Boolean,
        default: Mh.popup.zoom
      },
      bgColor: {
        type: String,
        default: Mh.popup.bgColor
      },
      overlayOpacity: {
        type: [Number, String],
        default: Mh.popup.overlayOpacity
      }
    }
  },
  $v = {
    props: {
      showScrollbar: {
        type: Boolean,
        default: Mh.list.showScrollbar
      },
      lowerThreshold: {
        type: [String, Number],
        default: Mh.list.lowerThreshold
      },
      upperThreshold: {
        type: [String, Number],
        default: Mh.list.upperThreshold
      },
      scrollTop: {
        type: [String, Number],
        default: Mh.list.scrollTop
      },
      offsetAccuracy: {
        type: [String, Number],
        default: Mh.list.offsetAccuracy
      },
      enableFlex: {
        type: Boolean,
        default: Mh.list.enableFlex
      },
      pagingEnabled: {
        type: Boolean,
        default: Mh.list.pagingEnabled
      },
      scrollable: {
        type: Boolean,
        default: Mh.list.scrollable
      },
      scrollIntoView: {
        type: String,
        default: Mh.list.scrollIntoView
      },
      scrollWithAnimation: {
        type: Boolean,
        default: Mh.list.scrollWithAnimation
      },
      enableBackToTop: {
        type: Boolean,
        default: Mh.list.enableBackToTop
      },
      height: {
        type: [String, Number],
        default: Mh.list.height
      },
      width: {
        type: [String, Number],
        default: Mh.list.width
      },
      preLoadScreen: {
        type: [String, Number],
        default: Mh.list.preLoadScreen
      }
    }
  },
  zv = {
    props: {
      offsetTop: {
        type: [String, Number],
        default: Mh.sticky.offsetTop
      },
      customNavHeight: {
        type: [String, Number],
        default: Mh.sticky.customNavHeight
      },
      disabled: {
        type: Boolean,
        default: Mh.sticky.disabled
      },
      bgColor: {
        type: String,
        default: Mh.sticky.bgColor
      },
      zIndex: {
        type: [String, Number],
        default: Mh.sticky.zIndex
      },
      index: {
        type: [String, Number],
        default: Mh.sticky.index
      }
    }
  },
  Qv = {
    props: {
      show: {
        type: Boolean,
        default: Mh.modal.show
      },
      title: {
        type: [String],
        default: Mh.modal.title
      },
      content: {
        type: String,
        default: Mh.modal.content
      },
      confirmText: {
        type: String,
        default: Mh.modal.confirmText
      },
      cancelText: {
        type: String,
        default: Mh.modal.cancelText
      },
      showConfirmButton: {
        type: Boolean,
        default: Mh.modal.showConfirmButton
      },
      showCancelButton: {
        type: Boolean,
        default: Mh.modal.showCancelButton
      },
      confirmColor: {
        type: String,
        default: Mh.modal.confirmColor
      },
      cancelColor: {
        type: String,
        default: Mh.modal.cancelColor
      },
      buttonReverse: {
        type: Boolean,
        default: Mh.modal.buttonReverse
      },
      zoom: {
        type: Boolean,
        default: Mh.modal.zoom
      },
      asyncClose: {
        type: Boolean,
        default: Mh.modal.asyncClose
      },
      closeOnClickOverlay: {
        type: Boolean,
        default: Mh.modal.closeOnClickOverlay
      },
      negativeTop: {
        type: [String, Number],
        default: Mh.modal.negativeTop
      },
      width: {
        type: [String, Number],
        default: Mh.modal.width
      },
      confirmButtonShape: {
        type: String,
        default: Mh.modal.confirmButtonShape
      }
    }
  },
  Hv = {
    props: {
      duration: {
        type: Number,
        default: Mh.tabs.duration
      },
      list: {
        type: Array,
        default: Mh.tabs.list
      },
      lineColor: {
        type: String,
        default: Mh.tabs.lineColor
      },
      activeStyle: {
        type: [String, Object],
        default: Mh.tabs.activeStyle
      },
      inactiveStyle: {
        type: [String, Object],
        default: Mh.tabs.inactiveStyle
      },
      lineWidth: {
        type: [String, Number],
        default: Mh.tabs.lineWidth
      },
      lineHeight: {
        type: [String, Number],
        default: Mh.tabs.lineHeight
      },
      lineBgSize: {
        type: String,
        default: Mh.tabs.lineBgSize
      },
      itemStyle: {
        type: [String, Object],
        default: Mh.tabs.itemStyle
      },
      scrollable: {
        type: Boolean,
        default: Mh.tabs.scrollable
      },
      current: {
        type: [Number, String],
        default: Mh.tabs.current
      },
      keyName: {
        type: String,
        default: Mh.tabs.keyName
      }
    }
  },
  Wv = {
    props: {
      lang: String,
      sessionFrom: String,
      sendMessageTitle: String,
      sendMessagePath: String,
      sendMessageImg: String,
      showMessageCard: Boolean,
      appParameter: String,
      formType: String,
      openType: String
    }
  },
  Vv = {
    props: {
      openType: String
    },
    methods: {
      onGetUserInfo(e) {
        this.$emit("getuserinfo", e.detail)
      },
      onContact(e) {
        this.$emit("contact", e.detail)
      },
      onGetPhoneNumber(e) {
        this.$emit("getphonenumber", e.detail)
      },
      onError(e) {
        this.$emit("error", e.detail)
      },
      onLaunchApp(e) {
        this.$emit("launchapp", e.detail)
      },
      onOpenSetting(e) {
        this.$emit("opensetting", e.detail)
      }
    }
  },
  Kv = {
    props: {
      hairline: {
        type: Boolean,
        default: Mh.button.hairline
      },
      type: {
        type: String,
        default: Mh.button.type
      },
      size: {
        type: String,
        default: Mh.button.size
      },
      shape: {
        type: String,
        default: Mh.button.shape
      },
      plain: {
        type: Boolean,
        default: Mh.button.plain
      },
      disabled: {
        type: Boolean,
        default: Mh.button.disabled
      },
      loading: {
        type: Boolean,
        default: Mh.button.loading
      },
      loadingText: {
        type: [String, Number],
        default: Mh.button.loadingText
      },
      loadingMode: {
        type: String,
        default: Mh.button.loadingMode
      },
      loadingSize: {
        type: [String, Number],
        default: Mh.button.loadingSize
      },
      openType: {
        type: String,
        default: Mh.button.openType
      },
      formType: {
        type: String,
        default: Mh.button.formType
      },
      appParameter: {
        type: String,
        default: Mh.button.appParameter
      },
      hoverStopPropagation: {
        type: Boolean,
        default: Mh.button.hoverStopPropagation
      },
      lang: {
        type: String,
        default: Mh.button.lang
      },
      sessionFrom: {
        type: String,
        default: Mh.button.sessionFrom
      },
      sendMessageTitle: {
        type: String,
        default: Mh.button.sendMessageTitle
      },
      sendMessagePath: {
        type: String,
        default: Mh.button.sendMessagePath
      },
      sendMessageImg: {
        type: String,
        default: Mh.button.sendMessageImg
      },
      showMessageCard: {
        type: Boolean,
        default: Mh.button.showMessageCard
      },
      dataName: {
        type: String,
        default: Mh.button.dataName
      },
      throttleTime: {
        type: [String, Number],
        default: Mh.button.throttleTime
      },
      hoverStartTime: {
        type: [String, Number],
        default: Mh.button.hoverStartTime
      },
      hoverStayTime: {
        type: [String, Number],
        default: Mh.button.hoverStayTime
      },
      text: {
        type: [String, Number],
        default: Mh.button.text
      },
      icon: {
        type: String,
        default: Mh.button.icon
      },
      iconColor: {
        type: String,
        default: Mh.button.icon
      },
      color: {
        type: String,
        default: Mh.button.color
      }
    }
  },
  Jv = {
    computed: {
      value() {
        const {
          text: e,
          mode: t,
          format: n,
          href: r
        } = this;
        return "price" === t ? (/^\d+(\.\d+)?$/.test(e) || Dn.$u.error("金额模式下，text参数需要为金额格式"), Dn.$u.test.func(n) ? n(e) : Dn.$u.priceFormat(e, 2)) : "date" === t ? (!Dn.$u.test.date(e) && Dn.$u.error("日期模式下，text参数需要为日期或时间戳格式"), Dn.$u.test.func(n) ? n(e) : n ? Dn.$u.timeFormat(e, n) : Dn.$u.timeFormat(e, "yyyy-mm-dd")) : "phone" === t ? Dn.$u.test.func(n) ? n(e) : "encrypt" === n ? `${e.substr(0,3)}****${e.substr(7)}` : e : "name" === t ? ("string" != typeof e && Dn.$u.error("姓名模式下，text参数需要为字符串格式"), Dn.$u.test.func(n) ? n(e) : "encrypt" === n ? this.formatName(e) : e) : "link" === t ? (!Dn.$u.test.url(r) && Dn.$u.error("超链接模式下，href参数需要为URL格式"), e) : e
      }
    },
    methods: {
      formatName(e) {
        let t = "";
        if (2 === e.length) t = e.substr(0, 1) + "*";
        else if (e.length > 2) {
          let n = "";
          for (let t = 0, r = e.length - 2; t < r; t++) n += "*";
          t = e.substr(0, 1) + n + e.substr(-1, 1)
        } else t = e;
        return t
      }
    }
  },
  Gv = {
    props: {
      type: {
        type: String,
        default: Mh.text.type
      },
      show: {
        type: Boolean,
        default: Mh.text.show
      },
      text: {
        type: [String, Number],
        default: Mh.text.text
      },
      prefixIcon: {
        type: String,
        default: Mh.text.prefixIcon
      },
      suffixIcon: {
        type: String,
        default: Mh.text.suffixIcon
      },
      mode: {
        type: String,
        default: Mh.text.mode
      },
      href: {
        type: String,
        default: Mh.text.href
      },
      format: {
        type: [String, Function],
        default: Mh.text.format
      },
      call: {
        type: Boolean,
        default: Mh.text.call
      },
      openType: {
        type: String,
        default: Mh.text.openType
      },
      bold: {
        type: Boolean,
        default: Mh.text.bold
      },
      block: {
        type: Boolean,
        default: Mh.text.block
      },
      lines: {
        type: [String, Number],
        default: Mh.text.lines
      },
      color: {
        type: String,
        default: Mh.text.color
      },
      size: {
        type: [String, Number],
        default: Mh.text.size
      },
      iconStyle: {
        type: [Object, String],
        default: Mh.text.iconStyle
      },
      decoration: {
        tepe: String,
        default: Mh.text.decoration
      },
      margin: {
        type: [Object, String, Number],
        default: Mh.text.margin
      },
      lineHeight: {
        type: [String, Number],
        default: Mh.text.lineHeight
      },
      align: {
        type: String,
        default: Mh.text.align
      },
      wordWrap: {
        type: String,
        default: Mh.text.wordWrap
      }
    }
  },
  Yv = {
    props: {
      title: {
        type: [String, Number],
        default: Mh.stepsItem.title
      },
      desc: {
        type: [String, Number],
        default: Mh.stepsItem.desc
      },
      iconSize: {
        type: [String, Number],
        default: Mh.stepsItem.iconSize
      },
      error: {
        type: Boolean,
        default: Mh.stepsItem.error
      }
    }
  },
  Xv = {
    props: {
      direction: {
        type: String,
        default: Mh.steps.direction
      },
      current: {
        type: [String, Number],
        default: Mh.steps.current
      },
      activeColor: {
        type: String,
        default: Mh.steps.activeColor
      },
      inactiveColor: {
        type: String,
        default: Mh.steps.inactiveColor
      },
      activeIcon: {
        type: String,
        default: Mh.steps.activeIcon
      },
      inactiveIcon: {
        type: String,
        default: Mh.steps.inactiveIcon
      },
      dot: {
        type: Boolean,
        default: Mh.steps.dot
      }
    }
  },
  Zv = {
    props: {
      modelValue: {
        type: [String, Number],
        default: Mh.rate.value
      },
      count: {
        type: [String, Number],
        default: Mh.rate.count
      },
      disabled: {
        type: Boolean,
        default: Mh.rate.disabled
      },
      readonly: {
        type: Boolean,
        default: Mh.rate.readonly
      },
      size: {
        type: [String, Number],
        default: Mh.rate.size
      },
      inactiveColor: {
        type: String,
        default: Mh.rate.inactiveColor
      },
      activeColor: {
        type: String,
        default: Mh.rate.activeColor
      },
      gutter: {
        type: [String, Number],
        default: Mh.rate.gutter
      },
      minCount: {
        type: [String, Number],
        default: Mh.rate.minCount
      },
      allowHalf: {
        type: Boolean,
        default: Mh.rate.allowHalf
      },
      activeIcon: {
        type: String,
        default: Mh.rate.activeIcon
      },
      inactiveIcon: {
        type: String,
        default: Mh.rate.inactiveIcon
      },
      touchable: {
        type: Boolean,
        default: Mh.rate.touchable
      }
    }
  },
  ew = {
    props: {
      isDot: {
        type: Boolean,
        default: Mh.badge.isDot
      },
      value: {
        type: [Number, String],
        default: Mh.badge.value
      },
      modelValue: {
        type: [Number, String],
        default: Mh.badge.modelValue
      },
      show: {
        type: Boolean,
        default: Mh.badge.show
      },
      max: {
        type: [Number, String],
        default: Mh.badge.max
      },
      type: {
        type: String,
        default: Mh.badge.type
      },
      showZero: {
        type: Boolean,
        default: Mh.badge.showZero
      },
      bgColor: {
        type: [String, null],
        default: Mh.badge.bgColor
      },
      color: {
        type: [String, null],
        default: Mh.badge.color
      },
      shape: {
        type: String,
        default: Mh.badge.shape
      },
      numberType: {
        type: String,
        default: Mh.badge.numberType
      },
      offset: {
        type: Array,
        default: Mh.badge.offset
      },
      inverted: {
        type: Boolean,
        default: Mh.badge.inverted
      },
      absolute: {
        type: Boolean,
        default: Mh.badge.absolute
      }
    }
  },
  tw = {
    props: {
      show: {
        type: Boolean,
        default: Mh.transition.show
      },
      mode: {
        type: String,
        default: Mh.transition.mode
      },
      duration: {
        type: [String, Number],
        default: Mh.transition.duration
      },
      timingFunction: {
        type: String,
        default: Mh.transition.timingFunction
      }
    }
  },
  nw = e => ({
    enter: `u-${e}-enter u-${e}-enter-active`,
    "enter-to": `u-${e}-enter-to u-${e}-enter-active`,
    leave: `u-${e}-leave u-${e}-leave-active`,
    "leave-to": `u-${e}-leave-to u-${e}-leave-active`
  }),
  rw = {
    methods: {
      clickHandler() {
        this.$emit("click")
      },
      async vueEnter() {
        const e = nw(this.mode);
        this.status = "enter", this.$emit("beforeEnter"), this.inited = !0, this.display = !0, this.classes = e.enter, await ko(), this.$emit("enter"), this.transitionEnded = !1, this.$emit("afterEnter"), this.classes = e["enter-to"]
      },
      async vueLeave() {
        if (!this.display) return;
        const e = nw(this.mode);
        this.status = "leave", this.$emit("beforeLeave"), this.classes = e.leave, await ko(), this.transitionEnded = !1, this.$emit("leave"), setTimeout(this.onTransitionEnd, this.duration), this.classes = e["leave-to"]
      },
      onTransitionEnd() {
        this.transitionEnded || (this.transitionEnded = !0, this.$emit("leave" === this.status ? "afterLeave" : "afterEnter"), !this.show && this.display && (this.display = !1, this.inited = !1))
      }
    }
  },
  ow = {
    props: {
      color: {
        type: String,
        default: Mh.line.color
      },
      length: {
        type: [String, Number],
        default: Mh.line.length
      },
      direction: {
        type: String,
        default: Mh.line.direction
      },
      hairline: {
        type: Boolean,
        default: Mh.line.hairline
      },
      margin: {
        type: [String, Number],
        default: Mh.line.margin
      },
      dashed: {
        type: Boolean,
        default: Mh.line.dashed
      }
    }
  },
  iw = {
    props: {
      show: {
        type: Boolean,
        default: Mh.toolbar.show
      },
      cancelText: {
        type: String,
        default: Mh.toolbar.cancelText
      },
      confirmText: {
        type: String,
        default: Mh.toolbar.confirmText
      },
      cancelColor: {
        type: String,
        default: Mh.toolbar.cancelColor
      },
      confirmColor: {
        type: String,
        default: Mh.toolbar.confirmColor
      },
      title: {
        type: String,
        default: Mh.toolbar.title
      }
    }
  },
  aw = {
    props: {
      show: {
        type: Boolean,
        default: Mh.loadingIcon.show
      },
      color: {
        type: String,
        default: Mh.loadingIcon.color
      },
      textColor: {
        type: String,
        default: Mh.loadingIcon.textColor
      },
      vertical: {
        type: Boolean,
        default: Mh.loadingIcon.vertical
      },
      mode: {
        type: String,
        default: Mh.loadingIcon.mode
      },
      size: {
        type: [String, Number],
        default: Mh.loadingIcon.size
      },
      textSize: {
        type: [String, Number],
        default: Mh.loadingIcon.textSize
      },
      text: {
        type: [String, Number],
        default: Mh.loadingIcon.text
      },
      timingFunction: {
        type: String,
        default: Mh.loadingIcon.timingFunction
      },
      duration: {
        type: [String, Number],
        default: Mh.loadingIcon.duration
      },
      inactiveColor: {
        type: String,
        default: Mh.loadingIcon.inactiveColor
      }
    }
  },
  sw = {
    props: {
      show: {
        type: Boolean,
        default: Mh.overlay.show
      },
      zIndex: {
        type: [String, Number],
        default: Mh.overlay.zIndex
      },
      duration: {
        type: [String, Number],
        default: Mh.overlay.duration
      },
      opacity: {
        type: [String, Number],
        default: Mh.overlay.opacity
      }
    }
  },
  cw = {
    props: {
      bgColor: {
        type: String,
        default: Mh.statusBar.bgColor
      }
    }
  },
  uw = {
    props: {
      name: {
        type: [String, Number, Boolean],
        default: Mh.checkbox.name
      },
      shape: {
        type: String,
        default: Mh.checkbox.shape
      },
      size: {
        type: [String, Number],
        default: Mh.checkbox.size
      },
      checked: {
        type: Boolean,
        default: Mh.checkbox.checked
      },
      disabled: {
        type: [String, Boolean],
        default: Mh.checkbox.disabled
      },
      activeColor: {
        type: String,
        default: Mh.checkbox.activeColor
      },
      inactiveColor: {
        type: String,
        default: Mh.checkbox.inactiveColor
      },
      iconSize: {
        type: [String, Number],
        default: Mh.checkbox.iconSize
      },
      iconColor: {
        type: String,
        default: Mh.checkbox.iconColor
      },
      label: {
        type: [String, Number],
        default: Mh.checkbox.label
      },
      labelSize: {
        type: [String, Number],
        default: Mh.checkbox.labelSize
      },
      labelColor: {
        type: String,
        default: Mh.checkbox.labelColor
      },
      labelDisabled: {
        type: [String, Boolean],
        default: Mh.checkbox.labelDisabled
      }
    }
  },
  lw = {
    props: {
      name: {
        type: String,
        default: Mh.checkboxGroup.name
      },
      modelValue: {
        type: Array,
        default: Mh.checkboxGroup.value
      },
      shape: {
        type: String,
        default: Mh.checkboxGroup.shape
      },
      disabled: {
        type: Boolean,
        default: Mh.checkboxGroup.disabled
      },
      activeColor: {
        type: String,
        default: Mh.checkboxGroup.activeColor
      },
      inactiveColor: {
        type: String,
        default: Mh.checkboxGroup.inactiveColor
      },
      size: {
        type: [String, Number],
        default: Mh.checkboxGroup.size
      },
      placement: {
        type: String,
        default: Mh.checkboxGroup.placement
      },
      labelSize: {
        type: [String, Number],
        default: Mh.checkboxGroup.labelSize
      },
      labelColor: {
        type: [String],
        default: Mh.checkboxGroup.labelColor
      },
      labelDisabled: {
        type: Boolean,
        default: Mh.checkboxGroup.labelDisabled
      },
      iconColor: {
        type: String,
        default: Mh.checkboxGroup.iconColor
      },
      iconSize: {
        type: [String, Number],
        default: Mh.checkboxGroup.iconSize
      },
      iconPlacement: {
        type: String,
        default: Mh.checkboxGroup.iconPlacement
      },
      borderBottom: {
        type: Boolean,
        default: Mh.checkboxGroup.borderBottom
      }
    }
  },
  fw = {
    props: {
      color: {
        type: String,
        default: Mh.link.color
      },
      fontSize: {
        type: [String, Number],
        default: Mh.link.fontSize
      },
      underLine: {
        type: Boolean,
        default: Mh.link.underLine
      },
      href: {
        type: String,
        default: Mh.link.href
      },
      mpTips: {
        type: String,
        default: Mh.link.mpTips
      },
      lineColor: {
        type: String,
        default: Mh.link.lineColor
      },
      text: {
        type: String,
        default: Mh.link.text
      }
    }
  };
exports.$ = function (e) {
  var t, n = {
    routes: e.routes,
    guardHooks: {
      beforeHooks: null,
      afterHooks: null
    },
    push: function (e) {
      return rc(e, this, "push")
    },
    replace: function (e) {
      return rc(e, this, "replace")
    },
    replaceAll: function (e) {
      return rc(e, this, "replaceAll")
    },
    pushTab: function (e) {
      return rc(e, this, "pushTab")
    },
    back: function (e) {
      return Dn.navigateBack(e)
    },
    beforeEach: function (e) {
      sc(n, "beforeHooks", e)
    },
    afterEach: function (e) {
      sc(n, "afterHooks", e)
    },
    install: function (e) {
      var t = this,
        n = this;
      e.provide(Ks, this), e.provide(Js, this.route),
        function (e) {
          Gs.forEach((function (t) {
            nc[t] = function (n) {
              if ("navigateBack" === t) cc[t](n);
              else if (e.guardHooks.beforeHooks && e.guardHooks.beforeHooks[0]) {
                var r = ac(n.url, e);
                (o = e.guardHooks.beforeHooks[0], i = r, a = e.route.value, new Promise((function (e, t) {
                  var n = function n(r) {
                      n._called = !0, !1 === r ? t({}) : e(void 0 === r || !0 === r || r)
                    },
                    r = o.call(void 0, i, a, n),
                    s = Promise.resolve(r);
                  if (3 > o.length && (s = s.then(n)), o.length > 2) {
                    var c = 'The "next" callback was never called inside of '.concat(o.name ? '"' + o.name + '"' : "", ":\n").concat("" + o, '\n. If you are returning a value instead of calling "next", make sure to remove the "next" parameter from your function.');
                    if (null !== r && "object" === Qs(r) && "then" in r) s = s.then((function (e) {
                      return n._called ? e : (console.warn(c), Promise.reject(Error("Invalid navigation guard")))
                    }));
                    else if (!n._called) return console.warn(c), void t(Error("Invalid navigation guard"))
                  }
                  s.catch((function (e) {
                    return t(e)
                  }))
                }))).then((function (r) {
                  if (!0 === r) cc[t](n);
                  else if ("string" == typeof r) {
                    var o = oc(r, e);
                    cc[t]({
                      url: o
                    })
                  } else if ("back" === r.navType) cc.navigateBack(r);
                  else {
                    var i = oc(r, e);
                    cc[r.navType ? Ws[r.navType] : t]({
                      url: i
                    })
                  }
                })).catch((function (e) {
                  throw e
                }))
              } else cc[t](n);
              var o, i, a
            }
          }))
        }(n), e.mixin({
          beforeCreate: function () {
            if ("page" === this.$mpType && n.guardHooks.afterHooks && n.guardHooks.afterHooks[0]) {
              var e = n.route.value,
                t = ic(n);
              n.guardHooks.afterHooks[0].call(null, t, e)
            }
          },
          onLoad: function (e) {
            !Zs(e) && Zs(n.route.value.query) && Zs(n.route.value.params) && (n.route.value = lc(lc({}, n.route.value), {}, {
              query: e
            }))
          },
          onShow: function () {
            var e;
            "page" === this.$mpType && ((e = n).route.value = ic(e))
          }
        }), Object.defineProperty(e.config.globalProperties, "$Router", {
          get: function () {
            return n
          }
        }), Object.defineProperty(e.config.globalProperties, "$Route", {
          enumerable: !0,
          get: function () {
            return ao(t.route)
          }
        })
    },
    route: (t = {
      path: "/"
    }, oo(t, !0))
  };
  return n
}, exports.Bs = Tb, exports.Calendar = Nv, exports.H = function () {
  var e = Fo(Js);
  if (e) {
    var t = Qr(e.value);
    return qo(e, (function (e) {
      Object.assign(t, e)
    })), t
  }
  throw Error('useRoute 只可以在 Vue 上下文中使用，请确保你已经正确地注册了 "uni-mini-router" 并且当前正处于 Vue 上下文中')
}, exports.Schema = rv, exports._export_sfc = (e, t) => {
  const n = e.__vccOpts || e;
  for (const [r, o] of t) n[r] = o;
  return n
}, exports.axios = gl, exports.button = Wv, exports.chooseFile = function ({
  accept: e,
  multiple: t,
  capture: n,
  compressed: r,
  maxDuration: o,
  sizeType: i,
  camera: a,
  maxCount: s
}) {
  return new Promise(((c, u) => {
    switch (e) {
      case "image":
        Dn.chooseImage({
          count: t ? Math.min(s, 9) : 1,
          sourceType: n,
          sizeType: i,
          success: e => c(function (e) {
            return e.tempFiles.map((e => ({
              ...Lv(e, ["path"]),
              type: "image",
              url: e.path,
              thumb: e.path,
              size: e.size
            })))
          }(e)),
          fail: u
        });
        break;
      case "media":
        jn.chooseMedia({
          count: t ? Math.min(s, 9) : 1,
          sourceType: n,
          maxDuration: o,
          sizeType: i,
          camera: a,
          success: e => c(function (e) {
            return e.tempFiles.map((t => ({
              ...Lv(t, ["fileType", "thumbTempFilePath", "tempFilePath"]),
              type: e.type,
              url: t.tempFilePath,
              thumb: "video" === e.type ? t.thumbTempFilePath : t.tempFilePath,
              size: t.size
            })))
          }(e)),
          fail: u
        });
        break;
      case "video":
        Dn.chooseVideo({
          sourceType: n,
          compressed: r,
          maxDuration: o,
          camera: a,
          success: e => c(function (e) {
            return [{
              ...Lv(e, ["tempFilePath", "thumbTempFilePath", "errMsg"]),
              type: "video",
              url: e.tempFilePath,
              thumb: e.thumbTempFilePath,
              size: e.size
            }]
          }(e)),
          fail: u
        });
        break;
      case "file":
        jn.chooseMessageFile({
          count: t ? s : 1,
          type: e,
          success: e => c(Mv(e)),
          fail: u
        });
        break;
      default:
        jn.chooseMessageFile({
          count: t ? s : 1,
          type: "all",
          success: e => c(Mv(e)),
          fail: u
        })
    }
  }))
}, exports.computed = Yi, exports.createPinia = function () {
  const e = Ln(!0),
    t = e.run((() => ro({})));
  let n = [],
    r = [];
  const o = Yr({
    install(e) {
      mc(o), o._a = e, e.provide(bc, o), e.config.globalProperties.$pinia = o, r.forEach((e => n.push(e))), r = []
    },
    use(e) {
      return this._a ? n.push(e) : r.push(e), this
    },
    _p: n,
    _a: null,
    _e: e,
    _s: new Map,
    state: t
  });
  return o
}, exports.createSSRApp = Wa, exports.dayjs = Ad, exports.dayjs$1 = Iv, exports.defineComponent = function (e) {
  return A(e) ? {
    setup: e,
    name: e.name
  } : e
}, exports.defineStore = function (e, t, n) {
  let r, o;
  const i = "function" == typeof t;

  function a(e, n) {
    const a = zi();
    (e = e || a && Fo(bc, null)) && mc(e), (e = yc)._s.has(r) || (i ? Ic(r, t, o, e) : Ec(r, o, e));
    return e._s.get(r)
  }
  return "string" == typeof e ? (r = e, o = i ? n : t) : (o = e, r = e.id), a.$id = r, a
}, exports.defprops = Mh, exports.e = function (e, t) {
  return t && t.includes && (hc.includes = Array.from(new Set([].concat(dc(hc.includes), dc(t.includes))))), gc(e.pages).concat((n = e.subPackages, o = [], null == n || 0 == n.length ? [] : (n.forEach((function (e) {
    r = gc(e.pages, e.root), o = o.concat(r)
  })), o)));
  var n, r, o
}, exports.e$1 = fc, exports.e$2 = (e, ...t) => y(e, ...t), exports.f = (e, t) => function (e, t) {
  let n;
  if (w(e) || _(e)) {
    n = new Array(e.length);
    for (let r = 0, o = e.length; r < o; r++) n[r] = t(e[r], r, r)
  } else if ("number" == typeof e) {
    n = new Array(e);
    for (let r = 0; r < e; r++) n[r] = t(r + 1, r, r)
  } else if (k(e))
    if (e[Symbol.iterator]) n = Array.from(e, ((e, n) => t(e, n, n)));
    else {
      const r = Object.keys(e);
      n = new Array(r.length);
      for (let o = 0, i = r.length; o < i; o++) {
        const i = r[o];
        n[o] = t(e[i], i, o)
      }
    }
  else n = [];
  return n
}(e, t), exports.getCurrentInstance = zi, exports.icons = {
  "uicon-level": "",
  "uicon-column-line": "",
  "uicon-checkbox-mark": "",
  "uicon-folder": "",
  "uicon-movie": "",
  "uicon-star-fill": "",
  "uicon-star": "",
  "uicon-phone-fill": "",
  "uicon-phone": "",
  "uicon-apple-fill": "",
  "uicon-chrome-circle-fill": "",
  "uicon-backspace": "",
  "uicon-attach": "",
  "uicon-cut": "",
  "uicon-empty-car": "",
  "uicon-empty-coupon": "",
  "uicon-empty-address": "",
  "uicon-empty-favor": "",
  "uicon-empty-permission": "",
  "uicon-empty-news": "",
  "uicon-empty-search": "",
  "uicon-github-circle-fill": "",
  "uicon-rmb": "",
  "uicon-person-delete-fill": "",
  "uicon-reload": "",
  "uicon-order": "",
  "uicon-server-man": "",
  "uicon-search": "",
  "uicon-fingerprint": "",
  "uicon-more-dot-fill": "",
  "uicon-scan": "",
  "uicon-share-square": "",
  "uicon-map": "",
  "uicon-map-fill": "",
  "uicon-tags": "",
  "uicon-tags-fill": "",
  "uicon-bookmark-fill": "",
  "uicon-bookmark": "",
  "uicon-eye": "",
  "uicon-eye-fill": "",
  "uicon-mic": "",
  "uicon-mic-off": "",
  "uicon-calendar": "",
  "uicon-calendar-fill": "",
  "uicon-trash": "",
  "uicon-trash-fill": "",
  "uicon-play-left": "",
  "uicon-play-right": "",
  "uicon-minus": "",
  "uicon-plus": "",
  "uicon-info": "",
  "uicon-info-circle": "",
  "uicon-info-circle-fill": "",
  "uicon-question": "",
  "uicon-error": "",
  "uicon-close": "",
  "uicon-checkmark": "",
  "uicon-android-circle-fill": "",
  "uicon-android-fill": "",
  "uicon-ie": "",
  "uicon-IE-circle-fill": "",
  "uicon-google": "",
  "uicon-google-circle-fill": "",
  "uicon-setting-fill": "",
  "uicon-setting": "",
  "uicon-minus-square-fill": "",
  "uicon-plus-square-fill": "",
  "uicon-heart": "",
  "uicon-heart-fill": "",
  "uicon-camera": "",
  "uicon-camera-fill": "",
  "uicon-more-circle": "",
  "uicon-more-circle-fill": "",
  "uicon-chat": "",
  "uicon-chat-fill": "",
  "uicon-bag-fill": "",
  "uicon-bag": "",
  "uicon-error-circle-fill": "",
  "uicon-error-circle": "",
  "uicon-close-circle": "",
  "uicon-close-circle-fill": "",
  "uicon-checkmark-circle": "",
  "uicon-checkmark-circle-fill": "",
  "uicon-question-circle-fill": "",
  "uicon-question-circle": "",
  "uicon-share": "",
  "uicon-share-fill": "",
  "uicon-shopping-cart": "",
  "uicon-shopping-cart-fill": "",
  "uicon-bell": "",
  "uicon-bell-fill": "",
  "uicon-list": "",
  "uicon-list-dot": "",
  "uicon-zhihu": "",
  "uicon-zhihu-circle-fill": "",
  "uicon-zhifubao": "",
  "uicon-zhifubao-circle-fill": "",
  "uicon-weixin-circle-fill": "",
  "uicon-weixin-fill": "",
  "uicon-twitter-circle-fill": "",
  "uicon-twitter": "",
  "uicon-taobao-circle-fill": "",
  "uicon-taobao": "",
  "uicon-weibo-circle-fill": "",
  "uicon-weibo": "",
  "uicon-qq-fill": "",
  "uicon-qq-circle-fill": "",
  "uicon-moments-circel-fill": "",
  "uicon-moments": "",
  "uicon-qzone": "",
  "uicon-qzone-circle-fill": "",
  "uicon-baidu-circle-fill": "",
  "uicon-baidu": "",
  "uicon-facebook-circle-fill": "",
  "uicon-facebook": "",
  "uicon-car": "",
  "uicon-car-fill": "",
  "uicon-warning-fill": "",
  "uicon-warning": "",
  "uicon-clock-fill": "",
  "uicon-clock": "",
  "uicon-edit-pen": "",
  "uicon-edit-pen-fill": "",
  "uicon-email": "",
  "uicon-email-fill": "",
  "uicon-minus-circle": "",
  "uicon-minus-circle-fill": "",
  "uicon-plus-circle": "",
  "uicon-plus-circle-fill": "",
  "uicon-file-text": "",
  "uicon-file-text-fill": "",
  "uicon-pushpin": "",
  "uicon-pushpin-fill": "",
  "uicon-grid": "",
  "uicon-grid-fill": "",
  "uicon-play-circle": "",
  "uicon-play-circle-fill": "",
  "uicon-pause-circle-fill": "",
  "uicon-pause": "",
  "uicon-pause-circle": "",
  "uicon-eye-off": "",
  "uicon-eye-off-outline": "",
  "uicon-gift-fill": "",
  "uicon-gift": "",
  "uicon-rmb-circle-fill": "",
  "uicon-rmb-circle": "",
  "uicon-kefu-ermai": "",
  "uicon-server-fill": "",
  "uicon-coupon-fill": "",
  "uicon-coupon": "",
  "uicon-integral": "",
  "uicon-integral-fill": "",
  "uicon-home-fill": "",
  "uicon-home": "",
  "uicon-hourglass-half-fill": "",
  "uicon-hourglass": "",
  "uicon-account": "",
  "uicon-plus-people-fill": "",
  "uicon-minus-people-fill": "",
  "uicon-account-fill": "",
  "uicon-thumb-down-fill": "",
  "uicon-thumb-down": "",
  "uicon-thumb-up": "",
  "uicon-thumb-up-fill": "",
  "uicon-lock-fill": "",
  "uicon-lock-open": "",
  "uicon-lock-opened-fill": "",
  "uicon-lock": "",
  "uicon-red-packet-fill": "",
  "uicon-photo-fill": "",
  "uicon-photo": "",
  "uicon-volume-off-fill": "",
  "uicon-volume-off": "",
  "uicon-volume-fill": "",
  "uicon-volume": "",
  "uicon-red-packet": "",
  "uicon-download": "",
  "uicon-arrow-up-fill": "",
  "uicon-arrow-down-fill": "",
  "uicon-play-left-fill": "",
  "uicon-play-right-fill": "",
  "uicon-rewind-left-fill": "",
  "uicon-rewind-right-fill": "",
  "uicon-arrow-downward": "",
  "uicon-arrow-leftward": "",
  "uicon-arrow-rightward": "",
  "uicon-arrow-upward": "",
  "uicon-arrow-down": "",
  "uicon-arrow-right": "",
  "uicon-arrow-left": "",
  "uicon-arrow-up": "",
  "uicon-skip-back-left": "",
  "uicon-skip-forward-right": "",
  "uicon-rewind-right": "",
  "uicon-rewind-left": "",
  "uicon-arrow-right-double": "",
  "uicon-arrow-left-double": "",
  "uicon-wifi-off": "",
  "uicon-wifi": "",
  "uicon-empty-data": "",
  "uicon-empty-history": "",
  "uicon-empty-list": "",
  "uicon-empty-page": "",
  "uicon-empty-order": "",
  "uicon-man": "",
  "uicon-woman": "",
  "uicon-man-add": "",
  "uicon-man-add-fill": "",
  "uicon-man-delete": "",
  "uicon-man-delete-fill": "",
  "uicon-zh": "",
  "uicon-en": ""
}, exports.index = Dn, exports.initVueI18n = function (e, t = {}, n, r) {
  "string" != typeof e && ([e, t] = [t, e]), "string" != typeof e && (e = void 0 !== Dn && Dn.getLocale ? Dn.getLocale() : "undefined" != typeof global && global.getLocale ? global.getLocale() : qe), "string" != typeof n && (n = "undefined" != typeof __uniConfig && __uniConfig.fallbackLocale || qe);
  const o = new Ke({
    locale: e,
    fallbackLocale: n,
    messages: t,
    watcher: r
  });
  let i = (e, t) => {
    if ("function" != typeof getApp) i = function (e, t) {
      return o.t(e, t)
    };
    else {
      let e = !1;
      i = function (t, n) {
        const r = getApp().$vm;
        return r && (r.$locale, e || (e = !0, function (e, t) {
          e.$watchLocale ? e.$watchLocale((e => {
            t.setLocale(e)
          })) : e.$watch((() => e.$locale), (e => {
            t.setLocale(e)
          }))
        }(r, o))), o.t(t, n)
      }
    }
    return i(e, t)
  };
  return {
    i18n: o,
    f: (e, t, n) => o.f(e, t, n),
    t: (e, t) => i(e, t),
    add: (e, t, n = !0) => o.add(e, t, n),
    watch: e => o.watchLocale(e),
    getLocale: () => o.getLocale(),
    setLocale: e => o.setLocale(e)
  }
}, exports.inject = Fo, exports.isRef = no, exports.j = function () {
  var e = Fo(Ks);
  if (e) return e;
  throw Error('useRouter 只可以在 Vue 上下文中使用，请确保你已经正确地注册了 "uni-mini-router" 并且当前正处于 Vue 上下文中')
}, exports.lib = vd, exports.lodash = Qh, exports.m = (e, t, n = !1) => function (e, {
  number: t,
  trim: n
}, r = !1) {
  return r ? (...r) => (n ? r = r.map((e => e.trim())) : t && (r = r.map(H)), e(...r)) : r => {
    const o = r.detail.value;
    return n ? r.detail.value = o.trim() : t && (r.detail.value = H(o)), e(r)
  }
}(e, t, n), exports.mapState = function (e, t) {
  return Array.isArray(t) ? t.reduce(((t, n) => (t[n] = function () {
    return e(this.$pinia)[n]
  }, t)), {}) : Object.keys(t).reduce(((n, r) => (n[r] = function () {
    const n = e(this.$pinia),
      o = t[r];
    return "function" == typeof o ? o.call(this, n) : n[o]
  }, n)), {})
}, exports.mixin = Wd, exports.mixinUp = Fv, exports.mpAdapter = function (e, t) {
  var n = (void 0 === t ? {} : t).transformRequestOption,
    r = void 0 === n ? function (e) {
      return e
    } : n,
    o = function () {
      switch (!0) {
        case "object" == typeof jn:
          return qd = "wechat", jn.request.bind(jn);
        case "object" == typeof swan:
          return qd = "baidu", swan.request.bind(swan);
        case "object" == typeof dd:
          return qd = "dd", dd.httpRequest.bind(dd);
        case "object" == typeof my:
          return qd = "alipay", (my.request || my.httpRequest).bind(my);
        default:
          return jn.request.bind(jn)
      }
    }();
  return new Promise((function (t, n) {
    var i, a, s, c = e.data,
      u = e.headers,
      l = {
        method: e.method && e.method.toUpperCase() || "GET",
        url: Ld((a = e.baseURL, s = e.url, a && !Md(s) ? Fd(a, s) : s), e.params, e.paramsSerializer),
        timeout: e.timeout,
        success: function (r) {
          var o = function (e, t, n) {
            var r = e.header || e.headers,
              o = e.statusCode || e.status,
              i = "";
            return 200 === o ? i = "OK" : 400 === o && (i = "Bad Request"), {
              data: e.data,
              status: o,
              statusText: i,
              headers: r,
              config: t,
              request: n
            }
          }(r, e, l);
          ! function (e, t, n) {
            var r = n.config.validateStatus;
            !r || r(n.status) ? e(n) : t(Dd("Request failed with status code " + n.status, n.config, null, n.request, n))
          }(t, n, o)
        },
        fail: function (t) {
          ! function (e, t, n) {
            switch (qd) {
              case "wechat":
                -1 !== e.errMsg.indexOf("request:fail abort") ? t(jd("Request aborted", n, "ECONNABORTED", "")) : -1 !== e.errMsg.indexOf("timeout") ? t(jd("timeout of " + n.timeout + "ms exceeded", n, "ECONNABORTED", "")) : t(jd("Network Error", n, null, ""));
                break;
              case "dd":
              case "alipay":
                [14, 19].includes(e.error) ? t(jd("Request aborted", n, "ECONNABORTED", "", e)) : [13].includes(e.error) ? t(jd("timeout of " + n.timeout + "ms exceeded", n, "ECONNABORTED", "", e)) : t(jd("Network Error", n, null, "", e));
                break;
              case "baidu":
                t(jd("Network Error", n, null, ""))
            }
          }(t, n, e)
        },
        complete: function () {
          i = void 0
        }
      };
    if (e.auth) {
      var f = [e.auth.username || "", e.auth.password || ""],
        p = f[0],
        d = f[1];
      u.Authorization = "Basic " + function (e) {
        for (var t, n, r = String(e), o = 0, i = Ud, a = ""; r.charAt(0 | o) || (i = "=", o % 1); a += i.charAt(63 & t >> 8 - o % 1 * 8)) {
          if ((n = r.charCodeAt(o += 3 / 4)) > 255) throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
          t = t << 8 | n
        }
        return a
      }(p + ":" + d)
    }
    Cd.forEach(u, (function (e, t) {
        var n = t.toLowerCase();
        (void 0 === c && "content-type" === n || "referer" === n) && delete u[t]
      })), l.header = u, e.responseType && (l.responseType = e.responseType), e.cancelToken && e.cancelToken.promise.then((function (e) {
        i && (i.abort(), n(e), i = void 0)
      })),
      function (e) {
        try {
          return "string" == typeof e && e.length && (e = JSON.parse(e)) && "[object Object]" === Object.prototype.toString.call(e)
        } catch (t) {
          return !1
        }
      }(c) && (c = JSON.parse(c)), void 0 !== c && (l.data = c), i = o(r(function (e) {
        var t;
        return ["alipay", "dd"].includes(qd) && (e.headers = e.header, delete e.header, "dd" === qd && "GET" !== e.method && "application/json" === (null === (t = e.headers) || void 0 === t ? void 0 : t["Content-Type"]) && "[object Object]" === Object.prototype.toString.call(e.data) && (e.data = JSON.stringify(e.data))), e
      }(l)))
  }))
}, exports.mpMixin = Vd, exports.n = e => s(e), exports.nextTick$1 = ko, exports.o = (e, t) => qa(e, t), exports.onHide = Ls, exports.onLaunch = Ms, exports.onLoad = Fs, exports.onMounted = ei, exports.onPullDownRefresh = zs, exports.onReachBottom = $s, exports.onReady = Us, exports.onShow = Rs, exports.onUnload = qs, exports.onUnmounted = oi, exports.openType = Vv, exports.p = e => function (e) {
  const {
    uid: t,
    __counter: n
  } = zi();
  return t + "," + ((La[t] || (La[t] = [])).push(Mi(e)) - 1) + "," + n
}(e), exports.props = Eb, exports.props$1 = Ib, exports.props$10 = Mb, exports.props$11 = ov, exports.props$12 = jv, exports.props$13 = Dv, exports.props$14 = Rv, exports.props$15 = Uv, exports.props$16 = qv, exports.props$17 = $v, exports.props$18 = zv, exports.props$19 = Qv, exports.props$2 = Ob, exports.props$20 = Hv, exports.props$21 = Kv, exports.props$22 = Gv, exports.props$23 = Yv, exports.props$24 = Xv, exports.props$25 = Zv, exports.props$26 = ew, exports.props$27 = tw, exports.props$28 = ow, exports.props$29 = iw, exports.props$3 = Cb, exports.props$30 = aw, exports.props$31 = sw, exports.props$32 = cw, exports.props$33 = {
  props: {}
}, exports.props$34 = uw, exports.props$35 = lw, exports.props$36 = fw, exports.props$4 = Bb, exports.props$5 = jb, exports.props$6 = Db, exports.props$7 = Nb, exports.props$8 = Rb, exports.props$9 = Lb, exports.quarterOfYear = Sd, exports.r = (e, t, n) => za(e, t, n), exports.reactive = Qr, exports.ref = ro, exports.resolveComponent = function (e, t) {
  return function (e, t, n = !0, r = !1) {
    const o = Lo || $i;
    if (o) {
      const n = o.type;
      if (e === ui) {
        const e = function (e, t = !0) {
          return A(e) ? e.displayName || e.name : e.name || t && e.__name
        }(n, !1);
        if (e && (e === t || e === R(t) || e === F(R(t)))) return n
      }
      const i = li(o[e] || n[e], t) || li(o.appContext[e], t);
      return !i && r ? n : i
    }
  }(ui, e, !0, t) || e
}, exports.s = e => Ha(e), exports.sr = (e, t, n) => function (e, t, n = {}) {
  const {
    $templateRefs: r
  } = zi();
  r.push({
    i: t,
    r: e,
    k: n.k,
    f: n.f
  })
}(e, t, n), exports.src_default = Hd, exports.storeToRefs = function (e) {
  {
    e = Gr(e);
    const t = {};
    for (const n in e) {
      const r = e[n];
      (no(r) || Vr(r)) && (t[n] = lo(e, n))
    }
    return t
  }
}, exports.t = e => (e => _(e) ? e : null == e ? "" : w(e) || k(e) && (e.toString === E || !A(e.toString)) ? JSON.stringify(e, c, 2) : String(e))(e), exports.transition = rw, exports.unref = ao, exports.uviewPlus = qh, exports.value = Jv, exports.w = (e, t) => Qa(e, t), exports.watch = qo, exports.wx$1 = jn;