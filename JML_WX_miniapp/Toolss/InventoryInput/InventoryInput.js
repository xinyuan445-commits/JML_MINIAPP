// 你的真实接口（支持 ?sql=xxx）
const BASE_URL = 'https://api.quanshenghuoqin.com/api/query/run';

const INSERT_URL = "https://api.quanshenghuoqin.com/api/query/insert"

Page({
  data: {
    form: {
      itemCode: '',
      qty: '',
      batchNo: '',
      inputHistory: [],   // ⭐ 新增：当天输入记录

      binLoc: ''
    },

    // 查询/选择器状态
    searching: false,
    selectorVisible: false,
    selectorList: [], // 已加载的结果
    loadingMore: false,
    noMore: false,
    totalCount: 0, // 如果后端不返回总数，就显示“已加载条数”
    _searchTokens: [], // 当前查询关键词
    _page: 0,
    _pageSize: 50,
    stockList: [],
    stockLoading: false,
    stockLoaded: false,   // 表示加载完成过（用来显示“无数据”）
    _stockTimer: null     // 防抖定时器
  },


  onLongPressDelete(e) {
    const id = e.currentTarget.dataset.id;
    console.log(id)
  
    wx.showModal({
      title: "删除确认",
      content: "确定要删除此条记录吗？",
      success: (res) => {
        if (res.confirm) {
          this.doDeleteRecord(id);  // 调用软删除方法
        }
      }
    });
  },

  doDeleteRecord(id) {
    wx.request({
      url: `https://api.quanshenghuoqin.com/api/query/checkvouch/delete?id=${id}`,
      method: "DELETE",
      success: (res) => {
        if (res.data.code === 0) {
          wx.showToast({ title: "删除成功", icon: "success" });
  
          // 删除后刷新列表
          this.loadInputHistory();
        } else {
          wx.showToast({ title: res.data.msg || "删除失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "网络错误", icon: "none" });
      }
    });
  },
  
  


  
// =========================
// ⭐ 加载今日输入记录（新增功能）
// =========================
loadInputHistory() {
  const pos = this.data.form.binLoc;
  if (!pos) return; // 未填货位则不查询

  // 今日日期
  const date = new Date().toISOString().split("T")[0];

  // 获取 userId
  let userId = "";
  try {
    const userObj = JSON.parse(wx.getStorageSync("userStore") || "{}");
    userId = userObj.userId || "";
  } catch (e) {}

  if (!userId) return;

  wx.request({
    url: "https://api.quanshenghuoqin.com/api/query/checkvouch",
    method: "GET",
    data: {
      date,
      userId,
      pos,
      page: 1,
      pageSize: 200
    },
    success: (res) => {
      if (res.data.code !== 0) return;

      const list = res.data.data.map(item => ({
        ...item,
        qty_fmt: Number(item.qty).toFixed(2),
        time_fmt: this.formatDateTime(item.createtime)
      }));

      // 按 id 降序排
      list.sort((a,b) => b.id - a.id);

      this.setData({ inputHistory: list });
    }
  });
},

// 时间格式化
formatDateTime(str) {
  if (!str) return "";
  const d = new Date(str.replace(/-/g, "/"));
  const p = n => (n < 10 ? "0" + n : n);
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} `
       + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
},

  // 提交
  onSubmit() {
    const {
      itemCode,
      qty,
      batchNo,
      binLoc
    } = this.data.form

    // 必填校验：四个输入框都不能为空
    if (!itemCode) {
      wx.showToast({
        title: '请填写料号',
        icon: 'none'
      })
      return
    }
    if (!qty) {
      wx.showToast({
        title: '请填写数量',
        icon: 'none'
      })
      return
    }
    if (!batchNo) {
      wx.showToast({
        title: '请填写批号',
        icon: 'none'
      })
      return
    }
    if (!binLoc) {
      wx.showToast({
        title: '请填写货位',
        icon: 'none'
      })
      return
    }

    // 从缓存取字符串
    const userStr = wx.getStorageSync("userStore") || "{}"

    let userId = ""
    try {
      const userObj = JSON.parse(userStr) // 解析成对象
      userId = userObj.userId || "" // 取 userId
    } catch (e) {
      console.error("解析 userStore 出错:", e)
    }






    const payload = {
      table: "Checkvouch",
      values: {
        cinvcode: itemCode,
        cbatch: batchNo,
        cposname: binLoc,
        qty: Number(qty),
        user: userId
      }
    }

    // console.log("提交数据:", payload)

    wx.request({
      url: "https://api.quanshenghuoqin.com/api/query/insert",
      method: "POST",
      header: {
        "Content-Type": "application/json"
      },
      data: payload,
      success: (res) => {
        // console.log("返回:", res.data)
        if (res.statusCode === 200 && res.data.code === 0) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          })
          // 清空数量输入框
          this.setData({
            'form.qty': ''
          })
              // ⭐ 新增：提交成功后刷新历史记录
    this.loadInputHistory();
        } else {
          wx.showToast({
            title: res.data.msg || '提交失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error("提交失败:", err)
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    })
  },

  // ========== 输入绑定 ==========
  // 关键：不再 trim，保留用户中间的空格（便于分词）
  onItemCodeInput(e) {
    this.setData({
      'form.itemCode': e.detail.value
    });
    this._maybeLoadStock();     // ← 新增
  },
  onQtyInput(e) {
    this.setData({
      'form.qty': e.detail.value.replace(/[^\d.]/g, '')
    });
  },
  onQtyBlur() {
    const v = this.data.form.qty;
    this.setData({
      'form.qty': fix2(v)
    });
  },
  onBatchInput(e) {
    this.setData({
      'form.batchNo': e.detail.value
    });
    this._maybeLoadStock();     // ← 新增
  },
  onLocInput(e) {
    this.setData({
      'form.binLoc': e.detail.value
    });
    
    // ⭐ 新增：货位改变时自动加载历史记录
    this.loadInputHistory();
  },

  // ========== 清空 ==========
  onReset() {
    this.setData({
      form: {
        itemCode: '',
        qty: '',
        batchNo: '',
        binLoc: ''
      },
      selectorList: [],
      selectorVisible: false,
      loadingMore: false,
      noMore: false,
      totalCount: 0,
      _searchTokens: [],
      _page: 0,
      stockList: [], stockLoading: false, stockLoaded: false
    });
  },

  // 只要料号和批号都有值，就触发库存查询（400ms 防抖）
_maybeLoadStock() {
  const { itemCode, batchNo } = this.data.form;
  // 任何一个为空，就清空显示并跳出
  if (!itemCode || !batchNo) {
    this.setData({ stockList: [], stockLoading: false, stockLoaded: false });
    if (this._stockTimer) clearTimeout(this._stockTimer);
    return;
  }
  if (this._stockTimer) clearTimeout(this._stockTimer);
  this._stockTimer = setTimeout(() => {
    // this._fetchStock(itemCode,batchNo);
  }, 400);
},

// // 实际请求库存
// _fetchStock(cinvcode, cbatch) {
//   this.setData({ stockLoading: true, stockLoaded: false });
//   wx.request({
//     url: 'https://api.quanshenghuoqin.com/api/query/stock',
//     method: 'GET',
//     data: { cinvcode, cbatch },   // 必填两参
//     timeout: 15000,
//     success: (res) => {
//       const ok = res.statusCode === 200 && res.data && res.data.code === 0;
//       const list = ok && Array.isArray(res.data.data) ? res.data.data : [];
//       this.setData({
//         stockList: list,
//         stockLoading: false,
//         stockLoaded: true
//       });
//       if (!ok) {
//         wx.showToast({ title: res.data?.msg || '库存查询失败', icon: 'none' });
//       }
//     },
//     fail: (err) => {
//       console.error('库存查询失败：', err);
//       this.setData({
//         stockList: [],
//         stockLoading: false,
//         stockLoaded: true
//       });
//       wx.showToast({ title: '库存查询失败', icon: 'none' });
//     }
//   });
// },
// 跳转到输入数据界面，并携带 userId
goToInputDataPage() {
  const userStr = wx.getStorageSync("userStore") || "{}";
  let userId = "";

  try {
    const userObj = JSON.parse(userStr);
    userId = userObj.userId || "";
  } catch (e) {
    console.error("解析 userStore 出错:", e);
  }

  wx.navigateTo({
    url: `/Toolss/InventoryInput_data/InventoryInput_data?userId=${encodeURIComponent(userId)}`
  });
},


  // 你提供的转换逻辑，稍微增强：自动大写、空值兜底
  letterToNum(str) {
    if (str == null) return '';
    const s = String(str).toUpperCase();
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const code = ch.charCodeAt(0);
      const offset = code - 'A'.charCodeAt(0) - i + 11;
      const lastDigit = String(offset).slice(-1);
      out += lastDigit;
    }
    return out;
  },

  // 点击“转换”按钮
  onConvertBatch() {
    const src = this.data.form.batchNo || '';
    if (!src) {
      wx.showToast({
        title: '请先输入批号',
        icon: 'none'
      });
      return;
    }
    const converted = this.letterToNum(src);
    this.setData({
      'form.batchNo': converted
    }); // 回写到同一输入框
    wx.showToast({
      title: '已转换',
      icon: 'success',
      duration: 800
    });
    this._maybeLoadStock();      // 转换后自动刷新
  },





  // ========== 空格/逗号分词 + OR 模糊查询 ==========
  async onSearchItemCode() {
    const raw = (this.data.form.itemCode || '');
    // 支持：半/全角空格、逗号、顿号作为分隔；过滤空串
    const tokens = raw.split(/[ \u3000,，、]+/).map(s => s.trim()).filter(Boolean);
    if (!tokens.length) {
      wx.showToast({
        title: '请先输入料号关键词',
        icon: 'none'
      });
      return;
    }

    // 初始化分页
    this.setData({
      searching: true,
      selectorVisible: true,
      selectorList: [],
      loadingMore: false,
      noMore: false,
      totalCount: 0,
      _searchTokens: tokens,
      _page: 0
    });

    wx.showLoading({
      title: '查询中...',
      mask: true
    });
    try {
      await this._fetchPage(0); // 拉取第1页
    } catch (err) {
      console.error('查询失败:', err);
      wx.showToast({
        title: '查询失败，请检查网络/接口',
        icon: 'none'
      });
      this.setData({
        selectorVisible: false
      });
    } finally {
      this.setData({
        searching: false
      });
      wx.hideLoading();
    }
  },

  // 下一页
  async loadMore() {
    if (this.data.noMore || this.data.loadingMore) return;
    const next = this.data._page + 1;
    this.setData({
      loadingMore: true
    });
    try {
      await this._fetchPage(next);
    } catch (e) {
      console.error('加载更多失败:', e);
      wx.showToast({
        title: '加载更多失败',
        icon: 'none'
      });
    } finally {
      this.setData({
        loadingMore: false
      });
    }
  },

  // 关闭选择器
  closeSelector() {
    this.setData({
      selectorVisible: false
    });
  },

  // 选择某一项并回填
  pickItem(e) {
    const code = e.currentTarget.dataset.code || '';
    if (!code) return;
  
    this.setData({
      'form.itemCode': code,
      selectorVisible: false
    }, () => {
      // 用回调保证拿到的是最新的 form.itemCode
      this._maybeLoadStock();
    });
  },
  

  // 拦截遮罩层滚动穿透
  noop() {},

  /** ===== Page 内部：分页查询一页 ===== */
  async _fetchPage(page) {
    const tokens = this.data._searchTokens;
    const size = this.data._pageSize;

    const {
      main,
      count
    } = buildSql(tokens, page, size);

    // 并发尝试拿数据与总数（如果 count 报错也不影响主列表）
    const [rowsRes, totalRes] = await Promise.allSettled([
      requestSql(main),
      requestSql(count)
    ]);

    const rows = rowsRes.status === 'fulfilled' ? rowsRes.value : [];
    const mapped = rows.map(r => ({
      code: r.cinvcode || r.code || '',
      name: r.cinvname || r.name || ''
    })).filter(x => x.code);

    let total = this.data.totalCount || 0;
    if (totalRes.status === 'fulfilled' && totalRes.value[0] && totalRes.value[0].total != null) {
      total = Number(totalRes.value[0].total) || mapped.length;
    }

    const newList = (page === 0 ? [] : this.data.selectorList).concat(mapped);
    const noMore = mapped.length < size || (total > 0 && newList.length >= total);

    this.setData({
      selectorList: newList,
      _page: page,
      totalCount: total || newList.length, // 若拿不到总数，用当前已加载数兜底
      noMore
    });
  }
});

/** ===== 构造 SQL（OR 模糊 + 分页） ===== */
function buildSql(tokens, page, pageSize) {
  // 基础转义：把单引号变成俩，避免断句；生产建议后端参数化！
  const safe = (s) => s.replace(/'/g, "''");

  // OR 拼接
  const where = tokens.map(k => `cinvcode LIKE '%${safe(k)}%'`).join(' and ');
  const offset = page * pageSize;

  const main = `SELECT cinvcode, cinvname FROM inventory WHERE ${where} ORDER BY cinvcode ASC LIMIT ${offset}, ${pageSize}`;
  console.log(main)
  const count = `SELECT COUNT(1) AS total FROM inventory WHERE ${where}`;
  return {
    main,
    count
  };
}

/** ===== 发起请求，兼容多种返回结构 ===== */
function requestSql(sql) {
  const url = `${BASE_URL}?sql=${encodeURIComponent(sql)}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 15000,
      success: (res) => {
        const d = res.data;
        const rows = Array.isArray(d) ? d :
          Array.isArray(d?.data) ? d.data :
          Array.isArray(d?.rows) ? d.rows : [];
        resolve(rows);
      },
      fail: reject
    });
  });
}

/** ===== 小工具：两位小数 ===== */
function fix2(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

