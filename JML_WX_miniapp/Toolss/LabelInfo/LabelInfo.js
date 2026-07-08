Page({
  data: {
    // ===== 标签解析 =====
    materialCode: '',   // 料号
    cinvname: '',       // 存货名称
    batchNo: '',
    serialNo: '',
    labelQty: null,     // 标签剩余数量

    // 最近一次标签操作信息
    lastWarehouse: '',
    lastPos: '',
    lastTime: '',
    lastUser: '',

    hasData: false,

    // ===== 库存 =====
    stockList: [],      // 库存明细（含批号）
    posSummary: []      // 已废弃，占位防止模板报错
  },

  /* ================= 工具函数 ================= */

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  /* ================= 扫码 ================= */

  scanCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode', 'barCode'],
      success: async (res) => {
        const scanResult = res.result
        const arr = scanResult.split('|')

        if (arr.length < 5) {
          wx.showToast({
            title: '标签格式不正确',
            icon: 'none'
          })
          return
        }

        const materialCode = arr[1]

        // 先清空旧数据
        this.setData({
          materialCode,
          batchNo: arr[2],
          serialNo: arr[4],
          hasData: true,

          cinvname: '',
          labelQty: null,

          lastWarehouse: '',
          lastPos: '',
          lastTime: '',
          lastUser: '',

          stockList: [],
          posSummary: []
        })

        try {
          // 1️⃣ 查标签数量 + 最近仓库货位
          await this.queryLabelQty(scanResult)
          await this.sleep(300)

          // 2️⃣ 查存货名称
          await this.queryInventoryName(materialCode)
          await this.sleep(300)

          // 3️⃣ 查库存（明细 + 批号 + 排序）
          await this.queryStock(materialCode)

        } catch (e) {
          console.error('扫码后请求失败', e)
        }
      }
    })
  },

  /* ================= 接口封装 ================= */

  // 查询存货名称
  queryInventoryName(cinvcode) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.quanshenghuoqin.com/api/query/inventory/name',
        method: 'GET',
        data: { cinvcode },
        success: (res) => {
          if (res.data.code === 0 && res.data.data) {
            this.setData({
              cinvname: res.data.data.cinvname
            })
          }
          resolve(res)
        },
        fail: reject
      })
    })
  },

  // 查询标签剩余数量 + 最近仓库货位
  queryLabelQty(traceBackCode) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.quanshenghuoqin.com/api/query/label/qty',
        method: 'GET',
        data: { traceBackCode },
        success: (res) => {
          if (res.data.code === 0 && res.data.data) {
            this.setData({
              labelQty: res.data.data.qty,
              lastWarehouse: res.data.data.warehouse || '',
              lastPos: res.data.data.cPosName || '',
              lastTime: res.data.data.last_time || '',
              lastUser: res.data.data.last_user || ''
            })
          }
          resolve(res)
        },
        fail: reject
      })
    })
  },

  queryStock(cinvcode) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.quanshenghuoqin.com/api/query/stock/by-cinvcode',
        method: 'GET',
        data: { cinvcode },
        success: (res) => {
          if (res.data.code !== 0) {
            wx.showToast({
              title: res.data.msg || '库存查询失败',
              icon: 'none'
            })
            reject(res)
            return
          }
  
          const rawList = res.data.data || []
  
          // ✅ 关键：生成“新数组 + 新对象”
          const list = rawList.map(item => ({
            ...item,
            
            iQuantity:
            
              item.iQuantity !== null &&
              item.iQuantity !== undefined &&
              item.iQuantity !== ''
                ? Number(item.iQuantity).toFixed(2)
                : '0.00'
          }))
  
          // 按货位升序
          list.sort((a, b) => {
            const posA = a.cposname || ''
            const posB = b.cposname || ''
            return posA.localeCompare(posB, 'zh-Hans-CN', { numeric: true })
          })
  
          this.setData({
            stockList: list
          })
  
          resolve(res)
        },
        fail: reject
      })
    })
  }
  
})
