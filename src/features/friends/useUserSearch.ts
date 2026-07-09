import { useQuery } from '@tanstack/react-query';

import { searchUsers, type PublicProfile } from './api';

/** Username search for adding friends (empty query returns nothing). */
export function useUserSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<PublicProfile[]>({
    queryKey: ['user_search', trimmed],
    queryFn: () => searchUsers(trimmed),
    enabled: trimmed.length >= 2,
  });
}
