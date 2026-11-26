import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { fetchRecommendations } from './api';
import { buildFeed } from './feed';

export const recommendationsKey = ['recommendations'] as const;

/** The feed of sent and received recommendations, and how many are still unseen. */
export function useRecommendations() {
  const { session } = useAuth();
  const me = session?.user.id;

  const query = useQuery({
    queryKey: recommendationsKey,
    queryFn: fetchRecommendations,
    enabled: !!me,
  });
  const { data: entries } = useWatchEntries();

  const items = useMemo(
    () => buildFeed(query.data ?? [], me, new Set((entries ?? []).map((e) => e.media_id))),
    [query.data, me, entries],
  );
  const unseenCount = useMemo(() => items.filter((i) => i.unseen).length, [items]);

  return { isLoading: query.isLoading, items, unseenCount };
}
