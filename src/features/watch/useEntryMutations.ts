import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import type { MediaSummary, WatchStatus } from '@/media/types';
import { addEntry, deleteEntry, updateEntry, type WatchEntryRow } from './api';
import { entriesKey } from './useWatchEntries';

/** Add/move, update, and delete entries; all invalidate the entries list. */
export function useEntryMutations() {
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
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (vars: {
      entryId: string;
      patch: Partial<
        Pick<WatchEntryRow, 'status' | 'rating' | 'notes' | 'started_at' | 'finished_at' | 'snoozed'>
      >;
    }) => updateEntry(vars),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteEntry(entryId),
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
