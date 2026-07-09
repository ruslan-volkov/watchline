import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export interface AvatarPickResult {
  status: 'uploaded' | 'cancelled' | 'denied';
  avatarUrl?: string;
}

/**
 * Let the user pick a square photo, upload it to the `avatars` bucket under
 * their id, and return the new public URL (cache-busted). No-throw: returns a
 * status the caller can react to.
 */
export async function pickAndUploadAvatar(userId: string): Promise<AvatarPickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || !result.assets[0]?.base64) return { status: 'cancelled' };

  const asset = result.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';
  const path = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(asset.base64!), { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so expo-image reloads the new file at the same path.
  return { status: 'uploaded', avatarUrl: `${data.publicUrl}?t=${Date.now()}` };
}
