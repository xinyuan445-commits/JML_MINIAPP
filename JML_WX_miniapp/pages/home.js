"use strict";
const o=require("../common/vendor.js"),u8=require("../utils/u8.js");
Math||(e+n)();
const e=()=>"./factoryUserHome.js",n=()=>"./userHome.js",
r=o.defineComponent({__name:"home",setup:e=>(o.onShow(()=>{console.log("onShow"),o.index.$off()}),
o.onMounted(async()=>{const t=wx.getStorageSync("userStore")||"{}";let r="";
try{r=JSON.parse(t).userId||""}catch(o){console.error("解析 userStore 出错:",o)}
if(["a0L2w000005bTiFEAU","a0L2w000005bTIREA2","a0L2w000005bTNHEA2"].includes(r))
try{const{id:o,expiresAt:e}=await u8.getU8Token();console.log("U8 token id =",o,"expiresAt =",new Date(e).toISOString())}
catch(o){console.error("获取U8 token失败：",o),o.index.showToast({title:"U8获取失败",icon:"none"})}}),
o.onMounted(()=>{}),(e,n)=>{var r,t;return o.e$2({a:1==(null==(r=e.userInfo)?void 0:r.isFactory)},(null==(t=e.userInfo)||t.isFactory,{}))})});
wx.createPage(r);
