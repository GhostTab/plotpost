import { supabase } from "./supabase";

export type MediaBucket = "avatars" | "covers";

/** Upload to Supabase Storage under `{userId}/{timestamp}-{safeName}` and return public URL. */
export async function uploadProfileMedia(
  bucket: MediaBucket,
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) {
    throw new Error(error.message || `Could not upload to ${bucket}.`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("Upload succeeded but no public URL was returned.");
  }
  return data.publicUrl;
}
