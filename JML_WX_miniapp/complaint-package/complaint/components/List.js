"use strict";
const e = require("../../../common/vendor.js"),
  a = require("../../../api/complaint.js"),
  o = require("../../../api/common.js"),
  t = require("../../../vueUse/dataList.js"),
  n = require("../../../store/modules/dictStore.js");
if (require("../../../utils/http.js"), require("../../../common/config.js"), require("../../../router/index.js"), require("../../../store/modules/userStore.js"), require("../../../api/user.js"), require("../../../api/home.js"), require("../../../store/modules/appStore.js"), require("../../../utils/dateUtils.js"), !Array) {
  (e.resolveComponent("u-icon") + e.resolveComponent("u-search") + e.resolveComponent("u-divider") + e.resolveComponent("u-tag") + e.resolveComponent("uni-swipe-action-item") + e.resolveComponent("uni-swipe-action") + e.resolveComponent("u-empty") + e.resolveComponent("u-calendar") + e.resolveComponent("u-picker") + e.resolveComponent("u--textarea") + e.resolveComponent("u-form-item") + e.resolveComponent("u--form") + e.resolveComponent("u-modal") + e.resolveComponent("u-radio") + e.resolveComponent("u-radio-group"))()
}
Math || ((() => "../../../node-modules/uview-plus/components/u-icon/u-icon.js") + (() => "../../../node-modules/uview-plus/components/u-search/u-search.js") + (() => "../../../node-modules/uview-plus/components/u-divider/u-divider.js") + (() => "../../../node-modules/uview-plus/components/u-tag/u-tag.js") + i + (() => "../../../uni_modules/uni-swipe-action/components/uni-swipe-action-item/uni-swipe-action-item.js") + (() => "../../../uni_modules/uni-swipe-action/components/uni-swipe-action/uni-swipe-action.js") + (() => "../../../node-modules/uview-plus/components/u-empty/u-empty.js") + (() => "../../../node-modules/uview-plus/components/u-calendar/u-calendar.js") + (() => "../../../node-modules/uview-plus/components/u-picker/u-picker.js") + (() => "../../../node-modules/uview-plus/components/u-textarea/u-textarea.js") + (() => "../../../node-modules/uview-plus/components/u-form-item/u-form-item.js") + (() => "../../../node-modules/uview-plus/components/u-form/u-form.js") + (() => "../../../node-modules/uview-plus/components/u-modal/u-modal.js") + (() => "../../../node-modules/uview-plus/components/u-radio/u-radio.js") + (() => "../../../node-modules/uview-plus/components/u-radio-group/u-radio-group.js") + s)();
const s = () => "../../../components/FloatingWindow.js",
  i = () => "../../../components/ProgressStatus.js",
  l = {
    __name: "List",
    props: {},
    setup(s) {
      const i = s,
        l = e.j(),
        r = e.inject("util"),
        {
          data: u
        } = t.useDataList(),
        c = n.useDictStore();
      e.computed((() => u.list.length > 0 ? "没有更多了" : ""));
      const p = () => {
        y()
      };
      var d = getCurrentPages(),
        m = d[d.length - 1];
      const f = e.ref(m.route);
      console.log(m, "打印当前页路由");
      const v = e.reactive({
        multiFiled: "",
        caseStageCode: "",
        // 兼容分包与主包路由，使用 endsWith 判断是否为审批列表页
        flag: (f.value && (f.value.endsWith("/complaint/ApproveList") || f.value === "pages/complaint/ApproveList")) ? "1" : "",
        serviceType: "",
        startDate: i.startDate || "",
        endDate: i.endDate || "",
        createdStaffId: "",
        pageNo: u.pageNo,
        pageSize: u.pageSize
      });
      console.log(v);
      const g = e.ref(!1),
        h = () => {
          console.log("refresh"), g.value = "restore", y()
        },
        b = e => {
          u.finished || u.loading || (v.pageNo = e || u.pageNo, u.loading = !0, v.pageNo <= 1 && u.initEmpty(), a.queryPageData(v).then((e => {
            !1 !== g.value && (g.value = !1), u.list = [...u.list, ...e.data.list], u.totalRow = e.data.totalRow, u.pageNo = u.pageNo + 1, u.loading = !1, u.finished = e.data.lastPage
          })).catch((e => {
            u.finished = !0
          })))
        },
        C = e.ref([]),
        y = () => {
          u.initEmpty(), b(1)
        };
      e.onShow((() => {
        e.index.$once("refresh", (a => {
          e.index.$off("refresh"), y()
        }))
      })), e.onMounted((() => {
        (async () => {
          const e = await c.getDict("case_stage");
          C.value = e.map((e => ({
            label: e.dname,
            value: e.dval
          }))), u.finished && (u.finished = !1), b()
        })()
      }));
      const w = e.ref(!1),
        S = e.ref("提示"),
        j = () => {
          if ("cancel" == x.value ? D.value.caseBtnStage = "拒绝" : "confirm" == x.value && (D.value.caseBtnStage = "通过"), !D.value.remark || "" == D.value.remark) return e.index.showToast({
            title: "备注必须填写",
            duration: 1500,
            icon: "none"
          });
          a.caseDo(D.value).then((a => {
            e.index.showModal({
              title: "提示",
              showCancel: !1,
              content: a.msg || "操作成功"
            }).then((e => {
              l.back()
            }))
          }))
        },
        D = e.ref({
          id: null
        }),
        x = e.ref(null),
        E = (e, a) => {
          "cancel" == e ? S.value = "拒绝操作" : "confirm" == e && (S.value = "通过操作"), x.value = e, D.value.id = a, w.value = !0
        },
        q = e.ref(!1),
        _ = e.ref(null),
        z = async () => {
          !c.hasDict("service_type") && await c.getDictBatch(["service_type"]), q.value = !0
        }, N = () => {
          if (!_.value) return e.index.showToast({
            title: "请选择类型",
            duration: 1500,
            icon: "none"
          });
          q.value = !1, l.push({
            name: "complaintEdit",
            params: {
              serviceType: _.value
            }
          })
        }, P = e => "confirm" !== e || _.value, B = e.ref(!1), I = a => {
          const o = a[0],
            t = a[a.length - 1];
          B.value = !1, v.startDate = `${e.dayjs(o).format("YYYY-MM-DD")}`, v.endDate = `${e.dayjs(t).format("YYYY-MM-DD")}`, y()
        }, Y = e.computed((() => "" != v.startDate || "" != v.endDate || "" != v.serviceType || "" != v.caseStageCode || "" != v.createdStaffId || null != W.value)), k = () => {
          v.startDate = "", v.endDate = "", v.serviceType = "", v.caseStageCode = "", v.createdStaffId = "", W.value = null, y()
        }, M = e.ref(!1), T = e.ref(!1), $ = e.ref(null), R = e.ref([]), L = e.ref(!0), O = () => {
          (!R.value || 0 == R.value.length) && o.queryUserList().then((e => {
            R.value = e.data, R.value.unshift({
              name: "全部",
              id: ""
            }), L.value = !1, prop.createdStaffId && (W.value = R.value.find((e => e.id == prop.createdStaffId)))
          })).catch((e => {})), M.value = !0
        }, W = e.ref(null), A = ({
          value: e,
          indexs: a
        }) => {
          console.log("onUserConfirm", e, a);
          let o = e[0];
          o && (W.value = o, v.createdStaffId = o.id, y()), M.value = !1
        }, F = e.ref([]), U = async (e, a) => {
          $.value = {
            type: e,
            key: a
          }, F.value[0] = await c.getDict(a), T.value = !0
        }, V = ({
          value: e,
          indexs: a
        }) => {
          console.log("onTypeConfirm", e, a);
          let o = e[0];
          o && (v[$.value.type] = o.dval, v[`${$.value.type}_text`] = o.dname, y()), T.value = !1
        };
      return e.onShow((() => {})), (o, t) => e.e$2({
        a: e.p({
          size: "6",
          labelSize: "12",
          labelPos: "left",
          label: e.unref(v).serviceType ? e.unref(v).serviceType : "类型",
          name: "/static/icon/sel_icon.png"
        }),
        b: e.o((e => U("serviceType", "service_type"))),
        c: e.p({
          size: "6",
          labelSize: "12",
          labelPos: "left",
          label: e.unref(v).caseStageCode ? e.unref(v).caseStageCode_text : "阶段",
          name: "/static/icon/sel_icon.png"
        }),
        d: e.o((e => U("caseStageCode", "case_stage_code"))),
        e: e.o((a => e.unref(r).debounce(p))),
        f: e.o((a => e.unref(r).debounce(p))),
        g: e.o((a => e.unref(v).multiFiled = a)),
        h: e.p({
          placeholder: "客户名字/电话/客服服务编号",
          shape: "square",
          modelValue: e.unref(v).multiFiled
        }),
        i: e.unref(Y)
      }, e.unref(Y) ? {
        j: e.p({
          size: "16",
          name: "close-circle-fill",
          color: "#849EB2"
        }),
        k: e.o(k)
      } : {}, {
        l: e.p({
          size: "6",
          labelSize: "12",
          labelPos: "left",
          label: e.unref(W) && e.unref(W).name ? e.unref(W).name : "员工",
          name: "/static/icon/sel_icon.png"
        }),
        m: e.o(O),
        n: e.p({
          size: "6",
          labelSize: "12",
          labelPos: "left",
          label: e.unref(v).startDate ? `${e.unref(v).startDate} - ${e.unref(v).endDate}` : "日期",
          name: "/static/icon/sel_icon.png"
        }),
        o: e.o((e => B.value = !0)),
        p: e.f(e.unref(u).list, ((o, t, n) => e.e$2({
          a: "NEW" == o.caseStageCode && 1 == o.isEdit
        }, "NEW" == o.caseStageCode && 1 == o.isEdit ? {
          b: "3b978682-8-" + n + ",3b978682-7-" + n,
          c: e.p({
            size: "20",
            color: "#fff",
            name: "trash"
          }),
          d: e.o((t => {
            return n = o.id, void e.index.showModal({
              title: "提示",
              content: "是否删除该记录？",
              success: function (o) {
                o.confirm && a.deleteReport(n).then((a => {
                  e.index.showModal({
                    title: "提示",
                    showCancel: !1,
                    content: "操作成功"
                  }).then((e => {
                    y()
                  }))
                })).catch((e => {}))
              }
            });
            var n
          }), t)
        } : {}, {
          e: e.t(o.name),
          f: e.t(o.serviceType),
          g: "3b978682-9-" + n + ",3b978682-7-" + n,
          h: o.approvalStatus
        }, o.approvalStatus ? e.e$2({
          i: "通过" == o.approvalStatus
        }, "通过" == o.approvalStatus ? {
          j: "3b978682-10-" + n + ",3b978682-7-" + n,
          k: e.p({
            bgColor: "#88D39B",
            size: "mini",
            borderColor: "#88D39B",
            text: "通过"
          })
        } : {}, {
          l: "拒绝" == o.approvalStatus
        }, "拒绝" == o.approvalStatus ? {
          m: "3b978682-11-" + n + ",3b978682-7-" + n,
          n: e.p({
            bgColor: "#EB7155",
            size: "mini",
            borderColor: "#EB7155",
            text: "拒绝"
          })
        } : {}) : {}, {
          o: o.accName
        }, o.accName ? {
          p: e.t(o.accName)
        } : {}, {
          q: o.contactName
        }, o.contactName ? {
          r: e.t(o.contactName)
        } : {}, {
          s: o.contactPhone
        }, o.contactPhone ? {
          t: e.t(o.contactPhone)
        } : {}, {
          v: o.qaStatus
        }, o.qaStatus ? {
          w: "3b978682-12-" + n + ",3b978682-7-" + n,
          x: e.p({
            bgColor: "已受理" == o.qaStatus ? "#88D39B" : "#EB7155",
            size: "mini",
            borderColor: "已受理" == o.qaStatus ? "#88D39B" : "#EB7155",
            text: o.qaStatus
          })
        } : {}, {
          y: o.factory
        }, o.factory ? {
          z: e.t(o.factory)
        } : {}, {
          A: e.t(o.createdTime),
          B: "3b978682-13-" + n + ",3b978682-7-" + n,
          C: e.t(o.createdStaffName),
          D: "3b978682-14-" + n + ",3b978682-7-" + n,
          E: "3b978682-15-" + n + ",3b978682-7-" + n,
          F: e.p({
            data: o,
            readonly: !0,
            status_list: o.stageList,
            active: o.caseStageCode,
            isClosed: o.isClosed
          }),
          G: e.o((e => (e => {
            const typeVal = (f.value && (f.value.endsWith("/complaint/Index") || f.value === "pages/complaint/Index"))
              ? "pages/complaint/Index"
              : ((f.value && (f.value.endsWith("/complaint/ApproveList") || f.value === "pages/complaint/ApproveList" || f.value.endsWith("/complaintApprove/Index") || f.value === "pages/complaintApprove/Index"))
                ? "pages/complaint/ApproveList"
                : f.value);
            console.log("[Complaint List] navigate complaintInfo", {id: e.id, type: typeVal});
            l.push({
              name: "complaintInfo",
              params: {
                id: e.id,
                type: typeVal
              }
            })
          })(o)), t),
          // 兼容 complaintApprove 审批页面路由
          H: (e.unref(f) && (e.unref(f).endsWith("/complaintApprove/Index") || e.unref(f) === "pages/complaintApprove/Index")) && 1 == o.isEdit
        }, (e.unref(f) && (e.unref(f).endsWith("/complaintApprove/Index") || e.unref(f) === "pages/complaintApprove/Index")) && 1 == o.isEdit ? {
          I: "3b978682-16-" + n + ",3b978682-7-" + n,
          J: e.p({
            size: "20",
            name: "/static/icon/refuse.png"
          }),
          K: e.o((e => E("cancel", o.id)), t),
          L: "3b978682-17-" + n + ",3b978682-7-" + n,
          M: e.p({
            size: "20",
            name: "/static/icon/agree.png"
          }),
          N: e.o((e => E("confirm", o.id)), t)
        } : {}, {
          // 兼容投诉首页路由
          O: (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index")) && "NEW" == o.caseStageCode && 1 == o.isEdit
        }, (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index")) && "NEW" == o.caseStageCode && 1 == o.isEdit ? {
          P: "3b978682-18-" + n + ",3b978682-7-" + n,
          Q: e.p({
            size: "20",
            name: "/static/icon/edit.png"
          }),
          R: e.o((a => e.unref(l).push({
            name: "complaintEdit",
            params: {
              id: o.id
            }
          })), t)
        } : {}, {
          S: "3b978682-7-" + n + ",3b978682-6",
          T: t
        }))),
        q: e.p({
          name: "arrow-right",
          size: "12"
        }),
        r: !e.unref(u).loading && (!e.unref(u).list || e.unref(u).list.length <= 0)
      }, e.unref(u).loading || e.unref(u).list && !(e.unref(u).list.length <= 0) ? {} : e.e$2({
        s: !e.unref(u).list || 0 == e.unref(u).list.length
      }, e.unref(u).list && 0 != e.unref(u).list.length ? {} : {
        t: e.p({
          text: "未找到信息",
          icon: `${o.config.static}images/empty/data.png`
        })
      }, {
        // 兼容投诉首页路由，控制添加按钮显示
        v: o.hasPermission("Complaint", "C") && (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index"))
      }, o.hasPermission("Complaint", "C") && (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index")) ? {
        w: e.p({
          size: "20",
          name: "/static/icon/btn_add_icon.png"
        }),
        x: e.o((e => z()))
      } : {}), {
        y: e.o((e => b())),
        z: e.o(h),
        A: e.unref(g),
        B: e.o(I),
        C: e.o((e => B.value = !1)),
        D: e.o((a => e.isRef(B) ? B.value = a : null)),
        E: e.p({
          color: "#849EB2",
          monthNum: "24",
          minDate: e.unref(e.dayjs)().add(-1, "year").format("YYYY-MM-DD"),
          maxDate: e.unref(e.dayjs)().add(1, "days").format("YYYY-MM-DD"),
          "confirm-disabled-text": "请选择结束时间",
          mode: "range",
          round: "10",
          closeOnClickOverlay: !0,
          show: e.unref(B)
        }),
        F: e.o(A),
        G: e.o((e => M.value = !1)),
        H: e.o((a => e.isRef(M) ? M.value = a : null)),
        I: e.p({
          title: "创建员工",
          columns: [e.unref(R)],
          keyName: "name",
          closeOnClickOverlay: !0,
          show: e.unref(M)
        }),
        J: e.o(V),
        K: e.o((e => T.value = !1)),
        L: e.o((a => e.isRef(T) ? T.value = a : null)),
        M: e.p({
          title: "请选择",
          columns: e.unref(F),
          keyName: "dname",
          closeOnClickOverlay: !0,
          show: e.unref(T)
        }),
        N: e.o((a => e.unref(D).remark = a)),
        O: e.p({
          count: !0,
          placeholder: "备注",
          modelValue: e.unref(D).remark
        }),
        P: e.p({
          label: "备注",
          prop: "info.name",
          required: !0
        }),
        Q: e.sr("form1", "3b978682-25,3b978682-24"),
        R: e.p({
          labelPosition: "top",
          labelWidth: "auto"
        }),
        S: e.o(j),
        T: e.o((e => w.value = !1)),
        U: e.o((e => w.value = !1)),
        V: e.o((a => e.isRef(w) ? w.value = a : null)),
        W: e.p({
          title: e.unref(S),
          confirmColor: "#849EB2",
          "show-cancel-button": !0,
          show: e.unref(w)
        }),
        X: e.f(o.dict.service_type, ((a, o, t) => ({
          a: "3b978682-30-" + t + ",3b978682-29",
          b: e.p({
            customStyle: {
              padding: "5px 10px"
            },
            label: a.dname,
            name: a.dval
          }),
          c: a.dval
        }))),
        Y: e.o((a => e.isRef(_) ? _.value = a : null)),
        Z: e.p({
          activeColor: "#849EB2",
          iconPlacement: "right",
          placement: "column",
          modelValue: e.unref(_)
        }),
        aa: e.o(N),
        ab: e.o((e => q.value = !1)),
        ac: e.o((e => q.value = !1)),
        ad: e.o((a => e.isRef(q) ? q.value = a : null)),
        ae: e.p({
          "before-close": P,
          title: "选择服务类型",
          "show-cancel-button": !0,
          confirmColor: "#849EB2",
          "confirm-button-text": "提交",
          show: e.unref(q)
        }),
        af: o.hasPermission("Complaint", "C") && (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index"))
      }, o.hasPermission("Complaint", "C") && (e.unref(f) && (e.unref(f).endsWith("/complaint/Index") || e.unref(f) === "pages/complaint/Index")) ? {
        ag: e.p({
          size: "20",
          name: "/static/icon/add.png"
        }),
        ah: e.o((e => z()))
      } : {})
    }
  },
  r = e._export_sfc(l, [
    ["__scopeId", "data-v-3b978682"]
  ]);
wx.createComponent(r);