import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh helper: refetches the given query keys and tracks the spinner
 * state for a RefreshControl. Keys are matched by prefix, like invalidateQueries.
 */
export function usePullRefresh(keys: QueryKey[]) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(keys.map((key) => qc.refetchQueries({ queryKey: key })));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  return { refreshing, onRefresh };
}
