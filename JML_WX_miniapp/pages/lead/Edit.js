Page({
  onLoad(options) {
    const params = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
    const url = `/business/lead/Edit?${params}`;
    wx.redirectTo({ url });
  }
})