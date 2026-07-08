Page({
  onLoad(options) {
    const params = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
    const url = `/business/address/Detailed?${params}`;
    wx.redirectTo({ url });
  }
})
