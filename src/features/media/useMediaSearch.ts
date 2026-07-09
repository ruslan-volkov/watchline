import { useQuery } from '@tanstack/react-query';

import { mediaProvider } from '@/media/provider';
import type { MediaSummary } from '@/media/types';

/** Search the active media source (mock today, TMDB later). */
export function useMediaSearch(query: string) {
  const trimmed = query.trim();
  return useQuery<MediaSummary[]>({
    queryKey: ['media_search', trimmed],
    queryFn: () => mediaProvider.search(trimmed),
    staleTime: 60_000,
  });
}
