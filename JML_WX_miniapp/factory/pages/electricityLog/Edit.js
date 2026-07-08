"use strict";
const e = require("../../../common/vendor.js"),
  t = require("../../../store/modules/dictStore.js"),
  o = require("../../api/electricityLog.js"),
  a = require("../../vueUse/datetimeUse.js"),
  i = require("../../../api/common.js"),
  l = require("../../../store/modules/appStore.js"),
  r = require("../../../store/modules/userStore.js");
if (require("../../../utils/http.js"), require("../../../common/config.js"), require("../../../router/index.js"), require("../../../utils/dateUtils.js"), require("../../../api/user.js"), require("../../../api/home.js"), !Array) {
  (e.resolveComponent("uni-text") + e.resolveComponent("uni-data-picker") + e.resolveComponent("u-form-item") + e.resolveComponent("u--input") + e.resolveComponent("u-upload") + e.resolveComponent("u--textarea") + e.resolveComponent("u--form") + e.resolveComponent("u-datetime-picker"))()
}
Math || ((() => "../../../uni_modules/uni-data-picker/components/uni-data-picker/uni-data-picker.js") + (() => "../../../node-modules/uview-plus/components/u-form-item/u-form-item.js") + (() => "../../../node-modules/uview-plus/components/u-input/u-input.js") + (() => "../../../node-modules/uview-plus/components/u-upload/u-upload.js") + (() => "../../../node-modules/uview-plus/components/u-textarea/u-textarea.js") + (() => "../../../node-modules/uview-plus/components/u-form/u-form.js") + (() => "../../../node-modules/uview-plus/components/u-datetime-picker/u-datetime-picker.js") + n + u)();
const u = () => "../../../components/FloatingWindow.js",
  n = () => "../../../components/FooterBtn.js",
  s = {
    __name: "Edit",
    props: {
      id: String,
      isComponent: {
        type: Boolean,
        default: !1
      },
      accountId: {
        type: String,
        default: null
      }
    },
    setup(u) {
      const n = u,
        s = n;
      l.useAppStore();
      const c = e.j();
      r.useUserStore();
      const d = t.useDictStore();
      e.ref([]), e.inject("util");

      const p = [];

      // 【新增】具体位置 / 电表类型 必填校验
      p.push({
        key: 'electricityType',
        required: true,
        message: '请选择具体位置/电表类型'
      });
    
      const m = e.ref({
        dailyReading: "",
        meterRatio: null   // ✅ 电表倍率
      });
      // e.watch((() => m.value.dailyReading), ((e, t) => {
      //   if (e) {
      //     let t = m.value.beforeReading ? e - m.value.beforeReading : 0;
      //     m.value.beforeUsage = Number(t.toFixed(2))
      //   }
      // }), {
      //   deep: !1,
      //   immediate: !1
      // });
      const calcUsage = () => {
        if (!m.value.dailyReading) { m.value.beforeUsage = 0; return; }
        const before = Number(m.value.beforeReading) || 0;
        const current = Number(m.value.dailyReading) || 0;
        const ratio = m.value.meterRatio ? Number(m.value.meterRatio) : 1;
        m.value.beforeUsage = Number(((current - before) * ratio).toFixed(2));
      };

      e.watch(() => m.value.dailyReading, calcUsage, { deep: !1, immediate: !1 });
      
      const {
        dateTimeShow: v,
        field: f,
        currentTime: y,
        onDateTimeShow: g,
        onDateTimeConfirm: h,
        dateMode: j
      } = a.useDateTime(m), w = async () => {
        await d.getDictBatch(["replace_reason", "product_line", "electricity_type"]), s.id && o.queryDetails(s.id).then((e => {
          m.value = e.data, e.data.electricityImg ? m.value.electricityImg = e.data.electricityImg.split(";").map((e => ({
            url: "" + e
          }))) : m.value.electricityImg = []
        })).catch((e => {}))
      }, b = ({
        file: t,
        index: o
      }, a) => {
        e.index.showModal({
          title: "提示",
          content: "是否删除该附件？",
          success: function (e) {
            e.confirm ? m.value[a].splice(o, 1) : e.cancel && console.log("用户点击取消")
          }
        })
      }, x = e.ref(!1);
      e.ref(null);
      const q = e.ref([]),
        // k = e => {
        //   let t = e.detail.value;
        //   m.value.specLocation = t[0].text, m.value.electricityType = t[1].text, (async e => {
        //     if (!s.id) {
        //       let {
        //         data: t
        //       } = await o.queryBeforeLiquid(e);
        //       m.value.beforeReading = (null == t ? void 0 : t.beforeReading) ?? 0
        //     }
        //   })(m.value.electricityType), x.value = !1
        // };
        k = e => {
          let t = e.detail.value;
        
          // 1️⃣ 设置具体位置 & 电表类型
          m.value.specLocation = t[0].text;
          m.value.electricityType = t[1].text;
        
          console.log("【具体位置】", m.value.specLocation);
          console.log("【电表类型】", m.value.electricityType);
        
          // 2️⃣ 原有逻辑：查询上一次用电示数（保持不变）
          (async type => {
            if (!s.id) {
              let { data } = await o.queryBeforeLiquid(type);
              m.value.beforeReading = (data?.beforeReading) ?? 0;
              calcUsage();
            }
          })(m.value.electricityType);
        
          // 3️⃣ 新增：查询电表倍率（wx.request）
          wx.request({
            url: "https://api.quanshenghuoqin.com/api/factory/task/electricity-meter-ratio",
            method: "GET",
            data: {
              spec_location: m.value.specLocation,
              electricity_type: m.value.electricityType
            },
            success: res => {
              if (res.data && res.data.success) {
                const ratio = res.data.data.ratio;
                m.value.meterRatio = Number(ratio).toFixed(2);
                console.log("【电表倍率】", m.value.meterRatio);
              } else {
                m.value.meterRatio = null;
                console.warn("未查到电表倍率");
              }
              calcUsage();
            },
            fail: err => {
              m.value.meterRatio = null;
              console.error("查询电表倍率失败", err);
              calcUsage();
            }
          });
        
          // 4️⃣ 关闭 picker
          x.value = !1;
        };
        
      return e.onMounted((() => {
        w(), 0 == q.value.length && i.dictTree("spec_location").then((e => {
          q.value = e.data
        })).catch((e => {}))
      })), (t, a) => ({
        a: e.t(m.value.beforeReading),
        meterRatio: m.value.meterRatio,
        b: e.w((({
          data: t,
          error: o,
          options: a
        }, i, l) => e.e$2(m.value.specLocation ? {
          a: e.t(m.value.specLocation),
          b: e.t(m.value.electricityType)
        } : {}, {
          c: l,
          d: i
        })), {
          name: "d",
          path: "b",
          vueId: "f6d653d5-3,f6d653d5-2"
        }),
        c: m.value.specLocation,
        d: e.o(k),
        e: e.p({
          placeholder: "请选择具体位置",
          "popup-title": "具体位置/电表类型",
          map: {
            text: "dname",
            value: "dval"
          },
          localdata: q.value
        }),
        f: e.p({
          label: "具体位置/电表类型",
          required: !0,
          prop: "electricityType"
        }),
        g: e.o(e.m((e => m.value.dailyReading = e), {
          number: !0
        }, !0)),
        h: e.p({
          type: "digit",
          placeholder: "请输入",
          modelValue: m.value.dailyReading
        }),
        i: e.p({
          label: "今日用电示数",
          required: !0,
          prop: "dailyReading"
        }),
        j: e.o((t => (async (t, o) => {
          let a = [].concat(t.file);
          m.value[o] || (m.value[o] = []);
          let l = m.value[o].length;
          a.map((e => {
            m.value[o].push({
              ...e,
              status: "uploading",
              message: "上传中"
            })
          }));
          for (let u = 0; u < a.length; u++) try {
            const {
              data: e
            } = await i.asyncUpload(a[u].url);
            let t = m.value[o][l];
            m.value[o].splice(l, 1, {
              ...t,
              status: "success",
              message: "",
              url: e.url
            }), l++
          } catch (r) {
            console.log(r), e.index.showToast({
              title: "图片上传失败",
              icon: "none"
            })
          }
        })(t, "electricityImg"))),
        k: e.o((e => b(e, "electricityImg"))),
        l: e.p({
          "max-count": 1,
          deletable: !0,
          sizeType: ["compressed"],
          "before-delete": (e, t) => b(e, t),
          fileList: m.value.electricityImg
        }),
        m: e.p({
          label: "今日用电示数照片",
          required: !0,
          prop: "electricityImg"
        }),
        n: e.t(m.value.beforeUsage),
        o: e.o((e => m.value.remark = e)),
        p: e.p({
          count: !!m.value.remark,
          maxlength: "800",
          placeholder: "备注",
          modelValue: m.value.remark
        }),
        q: e.p({
          label: "备注",
          prop: "remark"
        }),
        r: e.sr("form1", "f6d653d5-0"),
        s: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        }),
        t: e.o(e.unref(h)),
        v: e.o((e => v.value = !1)),
        w: e.o((e => v.value = !1)),
        x: e.o((t => e.isRef(y) ? y.value = t : null)),
        y: e.p({
          show: e.unref(v),
          confirmColor: "#849EB2",
          closeOnClickOverlay: !0,
          mode: e.unref(j),
          modelValue: e.unref(y)
        }),
        z: e.o((t => (() => {
          for (let o in p) {
            var t = p[o];
            if (t.required && (!m.value[t.key] || "" == m.value[t.key])) return e.index.showToast({
              title: t.message,
              duration: 1500,
              icon: "none"
            })
          }
          e.lodashExports.isArray(m.value.electricityImg) && m.value.electricityImg.forEach(((e, t) => {
            m.value[`electricityImg${t+1}`] = e.url
          })), o.saveEdit(m.value).then((t => {
            e.index.showModal({
              title: "提示",
              content: m.value.id ? "修改成功" : "保存成功",
              showCancel: !1,
              success: function (o) {
                o.confirm ? n.isComponent ? emit("confirm", t) : (e.index.$emit("refresh-electricityLog", {
                  refresh: !0
                }), c.back()) : o.cancel && console.log("用户点击取消")
              }
            })
          }))
        })())),
        A: e.p({
          cancelBtnShow: !1,
          confirm_btn_text: "保存"
        })
      })
    }
  },
  c = e._export_sfc(s, [
    ["__scopeId", "data-v-f6d653d5"]
  ]);
wx.createPage(c);