# 小程序报工、报表与看板后端

更新：2026-10-27。总交接见[工序管理交接](../../../docs/工序管理交接20261022.md)。本服务源码位于 `JML_MINIAPP/pthonapi`，管理后台后端则位于 `jml_admin/webapi`，不要混用。

## 接口与代码

统一前缀 `/api/mo`，路由在 `routes/mo_reporting.py`，由 `app.py` 注册。

| 方法/路径 | 用途 |
| --- | --- |
| GET `/reporting/access` | 当前员工能否查看报表入口，响应禁止缓存 |
| GET `/reporting/records` | 真实完工批次列表，分页20条；支持 `process` 工序筛选并返回当前范围的工序选项 |
| GET `/reporting/summary` | 日期范围汇总、质量比例、工序组合图 |
| GET `/reporting/board` | 权限过滤后的工序流转矩阵及首站实时领料 |
| GET `/reporting/detail` | 复用详情结构，读取指定批次 |
| GET `/reporting/label` | 指定批次标签兼容接口 |
| GET `/reporting/latest-label` | 当前工序最新实际完工标签 |
| POST `/reporting/print-log` | 成功打印记录及权限复核 |
| POST `/reporting/label-pdf` | 流转标签PDF |

- `services/mo_reporting_summary.py`：纯汇总；新增质量和组合图字段，保留旧 `normal_count/rework_count/c_ratio/grades/processes/trend` 字段。
- `services/mo_reporting_board.py`：读取ERP开放工单、按权限读取材料及脱敏。
- `services/mo_dashboard_snapshot.py`：后台数量模型本地镜像；新增首站字段，不依赖运行中的后台Python模块。
- `services/mo_station_access.py`：已有工站策略与员工检查。
- `services/mo_workorder_context.py`：工单产品、客户和计划资料缓存；实时首站领料不复用旧余额缓存。

## 身份与范围

请求用 `staff-id` 携带 `jml_staff.id`；存在辅助 `user_id` 时必须一致。后端重新读取员工状态与工站策略，不信任前端直接指定“查看全部”。

- 限制开启且豁免：全部。
- 限制开启且有线长、扫码或有效代班绑定：获授权工站并集。
- 其他报工查询范围：本人提交。

正常和返工SQL均加范围条件；详情、标签、打印也重查权限。看板非授权格不返回数量、人员及时间；本人范围不返回同事累计量或ERP余额。此为沿用客户端员工ID的业务权限模型，不等于新增防伪认证。参与人员使用另存的工作快照，不决定登录人的权限。

生产现场看板以ERP开放接口返回的已审核/已下达且未关闭工单行为底表，并返回计划数量、当前计划开工 `StartDate_c`、当前计划完工 `DueDate_c`，以及MOAPI从现有 `YX_TEST.dbo.mom_morder` 最早快照读取的 `original_start_date`、`original_due_date`；原日期与当前日期相同时不返回显示值。没有本地接收、执行或交接记录的行，通过临时状态加入快照并返回 `has_reporting=false`；路线优先取工单绑定，其次按产品类别匹配。全部范围可查看全部未报工开放行，工站范围只查看路线配置到授权工站的工序，本人范围不新增无本人报工的行。首站材料改由MOAPI批量接口一次查询，未报工工单也参与BOM领料折算，不再因逐单查询保护而固定显示未开工。

逾期按北京时间自然日判断，计划完工日早于当天且仍有待处理任务才标记逾期。计划日期保留 ERP 日历日期，有变更的原日期以灰色小字显示在对应当前日期下方。小程序列表仅显示 ERP 确认未关闭的工单行。

拼皮线（ERP 部门 `04125`）首站仅合计同工单行的拼皮木皮（`4402` 开头），应领及已领量统一按平方米。按总领料比例折算为张数，折算量可以超过计划量，再扣累计接收。看板和首次、追加接收共用 MOAPI 的实领折算基准，缺失有效应领面积时显示待核对。该规则依赖新版 MOAPI 明细及批量接口。

2026-11-16 已上线 MOAPI 与 PythonAPI。使用正式 ERP 和报工数据只读核对 `SCDD26113170` 第 1 行，应领 600 ㎡、已领 872.99 ㎡、计划 150 张、累计已接收 0 张，首站接收基准和小程序看板均为 218.2475 张。发布验收未写入报工记录，小程序前端由用户上传验收。

