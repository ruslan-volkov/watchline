import type { PublicProfile } from '@/features/friends/api';
import type { MediaRow } from '@/features/watch/api';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/db';

/**
 * A recommendation with what a list row needs. `inbox` is what the recipient did with
 * it: RLS only hands it to the recipient, so it is `null` on the sender's side.
 */
export interface RecommendationWithDetails extends Tables<'recommendations'> {
  media: MediaRow;
  sender: PublicProfile | null;
  recipient: PublicProfile | null;
  inbox: Pick<Tables<'recommendation_inbox'>, 'seen_at' | 'dismissed_at'> | null;
}

/** Everything the current user sent or received. */
export async function fetchRecommendations(): Promise<RecommendationWithDetails[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select(
      '*, media(*), sender:profiles!recommendations_sender_id_fkey(id,username,avatar_url), recipient:profiles!recommendations_recipient_id_fkey(id,username,avatar_url), inbox:recommendation_inbox(seen_at,dismissed_at)',
    );
  if (error) throw error;
  return (data ?? []) as unknown as RecommendationWithDetails[];
}

/** Unlike the friend pings, the function writes the row: its failure is the action's. */
async function invokeRecommend(body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('recommend-media', { body });
  if (error) throw error;
}

export function sendRecommendation(
  mediaId: string,
  recipientIds: string[],
  message: string | null,
): Promise<void> {
  return invokeRecommend({ mediaId, recipientIds, message });
}

export function nudgeRecommendation(
  recommendationId: string,
  message: string | null,
): Promise<void> {
  return invokeRecommend({ recommendationId, message });
}

/** RLS limits this to the caller's own inbox. */
export async function markAllSeen(): Promise<void> {
  const { error } = await supabase
    .from('recommendation_inbox')
    .update({ seen_at: new Date().toISOString() })
    .is('seen_at', null);
  if (error) throw error;
}

export async function dismissRecommendation(recommendationId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendation_inbox')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('recommendation_id', recommendationId);
  if (error) throw error;
}

/** Lets the sender know their recommendation landed. */
export async function markAdded(recommendationId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({ added_at: new Date().toISOString() })
    .eq('id', recommendationId);
  if (error) throw error;
}
