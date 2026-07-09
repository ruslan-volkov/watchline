import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateEntry } from '@/features/watch/api';
import { entriesKey } from '@/features/watch/useWatchEntries';
import { markEpisodes } from './api';
import type { EpisodeRef } from './cascade';

interface Vars {
  entryId: string;
  episode: EpisodeRef;
  /** Watched count *before* this mark, and season total, to sync entry status. */
  watchedBefore: number;
  total: number;
}

/** Marks one episode (the next one) from the home carousel and syncs status. */
export function useMarkNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, episode, watchedBefore, total }: Vars) => {
      await markEpisodes(entryId, [episode]);
      const now = new Date().toISOString().slice(0, 10);
      if (total > 0 && watchedBefore + 1 >= total) {
        await updateEntry({ entryId, patch: { status: 'completed', finished_at: now } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entriesKey });
      qc.invalidateQueries({ queryKey: ['episode_progress'] });
      qc.invalidateQueries({ queryKey: ['progress_all'] });
    },
  });
}