仅当ERP生产部门名称精确等于“拼皮线”时，看板允许把外部生产事实补成正式报工记录：先查询现有 `mo_execution_yx`/交接记录，人工记录存在时完全跳过；没有记录且YX_TEST存在裁切记录时，以最早 `MupiMaterialIssueItem_yx.CreatedAtUtc+8小时` 作为开工时间；U8存在已审核产成品入库时，以累计正数 `rdall_yx.iQuantity` 作为完工数量并全部记入A，以最后 `COALESCE(dnverifytime,dVeriDate)` 作为完工时间。自动记录使用固定系统操作人和 `panel-sync:*` 操作日志标识，后续只增补系统自动记录，检测到人工完工批次后停止自动更新。其他部门、无裁切记录、非单工序路线均不写入。

看板工序快照返回 `normal_done_qty`及 `qty_a/qty_a1/qty_a2/qty_c`，小程序详情以五格显示累计正常完工合计和各等级。返工不计入这组数量；本人范围不返回全工站等级明细。

报表页面开放模式读取 `mo_station_access_setting_yx.report_access_mode`：`exempt` 只允许豁免人员，`station` 允许豁免、线长、扫码人员及有效代理，`all` 允许所有有效员工。管理后台工站权限页保存后，小程序通过 `/reporting/access` 动态显示入口，`/reporting/summary` 与 `/reporting/board` 再次强制校验；PythonAPI每次请求读取数据库，因此切换后无需重启服务，也不需要修改或重新上传小程序。开放模式只决定能否进入报表，返回数据仍按上面的全部、工站或本人范围过滤。`/reporting/records` 等报工记录接口不受这个页面开放开关影响。

## 统计口径

正常批次来自 `mo_execution_completion_yx`，返工批次来自 `mo_rework_completion_yx`，关联 `mo_execution_yx/mo_rework_yx`。

完工质量报告规则：每次提交只要 A1、A2、C 任一数量大于0，必须现场拍摄1至2张质量报告单；本次全部为A时不要求。普通完工、追加接收完工、返工完工和组合完工使用同一规则，组合完工整次提交共用最多2张。照片数组写入两张批次表的 `quality_report_photo_urls`，原 `photo_url` 和请求字段 `complete_photo_url` 暂时保留兼容历史版本。

- 日期按实际批次完工时间，查询含开始日、不含结束日次日。
- 完成数量仅正常 `qty_done` 汇总；返工不重复计产出。
- A为良品；A1+A2+C为不良。不良率各用正常完成量作分母；无分母返回null。
- 计划依据范围内正常完工涉及的 `(mo_code,sort_seq,route_id,seq)` 唯一组合，读取 `mo_workorder_context_yx.plan_qty` 后求和。分批不重复，但不同工序各计一份计划。
- 同工单行计划100、两个工序报工，顶部计划为200。按工单行去重的顶部计划尚未实现，不能误写成已完成。
- 缺计划返回null，不以0代替。工单数量按有正常或返工完工的 `mo_code` 去重。
- 拼皮线自动补录在同一事务内补存有效的 ERP 计划量。已有自动报工即使没有新增完工，也会在后续同步时补齐缺失快照，已有计划量保留。ERP 未提供有效计划量时留待后续同步。
- 2026-11-09 已从 ERP 补齐四条拼皮线历史工单的计划快照，均为第 1 行：`SCDD26113147` 230、`SCDD26103093` 300、`SCDD26103115` 151、`SCDD26103117` 300。用真实数据按全部工站验证，近 7 天与近 14 天的计划总量均正常返回。

## 首站领料：只读补充

从原 `routes.mo` 复用纯函数 `_summarize_first_step_materials`，不得调用会补写上下文的 `_fetch_workorder_detail`。这些报表/看板调整没有修改原接收处理逻辑。

无1、2、31前缀受控材料而按全部BOM比例折算时，PythonAPI同时返回决定最低领料比例的物料号、应领、已领、比例及物料行数。小程序看板在工序详情中将换算后的“可接收”显示为可点击数量，点击弹出“计划数量×最低领料比例=折算领料；折算领料−累计接收=可接收”的真实公式。受控材料直接汇总的记录不显示比例公式。

