Page({
  data: {
    mode: 'letterToNum', // 'letterToNum' | 'numToLetter'
    input: '',
    output: ''
  },

  changeMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, input: '', output: '' })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  convert() {
    const raw = (this.data.input || '')
    if (!raw) {
      wx.showToast({ title: '请输入批次号', icon: 'none' })
      return
    }

    if (this.data.mode === 'letterToNum') {
      this.setData({ output: this.letterToNum(raw) })
    } else {
      this.setData({ output: this.numToLetter(raw) })
    }
  },

  copy() {
    if (!this.data.output) return
    wx.setClipboardData({ data: this.data.output })
  },

  // --- SQL过程 lettertonum 的等价实现 ---
  // 对每个字符：取 ASCII(current) - ASCII('A') - (index-1) + 11，然后取个位
  // 注意：SP使用的是 NVARCHAR 与 RIGHT(...,1) 取最后一位
  letterToNum(str) {
    if (str == null) return ''
    let out = ''
    for (let i = 0; i < str.length; i++) {
      const ch = str[i]
      const code = ch.charCodeAt(0)
      const offset = code - 'A'.charCodeAt(0) - i + 11
      const lastDigit = String(offset).slice(-1) // 模拟 RIGHT(x,1)
      out += lastDigit
    }
    return out
  },

  // --- SQL过程 numtoletter 的等价实现 ---
  // 规则：
  // - 若出现中文(U+4E00~U+9FA5)则返回空
  // - 字母：大写 -> 小写， 小写 -> 保持不变
  // - '-' 原样保留
  // - 数字：映射为 CHAR(ASCII('A') + ( RIGHT(n+10-1,1) ) + (index-1))
  numToLetter(str) {
    let out = ''
    for (let i = 0; i < str.length; i++) {
      const ch = str[i]
      const code = ch.charCodeAt(0)
      // 中文检测
      if (code >= 0x4e00 && code <= 0x9fa5) return ''

      // 保留与大小写处理
      if (/[A-Z]/.test(ch)) { out += ch.toLowerCase(); continue }
      if (/[a-z]/.test(ch)) { out += ch; continue }
      if (ch === '-') { out += ch; continue }

      if (/[0-9]/.test(ch)) {
        const n = parseInt(ch, 10)
        // SQL: RIGHT(n+10-1,1) 等价于 (n+9)%10
        const last = (n + 9) % 10
        const base = 'A'.charCodeAt(0)
        const mapped = String.fromCharCode(base + last + (i))
        out += mapped
        continue
      }
    }
    return out
  }
})