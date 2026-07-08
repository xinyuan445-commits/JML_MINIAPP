const API_BASE = 'https://api.quanshenghuoqin.com/api/factory/natural-gas';
const legacyHttp = require('../../utils/http.js');

function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success: ({ data: result }) => {
        if (result && result.code === 0) {
          resolve(result);
        } else {
          reject(new Error((result && result.msg) || '请求失败'));
        }
      },
      fail: reject
    });
  });
}

exports.queryDevices = function () {
  return request('/device/list', 'GET', { is_enable: 1 });
};

exports.queryBeforeReading = function (deviceId) {
  return request('/before-reading', 'GET', { device_id: deviceId });
};

exports.saveNewLog = function (data) {
  return request('/save', 'POST', data);
};

exports.queryNewPage = function (data) {
  return request('/list', 'GET', data);
};

exports.queryNewDetail = function (id) {
  return request('/detail', 'GET', { id });
};

// 列表和详情暂时继续使用旧 Java API，避免扩大本次改动范围。
exports.queryDetails = function (id) {
  return legacyHttp.request({
    url: '/api/naturalGasLog/queryDetails',
    method: 'get',
    data: { id }
  });
};

exports.queryPageData = function (data) {
  return legacyHttp.request({
    url: '/api/naturalGasLog/queryPageBy',
    method: 'get',
    data
  });
};

/*
 * 旧版 Java API 调用已停用但不删除，完整页面同时保留在 *.legacy.* 文件中。
 *
 * queryBeforeLiquid: /api/naturalGasLog/queryBeforeReading
 * queryDetails / queryPageData 暂时仍在上方启用，供旧列表和详情使用。
 * saveEdit:          /api/naturalGasLog/save
 */
