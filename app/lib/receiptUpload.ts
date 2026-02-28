import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Opens the image picker and uploads the selected image to Supabase Storage.
 * Returns the public URL and storage path, or null if cancelled / failed.
 */
export async function pickAndUploadReceipt(
  userId: string,
  itemId: string
): Promise<UploadResult | null> {
  // Ask permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `${userId}/${itemId}/${fileName}`;

  // Fetch the file as a blob
  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('receipts')
    .upload(filePath, blob, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: false,
    });

  if (error) {
    console.error('Receipt upload failed:', error.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);

  // Also get a signed URL (more secure for private bucket)
  const { data: signedData } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  return {
    url: signedData?.signedUrl ?? publicUrl,
    path: filePath,
  };
}

/**
 * Takes a new photo and uploads it.
 */
export async function takeAndUploadReceipt(
  userId: string,
  itemId: string
): Promise<UploadResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `${userId}/${itemId}/${fileName}`;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('receipts')
    .upload(filePath, blob, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: false,
    });

  if (error) {
    console.error('Receipt upload failed:', error.message);
    return null;
  }

  const { data: signedData } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  return {
    url: signedData?.signedUrl ?? '',
    path: filePath,
  };
}

/**
 * Deletes a receipt from storage.
 */
export async function deleteReceipt(path: string): Promise<void> {
  await supabase.storage.from('receipts').remove([path]);
}
