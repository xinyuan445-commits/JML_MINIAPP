/*
生产工单材料超领查询（U8 / SQL Server / 008账套）
维护日期：2026-11-02

口径：当前 mom_moallocate.IssQty > mom_moallocate.Qty。
  - Qty为ERP当前应领数量（包含ERP已维护的损耗等），不是按BOM另算理论耗用。
  - IssQty为ERP当前累计已领量；不乘红蓝字标记，退料流水直接保留负数量。
  - 按AllocateId逐子件行核对；同料号的不同子件行不能直接合并判定。
  - 默认包含已关闭、未关闭工单，不限制审核状态和材料编码前缀。
  - 应领为0、已领为正数也属于超领；应领NULL或负数不按普通超领处理。
  - 这是当前超领清单，不含已退回至应领范围内的历史超领材料。

结果1：当前超领汇总，一行=一个工单行的一个材料子件行。
  - 累计入库数量取工单行QualifiedInQty（ERP累计合格入库）。
  - 基本用量、基础数量和子件损耗率取该工单子件行，不取母件最新BOM。
  - BOM单位用量 = BaseQtyN / BaseQtyD（不另加损耗）。
  - 反算领料单耗 = 当前累计已领数量 / 累计入库数量。
  - 单耗差异 = 反算领料单耗 - BOM单位用量。
  - 分母不大于0时对应单耗为空；未全部入库时反算单耗可能偏高。
结果2：这些超领子件行对应的全部材料出库/退料明细。
  日期过滤仅控制展示，不重新计算“截至某历史日期”的应领和已领数量。
  不同单位的数量不能直接相加；结果2重复展示结果1的累计数，不要再次求和。

仅DECLARE、SET及SELECT；不改ERP、不建表、不写回。
字段及 rdrecords11.iMPoIds = mom_moallocate.AllocateId 关系已核对当前账套。
*/
USE [UFDATA_008_2021];
SET NOCOUNT ON;

-- ==================== 查询条件：一般只改这里 ====================
DECLARE @MoCode       NVARCHAR(50)  = NULL; -- 精确工单号；NULL=全部
DECLARE @MoLine       INT           = NULL; -- 工单行号；NULL=全部
DECLARE @MaterialCode NVARCHAR(100) = NULL; -- 应领子件料号，精确匹配
DECLARE @MoDateFrom   DATE          = NULL; -- 工单建单日期起，含当天
DECLARE @MoDateTo     DATE          = NULL; -- 工单建单日期止，含当天
DECLARE @IssueDateFrom DATE         = NULL; -- 仅筛结果2的单据日期
DECLARE @IssueDateTo   DATE         = NULL; -- 仅筛结果2的单据日期，含当天
DECLARE @IncludeClosed BIT         = 1;    -- 1=含关闭工单；0=只看未关闭
DECLARE @MinOverQty   DECIMAL(28,6) = 0;    -- 只看超领数量大于此值的子件行
DECLARE @Epsilon      DECIMAL(28,6) = 0.000001; -- 数量比较容差

-- 例：查指定工单第2行：
-- 将上面的 @MoCode 改为 N'SCDD26103080'，@MoLine 改为 2。