使用现有ERP明细服务。存在料号前缀1、2、31的子件时继续沿用原汇总规则；没有这些子件时，按全部正数应领材料的 `已领数量÷应领数量×工单计划数量` 折算，多种材料取最小值并封顶到计划数量。没有有效材料明细或ERP读取失败时看板保持未知，首工序接收不自动放行。看板、工单详情和首工序接收共同复用 `_summarize_first_step_materials`，避免显示与实际校验口径不一致。

累计接收 = 交接累计数量 + 进行中追加接收数量；已完成追加接收已入交接累计，不再相加。

可再接收 = max(0, ERP已领数量 − 累计接收)，不扣完工量，也不额外扣返工。

从「报工」打开已有接收记录的首工序详情时，也实时读取 ERP 领料并返回剩余可接收数量。ERP 查询失败时沿用原交接快照。报工详情只读，不写入工单上下文或交接记录。

只请求ERP确认开放且当前账号可查看首站的工单。优先通过MOAPI `/api/mo/workorder/production-status/batch` 一次取得BOM折算、拼皮线裁切和入库事实；批量接口不可用时保留原最多4并发、总等待12秒的逐单材料降级查询。失败返回未知和 `material_notice`，不假设0、不阻断其他工单。首站字段为 `is_first_step/first_issued_qty`。开放状态读取失败和材料读取失败分开提示。

除上述精确限定的拼皮线自动补录外，GET查询不提交报工数据、不补写ERP上下文；原接收、开工、完工及数量/拍照校验接口保留。自动补录不修改ERP、YX_TEST裁切表或Cloudflare隧道。

## 打印

列表提示按整道工序正常及返工完工次数与有效打印次数比较：未打印、漏打、已打印；不让员工逐批核对。操作始终取最新实际批次标签，不回落成累计标签。打印前复核权限及最新批次，批次已变化则重新确认预览；失败不得记成功次数。打印日志使用 `mo_execution_print_log_yx`，审计沿用 `mo_operation_log_yx`。

## 人员加载异常记录

2026-11-02 12:14左右，一台Android微信小程序出现一次“人员加载失败”。服务器日志显示：12:13:57 `GET /api/mo/dingtalk/departments` 正常返回200，同一批本应并发的 `GET /api/mo/dingtalk/workers` 未进入Nginx或Gunicorn访问日志；12:15:19重试时两个接口均返回200。期间无人员接口500、数据库查询异常或Gunicorn工作进程异常；同一客户端在12:13:51还有一次请求主动中断（Nginx 499）并在数秒后成功重试。结论是当次人员请求在微信端或网络层中断，没有到达报工服务，不是人员数据查询失败。

当前小程序用 `Promise.all` 同时加载部门和人员，任一请求失败都只显示同一条“人员加载失败”，且不自动重试。待后续调整时，建议分别记录两个接口结果、人员请求失败自动重试一次、保留上次成功人员缓存，并上报微信 `fail.errMsg`。本次仅查日志并记录，未修改、重启或部署。

## 本地验证

在小程序目录执行：

```powershell
node --test --test-reporter=tap tests/*.test.js
node --test tests/process-reports.test.js
```

在本后端目录执行：

```powershell
python -m pytest tests/test_mo_reports_summary.py tests/test_mo_reporting.py tests/test_mo_station_v2.py tests/test_mo_completion.py -q
```

最近记录：2026-10-28 PythonAPI完整238项通过（存在既有reportlab弃用告警），并以只读实查验证批量接口可返回 `SCDD26103117-1` 的BOM折算299.770909、首个裁切时间、入库140和最后审核时间。检查覆盖范围隔离、分批去重、空值、A/A1/A2/C累计和比例、人工记录优先、拼皮线精确部门过滤、系统开工及A级完工写入，以及重复同步保护。MOAPI公网批量接口及PythonAPI已生效；小程序无需为本次后端数据同步再次发布。

## 线上维护

