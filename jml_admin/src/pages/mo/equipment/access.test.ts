import access from '@/access';
import { authorizedRedirect } from '@/utils/adminPermissions';
import routes from '../../../../config/routes';

test('equipment has an independent route and menu permission', () => {
  const group = routes.find((row) => row.key === 'process-config');
  expect(
    group?.routes?.find((row) => row.path === '/mo/equipment'),
  ).toMatchObject({ access: 'canEquipment' });
  const allowed = access({ currentUser: { permissions: ['equipment.view'] } });
  expect(allowed.canEquipment).toBe(true);
  expect(allowed.canProcessConfig).toBe(true);
  expect(allowed.canProcessManagement).toBe(false);
  expect(allowed.can('equipment.edit')).toBe(false);
  expect(
    authorizedRedirect('/mo/equipment', { permissions: ['equipment.view'] }),
  ).toBe('/mo/equipment');
  const denied = access({
    currentUser: {
      permissions: ['equipment.view'],
      disabledPages: ['equipment'],
    },
  });
  expect(denied.canEquipment).toBe(false);
  expect(denied.canProcessConfig).toBe(false);
});

test('capacity approvers can reach the existing approval center', () => {
  expect(
    access({ currentUser: { permissions: ['equipment-capacity.approve'] } })
      .canApprovalCenter,
  ).toBe(true);
});
