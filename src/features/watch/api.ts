import { supabase } from '@/lib/supabase';
import type { MediaSummary, WatchStatus } from '@/media/types';
import type { Tables } from '@/types/db';

export type MediaRow = Tables<'media'>;
export type WatchEntryRow = Tables<'watch_entries'>;

/** A watch entry with its joined media row — the app's core list unit. */
export interface EntryWithMedia extends WatchEntryRow {
  media: MediaRow;
}

/** All of a user's entries (with media), newest first. */
export async function fetchEntries(userId: string): Promise<EntryWithMedia[]> {
  const { data, error } = await supabase
    .from('watch_entries')
    .select('*, media(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EntryWithMedia[];
}

/**
 * Ensure the shared media cache row exists, returning it. Inserts if absent and
 * does nothing if already present — media has INSERT/SELECT policies but no
 * UPDATE policy (it's a cache), so an on-conflict UPDATE would be blocked by RLS.
 */
export async function ensureMedia(summary: MediaSummary): Promise<MediaRow> {
  const { error: insertError } = await supabase.from('media').upsert(
    {
      tmdb_id: summary.tmdbId,
      media_type: summary.mediaType,
      title: summary.title,
      poster_path: summary.posterPath,
      backdrop_path: summary.backdropPath ?? null,
      release_date: summary.releaseDate,
    },
    { onConflict: 'tmdb_id,media_type', ignoreDuplicates: true },
  );
  if (insertError) throw insertError;

  const { data, error } = await supabase
    .from('media')
    .select()
    .eq('tmdb_id', summary.tmdbId)
    .eq('media_type', summary.mediaType)
    .single();
  if (error) throw error;
  return data;
}

interface AddParams {
  userId: string;
  summary: MediaSummary;
  status: WatchStatus;
}

/** Add (or move) a title to the user's list at the chosen status. */
export async function addEntry({ userId, summary, status }: AddParams): Promise<EntryWithMedia> {
  const media = await ensureMedia(summary);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('watch_entries')
    .upsert(
      {
        user_id: userId,
        media_id: media.id,
        status,
        started_at: status === 'watching' ? today : null,
        finished_at: status === 'completed' ? today : null,
      },
      { onConflict: 'user_id,media_id' },
    )
    .select('*, media(*)')
    .single();
  if (error) throw error;
  return data as EntryWithMedia;
}

interface UpdateParams {
  entryId: string;
  patch: Partial<
    Pick<WatchEntryRow, 'status' | 'rating' | 'notes' | 'started_at' | 'finished_at' | 'snoozed'>
  >;
}

export async function updateEntry({ entryId, patch }: UpdateParams): Promise<EntryWithMedia> {
  const { data, error } = await supabase
    .from('watch_entries')
    .update(patch)
    .eq('id', entryId)
    .select('*, media(*)')
    .single();
  if (error) throw error;
  return data as EntryWithMedia;
}

export async function deleteEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('watch_entries').delete().eq('id', entryId);
  if (error) throw error;
}
