import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  fetchFriendActivity,
  fetchFriendships,
  type FriendActivity,
  type FriendshipWithProfiles,
  type PublicProfile,
} from './api';

export const friendshipsKey = ['friendships'] as const;

export interface AcceptedFriend {
  friendship: FriendshipWithProfiles;
  profile: PublicProfile | null;
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

  const other = (f: FriendshipWithProfiles): PublicProfile | null =>
    f.user_id === me ? f.addressee : f.requester;

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
    activityByUser,
  };
}
