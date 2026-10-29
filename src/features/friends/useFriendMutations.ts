import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { acceptFriendRequest, removeFriendship, sendFriendRequest } from './api';
import { friendshipsKey } from './useFriends';

/** Send / accept / remove friendships; all refresh the friendships list. */
export function useFriendMutations() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const me = session?.user.id;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: friendshipsKey });
    qc.invalidateQueries({ queryKey: ['friend_activity'] });
  };

  const send = useMutation({
    mutationFn: (friendId: string) => sendFriendRequest(me as string, friendId),
    onSuccess: () => {
      invalidate();
      track('friend_request_sent');
    },
  });

  const accept = useMutation({
    mutationFn: (friendshipId: string) => acceptFriendRequest(friendshipId),
    onSuccess: () => {
      invalidate();
      track('friend_request_accepted');
    },
  });

  const remove = useMutation({
    mutationFn: (friendshipId: string) => removeFriendship(friendshipId),
    onSuccess: invalidate,
  });

  return { send, accept, remove };
}