-- ==================== 结果1：当前累计超领汇总 ====================
;WITH over_allocations AS (
    SELECT ma.AllocateId, ma.MoDId, ma.SortSeq AS material_seq,
           ma.InvCode AS material_code, ma.WhCode, ma.LotNo,
           CAST(ma.Qty AS DECIMAL(28,6)) AS required_qty,
           CAST(ma.IssQty AS DECIMAL(28,6)) AS issued_qty,
           CAST(ma.BaseQtyN AS DECIMAL(28,8)) AS base_qty_n,
           CAST(ma.BaseQtyD AS DECIMAL(28,8)) AS base_qty_d,
           ma.CompScrap AS component_scrap,
           ma.Remark AS material_remark,
           o.MoCode, o.CreateDate, d.SortSeq AS order_seq,
           d.InvCode AS product_code, d.Qty AS product_plan_qty,
           CAST(d.QualifiedInQty AS DECIMAL(28,6)) AS receipt_qty,
           d.MDeptCode, d.OrderCode, d.SoCode, d.CloseDate,
           d.RelsTime, d.Remark AS order_remark
    FROM dbo.mom_moallocate ma
    JOIN dbo.mom_orderdetail d ON d.MoDId = ma.MoDId
    JOIN dbo.mom_order o ON o.MoId = d.MoId
    WHERE ma.Qty IS NOT NULL AND ma.Qty >= 0
      AND ma.IssQty - ma.Qty > @MinOverQty + @Epsilon
      AND (@MoCode IS NULL OR o.MoCode = @MoCode)
      AND (@MoLine IS NULL OR d.SortSeq = @MoLine)
      AND (@MaterialCode IS NULL OR ma.InvCode = @MaterialCode)
      AND (@MoDateFrom IS NULL OR o.CreateDate >= @MoDateFrom)
      AND (@MoDateTo IS NULL OR o.CreateDate < DATEADD(DAY,1,@MoDateTo))
      AND (@IncludeClosed = 1 OR d.CloseDate IS NULL)
),
voucher_summary AS (
    -- 必须汇总完整流水，不能先按日期截断再与累计已领数量比较。
    SELECT a.AllocateId, COUNT_BIG(*) AS row_count,
           COUNT(DISTINCT h.ID) AS voucher_count,
           SUM(CASE WHEN r.iQuantity > 0 THEN CAST(r.iQuantity AS DECIMAL(28,6)) ELSE 0 END) AS out_qty,
           SUM(CASE WHEN r.iQuantity < 0 THEN -CAST(r.iQuantity AS DECIMAL(28,6)) ELSE 0 END) AS return_qty,
           SUM(CAST(r.iQuantity AS DECIMAL(28,6))) AS net_qty,
           MIN(h.dDate) AS first_date, MAX(h.dDate) AS last_date,
           SUM(CASE WHEN NULLIF(LTRIM(RTRIM(h.cHandler)),N'') IS NULL THEN 1 ELSE 0 END) AS unverified_rows,
           SUM(CASE WHEN r.cInvCode <> a.material_code THEN 1 ELSE 0 END) AS different_material_rows
    FROM over_allocations a
    JOIN dbo.rdrecords11 r ON r.iMPoIds = a.AllocateId
    JOIN dbo.rdrecord11 h ON h.ID = r.ID
    GROUP BY a.AllocateId
)
SELECT
    a.MoCode AS [生产工单号], a.order_seq AS [工单行号],
    a.CreateDate AS [工单建单日期], dep.cDepName AS [生产部门],
    CASE WHEN a.CloseDate IS NULL THEN N'未关闭' ELSE N'已关闭' END AS [工单关闭状态],
    a.CloseDate AS [工单关闭日期],
    CASE WHEN a.RelsTime IS NULL THEN N'未下达' ELSE N'已下达' END AS [工单下达状态],
    a.OrderCode AS [工单来源单号], a.SoCode AS [工单销售订单号],
    a.product_code AS [产品料号], product.cInvName AS [产品名称],
    product.cInvStd AS [产品规格], a.product_plan_qty AS [计划生产数量],
    a.receipt_qty AS [累计入库数量],
    a.MoDId AS [工单明细ID], a.AllocateId AS [材料分配ID],
    a.material_seq AS [子件行号], a.material_code AS [材料料号],
    material.cInvName AS [材料名称], material.cInvStd AS [材料规格],
    unit.cComUnitName AS [材料主计量单位],
    wh.cWhName AS [子件指定仓库], a.LotNo AS [子件批号],
    a.required_qty AS [当前应领数量], a.issued_qty AS [当前累计已领数量],
    a.base_qty_n AS [基本用量], a.base_qty_d AS [基础数量],
    a.component_scrap AS [子件损耗率百分比],
    CASE WHEN a.base_qty_d > 0 THEN
         CAST(a.base_qty_n / NULLIF(a.base_qty_d,0) AS DECIMAL(28,8))
    END AS [BOM单位用量],
    CASE WHEN a.receipt_qty > 0 THEN
         CAST(a.issued_qty / NULLIF(a.receipt_qty,0) AS DECIMAL(28,8))
    END AS [反算领料单耗],
    CASE WHEN a.receipt_qty > 0 AND a.base_qty_d > 0 THEN
         CAST(a.issued_qty / NULLIF(a.receipt_qty,0)
              - a.base_qty_n / NULLIF(a.base_qty_d,0) AS DECIMAL(28,8))
    END AS [单耗差异],
    a.issued_qty - a.required_qty AS [当前超领数量],
    CAST((a.issued_qty - a.required_qty) * 100.0 / NULLIF(a.required_qty,0)
         AS DECIMAL(20,2)) AS [超领比例百分比],
    CASE WHEN a.required_qty = 0 THEN N'零应领有领料' ELSE N'超过当前应领' END AS [超领类型],
    v.out_qty AS [流水累计正数发料], v.return_qty AS [流水累计退料],
    v.net_qty AS [流水累计净领料],
    a.issued_qty - v.net_qty AS [ERP已领与流水差额],
    ISNULL(v.voucher_count,0) AS [关联单据数], ISNULL(v.row_count,0) AS [关联明细行数],
    v.first_date AS [首次领退料单据日期], v.last_date AS [末次领退料单据日期],
    ISNULL(v.unverified_rows,0) AS [未审核明细行数],
    ISNULL(v.different_material_rows,0) AS [实际料号不同明细行数],
    CASE WHEN v.AllocateId IS NULL THEN N'未找到对应出库流水，需核对'
         WHEN ABS(a.issued_qty - v.net_qty) > @Epsilon THEN N'累计数量不一致，需核对'
         ELSE N'累计数量一致' END AS [数量核对],
    a.order_remark AS [工单备注], a.material_remark AS [子件备注]
