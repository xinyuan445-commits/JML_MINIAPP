# 液氮日志编辑页文案与逻辑优化计划

## 1. 任务概述
本计划旨在优化液氮日志编辑页 (`Edit`) 的界面文案及数据显示逻辑。主要包括将“今日”相关文案调整为“本次”，并根据耗用量的正负情况动态调整“上一次液位耗用量”的显示文案及数值（取绝对值显示）。

## 2. 涉及文件
- `factory/pages/nitrogenLog/Edit.js` (逻辑层)
- `factory/pages/nitrogenLog/Edit.wxml` (视图层)
- `factory/pages/nitrogenLog/Edit.json` (配置，预计无需修改)
- `factory/pages/nitrogenLog/Edit.wxss` (样式，预计无需修改)

## 3. 具体修改计划

### 3.1 视图层修改 (`Edit.wxml`)

#### 3.1.1 静态文案替换
- 查找并替换：`今日液位示数` -> `本次液位示数`
- 查找并替换：`今日液位示数照片` -> `本次液位示数照片`

#### 3.1.2 动态字段绑定
- 将写死的“上一次液位耗用量（单位：cmH2O）”文案替换为动态字段 `{{label_usage_text_cm}}`。
- 将写死的“上一次液位耗用量（单位：KG）”文案替换为动态字段 `{{label_usage_text_kg}}`。
- 将显示的耗用量数值字段绑定调整为绝对值显示字段（需在 JS 中计算，例如 `absBeforeUsageCm` 和 `absBeforeUsageKg`）。

### 3.2 逻辑层修改 (`Edit.js`)

#### 3.2.1 新增计算属性/监听逻辑
在 `setup` 函数中，需要对 `beforeUsageCm` (耗用厘米) 和 `beforeUsageKg` (耗用千克) 进行监听或计算，生成以下用于显示的字段：

1.  **`absBeforeUsageCm`**: `Math.abs(p.value.beforeUsageCm)` —— 用于显示 cm 绝对值。
2.  **`absBeforeUsageKg`**: `Math.abs(p.value.beforeUsageKg)` —— 用于显示 kg 绝对值。
3.  **`label_usage_text_cm`**:
    - 若 `beforeUsageCm < 0`: 显示 "本次液位充气量（单位：cmH2O）"
    - 若 `beforeUsageCm >= 0`: 显示 "本次液位耗用量（单位：cmH2O）"
4.  **`label_usage_text_kg`**:
    - 若 `beforeUsageKg < 0`: 显示 "本次液位充气量（单位：KG）"
    - 若 `beforeUsageKg >= 0`: 显示 "本次液位耗用量（单位：KG）"

#### 3.2.2 现有 `watch` 逻辑增强
现有的 `watch` 逻辑：
```javascript
e.watch((()=>p.value.liquidLevel),((e,o)=>{
    if(e){
        let o=p.value.beforeLiquidLevel>0?p.value.beforeLiquidLevel-e:0;
        p.value.beforeUsageCm=o,
        p.value.beforeUsageKg=parseFloat((47.297*o).toFixed(4))
    }
}),{deep:!1,immediate:!1});
```
需要确保当 `beforeUsageCm` 和 `beforeUsageKg` 更新时，上述新增的显示字段也能同步更新。由于 JS 代码经过混淆压缩，建议使用 `computed` (如果引入了) 或者在 `watch` 回调中直接更新这些显示用的响应式变量。

考虑到代码结构，可以在 `setup` 返回对象中直接添加计算逻辑，或者在模板渲染时进行三元运算（如果逻辑简单）。但为了保持清晰，建议在 JS 中处理好。

**拟定 JS 修改方案**：
在返回给模板的对象中，增加动态计算的属性。例如：
```javascript
// 假设 p 是响应式数据对象
// 在 return 之前或 return 对象中
const renderData = {
    // ... 原有字段
    usageCmLabel: p.value.beforeUsageCm < 0 ? "本次液位充气量" : "本次液位耗用量",
    usageKgLabel: p.value.beforeUsageCm < 0 ? "本次液位充气量" : "本次液位耗用量",
    displayUsageCm: Math.abs(p.value.beforeUsageCm),
    displayUsageKg: Math.abs(p.value.beforeUsageKg),
};
```
*注意：由于原文件是压缩格式，直接插入复杂逻辑可能较难，我们将尝试在 `return` 语句的渲染函数中注入这些逻辑。*

## 4. 验证步骤
1.  进入编辑页，输入一个比“上一次液位”大的值（模拟充气，耗用量为负）。
    -   检查文案是否变为“本次液位充气量”。
    -   检查数值是否显示为正数。
2.  输入一个比“上一次液位”小的值（模拟正常耗用）。
    -   检查文案是否为“本次液位耗用量”。
    -   检查数值是否显示为正数。
3.  检查“本次液位示数”和“本次液位示数照片”文案是否正确替换。

## 5. 待确认事项
- 用户的原话是“上次液位耗用量改成本次液位充气量”，我理解为“上一次”这个定语也要改成“本次”。根据上下文，这是合理的。
- 括号内的单位是否保留？用户说“括号的部分不变”，所以 `(单位：cmH2O)` 和 `(单位：KG)` 应当保留。

---
请确认此计划是否符合您的预期。
