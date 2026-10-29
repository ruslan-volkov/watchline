import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/db';

export type PublicProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'avatar_url'>;
export type FriendshipRow = Tables<'friendships'>;

/**
 * Ping a friend's devices about a friendship event. Best effort: the row is
 * already written, so a failed notification must never read as a failed action.
 */
async function notify(fn: string, body: Record<string, string>): Promise<void> {
  try {
    await supabase.functions.invoke(fn, { body });
  } catch (_e) {
    // A missed notification is not worth failing the action over.
  }
}

/** Tell the addressee that a request is waiting for them. */
export function notifyFriendRequest(addresseeId: string): Promise<void> {
  return notify('notify-friend-request', { addresseeId });
}

/** Tell the requester that their request was accepted. */
export function notifyFriendAccepted(friendshipId: string): Promise<void> {
  return notify('notify-friend-accepted', { friendshipId });
}

/** A friendship with both linked profiles resolved (requester = user_id side). */
export interface FriendshipWithProfiles extends FriendshipRow {
  requester: PublicProfile | null;
  addressee: PublicProfile | null;
}

/** One line of a friend's passive activity ("Regarde …"). */
export interface FriendActivity {
  user_id: string;
  title: string;
  tmdb_id: number;
}

/** Discovery via SECURITY DEFINER RPC (username match, excludes self). */
export async function searchUsers(q: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc('search_profiles', { q });
  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

/** All friendships involving the current user, with both profiles embedded. */
export async function fetchFriendships(): Promise<FriendshipWithProfiles[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(
      '*, requester:profiles!friendships_user_id_fkey(id,username,avatar_url), addressee:profiles!friendships_friend_id_fkey(id,username,avatar_url)',
    );
  if (error) throw error;
  return (data ?? []) as unknown as FriendshipWithProfiles[];
}

export async function sendFriendRequest(meId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: meId, friend_id: friendId, status: 'pending' });
  if (error) throw error;
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

/** Used for decline, cancel outgoing, and un-friend — all a row delete. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

/**
 * Latest "watching" title per friend. RLS only returns rows for accepted friends
 * whose activity_visible is true, so hidden friends simply yield nothing.
 */
export async function fetchFriendActivity(friendIds: string[]): Promise<FriendActivity[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from('watch_entries')
    .select('user_id, updated_at, media(title, tmdb_id)')
    .in('user_id', friendIds)
    .eq('status', 'watching')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const seen = new Set<string>();
  const out: FriendActivity[] = [];
  for (const row of (data ?? []) as { user_id: string; media: { title: string; tmdb_id: number } | null }[]) {
    if (!row.media || seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    out.push({ user_id: row.user_id, title: row.media.title, tmdb_id: row.media.tmdb_id });
  }
  return out;
}