FROM over_allocations a
LEFT JOIN voucher_summary v ON v.AllocateId = a.AllocateId
LEFT JOIN dbo.Inventory product ON product.cInvCode = a.product_code
LEFT JOIN dbo.Inventory material ON material.cInvCode = a.material_code
LEFT JOIN dbo.ComputationUnit unit ON unit.cComunitCode = material.cComUnitCode
LEFT JOIN dbo.Department dep ON dep.cDepCode = a.MDeptCode
LEFT JOIN dbo.Warehouse wh ON wh.cWhCode = a.WhCode
ORDER BY a.MoCode DESC, a.order_seq, a.material_seq, a.AllocateId;

-- ==================== 结果2：对应领料、退料单据明细 ====================
;WITH over_allocations AS (
    SELECT ma.AllocateId, ma.SortSeq AS material_seq,
           ma.InvCode AS planned_material_code,
           CAST(ma.Qty AS DECIMAL(28,6)) AS required_qty,
           CAST(ma.IssQty AS DECIMAL(28,6)) AS issued_qty,
           o.MoCode, d.SortSeq AS order_seq, d.MDeptCode
    FROM dbo.mom_moallocate ma
    JOIN dbo.mom_orderdetail d ON d.MoDId = ma.MoDId
    JOIN dbo.mom_order o ON o.MoId = d.MoId
    WHERE ma.Qty IS NOT NULL AND ma.Qty >= 0
      AND ma.IssQty - ma.Qty > @MinOverQty + @Epsilon
      AND (@MoCode IS NULL OR o.MoCode = @MoCode)
      AND (@MoLine IS NULL OR d.SortSeq = @MoLine)
      AND (@MaterialCode IS NULL OR ma.InvCode = @MaterialCode)
      AND (@MoDateFrom IS NULL OR o.CreateDate >= @MoDateFrom)
      AND (@MoDateTo IS NULL OR o.CreateDate < DATEADD(DAY,1,@MoDateTo))
      AND (@IncludeClosed = 1 OR d.CloseDate IS NULL)
),
ledger AS (
    SELECT a.*, r.AutoID AS voucher_row_id, h.ID AS voucher_id,
           h.cCode, h.dDate, h.dnmaketime, h.cWhCode,
           h.cMaker, h.cHandler, h.dVeriDate, h.cPersonCode, h.cMemo,
           r.irowno, r.cInvCode AS actual_material_code, r.cBatch,
           CAST(r.iQuantity AS DECIMAL(28,6)) AS row_qty,
           r.cwhpersonname, r.cbMemo,
           SUM(CAST(r.iQuantity AS DECIMAL(28,6))) OVER (
               PARTITION BY a.AllocateId
               ORDER BY h.dDate, h.ID, r.AutoID
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS running_net_qty,
           SUM(CAST(r.iQuantity AS DECIMAL(28,6))) OVER (
               PARTITION BY a.AllocateId
           ) AS all_net_qty
    FROM over_allocations a
    JOIN dbo.rdrecords11 r ON r.iMPoIds = a.AllocateId
    JOIN dbo.rdrecord11 h ON h.ID = r.ID
),
excess AS (
    SELECT l.*,
           CASE WHEN running_net_qty > required_qty
                THEN running_net_qty - required_qty ELSE 0 END AS after_excess,
           CASE WHEN running_net_qty - row_qty > required_qty
                THEN running_net_qty - row_qty - required_qty ELSE 0 END AS before_excess
    FROM ledger l
)
SELECT
    e.MoCode AS [生产工单号], e.order_seq AS [工单行号], dep.cDepName AS [生产部门],
    e.AllocateId AS [材料分配ID], e.material_seq AS [子件行号],
    e.planned_material_code AS [应领材料料号],
    e.actual_material_code AS [本笔实际材料料号],
    material.cInvName AS [本笔实际材料名称], material.cInvStd AS [材料规格],
    unit.cComUnitName AS [本笔材料主计量单位],
    CASE WHEN e.actual_material_code <> e.planned_material_code
         THEN N'料号不同，核对替代料及单位' ELSE N'' END AS [材料匹配提示],
    e.cCode AS [材料出库单号], e.voucher_id AS [出库单ID],
    e.irowno AS [出库单行号], e.voucher_row_id AS [出库明细ID],
    e.dDate AS [单据业务日期], e.dnmaketime AS [单据制单时间],
    wh.cWhName AS [实际出库仓库], e.cBatch AS [实际材料批号],
    CASE WHEN e.row_qty > 0 THEN N'领料'
         WHEN e.row_qty < 0 THEN N'退料' ELSE N'零数量' END AS [业务方向],
    e.row_qty AS [本笔数量含退料负数],
    e.required_qty AS [当前应领数量],
    e.running_net_qty - e.row_qty AS [按单据日期本笔前累计净领料],
    e.running_net_qty AS [按单据日期本笔后累计净领料],
    e.after_excess AS [按当前应领本笔后超额],
    e.after_excess - e.before_excess AS [按当前应领本笔超额变化],
    e.issued_qty AS [ERP当前累计已领数量],
    e.issued_qty - e.required_qty AS [当前超领数量],
    e.issued_qty - e.all_net_qty AS [ERP已领与完整流水差额],
    CASE WHEN NULLIF(LTRIM(RTRIM(e.cHandler)),N'') IS NULL
         THEN N'未审核' ELSE N'已审核' END AS [单据审核状态],
    e.cMaker AS [制单人], e.cHandler AS [审核人], e.dVeriDate AS [审核日期],
    e.cPersonCode AS [单据业务员编码], e.cwhpersonname AS [仓库人员],
    e.cMemo AS [单据备注], e.cbMemo AS [明细备注]
FROM excess e
LEFT JOIN dbo.Inventory material ON material.cInvCode = e.actual_material_code
LEFT JOIN dbo.ComputationUnit unit ON unit.cComunitCode = material.cComUnitCode
LEFT JOIN dbo.Department dep ON dep.cDepCode = e.MDeptCode
LEFT JOIN dbo.Warehouse wh ON wh.cWhCode = e.cWhCode
-- 窗口累计完成后才按单据日期筛选，保留期初领退料对累计数的影响。
WHERE (@IssueDateFrom IS NULL OR e.dDate >= @IssueDateFrom)
  AND (@IssueDateTo IS NULL OR e.dDate < DATEADD(DAY,1,@IssueDateTo))
ORDER BY e.MoCode DESC, e.order_seq, e.material_seq, e.AllocateId,
         e.dDate, e.voucher_id, e.voucher_row_id;

/*
使用注意：
1. 结果2的“本笔超额变化”可能为负，表示退料减少了超额；不是错误数据。
2. 运行累计按业务日期、单据ID、明细ID排序。补录/倒签可能改变顺序，
   不能把它当作历史时点真实审批顺序，也不能认定制单人就是实际领料人。
3. 累计比较使用当前应领数量；应领后来修改过时，无法由本查询还原当时标准。
4. 相关流水包括未审核单据，并给出审核状态；不能先过滤未审核，再默认其净和
   必须等于ERP累计已领。优先看结果1“数量核对”。
5. 有替代料或累计差额时，明细的超额拆分只供核对，不按该值直接定责。
6. 同一材料也可能有多条子件行；不要只按工单号+料号JOIN，否则放大领料数量。
7. 未关联到AllocateId的出库行不强行按料号猜配；汇总无流水或有差额时需另查。
8. 不加NOLOCK，避免用脏读结果认定超领；查询期间若ERP仍在领退料，建议在
   业务相对稳定时复核两份结果。单据金额和财务结算成本不在本查询口径内。
9. 反算的是领料单耗，不是扣除现场余料后的净加工耗用。累计入库和BOM用量
   会在每个子件行重复显示，不能跨材料行累加入库量。
10. BOM单位用量为分子/分母基础比值，子件损耗率单独显示，不混入该比值；
    若有固定用量、母件损耗或特殊单位换算，应再核对，不据差异直接修改BOM。
*/
