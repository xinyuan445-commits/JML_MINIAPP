import { filterRouteOptions, groupRouteOptions, type RouteOption } from './routePickerModel';

const routes: RouteOption[] = [
  {
    id: 1,
    route_code: 'RT-PAINT',
    route_name: '喷涂路线',
    dept_code: 'D02',
    dept_name: '涂装部',
    product_codes: ['CHAIR'],
    product_names: '椅子',
    description: '适用于木椅喷涂',
  },
  {
    id: 2,
    route_code: 'RT-CUT',
    route_name: '开料路线',
    dept_code: 'D01',
    dept_name: '木工部',
    product_codes: ['TABLE'],
    product_names: '桌子',
    is_default: 1,
  },
  {
    id: 3,
    route_code: 'RT-CHAIR',
    route_name: '椅子组装',
    dept_code: 'D01',
    dept_name: '木工部',
    product_codes: ['CHAIR'],
    product_names: '椅子',
  },
];

const versions: RouteOption[] = [
  { ...routes[2], id: 10, version_group: 'RT-CHAIR', version_no: 1, is_current: 0 },
  { ...routes[2], id: 20, version_group: 'RT-CHAIR', version_no: 2, is_current: 1, default_product_codes: ['CHAIR'] },
  { ...routes[2], id: 30, version_group: 'RT-CHAIR', version_no: 3, is_current: 0 },
];

describe('workorder route picker model', () => {
  it('finds RT-PROD-07 and lets the user choose the original code instead of default V3', () => {
    const hplVersions: RouteOption[] = [
      { id: 38, route_code: 'RT-PROD-07', route_name: 'HPL生产路线', version_group: 'RT-PROD-07', version_no: 1 },
      { id: 73, route_code: 'RT-PROD-07-MO-V2', route_name: 'HPL报工路线V2', version_group: 'RT-PROD-07', version_no: 2 },
      { id: 93, route_code: 'RT-PROD-07-V3', route_name: 'HPL报工路线V3', version_group: 'RT-PROD-07', version_no: 3, is_current: 1 },
    ];
    const hits = filterRouteOptions(hplVersions, { keyword: 'RT-PROD-07' });
    const initial = groupRouteOptions(hplVersions, {}, undefined, undefined, hits);
    expect(initial).toHaveLength(1);
    expect(initial[0].group_key).toBe('RT-PROD-07');
    expect(initial[0].id).toBe(93);
    expect(initial[0].versions.map(route => route.route_code)).toEqual([
      'RT-PROD-07-V3', 'RT-PROD-07-MO-V2', 'RT-PROD-07',
    ]);
    const chosen = groupRouteOptions(hplVersions, { 'RT-PROD-07': 38 }, undefined, undefined, hits);
    expect(chosen[0].group_key).toBe('RT-PROD-07');
    expect(chosen[0].id).toBe(38);
    expect(chosen[0].route_code).toBe('RT-PROD-07');
  });
  it('shows one row per route with the default version and all version choices', () => {
    const grouped = groupRouteOptions([...versions, routes[0]], {}, undefined, 'CHAIR');
    expect(grouped).toHaveLength(2);
    expect(grouped[0].id).toBe(20);
    expect(grouped[0].versions.map(route => route.id)).toEqual([30, 20, 10]);
  });

  it('keeps the currently bound version when opening the picker', () => {
    expect(groupRouteOptions(versions, {}, 10, 'CHAIR')[0].id).toBe(10);
  });

  it('keeps all enabled version choices when a search only matches one version', () => {
    const enabled = versions.slice(1);
    const routesWithCodes = enabled.map(route => ({ ...route, route_code: `RT-CHAIR-V${route.version_no}` }));
    const hits = filterRouteOptions(routesWithCodes, { keyword: 'RT-CHAIR-V3' });
    const groups = groupRouteOptions(routesWithCodes, {}, undefined, 'CHAIR', hits);
    expect(groups).toHaveLength(1);
    expect(groups[0].versions.map(route => route.id)).toEqual([30, 20]);
    expect(groups[0].id).toBe(20);
  });

  it('preserves a chosen older version while searching for a different version in the same route', () => {
    const grouped = groupRouteOptions(versions, { 'RT-CHAIR': 10 }, undefined, undefined, [versions[2]]);
    expect(grouped[0].id).toBe(10);
    expect(grouped[0].versions).toHaveLength(3);
  });

  it('uses the version explicitly chosen by the user instead of the default or initial version', () => {
    expect(groupRouteOptions(versions, { 'RT-CHAIR': 30 }, 10, 'CHAIR')[0].id).toBe(30);
  });

  it('falls back to the latest selectable version if no default exists', () => {
    expect(groupRouteOptions([versions[0], versions[2]], {})[0].id).toBe(30);
  });

  it('keeps different route groups separate even when their names match', () => {
    expect(groupRouteOptions([
      versions[0], { ...versions[1], version_group: 'OTHER-CHAIR' },
    ], {})).toHaveLength(2);
  });
  it('recommends the category default while keeping parallel versions selectable', () => {
    const parallel: RouteOption[] = [
      { ...routes[2], id: 10, version_no: 1, is_current: 0, default_product_codes: [] },
      { ...routes[2], id: 20, version_no: 2, is_current: 1, default_product_codes: ['CHAIR'] },
      { ...routes[2], id: 30, version_no: 3, is_current: 0, default_product_codes: [] },
    ];
    expect(filterRouteOptions(parallel, { keyword: '' }, { categoryCode: 'CHAIR' })
      .map(route => route.id)).toEqual([20, 10, 30]);
  });
  it('searches route details including department, category and description', () => {
    expect(
      filterRouteOptions(routes, { keyword: '木椅' }).map((route) => route.id),
    ).toEqual([1]);
    expect(
      filterRouteOptions(routes, { keyword: '木工部' }).map(
        (route) => route.id,
      ),
    ).toEqual([2, 3]);
    expect(
      filterRouteOptions(routes, { keyword: '椅子' }).map((route) => route.id),
    ).toEqual([1, 3]);
    expect(
      filterRouteOptions(routes, { keyword: 'TABLE' }).map((route) => route.id),
    ).toEqual([2]);
  });

  it('combines department and product category filters', () => {
    expect(
      filterRouteOptions(routes, {
        keyword: '',
        deptCode: 'D01',
        categoryCode: 'CHAIR',
      }).map((route) => route.id),
    ).toEqual([3]);
  });

  it('puts matching recommendations first without hiding other routes', () => {
    expect(
      filterRouteOptions(
        routes,
        { keyword: '' },
        { deptCode: 'D01', categoryCode: 'CHAIR' },
      ).map((route) => route.id),
    ).toEqual([3, 1, 2]);
  });
});
