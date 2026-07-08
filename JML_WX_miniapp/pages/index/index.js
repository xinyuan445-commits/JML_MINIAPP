"use strict";
const e = require("../../common/vendor.js"),
  n = e.defineComponent({
    __name: "index",
    setup(n) {
      const o = e.ref("Hello");
      let t = e.j();
      return console.log(t), (n, t) => ({
        a: e.t(o.value)
      })
    }
  });
wx.createPage(n);