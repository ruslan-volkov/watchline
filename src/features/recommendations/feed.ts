import type { PublicProfile } from '@/features/friends/api';
import type { MediaSummary } from '@/media/types';
import type { RecommendationWithDetails } from './api';

/** Kept in one place so the screen can move without touching what links to it. */
export const RECOMMENDATIONS_ROUTE = '/recommendations';

export type Direction = 'received' | 'sent';
export type FeedFilter = 'all' | Direction;

export interface RecommendationItem {
  rec: RecommendationWithDetails;
  direction: Direction;
  /** The friend on the other end. */
  other: PublicProfile | null;
  /** Received and not looked at yet. */
  unseen: boolean;
  /** The title is already in the current user's list. */
  inMyList: boolean;
}

function lastActivity(rec: RecommendationWithDetails): string {
  return rec.last_nudged_at ?? rec.created_at;
}

/** Sent and received in one list, latest activity first, minus "Pas pour moi". */
export function buildFeed(
  rows: RecommendationWithDetails[],
  me: string | undefined,
  myMediaIds: Set<string>,
): RecommendationItem[] {
  return rows
    .filter((rec) => !rec.inbox?.dismissed_at)
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
    .map((rec) => {
      const direction: Direction = rec.sender_id === me ? 'sent' : 'received';
      return {
        rec,
        direction,
        other: direction === 'sent' ? rec.recipient : rec.sender,
        unseen: direction === 'received' && !rec.inbox?.seen_at,
        inMyList: myMediaIds.has(rec.media_id),
      };
    });
}

export function filterFeed(items: RecommendationItem[], filter: FeedFilter): RecommendationItem[] {
  return filter === 'all' ? items : items.filter((i) => i.direction === filter);
}

/** Friends this title was already sent to: going back to them is a nudge. */
export function alreadyRecommendedTo(
  items: RecommendationItem[],
  summary: Pick<MediaSummary, 'tmdbId' | 'mediaType'>,
): Set<string> {
  return new Set(
    items
      .filter(
        ({ direction, rec }) =>
          direction === 'sent' &&
          rec.media.tmdb_id === summary.tmdbId &&
          rec.media.media_type === summary.mediaType,
      )
      .map(({ rec }) => rec.recipient_id),
  );
}

export function mediaSummary(media: RecommendationWithDetails['media']): MediaSummary {
  return {
    tmdbId: media.tmdb_id,
    mediaType: media.media_type,
    title: media.title,
    posterPath: media.poster_path,
    backdropPath: media.backdrop_path,
    releaseDate: media.release_date,
  };
}
