"use strict";
const e = require("../../../common/vendor.js"),
  a = require("../../../store/modules/dictStore.js"),
  t = require("../../api/deviceRepair.js"),
  l = require("../../constant/index.js"),
  o = require("../../../api/common.js"),
  r = require("../../vueUse/datetimeUse.js");
if (require("../../../utils/http.js"), require("../../../common/config.js"), require("../../../router/index.js"), require("../../../store/modules/userStore.js"), require("../../../api/user.js"), require("../../../api/home.js"), require("../../../store/modules/appStore.js"), require("../../../utils/dateUtils.js"), !Array) {
  (e.resolveComponent("u-tag") + e.resolveComponent("u-divider") + e.resolveComponent("u--text") + e.resolveComponent("u-form-item") + e.resolveComponent("zxz-uni-data-select") + e.resolveComponent("u--textarea") + e.resolveComponent("u--form") + e.resolveComponent("uni-th") + e.resolveComponent("uni-tr") + e.resolveComponent("uni-td") + e.resolveComponent("u-button") + e.resolveComponent("uni-table") + e.resolveComponent("u-radio") + e.resolveComponent("u-radio-group") + e.resolveComponent("u-upload") + e.resolveComponent("u--input") + e.resolveComponent("u-steps-item") + e.resolveComponent("u-steps") + e.resolveComponent("uni-datetime-picker") + e.resolveComponent("u-rate") + e.resolveComponent("u-modal") + e.resolveComponent("u-icon") + e.resolveComponent("u-popup") + e.resolveComponent("u-datetime-picker"))()
}
Math || ((() => "../../../node-modules/uview-plus/components/u-tag/u-tag.js") + (() => "../../../node-modules/uview-plus/components/u-divider/u-divider.js") + u + (() => "../../../node-modules/uview-plus/components/u-text/u-text.js") + n + (() => "../../../node-modules/uview-plus/components/u-form-item/u-form-item.js") + (() => "../../../uni_modules/zxz-uni-data-select/components/zxz-uni-data-select/zxz-uni-data-select.js") + (() => "../../../node-modules/uview-plus/components/u-textarea/u-textarea.js") + (() => "../../../node-modules/uview-plus/components/u-form/u-form.js") + (() => "../../../uni_modules/uni-table/components/uni-th/uni-th.js") + (() => "../../../uni_modules/uni-table/components/uni-tr/uni-tr.js") + (() => "../../../uni_modules/uni-table/components/uni-td/uni-td.js") + (() => "../../../node-modules/uview-plus/components/u-button/u-button.js") + (() => "../../../uni_modules/uni-table/components/uni-table/uni-table.js") + (() => "../../../node-modules/uview-plus/components/u-radio/u-radio.js") + (() => "../../../node-modules/uview-plus/components/u-radio-group/u-radio-group.js") + (() => "../../../node-modules/uview-plus/components/u-upload/u-upload.js") + (() => "../../../node-modules/uview-plus/components/u-input/u-input.js") + (() => "../../../node-modules/uview-plus/components/u-steps-item/u-steps-item.js") + (() => "../../../node-modules/uview-plus/components/u-steps/u-steps.js") + (() => "../../../uni_modules/uni-datetime-picker/components/uni-datetime-picker/uni-datetime-picker.js") + (() => "../../../node-modules/uview-plus/components/u-rate/u-rate.js") + (() => "../../../node-modules/uview-plus/components/u-modal/u-modal.js") + (() => "../../../node-modules/uview-plus/components/u-icon/u-icon.js") + p + (() => "../../../node-modules/uview-plus/components/u-popup/u-popup.js") + (() => "../../../node-modules/uview-plus/components/u-datetime-picker/u-datetime-picker.js") + i)();
const i = () => "../../../components/FloatingWindow.js",
  u = () => "../../../components/ProgressStatus.js",
  p = () => "../../../components/FooterBtn.js",
  n = () => "../../../components/LoadSelector.js",
  s = {
    __name: "Detailed",
    props: ["id"],
    setup(i) {
      const u = i,
        p = e.j();
      e.inject("util");
      const n = a.useDictStore(),
        s = u,
        d = e.ref({}),
        m = () => {
          t.queryDetails(s.id).then((e => {
            d.value = e.data;
            d.value.btnList = d.value.btnList || [];
            ["repair", "complete"].forEach(k => {
              if (!d.value.btnList.find(b => b.btnValue === k)) {
                d.value.btnList.push({
                  btnValue: k,
                  btnName: k === "repair" ? "添加维修进展" : "完成维修",
                  btnCode: k
                })
              }
            })
          })).catch((e => {}))
        },
        c = e.computed((() => e => !(!d.value.btnList || !e) && !!d.value.btnList.find((a => a.btnValue === e)))),
        v = e.ref({
          id: s.id,
          deviceRepairId: s.id
        }),
        b = () => {
          v.value = {
            id: s.id
          }, C.value = !1
        },
        f = async (a, t) => {
          let l = [].concat(a.file);
          v.value[t] || (v.value[t] = []);
          let r = v.value[t].length;
          l.map((e => {
            v.value[t].push({
              ...e,
              status: "uploading",
              message: "上传中"
            })
          }));
          for (let u = 0; u < l.length; u++) try {
            const {
              data: e
            } = await o.asyncUpload(l[u].url);
            let a = v.value[t][r];
            v.value[t].splice(r, 1, {
              ...a,
              status: "success",
              message: "",
              url: e.url
            }), r++
          } catch (i) {
            console.log(i), e.index.showToast({
              title: "图片上传失败",
              icon: "none"
            })
          }
        }, g = ({
          file: a,
          index: t
        }, l) => {
          e.index.showModal({
            title: "提示",
            content: "是否删除该附件？",
            success: function (e) {
              e.confirm ? v.value[l].splice(t, 1) : e.cancel && console.log("用户点击取消")
            }
          })
        };
      let h = !1;
      const C = e.ref(!1),
        y = () => {
          w()
        },
        w = a => {
          if (h) return !1;
          if (!a && !v.value.operateType) return;
          let {
            operateType: l,
            dialogTitle: o,
            partImg: r,
            completionImg: i,
            repairImg: u,
            ...p
          } = v.value;
          r && e.lodashExports.isArray(r) && r.forEach(((e, a) => {
            p[`partImg${a+1}`] = e.url
          })), i && e.lodashExports.isArray(i) && i.forEach(((e, a) => {
            p[`completionImg${a+1}`] = e.url
          })), u && e.lodashExports.isArray(u) && u.forEach(((e, a) => {
            p[`repairImg${a+1}`] = e.url
          })), h = !0, t.operate(a ?? l, p).then((a => {
            e.index.showModal({
              title: "提示",
              content: a.msg,
              showCancel: !1,
              success: function (e) {
                h = !1, C.value = !1, v.value = {
                  id: s.id
                }, m()
              }
            })
          })).catch((e => {
            h = !1
          }))
        },
        j = e.ref(!1),
        S = e.ref({}),
        {
          dateTimeShow: I,
          field: x,
          currentTime: T,
          onDateTimeShow: R,
          onDateTimeConfirm: q,
          dateMode: L
        } = r.useDateTime(v, "datetime");
      return e.onShow((() => {
        (async () => {
          await n.getDictBatch(["impact_level", "product_line", "repairer_status", "repair_status_c", "solution", "replace_part", "repair_status"]), m()
        })()
      })), e.onMounted((() => {})), (a, o) => e.e$2({
        a: e.t(d.value.jobType),
        b: e.t(d.value.prodLineOrDept),
        c: e.t(d.value.name),
        d: d.value.impactLevel
      }, d.value.impactLevel ? {
        e: e.p({
          size: "mini",
          bgColor: e.unref(l.impactLevel)[d.value.impactLevel].bgColor,
          borderColor: e.unref(l.impactLevel)[d.value.impactLevel].bgColor,
          text: d.value.impactLevel
        })
      } : {}, {
        f: "已取消" == d.value.repairStatus
      }, "已取消" == d.value.repairStatus ? {
        g: e.p({
          dataKey: "dval",
          dataLabel: "dname",
          status_list: a.dict.repair_status_c,
          active: d.value.repairStatus,
          readonly: !0,
          data: d.value
        })
      } : {
        h: e.p({
          dataKey: "dval",
          dataLabel: "dname",
          status_list: a.dict.repair_status,
          active: d.value.repairStatus,
          readonly: !0,
          data: d.value
        })
      }, {
        i: 1 == d.value.addPartsPurchase
      }, 1 == d.value.addPartsPurchase ? {
        j: e.p({
          size: "14",
          bold: !0,
          color: "#666",
          prefixIcon: `${a.baseURL}/assets/fac/repair.png`,
          iconStyle: "font-size: 14px;color:#A1A4A9; margin-right: 5upx;",
          text: "零配件采购"
        }),
        k: e.o((a => e.unref(p).push({
          name: "partsPurchaseEdit",
          params: {
            deviceRepairId: e.unref(s).id,
            deviceRepairName: d.value.name
          }
        }))),
        l: e.p({
          size: "mini",
          borderColor: "#849EB2",
          bgColor: "#849EB2",
          text: "去发起"
        })
      } : {}, {
        m: e.unref(c)("assign")
      }, e.unref(c)("assign") ? {
        n: e.o((e => v.value.repairerStaffId = e)),
        o: e.p({
          placeholder: "请选择",
          dataText: "name",
          filterable: !0,
          dataValue: "staffId",
          load_url: "/api/jml/staff/list4Repairer",
          modelValue: v.value.repairerStaffId
        }),
        p: e.p({
          label: "分配维修员",
          required: !0,
          prop: "repairerStaffId"
        }),
        q: e.o((e => v.value.repairerStatus = e)),
        r: e.p({
          placeholder: "请选择",
          localdata: a.dict.repairer_status,
          modelValue: v.value.repairerStatus
        }),
        s: e.p({
          label: "维修机器状态",
          required: !0,
          prop: "repairerStatus"
        }),
        t: e.o((e => v.value.assignRemark = e)),
        v: e.p({
          count: !!v.value.assignRemark,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.assignRemark
        }),
        w: e.p({
          label: "分配备注",
          prop: "assignRemark"
        }),
        x: e.sr("form1", "001edf9d-6"),
        y: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      } : {}, {
        z: d.value.repairProgressList && d.value.repairProgressList.length > 0
      }, d.value.repairProgressList && d.value.repairProgressList.length > 0 ? e.e$2({
        A: e.p({
          width: "150",
          align: "center"
        }),
        B: e.p({
          width: "160",
          align: "center"
        }),
        C: e.p({
          width: "160",
          align: "center"
        }),
        D: e.p({
          width: "120",
          align: "center"
        }),
        E: e.p({
          operate: !0,
          width: "120",
          align: "center"
        }),
        F: e.f(d.value.repairProgressList, ((a, t, l) => ({
          a: e.t(a.repairContent),
          b: "001edf9d-21-" + l + ",001edf9d-20-" + l,
          c: e.t(a.repairStartTime),
          d: "001edf9d-22-" + l + ",001edf9d-20-" + l,
          e: e.t(a.repairEndTime),
          f: "001edf9d-23-" + l + ",001edf9d-20-" + l,
          g: e.t(a.repairStaffName),
          h: "001edf9d-24-" + l + ",001edf9d-20-" + l,
          i: e.o((e => (async (e, a) => {
            S.value = {
              ...e
            }, e.repairImg ? S.value.repairImg = e.repairImg.split(";") : S.value.repairImg = [], j.value = !0
          })(a)), t),
          j: "001edf9d-26-" + l + ",001edf9d-25-" + l,
          k: "001edf9d-25-" + l + ",001edf9d-20-" + l,
          l: t,
          m: "001edf9d-20-" + l + ",001edf9d-13"
        }))),
        G: e.p({
          align: "center"
        }),
        H: e.p({
          align: "center"
        }),
        I: e.p({
          align: "center"
        }),
        J: e.p({
          align: "center"
        }),
        K: e.p({
          color: "#849EB2",
          plain: !0,
          hairline: !0,
          size: "mini",
          type: "primary"
        }),
        L: e.p({
          operate: !0,
          align: "center"
        }),
        M: e.p({
          border: !0,
          stripe: !0,
          emptyText: "暂无更多数据"
        }),
        N: e.unref(c)("complete") && !C.value
      }, e.unref(c)("complete") && !C.value ? e.e$2({
        O: e.o((e => v.value.repairContent = e)),
        P: e.p({
          count: !!v.value.repairContent,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.repairContent
        }),
        Q: e.p({
          label: "维修内容",
          prop: "repairContent",
          required: !0
        }),
        R: e.o((e => v.value.faultAnalysis = e)),
        S: e.p({
          count: !!v.value.faultAnalysis,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.faultAnalysis
        }),
        T: e.p({
          label: "原因分析",
          prop: "faultAnalysis",
          required: !0
        }),
        U: e.f(a.dict.solution, ((a, t, l) => ({
          a: t,
          b: "001edf9d-34-" + l + ",001edf9d-33",
          c: e.p({
            customStyle: {
              marginRight: "16px"
            },
            label: a.dname,
            name: a.dval
          })
        }))),
        V: e.o((e => v.value.solution = e)),
        W: e.p({
          activeColor: "#849EB2",
          iconPlacement: "left",
          modelValue: v.value.solution
        }),
        X: e.p({
          label: "处理方式",
          prop: "solution",
          required: !0
        }),
        Y: e.o((e => v.value.preventionMethod = e)),
        Z: e.p({
          count: !!v.value.preventionMethod,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.preventionMethod
        }),
        aa: e.p({
          label: "预防方法",
          prop: "preventionMethod",
          required: !0
        }),
        ab: e.o((e => f(e, "completionImg"))),
        ac: e.o((e => g(e, "completionImg"))),
        ad: e.p({
          "max-count": 3,
          multiple: !0,
          deletable: !0,
          sizeType: ["compressed"],
          "before-delete": (e, a) => g(e, a),
          fileList: v.value.completionImg
        }),
        ae: e.p({
          label: "完成照片",
          prop: "completionImg"
        }),
        af: e.f(a.dict.replace_part, ((a, t, l) => ({
          a: t,
          b: "001edf9d-41-" + l + ",001edf9d-40",
          c: e.p({
            customStyle: {
              marginRight: "16px"
            },
            label: a.dname,
            name: a.dval
          })
        }))),
        ag: e.o((e => v.value.replacePart = e)),
        ah: e.p({
          activeColor: "#849EB2",
          iconPlacement: "left",
          modelValue: v.value.replacePart
        }),
        ai: e.p({
          label: "是否需要更换配件",
          prop: "replacePart",
          required: !0
        }),
        aj: "1" == v.value.replacePart
      }, "1" == v.value.replacePart ? {
        ak: e.o((e => v.value.partName = e)),
        al: e.p({
          placeholder: "请输入",
          modelValue: v.value.partName
        }),
        am: e.p({
          label: "配件名称",
          required: !0,
          prop: "partName"
        }),
        an: e.o((e => v.value.partModel = e)),
        ao: e.p({
          placeholder: "请输入",
          modelValue: v.value.partModel
        }),
        ap: e.p({
          label: "配件型号",
          required: !0,
          prop: "partModel"
        }),
        aq: e.o(e.m((e => v.value.partQty = e), {
          number: !0
        }, !0)),
        ar: e.p({
          type: "number",
          placeholder: "请输入",
          modelValue: v.value.partQty
        }),
        as: e.p({
          label: "配件数量",
          required: !0,
          prop: "partQty"
        }),
        at: e.o((e => f(e, "partImg"))),
        av: e.o((e => g(e, "partImg"))),
        aw: e.p({
          "max-count": 2,
          multiple: !0,
          deletable: !0,
          sizeType: ["compressed"],
          "before-delete": (e, a) => g(e, a),
          fileList: v.value.partImg
        }),
        ax: e.p({
          label: "完成照片",
          prop: "partImg"
        })
      } : {}, {
        ay: e.sr("form1", "001edf9d-27"),
        az: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      }) : {}) : {}, {
        aA: e.t(d.value.deviceName),
        aB: e.t(d.value.location),
        aC: e.t("1" == d.value.repairAccepted ? "已接受" : "否"),
        aD: "1" == d.value.repairAccepted
      }, "1" == d.value.repairAccepted ? {
        aE: e.t(d.value.repairAcceptedTime)
      } : {}, {
        aF: d.value.damageImg
      }, d.value.damageImg ? {
        aG: e.f(d.value.damageImg.split(";"), ((e, t, l) => ({
          a: t,
          b: a.imgBase + e
        })))
      } : {}, {
        aH: e.t(d.value.faultDesc),
        aI: e.t(d.value.createdTime),
        aJ: e.t(d.value.createdStaffName),
        aK: e.t(d.value.updateTime),
        aL: e.t(d.value.updateStaffName),
        aM: d.value.repairHistoryList
      }, d.value.repairHistoryList ? {
        aN: e.f(d.value.repairHistoryList, ((a, t, l) => ({
          a: e.t(a.createdStaffName),
          b: e.t(a.createdTime),
          c: e.t(a.remark),
          d: t,
          e: "001edf9d-54-" + l + ",001edf9d-53",
          f: e.p({
            title: `${a.createdStaffName} | ${a.createdTime}`
          })
        }))),
        aO: e.p({
          current: d.value.repairHistoryList.length,
          direction: "column"
        })
      } : {}, {
        aP: "repair" == v.value.operateType
      }, "repair" == v.value.operateType ? {
        aQ: e.o((e => v.value.repairStartTime = e)),
        aR: e.p({
          type: "datetime",
          placeholder: "开始时间",
          border: !1,
          modelValue: v.value.repairStartTime
        }),
        aS: e.p({
          label: "维修开始时间",
          prop: "repairStartTime",
          required: !0
        }),
        aT: e.o((e => v.value.repairEndTime = e)),
        aU: e.p({
          type: "datetime",
          placeholder: "结束时间",
          border: !1,
          modelValue: v.value.repairEndTime
        }),
        aV: e.p({
          label: "维修结束时间",
          prop: "repairEndTime",
          required: !0
        }),
        aW: e.o((e => v.value.repairContent = e)),
        aX: e.p({
          count: !!v.value.repairContent,
          maxlength: "800",
          placeholder: "请填写",
          modelValue: v.value.repairContent
        }),
        aY: e.p({
          label: "维修内容",
          prop: "repairContent",
          required: !0
        }),
        aZ: e.o((e => f(e, "repairImg"))),
        ba: e.o((e => g(e, "repairImg"))),
        bb: e.p({
          "max-count": 3,
          multiple: !0,
          deletable: !0,
          sizeType: ["compressed"],
          "before-delete": (e, a) => g(e, a),
          fileList: v.value.repairImg
        }),
        bc: e.p({
          label: "维修照片",
          prop: "repairImg",
          required: !0
        }),
        bd: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      } : {}, {
        be: "assign" == v.value.operateType
      }, "assign" == v.value.operateType ? {
        bf: e.o((e => v.value.repairerStaffId = e)),
        bg: e.p({
          placeholder: "请选择",
          dataText: "name",
          filterable: !0,
          dataValue: "staffId",
          load_url: "/api/jml/staff/list4Repairer",
          modelValue: v.value.repairerStaffId
        }),
        bh: e.p({
          label: "分配维修员",
          required: !0,
          prop: "repairerStaffId"
        }),
        bi: e.o((e => v.value.repairerStatus = e)),
        bj: e.p({
          placeholder: "请选择",
          localdata: a.dict.repairer_status,
          modelValue: v.value.repairerStatus
        }),
        bk: e.p({
          label: "维修机器状态",
          required: !0,
          prop: "repairerStatus"
        }),
        bl: e.o((e => v.value.assignRemark = e)),
        bm: e.p({
          count: !!v.value.assignRemark,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.assignRemark
        }),
        bn: e.p({
          label: "分配备注",
          prop: "assignRemark"
        }),
        bo: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      } : {}, {
        bp: "cancel" == v.value.operateType
      }, "cancel" == v.value.operateType ? {
        bq: e.o((e => v.value.cancelReason = e)),
        br: e.p({
          count: !!v.value.cancelReason,
          maxlength: "800",
          placeholder: "请输入",
          modelValue: v.value.cancelReason
        }),
        bs: e.p({
          label: "取消原因",
          prop: "cancelReason"
        }),
        bt: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      } : {}, {
        bv: "confirm" == v.value.operateType
      }, "confirm" == v.value.operateType ? {
        bw: e.o((e => v.value.serviceRating = e)),
        bx: e.p({
          "active-color": "#FA3534",
          "inactive-color": "#b2b2b2",
          gutter: "20",
          modelValue: v.value.serviceRating
        }),
        by: e.p({
          label: "您对本次问题处理结果满意吗?",
          prop: "serviceRating"
        }),
        bz: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        })
      } : {}, {
        bA: e.o(y),
        bB: e.o(b),
        bC: e.o((e => C.value = e)),
        bD: e.p({
          confirmColor: "#849EB2",
          title: v.value.dialogTitle,
          "show-cancel-button": !0,
          show: C.value
        }),
        bE: !C.value
      }, C.value ? {} : e.e$2({
        bF: d.value.btnList || "1" == d.value.showRepairAccept
      }, d.value.btnList || "1" == d.value.showRepairAccept ? {
        bG: e.f(d.value.btnList, ((a, t, o) => {
          var r, i, u, p;
          return e.e$2({
            a: null == (r = e.unref(l.deviceRepairStatusInfo)[a.btnValue]) ? void 0 : r.icon
          }, (null == (i = e.unref(l.deviceRepairStatusInfo)[a.btnValue]) ? void 0 : i.icon) ? {
            b: "001edf9d-79-" + o + ",001edf9d-78",
            c: e.p({
              size: "16",
              color: "#fff",
              name: null == (u = e.unref(l.deviceRepairStatusInfo)[a.btnValue]) ? void 0 : u.icon
            })
          } : {}, {
            d: e.t(a.btnName),
            e: t,
            f: e.s(`background: ${null==(p=e.unref(l.deviceRepairStatusInfo)[a.btnValue])?void 0:p.btnColor};`),
            g: e.o((e => (e => {
              var a, t;
              (null == (a = l.deviceRepairStatusInfo[e.btnValue]) ? void 0 : a.dialogShow) ? (v.value.operateType = e.btnCode, v.value.dialogTitle = null == (t = l.deviceRepairStatusInfo[e.btnValue]) ? void 0 : t.dialogTitle, C.value = !0) : w(e.btnCode)
            })(a)), t),
            h: e.n(a.btnCode)
          })
        })),
        bH: e.o((a => {
          return l = d.value.id, void e.index.showModal({
            title: "提示",
            content: "是否接受该任务？",
            success: function (a) {
              a.confirm && t.accept(l).then((a => {
                e.index.showModal({
                  title: "提示",
                  showCancel: !1,
                  content: a.msg ?? "操作成功"
                }).then((e => {
                  m()
                }))
              })).catch((e => {}))
            }
          });
          var l
        })),
        bI: e.p({
          cancelBtnShow: !1,
          confirmBtnShow: "1" == d.value.showRepairAccept,
          confirm_btn_text: "接受"
        })
      } : {}), {
        bJ: e.t(S.value.repairContent),
        bK: e.t(S.value.repairStartTime),
        bL: e.t(S.value.repairEndTime),
        bM: e.t(S.value.repairStaffName),
        bN: e.f(S.value.repairImg, ((t, l, o) => ({
          a: l,
          b: e.o((e => a.showImagePreview(S.value.repairImg, l)), l),
          c: a.imgBase + t
        }))),
        bO: e.o((e => j.value = !1)),
        bP: e.p({
          show: j.value,
          round: 10,
          closeable: !0,
          mode: "bottom"
        }),
        bQ: e.o(e.unref(q)),
        bR: e.o((e => I.value = !1)),
        bS: e.o((e => I.value = !1)),
        bT: e.o((a => e.isRef(T) ? T.value = a : null)),
        bU: e.p({
          show: e.unref(I),
          confirmColor: "#849EB2",
          closeOnClickOverlay: !0,
          mode: e.unref(L),
          modelValue: e.unref(T)
        })
      })
    }
  };
wx.createPage(s);