import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { track, type Surface } from '@/lib/analytics';
import type { MediaSummary, WatchStatus } from '@/media/types';
import { addEntry, deleteEntry, updateEntry, type WatchEntryRow } from './api';
import { entriesKey } from './useWatchEntries';

/**
 * Add/move, update, and delete entries; all invalidate the entries list.
 *
 * `surface` is where the hook is mounted ("search", "home", …). It rides along
 * on every analytics event from here, so the same action can be compared
 * between the places it's offered from, without each call site repeating it.
 */
export function useEntryMutations(surface: Surface) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: entriesKey });
    qc.invalidateQueries({ queryKey: ['episode_progress'] });
  };

  const add = useMutation({
    mutationFn: (vars: { summary: MediaSummary; status: WatchStatus }) =>
      addEntry({ userId: userId as string, summary: vars.summary, status: vars.status }),
    onSuccess: (_data, vars) => {
      invalidate();
      track('entry_added', {
        media_type: vars.summary.mediaType,
        status: vars.status,
        tmdb_id: vars.summary.tmdbId,
        source: surface,
      });
    },
  });

  const update = useMutation({
    mutationFn: (vars: {
      entryId: string;
      patch: Partial<
        Pick<
          WatchEntryRow,
          'status' | 'rating' | 'notes' | 'started_at' | 'finished_at' | 'snoozed'
        >
      >;
    }) => updateEntry(vars),
    onSuccess: (_data, vars) => {
      invalidate();
      // One patch can carry several kinds of change (the rating sheet writes
      // rating + notes together), so report each dimension it touched.
      const { patch } = vars;
      if (patch.status !== undefined) {
        track('entry_status_changed', { status: patch.status, source: surface });
      }
      if (patch.rating !== undefined || patch.notes !== undefined) {
        track('entry_rated', {
          rating: patch.rating ?? null,
          has_notes: !!patch.notes,
          source: surface,
        });
      }
      if (patch.snoozed !== undefined) {
        track('entry_snooze_toggled', { snoozed: patch.snoozed, source: surface });
      }
    },
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteEntry(entryId),
    onSuccess: () => {
      invalidate();
      track('entry_removed', { source: surface });
    },
  });

  return { add, update, remove };
}
