import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { ensureMedia } from '@/features/watch/api';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { track } from '@/lib/analytics';
import type { MediaSummary } from '@/media/types';
import {
  dismissRecommendation,
  markAdded,
  markAllSeen,
  nudgeRecommendation,
  sendRecommendation,
} from './api';
import { mediaSummary, type RecommendationItem } from './feed';
import { recommendationsKey } from './useRecommendations';

/** Send, nudge, add and dismiss; all refresh the feed. */
export function useRecommendationMutations() {
  const qc = useQueryClient();
  const { add } = useEntryMutations('recommendations');

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: recommendationsKey }),
    [qc],
  );

  const send = useMutation({
    mutationFn: async (vars: {
      summary: MediaSummary;
      recipientIds: string[];
      message: string | null;
    }) => {
      const media = await ensureMedia(vars.summary);
      await sendRecommendation(media.id, vars.recipientIds, vars.message);
    },
    onSuccess: (_result, vars) => {
      invalidate();
      track('recommendation_sent', {
        media_type: vars.summary.mediaType,
        tmdb_id: vars.summary.tmdbId,
        recipient_count: vars.recipientIds.length,
        has_message: !!vars.message,
      });
    },
  });

  const nudge = useMutation({
    mutationFn: (vars: { id: string; message: string | null }) =>
      nudgeRecommendation(vars.id, vars.message),
    onSuccess: (_result, vars) => {
      invalidate();
      track('recommendation_nudged', { has_message: !!vars.message });
    },
  });

  const addToList = useMutation({
    mutationFn: async (item: RecommendationItem) => {
      await add.mutateAsync({ summary: mediaSummary(item.rec.media), status: 'plan_to_watch' });
      await markAdded(item.rec.id);
    },
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: (recommendationId: string) => dismissRecommendation(recommendationId),
    onSuccess: () => {
      invalidate();
      track('recommendation_dismissed');
    },
  });

  /** Not a useMutation: nobody asked for this, so a failure shouldn't raise an alert.
   *  The rows stay unseen and the next visit tries again. */
  const markSeen = useCallback(() => {
    markAllSeen().then(invalidate, () => undefined);
  }, [invalidate]);

  return { send, nudge, addToList, dismiss, markSeen };
}
