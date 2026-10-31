import type { RecommendationWithDetails } from './api';
import { alreadyRecommendedTo, buildFeed, filterFeed } from './feed';

const ME = 'me';
const JULIE = { id: 'julie', username: 'julie', avatar_url: null };
const SELF = { id: ME, username: 'moi', avatar_url: null };

function rec(overrides: Partial<RecommendationWithDetails>): RecommendationWithDetails {
  return {
    id: 'r1',
    sender_id: JULIE.id,
    recipient_id: ME,
    media_id: 'm1',
    message: null,
    created_at: '2026-10-01T10:00:00Z',
    last_nudged_at: null,
    nudge_count: 0,
    added_at: null,
    media: { id: 'm1', tmdb_id: 1, media_type: 'movie', title: 'Film' },
    sender: JULIE,
    recipient: SELF,
    inbox: { seen_at: null, dismissed_at: null },
    ...overrides,
  } as RecommendationWithDetails;
}

const sent = (overrides: Partial<RecommendationWithDetails> = {}) =>
  rec({ sender_id: ME, recipient_id: JULIE.id, sender: SELF, recipient: JULIE, inbox: null, ...overrides });

describe('buildFeed', () => {
  it('tells received from sent, and shows the friend on the other end', () => {
    const [received, outgoing] = buildFeed(
      [rec({ id: 'in', created_at: '2026-10-02T00:00:00Z' }), sent({ id: 'out' })],
      ME,
      new Set(),
    );
    expect(received).toMatchObject({ direction: 'received', other: JULIE });
    expect(outgoing).toMatchObject({ direction: 'sent', other: JULIE });
  });

  it('sorts by latest activity, so a nudge brings a row back to the top', () => {
    const feed = buildFeed(
      [
        rec({ id: 'recent', created_at: '2026-10-05T00:00:00Z' }),
        rec({
          id: 'nudged',
          created_at: '2026-09-01T00:00:00Z',
          last_nudged_at: '2026-10-06T00:00:00Z',
        }),
      ],
      ME,
      new Set(),
    );
    expect(feed.map((i) => i.rec.id)).toEqual(['nudged', 'recent']);
  });

  it('leaves dismissed titles out', () => {
    const dismissed = rec({ inbox: { seen_at: null, dismissed_at: '2026-10-02T00:00:00Z' } });
    expect(buildFeed([dismissed], ME, new Set())).toEqual([]);
  });

  it('only counts received rows as unseen', () => {
    const feed = buildFeed(
      [
        rec({ id: 'new' }),
        rec({ id: 'read', inbox: { seen_at: '2026-10-02T00:00:00Z', dismissed_at: null } }),
        sent({ id: 'out' }),
      ],
      ME,
      new Set(),
    );
    expect(feed.filter((i) => i.unseen).map((i) => i.rec.id)).toEqual(['new']);
  });

  it('flags titles already in my list', () => {
    expect(buildFeed([rec({})], ME, new Set(['m1']))[0].inMyList).toBe(true);
    expect(buildFeed([rec({})], ME, new Set(['other']))[0].inMyList).toBe(false);
  });
});

describe('filterFeed', () => {
  const feed = buildFeed([rec({ id: 'in' }), sent({ id: 'out' })], ME, new Set());

  it('keeps everything on "Tout"', () => {
    expect(filterFeed(feed, 'all')).toHaveLength(2);
  });

  it('keeps one direction otherwise', () => {
    expect(filterFeed(feed, 'received').map((i) => i.rec.id)).toEqual(['in']);
    expect(filterFeed(feed, 'sent').map((i) => i.rec.id)).toEqual(['out']);
  });
});

describe('alreadyRecommendedTo', () => {
  it('lists the friends who got this title from me, not the ones who sent it to me', () => {
    const feed = buildFeed([rec({ id: 'in' }), sent({ id: 'out' })], ME, new Set());
    expect(alreadyRecommendedTo(feed, { tmdbId: 1, mediaType: 'movie' })).toEqual(
      new Set([JULIE.id]),
    );
  });

  it('does not mix a film and a series that share a TMDB id', () => {
    const feed = buildFeed([sent()], ME, new Set());
    expect(alreadyRecommendedTo(feed, { tmdbId: 1, mediaType: 'tv' }).size).toBe(0);
  });
});
