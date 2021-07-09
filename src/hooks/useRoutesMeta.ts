import { useMemo } from 'react';
import { ROUTES_META } from '@src/config/routesMeta';

export function useRoutesMeta({
  includeHidden = false,
}: {
  includeHidden?: boolean;
} = {}) {
  return useMemo(() => {
    const arr = Object.values(ROUTES_META);
    return includeHidden ? arr : arr.filter((r) => !r.hidden);
  }, [includeHidden]);
}
