import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/**
 * Disk copy of the query cache. Without it every cold start begins empty and
 * the home list can only appear once Supabase *and* TMDB have answered; with
 * it, the last session's lists are on screen immediately and refresh behind.
 *
 * Holds one account's data, so it must be wiped whenever the account changes
 * (see AuthContext) — otherwise the previous user's entries would come back
 * from disk on the next launch.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'watchline-query-cache',
  throttleTime: 1_000,
});

/** A week — long enough to cover a holiday, short enough to stay plausible. */
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
