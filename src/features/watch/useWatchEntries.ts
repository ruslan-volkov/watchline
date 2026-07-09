import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, type EntryWithMedia } from './api';

export const entriesKey = ['watch_entries'] as const;

/** Current user's watch entries (with media). Empty list until authenticated. */
export function useWatchEntries() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery<EntryWithMedia[]>({
    queryKey: entriesKey,
    queryFn: () => fetchEntries(userId as string),
    enabled: !!userId,
  });
}
