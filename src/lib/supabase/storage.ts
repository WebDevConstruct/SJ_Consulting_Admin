// lib/supabase/storage.ts
import { createClient } from "@/lib/supabase/client";

const BUCKET = "announcement-images";

export async function uploadAnnouncementImage(
  file: File,
  announcementId?: string,
): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop() || "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Optional: organize by category or id
  const folder = announcementId ? `announcements/${announcementId}` : "announcements/drafts";
  const path = `${folder}/${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    throw error || new Error("Image upload failed");
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to get public URL");
  }

  return urlData.publicUrl;
}