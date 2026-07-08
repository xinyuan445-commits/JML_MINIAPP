"use strict";
const e = require("../../../common/vendor.js"),
  t = require("../../../store/modules/dictStore.js"),
  r = require("../../api/electricityLog.js");
if (require("../../../api/common.js"), require("../../../utils/http.js"), require("../../../common/config.js"), require("../../../router/index.js"), require("../../../store/modules/userStore.js"), require("../../../api/user.js"), require("../../../api/home.js"), require("../../../store/modules/appStore.js"), require("../../../utils/dateUtils.js"), !Array) {
  e.resolveComponent("u-divider")()
}
Math || ((() => "../../../node-modules/uview-plus/components/u-divider/u-divider.js") + a + i)();
const i = () => "../../../components/FloatingWindow.js",
  a = () => "../../../components/FooterBtn.js",
  o = {
    __name: "Detailed",
    props: ["id"],
    setup(i) {
      const a = i,
        o = e.j();
      e.inject("util"), t.useDictStore();
      const s = a,
        u = e.ref({}),
        n = async () => {
          r.queryDetails(s.id).then((e => {
            u.value = e.data
          })).catch((e => {}))
        };
      return e.onShow((() => {
        n()
      })), e.onMounted((() => {})), (t, r) => e.e$2({
        a: e.t(u.value.name),
        b: e.t(u.value.specLocation),
        c: e.t(u.value.electricityType),
        d: e.t(u.value.beforeReading),
        e: e.t(u.value.dailyReading),
        f: u.value.electricityImg
      }, u.value.electricityImg ? {
        g: e.f(u.value.electricityImg.split(";"), ((e, r, i) => ({
          a: r,
          b: t.imgBase + e
        })))
      } : {}, {
        h: e.t(u.value.beforeUsage),
        i: e.t(u.value.remark),
        j: e.t(u.value.createdTime),
        k: e.t(u.value.createdStaffName),
        l: e.t(u.value.updateTime),
        m: e.t(u.value.updateStaffName),
        n: "1" == u.value.isEdit && t.hasFactoryPermission("naturalGasLog", "U")
      }, "1" == u.value.isEdit && t.hasFactoryPermission("naturalGasLog", "U") ? {
        o: e.o((t => e.unref(o).push({
          name: "naturalGasLogEdit",
          params: {
            id: e.unref(s).id
          }
        }))),
        p: e.p({
          cancelBtnShow: !1,
          confirm_btn_text: "编辑"
        })
      } : {})
    }
  };
wx.createPage(o);