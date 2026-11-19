/**
 * @see https://umijs.org/docs/max/access#access
 * */
import {
  type AdminUser,
  canViewMaterialCoding,
  canViewProcessArchive,
  hasPermission,
  isPageEnabled,
} from './utils/adminPermissions';

export default function access(
  initialState: { currentUser?: AdminUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const can = (permission: string) => hasPermission(currentUser, permission);
  const pageOn = (pageKey: string) => isPageEnabled(currentUser, pageKey);
  return {
    canUser: Boolean(currentUser),
    canAdmin: can('accounts.manage'),
    can,
    canDashboard: pageOn('dashboard') && can('dashboard.view'),
    canReports: pageOn('reports') && can('reports.view'),
    canReports2: pageOn('reports2') && can('reports2.view'),
    canReceiptComparison:
      pageOn('receipt-comparison') && can('receipt-comparison.view'),
    canWorkorderProcessReport:
      pageOn('workorder-process-report') &&
      can('workorder-process-report.view'),
    canInventoryRouteReport: pageOn('inventory-route-report') && can('inventory-route-report.view'),
    canReportCenter: [
      ['receipt-comparison', 'receipt-comparison.view'],
      ['workorder-process-report', 'workorder-process-report.view'],
      ['inventory-route-report', 'inventory-route-report.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
    canCompleted: pageOn('completed') && can('completed.view'),
    canOperationLog: pageOn('operation-log') && can('operation-log.view'),
    canBoard: [
      ['dashboard', 'dashboard.view'],
      ['reports', 'reports.view'],
      ['reports2', 'reports2.view'],
      ['completed', 'completed.view'],
      ['operation-log', 'operation-log.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
    canProductionLabel:
      pageOn('production-label') && can('production-label.view'),
    canCompletionFlowReport:
      pageOn('completion-flow-report') && can('completion-flow-report.view'),
    canProductionManagement: [
      ['daily-tasks', 'daily-tasks.view'],
      ['production-label', 'production-label.view'],
      ['completion-flow-report', 'completion-flow-report.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
    canOutsource: pageOn('outsource') && can('outsource.view'),
    canDailyTasks: pageOn('daily-tasks') && can('daily-tasks.view'),
    canDemandCalculation:
      pageOn('demand-calculation') && can('demand-calculation.view'),
    canDemandPlan:
      pageOn('demand-calculation') && can('demand-calculation.view'),
    canWorkorder: pageOn('workorder') && can('workorder.view'),
    canRouteTrace: pageOn('route-trace') && can('route-trace.view'),
    canRoute: pageOn('route') && can('route.view'),
    canProcessArchive: canViewProcessArchive(currentUser),
    canMaterialCoding: canViewMaterialCoding(currentUser),
    canArchives: canViewProcessArchive(currentUser) || canViewMaterialCoding(currentUser),
    canEquipment: pageOn('equipment') && can('equipment.view'),
    canQuantityRules: pageOn('quantity-rules') && can('quantity-rules.view'),
    canProcessManagement: [
      ['workorder', 'workorder.view'],
      ['route-trace', 'route-trace.view'],
      ['route', 'route.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
    canProcess: pageOn('process') && can('process.view'),
    canWorkstation: pageOn('workstation') && can('workstation.view'),
    canCategory: pageOn('category') && can('category.view'),
    canWorkerDepartment:
      pageOn('worker-department') && can('worker-department.view'),
    canProcessConfig: [
      ['process', 'process.view'],
      ['workstation', 'workstation.view'],
      ['equipment', 'equipment.view'],
      ['quantity-rules', 'quantity-rules.view'],
      ['category', 'category.view'],
      ['worker-department', 'worker-department.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
    canAccounts: pageOn('accounts') && can('accounts.view'),
    canRoles: pageOn('roles') && can('roles.view'),
    canStationPermissions:
      pageOn('station-permissions') && can('station-permissions.view'),
    canPageSettings: can('page-settings.view'),
    canBasicSettings: pageOn('basic-settings') && can('basic-settings.view'),
    canReportEmailSettings:
      pageOn('report-email-settings') && can('report-email-settings.view'),
    canProductionScheduling:
      pageOn('production-scheduling') && can('production-scheduling.view'),
    canAudit: pageOn('audit') && can('audit.view'),
    canApprovalCenter:
      pageOn('approval') &&
      [
        'approval.mine',
        'process.approve',
        'workstation.approve',
        'category.approve',
        'route.approve',
        'equipment.approve',
        'equipment-capacity.approve',
      ].some(can),
    canSystemConfig: [
      ['accounts', 'accounts.view'],
      ['roles', 'roles.view'],
      ['station-permissions', 'station-permissions.view'],
      ['audit', 'audit.view'],
      ['page-settings', 'page-settings.view'],
      ['basic-settings', 'basic-settings.view'],
      ['report-email-settings', 'report-email-settings.view'],
      ['production-scheduling', 'production-scheduling.view'],
    ].some(([page, permission]) => pageOn(page) && can(permission)),
  };
}
