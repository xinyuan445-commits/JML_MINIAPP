# 液氮日志注意事项提示功能方案

## 需求分析
用户需要在液氮日志列表页的筛选栏（与“员工”、“日期”筛选同一行）添加一个提示图标。
- **样式**：圆形图标，中间带有感叹号（ℹ️ 或 ❕）。
- **交互**：点击图标弹出“注意事项”提示框。
- **内容**：
  > 每天10点前，充氮气前抄表一次，充氮气后抄表一次。
  *(注：用户原文为“超标”，结合语境推测应为“抄表”)*

## 技术方案

### 1. 组件选型
- **图标**：使用 `u-icon` 组件，名称为 `info-circle` 或 `info-circle-fill`，颜色建议使用主题色或醒目的灰色（如 `#2979ff` 或 `#909399`）。
- **弹窗**：使用 `uni.showModal`（原生模态框）或 `u-modal`（uView 模态框）来展示提示内容。考虑到代码中已经引入了 `uview-plus`，使用原生 `uni.showModal` 最为轻量快捷，或者如果项目中已有统一弹窗风格，可以使用 `u-modal`。本方案优先推荐使用原生 `uni.showModal` 以减少代码侵入。

### 2. 代码修改位置

#### A. 视图层 (`Index.wxml`)
在筛选工具栏区域 (`.card_tool .tool`) 中，紧随“日期选择器”之后添加提示图标。

**定位代码片段**：
```html
<view class="item data-v-437c320d">
  <uni-datetime-picker ...>...</uni-datetime-picker>
</view>
<!-- 在此处添加新图标 -->
```

**新增代码**：
```html
<view class="item data-v-437c320d" bindtap="{{showTips}}" style="margin-left: 10px;">
  <u-icon name="info-circle" size="20" color="#2979ff"></u-icon>
</view>
```

#### B. 逻辑层 (`Index.js`)
在 `setup` 函数中添加 `showTips` 方法。

**新增代码**：
```javascript
const showTips = () => {
  e.showModal({
    title: '注意事项',
    content: '每天10点前，充氮气前抄表一次，充氮气后抄表一次',
    showCancel: false,
    confirmText: '知道了'
  });
};
```
*(注：`e` 在压缩代码中通常代表 `uni` 或 `common/vendor.js` 的引用，需根据上下文确认具体变量名，通常源码中直接用 `uni.showModal` 即可)*

### 3. 样式调整 (`Index.wxss`)
如果新增的图标位置拥挤或对齐有问题，可能需要微调 `.card_tool .tool .item` 的 margin 或 flex 布局。目前看已有样式 `margin-right: 10px`，直接添加应该问题不大。

## 预期效果
1.  在筛选栏最右侧（或日期选择器旁）出现一个蓝色的感叹号图标。
2.  点击图标，屏幕中央弹出标准对话框，显示指定文本。
3.  用户点击“知道了”关闭弹窗。
