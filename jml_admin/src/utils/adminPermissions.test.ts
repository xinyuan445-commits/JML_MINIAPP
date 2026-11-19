import {
  type AdminUser,
  authorizedRedirect,
  canViewProcessArchive,
  homeForUser,
  MANAGEMENT_ENTRY,
  PROCESS_ARCHIVE_PATH,
  isPageEnabled,
} from './adminPermissions';

const user = (permissions: string[], disabledPages: string[] = []) =>
  ({ permissions, disabledPages }) as AdminUser;

describe('page availability', () => {
  it('overrides an existing view permission', () => {
    const current = user(['process.view', 'route.view'], ['process']);
    expect(authorizedRedirect('/mo/process', current)).toBe('/mo/route');
  });

  it('chooses the first enabled authorized page as home', () => {
    const current = user(['dashboard.view', 'reports.view'], ['dashboard']);
    expect(homeForUser(current)).toBe('/board/reports');
  });

  it('can choose an operation home outside the public production board', () => {
    const current = user(['dashboard.view', 'workorder.view']);
    expect(homeForUser(current, ['/board/production'])).toBe('/mo/workorder');
  });

  it('takes the dashboard return login to an authorized management page', () => {
    const current = user(['dashboard.view', 'workorder.view']);
    expect(authorizedRedirect(MANAGEMENT_ENTRY, current)).toBe('/mo/workorder');
    expect(authorizedRedirect(MANAGEMENT_ENTRY, user(['dashboard.view']))).toBe('/403');
  });

  it('authorizes the copied report with its own permission and switch', () => {
    const current = user(['reports2.view']);
    expect(authorizedRedirect('/board/reports2', current)).toBe(
      '/board/reports2',
    );
    expect(
      authorizedRedirect(
        '/board/reports2',
        user(['reports2.view'], ['reports2']),
      ),
    ).toBe('/403');
  });

  it('authorizes demand calculation with its own permission and switch', () => {
    expect(
      authorizedRedirect(
        '/demand/calculation',
        user(['demand-calculation.view']),
      ),
    ).toBe('/demand/calculation');
    expect(
      authorizedRedirect(
        '/demand/calculation',
        user(['demand-calculation.view'], ['demand-calculation']),
      ),
    ).toBe('/403');
  });

  it('authorizes the completion flow report with its own permission and switch', () => {
    expect(
      authorizedRedirect(
        '/mo/completion-flow-report',
        user(['completion-flow-report.view']),
      ),
    ).toBe('/mo/completion-flow-report');
    expect(
      authorizedRedirect(
        '/mo/completion-flow-report',
        user(['completion-flow-report.view'], ['completion-flow-report']),
      ),
    ).toBe('/403');
  });

  it('keeps the page switch available for recovery', () => {
    const current = user(['page-settings.view'], ['page-settings']);
    expect(isPageEnabled(current, 'page-settings')).toBe(true);
    expect(authorizedRedirect('/system/page-settings', current)).toBe(
      '/system/page-settings',
    );
  });

  it('authorizes basic settings independently from report delivery', () => {
    const current = user(['basic-settings.view']);
    expect(authorizedRedirect('/system/basic-settings', current)).toBe(
      '/system/basic-settings',
    );
    expect(authorizedRedirect('/system/report-email-settings', current)).toBe(
      '/system/basic-settings',
    );
  });

  it('lets any enabled archive section open the cover and preserves old approval links', () => {
    const current = user(['route.view', 'workstation.view'], ['route']);
    expect(canViewProcessArchive(current)).toBe(true);
    expect(authorizedRedirect(PROCESS_ARCHIVE_PATH, current)).toBe(PROCESS_ARCHIVE_PATH);
    expect(authorizedRedirect('/mo/workstation?approval_id=42', current)).toBe('/mo/workstation?approval_id=42');
    expect(authorizedRedirect('/mo/route?approval_id=42', current)).toBe('/mo/workstation');
    expect(canViewProcessArchive(user(['route.view'], ['route']))).toBe(false);
    expect(authorizedRedirect(PROCESS_ARCHIVE_PATH, user(['workorder.view']))).toBe('/mo/workorder');
  });
});
