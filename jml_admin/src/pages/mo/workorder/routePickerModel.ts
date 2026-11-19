export type RouteOption = {
  id: number;
  route_code: string;
  route_name: string;
  version_group?: string;
  dept_code?: string;
  dept_name?: string;
  product_codes?: string[];
  default_product_codes?: string[];
  is_current?: number;
  product_names?: string;
  description?: string;
  version_no?: number;
  is_default?: number;
  usage_count?: number;
};

export type RouteVersionOption = RouteOption & {
  group_key: string;
  versions: RouteOption[];
};

export function groupRouteOptions(
  routes: RouteOption[],
  choices: Record<string, number>,
  initialRouteId?: number,
  categoryCode?: string,
  matchingRoutes: RouteOption[] = routes,
): RouteVersionOption[] {
  const groups = new Map<string, RouteOption[]>();
  for (const route of routes) {
    const key = route.version_group || route.route_code;
    const versions = groups.get(key) || [];
    versions.push(route);
    groups.set(key, versions);
  }
  const visibleKeys = [...new Set(matchingRoutes.map(route => route.version_group || route.route_code))];
  return visibleKeys.map(key => {
    const versions = [...groups.get(key)!].sort((left, right) =>
      (right.version_no || 1) - (left.version_no || 1) || right.id - left.id);
    const route = versions.find(item => item.id === choices[key])
      || versions.find(item => item.id === initialRouteId)
      || versions.find(item => categoryCode && item.default_product_codes?.includes(categoryCode))
      || versions.find(item => item.is_current)
      || versions[0];
    return { ...route, group_key: key, versions };
  });
}

export type RouteFilters = {
  keyword: string;
  deptCode?: string;
  categoryCode?: string;
};

const includes = (value: unknown, keyword: string) =>
  String(value || '')
    .toLowerCase()
    .includes(keyword);

export function filterRouteOptions(
  routes: RouteOption[],
  filters: RouteFilters,
  preferred?: { deptCode?: string; categoryCode?: string },
) {
  const keyword = filters.keyword.trim().toLowerCase();
  return routes
    .filter((route) => {
      if (filters.deptCode && route.dept_code !== filters.deptCode)
        return false;
      if (
        filters.categoryCode &&
        !route.product_codes?.includes(filters.categoryCode)
      )
        return false;
      return (
        !keyword ||
        [
          route.route_code,
          route.version_group,
          route.route_name,
          route.dept_code,
          route.dept_name,
          route.product_codes?.join(' '),
          route.product_names,
          route.description,
        ].some((value) => includes(value, keyword))
      );
    })
    .map((route, index) => ({
      route,
      index,
      score:
        (preferred?.categoryCode &&
        route.product_codes?.includes(preferred.categoryCode)
          ? 4
          : 0) +
        (preferred?.deptCode && route.dept_code === preferred.deptCode
          ? 2
          : 0) +
        ((preferred?.categoryCode
          ? route.default_product_codes?.includes(preferred.categoryCode)
          : route.is_current || route.is_default) ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ route }) => route);
}
