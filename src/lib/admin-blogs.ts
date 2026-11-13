import { createClient } from "@/lib/supabase/client";


const supabase = createClient()
export interface AdminBlogRow {
  id: string;
  slug: string;
  title: string;
  subtext: string;
  summary: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  admin_access: {
    id: string;
    username: string;
    email: string;
    role: string;
  } | null;
}

export async function getAdminBlogs(): Promise<AdminBlogRow[]> {
  const { data, error } = await supabase
    .from("blogs")
    .select(`
      id,
      slug,
      title,
      subtext,
      summary,
      cover_image_url,
      is_published,
      published_at,
      created_at,
      updated_at,
      created_by,
      admin_access:created_by (
        id,
        username,
        email,
        role
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin blogs:", error);
    return [];
  }

  return (data ?? []) as unknown as AdminBlogRow[];
}

export async function toggleBlogPublished(
  blogId: string,
  isPublished: boolean
) {
  const { error } = await supabase
    .from("blogs")
    .update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    })
    .eq("id", blogId);

  if (error) throw error;
}

export async function deleteBlog(blogId: string) {
  const { error } = await supabase
    .from("blogs")
    .delete()
    .eq("id", blogId);

  if (error) throw error;
}

export interface BlogBlockRow {
  id: string;
  blog_id: string;
  position ?: number;
  block_type: "heading" | "subheading" | "paragraph" | "image" | "quote" | "list";
  heading: string | null;
  text: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_caption: string | null;
  list_items: string[] | null;
}

export async function getAdminBlogById(blogId: string) {
  const { data, error } = await supabase
    .from("blogs")
    .select(`
      id,
      slug,
      title,
      subtext,
      summary,
      cover_image_url,
      cover_image_alt,
      author_name,
      reading_time_minutes,
      tags,
      is_published,
      published_at,
      created_by,
      blog_blocks (
        id,
        blog_id,
        position,
        block_type,
        heading,
        text,
        image_url,
        image_alt,
        image_caption,
        list_items
      )
    `)
    .eq("id", blogId)
    .order("position", {
      ascending: true,
      referencedTable: "blog_blocks",
    })
    .maybeSingle();

  if (error) {
    console.error("Error fetching blog:", error);
    return null;
  }

  return data;
}

export async function updateBlog(
  blogId: string,
  updates: Record<string, unknown>
) {
  const { error } = await supabase
    .from("blogs")
    .update(updates)
    .eq("id", blogId);

  if (error) throw error;
}

export async function replaceBlogBlocks(
  blogId: string,
  blocks: Omit<BlogBlockRow, "id" | "blog_id">[]
) {
  const { error: deleteError } = await supabase
    .from("blog_blocks")
    .delete()
    .eq("blog_id", blogId);

  if (deleteError) throw deleteError;

  if (blocks.length === 0) return;

  const { error: insertError } = await supabase
    .from("blog_blocks")
    .insert(
      blocks.map((block, index) => ({
        ...block,
        blog_id: blogId,
        position: index + 1,
      }))
    );

  if (insertError) throw insertError;
}