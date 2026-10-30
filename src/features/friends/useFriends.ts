import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchFriendActivity,
  fetchFriendships,
  type FriendActivity,
  type FriendProfile,
  type FriendshipWithProfiles,
} from './api';

export const friendshipsKey = ['friendships'] as const;

export interface AcceptedFriend {
  friendship: FriendshipWithProfiles;
  profile: FriendProfile | null;
}

/** Where someone already stands with the signed-in user. */
export type FriendRelation = 'friend' | 'incoming' | 'outgoing';

/** Everything known about one other user, keyed by their id in `links`. */
export interface FriendLink {
  relation: FriendRelation;
  profile: FriendProfile | null;
}

/** Derives accepted friends, incoming/outgoing requests, and passive activity. */
export function useFriends() {
  const { session } = useAuth();
  const me = session?.user.id;

  const query = useQuery({
    queryKey: friendshipsKey,
    queryFn: fetchFriendships,
    enabled: !!me,
  });

  const friendships = useMemo(() => query.data ?? [], [query.data]);

  const other = (f: FriendshipWithProfiles): FriendProfile | null =>
    f.user_id === me ? f.addressee : f.requester;

  // Read from the row, not from the embedded profile, which is missing whenever
  // RLS declines to hand it over.
  const otherId = (f: FriendshipWithProfiles): string =>
    f.user_id === me ? f.friend_id : f.user_id;

  const acceptedFriends = useMemo<AcceptedFriend[]>(
    () =>
      friendships
        .filter((f) => f.status === 'accepted')
        .map((f) => ({ friendship: f, profile: other(f) })),
    [friendships, me],
  );

  const incoming = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.friend_id === me),
    [friendships, me],
  );

  const outgoing = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.user_id === me),
    [friendships, me],
  );

  /** Answers "who is this person to me?" for any user id. */
  const links = useMemo(() => {
    const map = new Map<string, FriendLink>();
    for (const f of friendships) {
      const relation: FriendRelation =
        f.status === 'accepted' ? 'friend' : f.friend_id === me ? 'incoming' : 'outgoing';
      map.set(otherId(f), { relation, profile: other(f) });
    }
    return map;
  }, [friendships, me]);

  const friendIds = useMemo(
    () => acceptedFriends.map((a) => a.profile?.id).filter(Boolean) as string[],
    [acceptedFriends],
  );

  const activityQuery = useQuery({
    queryKey: ['friend_activity', friendIds],
    queryFn: () => fetchFriendActivity(friendIds),
    enabled: friendIds.length > 0,
  });

  const activityByUser = useMemo(() => {
    const map = new Map<string, FriendActivity>();
    for (const a of activityQuery.data ?? []) map.set(a.user_id, a);
    return map;
  }, [activityQuery.data]);

  return {
    isLoading: query.isLoading,
    me,
    acceptedFriends,
    incoming,
    outgoing,
    other,
    links,
    activityByUser,
  };
}
