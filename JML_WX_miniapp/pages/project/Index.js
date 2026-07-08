Page({
  onLoad(options) {
    const params = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
    const url = `/business/project/Index?${params}`;
    wx.redirectTo({ url });
  }
})