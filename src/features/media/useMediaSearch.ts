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

/** Trending titles this week — shown when the search box is empty. */
export function useTrending() {
  return useQuery<MediaSummary[]>({
    queryKey: ['media_trending'],
    queryFn: () => mediaProvider.trending(),
    staleTime: 60 * 60_000,
  });
}
