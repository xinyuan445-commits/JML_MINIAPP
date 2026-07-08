"use strict";
const e = require("../common/vendor.js"),
  o = require("../store/modules/userStore.js"),
  n = require("../store/modules/appStore.js"),
  s = e.$({
    routes: [...e.e(e.e$1)]
  });
s.beforeEach((async (s, r, a) => {
  const l = o.useUserStore();
  n.useAppStore(), e.storeToRefs(l);
  const {
    userId: i,
    token: c
  } = l;
  if (!s.meta.workAuth || i && "" != i || "login" === s.name)
    if (i && "login" === s.name) a({
      name: "home",
      navType: "replaceAll"
    });
    else if ("login" === s.name) {
      try {
        const ts = wx.getStorageSync("just_logout_ts");
        const isExplicitLogout = wx.getStorageSync("is_explicit_logout");
        const now = Date.now();
        if (isExplicitLogout || (ts && now - Number(ts) < 5000)) {
          a();
        } else {
          const e2 = await l.getMiniUserInfo();
          e2 && e2.userInfo ? a({ name: "home", navType: "replaceAll" }) : a();
        }
      } catch {
        a()
      }
    } else await t(s, r, a);
  else a({
    name: "login",
    navType: "replaceAll"
  })
})), s.afterEach((async (e, t) => {
  const r = o.useUserStore();
  n.useAppStore();
  const {
    userId: a,
    token: l,
    menuList: i
  } = r;
  if (!e.meta.workAuth || a && "" != a || "login" === e.name) {
    if (a && "login" === e.name) s.replaceAll({
      name: "home"
    });
    else if ("login" === e.name) {
      try {
        const ts = wx.getStorageSync("just_logout_ts");
        const isExplicitLogout = wx.getStorageSync("is_explicit_logout");
        const now = Date.now();
        if (isExplicitLogout || (ts && now - Number(ts) < 5000)) {
        } else {
          const e2 = await r.getMiniUserInfo();
          e2 && e2.userInfo && s.replaceAll({ name: "home" })
        }
      } catch {}
    }
  } else s.replaceAll({
    name: "login"
  });
  console.log("跳转结束")
}));
const t = async (s, t, r) => {
  const a = o.useUserStore();
  n.useAppStore();
  const {
    userId: l,
    token: i,
    menuList: c,
    userInfo: u
  } = a;
  if (c) r();
  else try {
    await a.getUserRole();
    if (1 == (null == u ? void 0 : u.isFactory)) {
      let e = await a.getFactoryMenuList();
      console.log("fa", e)
    }
    r()
  } catch (m) {
    return r(!1), e.index.showToast({
      title: "获取个人权限失败~",
      icon: "none"
    })
  }
}, r = s;
exports.router = r;
