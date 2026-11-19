// Run with: node --test scripts/check-routes.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { getConfigRoutes } = require('@umijs/core/dist/route/routesConfig');
const { addParentRoute } = require('@umijs/core/dist/route/routeUtils');
const { matchRoutes } = require('react-router');

const source = fs.readFileSync(
  path.join(__dirname, '../config/routes.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const routeModule = { exports: {} };
new Function('module', 'exports', compiled)(routeModule, routeModule.exports);
const routes = routeModule.exports.default;
const toClientRoutes = (items) =>
  items.map(({ routes: children, ...route }) => ({
    ...route,
    children: children ? toClientRoutes(children) : undefined,
  }));
const clientRoutes = toClientRoutes(routes);

// Use Umi's installed parent-route transform and the layout plugin's predicate.
// Nested layout:false does not detach an already-layout-wrapped parent.
const runtimeRoutes = getConfigRoutes({ routes });
addParentRoute({
  addToAll: true,
  target: { id: 'ant-design-pro-layout', path: '/', isLayout: true },
  routes: runtimeRoutes,
  test: (route) => route.layout !== false,
});
const runtimeAncestors = (route) => {
  const parents = [];
  while (route.parentId) {
    route = runtimeRoutes[route.parentId];
    parents.push(route);
  }
  return parents;
};

test('exportStatic receives a string path for every configured route', () => {
  for (const route of Object.values(getConfigRoutes({ routes }))) {
    assert.equal(typeof route.path, 'string', route.name || route.id);
  }
});

test('empty-path menu groups do not capture the home redirect', () => {
  const match = matchRoutes(clientRoutes, '/').at(-1).route;
  assert.equal(match.redirect, '/board/production');
});

test('removed gantt entries redirect to the production dashboard', () => {
  for (const url of ['/board/gantt', '/board/process-gantt']) {
    const route = matchRoutes(clientRoutes, url).at(-1).route;
    assert.equal(route.redirect, '/board/production');
    assert.equal(route.name, undefined);
    assert.equal(route.component, undefined);
  }
});

test('production screen has no admin layout and retains an explicit user guard', () => {
  const screen = matchRoutes(clientRoutes, '/board/production').at(-1).route;
  assert.equal(screen.layout, false);
  assert.equal(screen.hideInMenu, true);
  assert.equal(screen.access, 'canDashboard');
  assert.deepEqual(screen.wrappers, ['@/wrappers/DashboardAccess']);
  const runtime = Object.values(runtimeRoutes).find(
    (route) => route.file === './mo/dashboard',
  );
  const ancestors = runtimeAncestors(runtime);
  assert.equal(
    ancestors.some((route) => route.isLayout),
    false,
  );
  assert.equal(ancestors[0].file, '@/wrappers/DashboardAccess');
  assert.equal(ancestors[0].layout, false);
  assert.equal(runtime.access, 'canDashboard');
});

test('reports and completed records retain their normal layout and board permission', () => {
  for (const url of ['/board/reports', '/board/reports2', '/board/completed']) {
    const matches = matchRoutes(clientRoutes, url);
    assert.equal(
      matches.some(({ route }) => route.layout === false),
      false,
    );
    assert.equal(
      matches.find(({ route }) => route.path === '/board').route.access,
      'canBoard',
    );
    const runtime = Object.values(runtimeRoutes).find(
      (route) => route.path === url,
    );
    assert.equal(
      runtimeAncestors(runtime).some(
        (route) => route.id === 'ant-design-pro-layout',
      ),
      true,
    );
  }
});

const loadTsModule = (file, resolve = require, allExports = false) => {
  const result = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, file), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const target = { exports: {} };
  new Function('module', 'exports', 'require', result.outputText)(
    target,
    target.exports,
    (name) => name.endsWith('utils/adminPermissions')
      ? loadTsModule('../src/utils/adminPermissions.ts', require, true)
      : resolve(name),
  );
  return allExports ? target.exports : target.exports.default;
};

test('standalone screen waits for identity and rejects anonymous users before rendering', () => {
  const accessFactory = loadTsModule('../src/access.ts');
  const state = { loading: true, currentUser: undefined };
  const location = {
    pathname: '/board/production',
    search: '?dept=test',
    hash: '#screen',
  };
  const Navigate = () => null;
  const Outlet = () => null;
  const guard = loadTsModule('../src/wrappers/DashboardAccess.tsx', (name) =>
    name === '@umijs/max'
      ? {
          Navigate,
          Outlet,
          useAccess: () => accessFactory(state),
          useModel: () => state,
          useLocation: () => location,
        }
      : require(name),
  );
  assert.equal(guard(), null);
  state.loading = false;
  const denied = guard();
  assert.equal(denied.type, Navigate);
  assert.equal(denied.props.replace, true);
  assert.equal(
    denied.props.to,
    `/user/login?redirect=${encodeURIComponent('/board/production?dept=test#screen')}`,
  );
  for (const authSource of ['session', 'oidc']) {
    state.currentUser = { access: 'viewer', authSource, permissions: ['dashboard.view'] };
    assert.equal(guard().type, Outlet);
  }
  state.currentUser = { access: 'admin', permissions: ['production-label.view'] };
  assert.equal(guard().type, Navigate);
  assert.equal(guard().props.to, '/403');
});

test('regrouped pages retain their URLs and admin permissions', () => {
  const expected = {
    '/mo/workorder': 'process-management',
    '/mo/route': 'process-management',
    '/mo/process': 'process-config',
    '/mo/workstation': 'process-config',
    '/mo/product-category': 'process-config',
    '/mo/worker-department': 'process-config',
    '/demand/calculation': 'demand-plan',
    '/reports/receipt-comparison': 'report-center',
    '/reports/workorder-process': 'report-center',
    '/system/approvals': 'system-config',
    '/mo/audit': 'system-config',
  };
  for (const [url, groupKey] of Object.entries(expected)) {
    const matches = matchRoutes(clientRoutes, url);
    assert.equal(matches.at(-1).route.path, url);
    const group = matches.find(({ route }) => route.key === groupKey);
    const groupAccess = {
      'process-management': 'canProcessManagement',
      'process-config': 'canProcessConfig',
      'demand-plan': 'canDemandPlan',
      'report-center': 'canReportCenter',
      'system-config': 'canSystemConfig',
    };
    assert.equal(group?.route.access, groupAccess[groupKey], url);
    assert.ok(matches.at(-1).route.access, url);
  }
});

test('granular permissions drive menus and ignore legacy admin labels', () => {
  const access = loadTsModule('../src/access.ts')({ currentUser: {
    access: 'admin', permissions: ['production-label.view', 'production-label.print'],
  } });
  assert.equal(access.canProductionLabel, true);
  assert.equal(access.can('production-label.print'), true);
  assert.equal(access.canDashboard, false);
  assert.equal(access.canSystemConfig, false);
  assert.equal(access.canProcessConfig, false);
  assert.equal(access.can('outsource.print'), false);
  assert.equal(loadTsModule('../src/access.ts')({currentUser: {access: 'admin'}}).canAdmin, false);
});

test('login lands on an authorized page instead of a forbidden dashboard', () => {
  const helpers = loadTsModule('../src/utils/adminPermissions.ts', require, true);
  const printer = {permissions: ['outsource.view']};
  assert.equal(helpers.homeForUser(printer), '/outsource/document-print');
  assert.equal(helpers.authorizedRedirect('/mo/route', printer), '/outsource/document-print');
  assert.equal(helpers.authorizedRedirect('/outsource/document-print?order=test', printer), '/outsource/document-print?order=test');
  assert.equal(helpers.homeForUser({permissions: []}), '/403');
});

test('new account, role and reserved station pages have separate access checks', () => {
  for (const [url, access] of [
    ['/system/approvals', 'canApprovalCenter'],
    ['/system/accounts', 'canAccounts'], ['/system/roles', 'canRoles'],
    ['/system/station-permissions', 'canStationPermissions'],
    ['/system/basic-settings', 'canBasicSettings'],
    ['/system/report-email-settings', 'canReportEmailSettings'],
  ]) assert.equal(matchRoutes(clientRoutes, url).at(-1).route.access, access);
});