- 目录 `47.117.37.186:/www/wwwroot/pthonapi`，Gunicorn端口8668。
- 健康检查 `https://api.quanshenghuoqin.com/test/success`。
- 最近报表口径部署：`/root/codex-reports-quality-20261022/before` 为更新前备份，只更新 `routes/mo_reporting.py`、`services/mo_reporting_summary.py`。
- 首站材料更新前备份：`/root/codex-board-materials-20261022/before`。
- 2026-10-27完工质量报告单已部署，更新前备份为 `/root/codex-quality-report-photos-20261027/before`，只更新 `routes/mo.py`、`routes/mo_reporting.py`。健康检查200，177条路由保持不变。
- 2026-10-27未报工看板已部署，只更新 `services/mo_dashboard_snapshot.py`、`services/mo_reporting_board.py`；更新前备份为 `/root/codex-board-unreported-20261027/before`。Gunicorn热重载和公网健康检查成功，路由数保持178；线上只读验证返回193个开放工单行、52个未报工行，`SCDD26103081`两行均返回。部署结果见 `.codex-temp/board-unreported-20261027/result.json`。
- 2026-10-28首站BOM比例换算及公式字段已部署，只更新 `routes/mo.py` 中首站材料纯计算函数、`services/mo_reporting_board.py` 和 `services/mo_dashboard_snapshot.py`，未带入本地尚未上线的数量规则等其他改动。Gunicorn热重载和公网健康检查成功，路由数保持178，在线看板返回197个开放工单行；`SCDD26103093`、`SCDD26103115`、`SCDD26103117`直接材料校验均返回折算数量、最低比例物料及真实比例。线上备份为 `/root/codex-material-formula-20261028-v2/before`，部署结果见 `.codex-temp/material-formula-release-20261028-v2/result.json`。小程序页面仍需另行上传发布才能看到点击公式。
- 2026-10-28拼皮线自动补录已部署，只更新 `routes/mo_reporting.py`、`services/mo_reporting_board.py`、`services/mo_dashboard_snapshot.py`。Gunicorn热重载成功，健康200，路由数178不变；首次校验只生成 `SCDD26103093-1`、`SCDD26103115-1`、`SCDD26103117-1` 三条系统开工记录，其中093入库284、117入库140全部记A，A1/A2/C均0；115暂无入库，只写开工。线上备份为 `/root/codex-panel-sync-20261028-v1/before`，本地发布审计目录为 `.codex-temp/panel-sync-release-20261028/`。
- 2026-10-28原计划日期已部署，只更新 `services/mo_reporting_board.py`、`services/mo_dashboard_snapshot.py`。Gunicorn热重载成功，健康200，路由数178不变；用户更新MOAPI后，端到端看板接口返回194行，其中37行带原计划日期，`SCDD26103081-1`原计划开工/完工均为`2026-10-14`。线上备份为 `/root/codex-original-plan-20261028-v1/before`，本地审计为 `.codex-temp/original-plan-release-20261028/result.json`。
- 2026-10-29第一工序 A/A1/A2 分级接收已部署。只在当前线上 `routes/mo.py` 上应用最小补丁：首次接收和后续补接收都允许 A1、A2，分别保存等级数量，但 A+A1+A2 仍不得超过 ERP 已领料总量。健康200，路由数178不变，业务写入0；备份为 `/root/codex-first-receive-grades-20261029-v1/before`，本地审计为 `.codex-temp/first-receive-grades-release-20261029/result.json`。小程序输入框仍需另行上传发布。
- 本地记录在工作目录 `.codex-temp/` 对应同名部署目录的 `result.json`；这些审计文件不是源码提交内容。
- 2026-11-09已部署报工详情实时领料，只在生产版 `routes/mo.py` 移除首工序详情跳过实时查询的条件，保留报工详情的只读写入保护。Gunicorn 热重载成功，公网健康检查 200，178 条路由保持不变。更新前备份为 `/root/codex-reporting-live-receipt-20261109-q0g05s0x/before/routes/mo.py`。
- 2026-11-09 已部署拼皮线自动补存计划量，只更新 `services/mo_reporting_board.py`。Gunicorn 热重载成功，健康检查 200，178 条路由保持不变。更新前备份为 `/root/codex-panel-plan-snapshot-20261109-jk7_qulu/before/services/mo_reporting_board.py`。
- 最近检查健康200、177条路由保持、权限配置未改、业务写入0；不代表未来服务器状态。
- **不能整份覆盖线上 `app.py`**：线上还有其他业务路由。部署前备份、核对差异及导入/路由，读取当前pid再重载；不能沿用旧PID。凭据使用已批准配置，不写进文档。
- 完工质量报告单新增两个数据库字段，迁移脚本为 `sql/mo_quality_report_photos.sql`，2026-10-27已在 `wecom-db` 执行并验证。没有新增专用环境变量。
