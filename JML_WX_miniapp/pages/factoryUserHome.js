"use strict";

const e = require("../common/vendor.js"),
  t = require("../api/home.js"),
  n = require("../api/workreport.js"),
  o = require("../store/modules/appStore.js"),
  a = require("../store/modules/userStore.js");
if (require("../utils/http.js"), require("../common/config.js"), require("../router/index.js"), require("../utils/dateUtils.js"), require("../api/common.js"), require("../api/user.js"), !Array) {
  (e.resolveComponent("u-icon") + e.resolveComponent("u-sticky") + e.resolveComponent("u-badge") + e.resolveComponent("u-tabs") + e.resolveComponent("uni-calendar") + e.resolveComponent("u-divider") + e.resolveComponent("u-popup") + e.resolveComponent("u-picker"))()
}
Math || ((() => "../node-modules/uview-plus/components/u-icon/u-icon.js") + (() => "../node-modules/uview-plus/components/u-sticky/u-sticky.js") + (() => "../node-modules/uview-plus/components/u-badge/u-badge.js") + (() => "../node-modules/uview-plus/components/u-tabs/u-tabs.js") + (() => "../uni_modules/uni-calendar/components/uni-calendar/uni-calendar.js") + (() => "../node-modules/uview-plus/components/u-divider/u-divider.js") + r + (() => "../node-modules/uview-plus/components/u-popup/u-popup.js") + s + (() => "../node-modules/uview-plus/components/u-picker/u-picker.js"))();
  const s = () => "../components/DragBox.js",
  r = () => "../components/SelectMap.js",
  u = e.defineComponent({
    __name: "factoryUserHome",
    

    setup(s) {
      
      let r = e.j();
      const u = e.ref(!1),
        i = () => {
          u.value = !0
        },
        l = () => {
          u.value = !1
        };
      o.useAppStore();
      const p = a.useUserStore(),
        c = e.ref([]),
        m = e.inject("util"),
        d = e.ref(new Date),
        f = e.ref(),
        v = e.ref([]),
        h = e.ref([]),
        y = e => {
          d.value = new Date(e.fulldate), console.log(e)
        },
        g = e.ref(e.dayjs().format("YYYY-MM")),
        b = () => {
          t.queryNoticeDay({
            date: g.value
          }).then((e => {
            v.value = e.data.map((e => ({
              date: e.day,
              info: "",
              data: {
                custom: "自定义信息",
                name: "自定义消息头"
              }

            })))
          }))
        },
        j = ({
          month: e,
          year: t
        }) => {
          g.value = `${t}-${e}`
        },
        w = () => {
          t.queryNoticeInfoByDay({
            day: m.dateUtils.timeFormat(d.value, "yyyy-mm-dd")
          }).then((e => {
            h.value = e.data
          }))
        };
      e.watch((() => [d.value, g.value]), (([e, t], [n, o]) => {
        console.log(e, t), e != n && w(), t != o && b()
      }));
      const _ = e.ref(!1),
        k = e.ref([]),
        x = e.ref([]);
      e.onShow((() => {
        console.log("onShow"), b(), w(), t.queryNoticeInfoByDB().then((e => {
          x.value = e.data
        }))
      })), e.onMounted((() => {
        C(), e.index.setNavigationBarTitle({
          title: "工厂任务管理"
        })
      }));
      const C = async () => {
        t.menu().then(e => {
          let n = e.data || [];
          let o = "";
          try {
            const e = wx.getStorageSync("userStore");
            if (e) {
              const t = typeof e === "string" ? JSON.parse(e) : e;
              o = (t?.state?.token ?? t?.token ?? "").toString()
            }
          } catch (e) {
            console.log("解析 userStore 出错:", e)
          }
          const a = ["yuanxin", "18626280870", "sandyho"],
            s = a.includes(o.toLowerCase());
          n = n.filter(e => e.menu_code === "PO_yx" ? s : !0);
          c.value = n;
          console.log("菜单数据 d =", c.value, "当前 token =", o)
        });
        let r = await p.getFactoryMenuList(!0);
        console.log("工厂任务菜单 =", r);
        k.value = [r]
      }, P = e => {
        let {
          value: t
        } = e, n = t[0];
        n.menuUrl ? r.push({
          name: n.menuUrl
        }) : r.push({
          name: "pressLineReport"
        }), _.value = !1
      }, S = e => {
        let t = c.value.length % 3,
          n = c.value.length / 3;
        return 0 == t ? e >= 3 * (n - 1) : e >= 3 * n
      }, q = e.ref(!1), R = e.ref(), D = t => {
        let o = {
          "salesReport.checkin_address": t.address || "",
          "salesReport.checkin_longitude": t.location.longitude || "",
          "salesReport.checkin_latitude": t.location.latitude || "",
          "salesReport.area_code": t.area_code || "",
          "salesReport.district": t.district || ""
        };
        e.lodashExports.isArray(t.files) && t.files.forEach(((e, t) => {
          o[`salesReport.site_img${t+1}`] = e.url
        })), n.saveEdit(o).then((t => {
          e.index.showModal({
            title: "提示",
            content: "签到成功",
            showCancel: !1,
            success: function (e) {
              R.value.reset(), q.value = !1
            }
          })
        }))
      }, I = [{
        name: "工厂任务提醒"
      }, {
        name: "待办事项"
      }], N = e.ref(0), $ = ({
        index: e,
        ...t
      }) => {
        N.value = e
      };

      let _once = !1;
      const Tlogout = () => {
        if (_once) return; _once = !0;
        try {
          q.value = !1;
          wx.removeStorageSync("userStore");
          wx.removeStorageSync("u8_user_login_resp");
          wx.removeStorageSync("u8_token_cache");
          wx.setStorageSync("just_logout_ts", Date.now());
          wx.setStorageSync("is_explicit_logout", "true");
        } catch (err) {}
        try {
          const us = a.useUserStore();
          us.userId = null;
          us.token = "";
          us.menuList = null;
          us.factoryMenuList = null;
          us.userInfo = null;
        } catch (err2) {}
        u.value = !1;
        r.replace({ name: "login" });
      };
      return (t, n) => e.e$2({
        a: e.p({
          size: "18",
          name: "/static/icon/menu.png"
        }),
        b: e.o(i),
        c: e.p({
          zIndex: "10"
        }),
        d: e.f(e.unref(c), ((t, n, o) => e.e$2({
          a: 1 == (null == t ? void 0 : t.gmRead)
        }, 1 == (null == t ? void 0 : t.gmRead) ? {
          b: "9ab3d753-2-" + o,
          c: e.p({
            isDot: !0,
            offset: [10, 30],
            absolute: !0
          })
        } : {}, {
          d: "9ab3d753-3-" + o,
          e: e.p({
            labelSize: "14",
            size: "40",
            labelPos: "bottom",
            space: "10",
            label: t.name,
            name: t.menu_icon
          }),
          f: n,
          g: e.n({
            last: S(n)
          }),
          h: e.o((e => (e => {
            e.menu_url && ("Task" == e.menu_url ? _.value = !0 : r.push({
              name: e.menu_url
            }))
          })(t)), n)
        }))),
        e: e.o($),
        f: e.p({
          current: e.unref(N),
          itemStyle: {
            flex: 1,
            height: "44px"
          },
          list: I,
          lineWidth: "120",
          lineColor: "#849EB2",
          keyName: "name"
        }),
        g: e.sr(f, "9ab3d753-5", {
          k: "calendar"
        }),
        h: e.o(y),
        i: e.o(j),
        j: e.p({
          selected: e.unref(v)
        }),
        k: e.unref(d) && e.unref(h)
      }, e.unref(d) && e.unref(h) ? e.e$2({
        l: e.t(e.unref(m).dateUtils.timeFormat(e.unref(d), "mm月dd日")),
        m: e.t(e.unref(m).dateUtils.timeFormat(e.unref(d), "W")),
        n: e.unref(h).listJobAssignment
      }, e.unref(h).listJobAssignment ? {
        o: e.f(e.unref(h).listJobAssignment, ((t, n, o) => e.e$2({
          a: e.t(t.name),
          b: t.expectedQty
        }, t.expectedQty ? {
          c: e.t(t.expectedQty)
        } : {}, {
          d: t.expectedWorkHours
        }, t.expectedWorkHours ? {
          e: e.t(t.expectedWorkHours)
        } : {}, {
          f: t.completionLocation
        }, t.completionLocation ? {
          g: e.t(t.completionLocation)
        } : {}, {
          h: e.o((n => e.unref(r).push({
            name: `${t.noticeType}Info`,
            params: {
              id: t.id
            }
          })), n),
          i: "9ab3d753-7-" + o,
          j: n
        })))
      } : {}, {
        p: e.unref(h).listPartsPurchase
      }, e.unref(h).listPartsPurchase ? {
        q: e.f(e.unref(h).listPartsPurchase, ((t, n, o) => ({
          a: e.t(t.name),
          b: e.t(t.approvalStatus),
          c: e.t(t.partCnt),
          d: e.t(t.deviceName),
          e: e.o((n => e.unref(r).push({
            name: `${t.noticeType}Info`,
            params: {
              id: t.id
            }
          })), n),
          f: "9ab3d753-8-" + o,
          g: n
        })))
      } : {}) : {}, {
        r: 0 == e.unref(N),
        s: e.unref(x).listDailyInspectionReport
      }, e.unref(x).listDailyInspectionReport ? {
        t: e.f(e.unref(x).listDailyInspectionReport, ((t, n, o) => e.e$2({
          a: e.t(t.name),
          b: t.inspectionDate
        }, t.inspectionDate ? {
          c: e.t(t.inspectionDate)
        } : {}, {
          d: t.inspectionStaffName
        }, t.inspectionStaffName ? {
          e: e.t(t.inspectionStaffName)
        } : {}, {
          f: e.o((n => e.unref(r).push({
            name: "dailyInspectionInfo",
            params: {
              id: t.id
            }
          })), n),
          g: "9ab3d753-9-" + o,
          h: n
        })))
      } : {}, {
        v: e.unref(x).listPartsPurchase
      }, e.unref(x).listPartsPurchase ? {
        w: e.f(e.unref(x).listPartsPurchase, ((t, n, o) => ({
          a: e.t(t.name),
          b: e.t(t.approvalStatus),
          c: e.t(t.partCnt),
          d: e.t(t.deviceName),
          e: e.o((n => e.unref(r).push({
            name: `${t.noticeType}Info`,
            params: {
              id: t.id
            }
          })), n),
          f: "9ab3d753-10-" + o,
          g: n
        })))
      } : {}, {
        x: 1 == e.unref(N),
        y: e.sr(R, "9ab3d753-11", {
          k: "map"
        }),
        z: e.o((e => q.value = !1)),
        A: e.o(D),
        B: e.o((t => e.isRef(q) ? q.value = t : null)),
        C: e.p({
          title: "一键签到",
          withUploader: !0,
          capture: "camera",
          "show-cancel-button": !0,
          show: e.unref(q)
        }),
        D: e.p({
          size: "18",
          name: "/static/icon/home_menu.png"
        }),
        E: e.p({
          size: "22",
          name: "/static/icon/menu_left.png"
        }),
        F: e.o((e => u.value = !1)),
        G: e.p({
          size: "18",
          name: "/static/icon/pwd_menu.png"
        }),
        H: e.p({
          size: "22",
          name: "/static/icon/menu_left.png"
        }),
        I: e.o(l),
        R: e.o(Tlogout),
        J: e.p({
          show: e.unref(u),
          mode: "left"
        }),
        K: t.hasPermission("SalesReport", "C")
      }, t.hasPermission("SalesReport", "C") ? {
        L: e.p({
          size: "26",
          name: "/static/icon/check-in.png"
        }),
        M: e.o((e => q.value = !0))
      } : {}, {
        N: e.o(P),
        O: e.o((e => _.value = !1)),
        P: e.p({
          confirmColor: "#849EB2",
          show: e.unref(_),
          columns: e.unref(k),
          keyName: "factoryMenuName"
        })
      })
    }
  }),
  i = e._export_sfc(u, [
    ["__scopeId", "data-v-9ab3d753"]
  ]);
wx.createComponent(i);
