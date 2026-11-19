/*
委外单据打印：查询 SQL 审核稿（已确认按此查询口径实现）
在现有 U8 业务账套执行，只查询，不修改任何数据。

查询口径：
1. 按委外订单号查询，已审核、未审核订单均可查询；已关闭的订单和明细仍可查询。
2. “领料单”取委外用料清单，不是材料出库单流水。
3. om_momaterialshead 每行对应一条委外订单产品明细。
   用料必须按 MODetailsID 关联，并核对 MOID，避免不同产品串料。
4. 订单行号取 iVouchRowNo；不能用 irowno，它不是本单行号。
5. 用料序号是按 MOMaterialsID 生成的打印序号，不是 ERP 原始行号。
6. iQuantity 使用存货主计量单位；iNum / cUnitID 是另一套数量单位，不混用。
7. 页面表头显示委外供应商，保留部门和计划日期。
   不打印客户、工艺路线、二维码及计划跟踪号；不把 cPlanLotNumber 当成生产批号。
   本稿查出的计划跟踪号和累计已领数量仅供核对，打印的“已领数量”留空手填。
*/

DECLARE @OrderCode nvarchar(30) = N'WWDD260820186'; -- 改成需要审核的委外订单号

/* 一、委外订单标签：每行一条委外产品，不展开用料 */
SELECT
    h.cCode AS [委外订单号],
    h.MOID AS [订单主表ID],
    h.MODetailsID AS [订单明细ID],
    h.iVouchRowNo AS [订单行号],
    m.dDate AS [订单日期],
    dp.cDepName AS [部门],
    m.cVenCode AS [供应商编码],
    ven.cVenName AS [委外供应商],
    h.cInvCode AS [产品编码],
    h.cInvName AS [产品名称],
    h.cInvStd AS [规格型号],
    h.cInvM_Unit AS [单位],
    h.iQuantity AS [委外数量],
    h.dStartDate AS [计划开工日期],
    h.dArriveDate AS [计划到货日期],
    CASE
        WHEN LEFT(h.cInvCode, 1) = N'1' THEN N'成品'
        WHEN LEFT(h.cInvCode, 1) = N'2' THEN N'半成品'
        ELSE N''
    END AS [产品类别], -- 暂沿用生产标签的编码分类口径
    h.cPlanLotNumber AS [计划跟踪号],
    h.cbMemo AS [行备注],
    m.cMemo AS [订单备注],
    m.cMaker AS [制单人],
    m.cVerifier AS [审核人],
    m.dVerifyDate AS [审核日期],
    m.dCloseDate AS [订单关闭日期],
    h.dbCloseDate AS [行关闭日期]
FROM dbo.om_momaterialshead AS h
INNER JOIN dbo.OM_MOMain AS m
    ON m.MOID = h.MOID
LEFT JOIN dbo.Department AS dp
    ON dp.cDepCode = m.cDepCode
LEFT JOIN dbo.Vendor AS ven
    ON ven.cVenCode = m.cVenCode
WHERE h.cCode = @OrderCode
-- 不按订单、明细关闭日期过滤。
ORDER BY h.iVouchRowNo, h.MODetailsID;

/* 二、委外领料单标签：每行一条用料，保留其所属订单产品行 */
SELECT
    h.cCode AS [委外订单号],
    h.MOID AS [订单主表ID],
    h.MODetailsID AS [订单明细ID],
    h.iVouchRowNo AS [订单行号],
    h.cInvCode AS [所属产品编码],
    h.cInvName AS [所属产品名称],
    ma.MOMaterialsID AS [用料明细ID],
    ROW_NUMBER() OVER (
        PARTITION BY h.MODetailsID
        ORDER BY ma.MOMaterialsID
    ) AS [用料打印序号],
    ma.cInvCode AS [材料编码],
    inv.cInvName AS [材料名称],
    inv.cInvStd AS [规格型号],
    unit.cComUnitName AS [单位],
    wh.cWhName AS [仓库],
    ma.cBatch AS [批号],
    ma.iQuantity AS [应领数量],
    ISNULL(ma.iSendQTY, 0) AS [累计已领数量_供核对],
    ma.cbMemo AS [用料备注]
FROM dbo.om_momaterialshead AS h
INNER JOIN dbo.OM_MOMain AS m
    ON m.MOID = h.MOID
INNER JOIN dbo.OM_MOMaterials AS ma
    ON ma.MoDetailsID = h.MODetailsID
   AND ma.MOID = h.MOID
LEFT JOIN dbo.Inventory AS inv
    ON inv.cInvCode = ma.cInvCode
LEFT JOIN dbo.ComputationUnit AS unit
    ON unit.cComunitCode = inv.cComUnitCode
LEFT JOIN dbo.Warehouse AS wh
    ON wh.cWhCode = ma.cWhCode
WHERE h.cCode = @OrderCode
-- 不按订单、明细关闭日期过滤；不合并不同产品行的相同材料。
-- 原生产领料单的“已领数量”打印留空；此处查出 ERP 数值仅供审核。
ORDER BY h.iVouchRowNo, h.MODetailsID, ma.MOMaterialsID;
