export type AdminUser = API.CurrentUser & {
  username?: string;
  permissions?: string[];
  adminRoles?: string[];
  adminAccountId?: number;
  disabledPages?: string[];
};

type PermissionRequirement = string | string[];

export const MANAGEMENT_ENTRY = '/admin';
export const PROCESS_ARCHIVE_PATH = '/archives/process';
export const MATERIAL_CODING_PATH = '/archives/material-coding';
export const processArchiveSections = [
  { key: 'route', path: '/mo/route', access: 'canRoute', label: '工艺路线' },
  { key: 'workstation', path: '/mo/workstation', access: 'canWorkstation', label: '工站' },
  { key: 'process', path: '/mo/process', access: 'canProcess', label: '工序' },
] as const;

export const pagePermissions: Record<string, PermissionRequirement> = {
  '/board/production': 'dashboard.view',
  '/board/reports': 'reports.view',
  '/board/reports2': 'reports2.view',
  '/reports/receipt-comparison': 'receipt-comparison.view',
  '/reports/workorder-process': 'workorder-process-report.view',
  '/reports/process-labor': 'workorder-process-report.view',
  '/reports/inventory-route': 'inventory-route-report.view',
  '/board/completed': 'completed.view',
  '/board/operation-log': 'operation-log.view',
  '/mo/production-label': 'production-label.view',
  '/mo/completion-flow-report': 'completion-flow-report.view',
  '/mo/daily-tasks': 'daily-tasks.view',
  '/outsource/document-print': 'outsource.view',
  '/demand/calculation': 'demand-calculation.view',
  '/mo/workorder': 'workorder.view',
  '/mo/workorder-trace': 'route-trace.view',
  '/mo/route': 'route.view',
  [MATERIAL_CODING_PATH]: 'material-coding.view',
  '/mo/equipment': 'equipment.view',
  '/mo/quantity-rules': 'quantity-rules.view',
  '/mo/process': 'process.view',
  '/mo/workstation': 'workstation.view',
  '/mo/product-category': 'category.view',
  '/mo/worker-department': 'worker-department.view',
  '/system/accounts': 'accounts.view',
  '/system/roles': 'roles.view',
  '/system/station-permissions': 'station-permissions.view',
  '/system/page-settings': 'page-settings.view',
  '/system/basic-settings': 'basic-settings.view',
  '/system/approvals': [
    'approval.mine',
    'process.approve',
    'workstation.approve',
    'category.approve',
    'route.approve',
    'equipment.approve',
    'equipment-capacity.approve',
  ],
  '/mo/audit': 'audit.view',
};

export const pageKeysByPath: Record<string, string> = {
  '/board/production': 'dashboard',
  '/board/reports': 'reports',
  '/board/reports2': 'reports2',
  '/reports/receipt-comparison': 'receipt-comparison',
  '/reports/workorder-process': 'workorder-process-report',
  '/reports/process-labor': 'workorder-process-report',
  '/reports/inventory-route': 'inventory-route-report',
  '/board/completed': 'completed',
  '/board/operation-log': 'operation-log',
  '/mo/production-label': 'production-label',
  '/mo/completion-flow-report': 'completion-flow-report',
  '/mo/daily-tasks': 'daily-tasks',
  '/outsource/document-print': 'outsource',
  '/demand/calculation': 'demand-calculation',
  '/mo/workorder': 'workorder',
  '/mo/workorder-trace': 'route-trace',
  '/mo/route': 'route',
  [MATERIAL_CODING_PATH]: 'material-coding',
  '/mo/equipment': 'equipment',
  '/mo/quantity-rules': 'quantity-rules',
  '/mo/process': 'process',
  '/mo/workstation': 'workstation',
  '/mo/product-category': 'category',
  '/mo/worker-department': 'worker-department',
  '/system/approvals': 'approval',
  '/system/accounts': 'accounts',
  '/system/roles': 'roles',
  '/system/station-permissions': 'station-permissions',
  '/mo/audit': 'audit',
  '/system/page-settings': 'page-settings',
  '/system/basic-settings': 'basic-settings',
};

export const isPageEnabled = (user: AdminUser | undefined, pageKey: string) =>
  pageKey === 'page-settings' || !user?.disabledPages?.includes(pageKey);

export const hasPermission = (
  user: AdminUser | undefined,
  permission: string,
) => Boolean(user?.permissions?.includes(permission));

const meetsRequirement = (
  user: AdminUser | undefined,
  requirement: PermissionRequirement | undefined,
) =>
  Array.isArray(requirement)
    ? requirement.some((permission) => hasPermission(user, permission))
    : Boolean(requirement && hasPermission(user, requirement));

export const canViewProcessArchive = (user: AdminUser | undefined) =>
  processArchiveSections.some(({ path }) =>
    isPageEnabled(user, pageKeysByPath[path]) && meetsRequirement(user, pagePermissions[path]),
  );

export const canViewMaterialCoding = (user: AdminUser | undefined) =>
  isPageEnabled(user, 'material-coding') &&
  (hasPermission(user, 'material-coding.view') || canViewProcessArchive(user));

export const homeForUser = (
  user: AdminUser | undefined,
  excludedPaths: readonly string[] = [],
) =>
  Object.entries(pagePermissions).find(
    ([path, requirement]) =>
      !excludedPaths.includes(path) &&
      isPageEnabled(user, pageKeysByPath[path]) &&
      meetsRequirement(user, requirement),
  )?.[0] || '/403';

export function authorizedRedirect(redirect: string, user: AdminUser) {
  const pathname = redirect.split(/[?#]/)[0];
  if (pathname === MANAGEMENT_ENTRY) {
    return homeForUser(user, ['/board/production']);
  }
  if (pathname === MATERIAL_CODING_PATH) {
    return canViewMaterialCoding(user) ? redirect : homeForUser(user);
  }
  if (pathname === PROCESS_ARCHIVE_PATH) {
    return canViewProcessArchive(user) ? redirect : homeForUser(user);
  }
  return isPageEnabled(user, pageKeysByPath[pathname]) &&
    meetsRequirement(user, pagePermissions[pathname])
    ? redirect
    : homeForUser(user);
}
