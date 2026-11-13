// src/services/admin-announcements.ts
import { createClient } from "@/lib/supabase/client";
import type {
  AnnouncementCategory,
  AnnouncementRecord,
} from "@/types/announcement";

const ANNOUNCEMENT_SELECT = [
  "id",
  "category",
  "title",
  "subtext",
  "content",
  "summary",
  "slug",
  "source_name",
  "image_url",
  "link",
  "location",
  "event_date",
  "is_published",
  "created_at",
  "updated_at",
].join(", ");

export async function getAdminAnnouncements(
    
  category?: AnnouncementCategory,
): Promise<AnnouncementRecord[]> {
    const supabase =  await createClient();
  let query = supabase
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAdminAnnouncements failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(error.message);
  }

  return (data ?? []) as unknown as AnnouncementRecord[];
}