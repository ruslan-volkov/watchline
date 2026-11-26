import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/db';
import type { EpisodeRef } from './cascade';

export type EpisodeProgressRow = Tables<'episode_progress'>;

export async function fetchProgress(entryId: string): Promise<EpisodeProgressRow[]> {
  const { data, error } = await supabase
    .from('episode_progress')
    .select('*')
    .eq('entry_id', entryId);
  if (error) throw error;
  return data ?? [];
}

/** Progress rows for several entries in one round-trip (home carousel / library). */
export async function fetchProgressForEntries(entryIds: string[]): Promise<EpisodeProgressRow[]> {
  if (entryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('episode_progress')
    .select('*')
    .in('entry_id', entryIds);
  if (error) throw error;
  return data ?? [];
}

/** Insert progress rows for a set of episodes (ignoring ones already present). */
export async function markEpisodes(entryId: string, episodes: EpisodeRef[]): Promise<void> {
  if (episodes.length === 0) return;
  const rows = episodes.map((e) => ({
    entry_id: entryId,
    season_number: e.seasonNumber,
    episode_number: e.episodeNumber,
  }));
  const { error } = await supabase
    .from('episode_progress')
    .upsert(rows, { onConflict: 'entry_id,season_number,episode_number', ignoreDuplicates: true });
  if (error) throw error;
}

/** Delete progress rows for the given episodes (re-tap to uncheck / undo). */
export async function unmarkEpisodes(entryId: string, episodes: EpisodeRef[]): Promise<void> {
  for (const e of episodes) {
    const { error } = await supabase
      .from('episode_progress')
      .delete()
      .eq('entry_id', entryId)
      .eq('season_number', e.seasonNumber)
      .eq('episode_number', e.episodeNumber);
    if (error) throw error;
  }
}
