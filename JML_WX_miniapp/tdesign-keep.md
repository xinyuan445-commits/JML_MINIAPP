# TDesign 保留清单（共 28 个）

每次「构建 npm」后，删除路径：
`miniprogram_npm/tdesign-miniprogram/` 下不在以下列表的目录全部删掉。

## 保留目录

### 页面直接使用
button, cell, cell-group, collapse, collapse-panel, divider,
dropdown-item, dropdown-menu, empty, fab, icon, input, loading,
popup, pull-down-refresh, radio, radio-group, search, step-item,
steps, tag

### 内部依赖（不可删）
checkbox（dropdown-item 内部依赖）,
common, image, miniprogram_npm, mixins, overlay
