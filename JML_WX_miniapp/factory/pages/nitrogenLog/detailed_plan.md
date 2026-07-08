# 液氮日志详情页字段显示逻辑优化方案

## 需求背景
在液氮日志详情页中，当前显示为“上一次液位耗用量”。用户希望根据数值的正负情况，动态调整显示的文案，并确保数值始终为正数。

## 需求详情
针对以下两个字段：
1.  **上一次液位耗用量(单付cmH20)**
2.  **上一次液位耗用量(单位KG)**

**判断逻辑：**
- **如果值为负数**：
    - 文案修改为：“本次液位充气量” + 原有单位后缀。
    - 数值显示为：绝对值（正数）。
- **如果值为非负数（正数或0）**：
    - 文案修改为：“本次液位耗用量” + 原有单位后缀。
    - 数值显示为：原值（正数）。

*(注：原代码中字段名为 `beforeUsageCm` 和 `beforeUsageKg`，文案为“上一次液位耗用量”，根据需求统一调整为“本次...”。)*

## 技术方案

### 1. 逻辑层 (`Detailed.js`)
在数据映射部分（`setup` 函数的返回对象中），增加动态计算的字段。

**当前代码片段**：
```javascript
{
  f: e.t(s.value.beforeUsageCm),
  g: e.t(s.value.beforeUsageKg),
  // ...
}
```

**修改后代码逻辑**：
我们需要计算以下新属性：
- `f`: `Math.abs(s.value.beforeUsageCm)` （绝对值）
- `g`: `Math.abs(s.value.beforeUsageKg)` （绝对值）
- `label_usage_text`: 根据 `beforeUsageCm < 0` 判断，返回 `"本次液位充气量"` 或 `"本次液位耗用量"`。

**具体实现**：
```javascript
// 在返回对象中
{
  // ...
  f: e.t(Math.abs(s.value.beforeUsageCm)),
  g: e.t(Math.abs(s.value.beforeUsageKg)),
  label_usage_text: s.value.beforeUsageCm < 0 ? "本次液位充气量" : "本次液位耗用量",
  // ...
}
```

### 2. 视图层 (`Detailed.wxml`)
修改 WXML 中的静态文案为动态绑定。

**修改前**：
```html
<view class="item">
  <view class="left">上一次液位耗用量(单付cmH20)</view>
  <view class="rigth">{{f}} cmH2O</view>
</view>
<view class="item">
  <view class="left">上一次液位耗用量(单位KG)</view>
  <view class="rigth">{{g}} KG</view>
</view>
```

**修改后**：
```html
<view class="item">
  <view class="left">{{label_usage_text}}(单付cmH20)</view>
  <view class="rigth">{{f}} cmH2O</view>
</view>
<view class="item">
  <view class="left">{{label_usage_text}}(单位KG)</view>
  <view class="rigth">{{g}} KG</view>
</view>
```
*(注：原代码中单位写的是 `单付cmH20`，可能是“单位”的笔误，若用户未提及修改错别字，暂保持原样或顺手修正为“单位”。根据用户指令“括号的部分不变”，则保持 `(单付cmH20)` 不变。)*

## 预期效果
- 当 `beforeUsageCm` 为 -10 时：
    - 显示：**本次液位充气量(单付cmH20)**  数值：**10 cmH2O**
    - 显示：**本次液位充气量(单位KG)**     数值：**对应KG绝对值**
- 当 `beforeUsageCm` 为 10 时：
    - 显示：**本次液位耗用量(单付cmH20)**  数值：**10 cmH2O**
    - 显示：**本次液位耗用量(单位KG)**     数值：**对应KG正数**
