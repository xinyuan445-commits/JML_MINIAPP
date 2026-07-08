// pages/complaint/Detailed.js
// 旧路径跳板页：进入后重定向到分包 complaint-package/complaint/Detailed
Page({
  onLoad(options) {
    try {
      const qs = Object.keys(options || {}).map(k => {
        const v = options[k] == null ? '' : String(options[k]);
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      }).join('&');
      const targetRel = `complaint-package/complaint/Detailed${qs ? ('?' + qs) : ''}`;
      const targetAbs = `/${targetRel}`;
      wx.redirectTo({
        url: targetRel,
        fail: () => {
          try { wx.reLaunch({ url: targetAbs }); }
          catch (_) { wx.navigateTo({ url: targetRel }); }
        }
      });
    } catch (err) {
      console.log('[Redirect Detailed] error:', err);
    }
  }
});