"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAdminBlogById,
  replaceBlogBlocks,
  updateBlog,
} from "@/lib/admin-blogs";

type BlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "image"
  | "quote"
  | "list";

interface EditableBlock {
  key: string;
  id?: string;
  block_type: BlockType;
  text: string;
  image_url: string;
  image_alt: string;
  image_caption: string;
  list_items: string;
}

export default function EditBlogPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const blogId = params.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtext, setSubtext] = useState("");
  const [summary, setSummary] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [readingTime, setReadingTime] = useState("");
  const [tags, setTags] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const [blocks, setBlocks] = useState<EditableBlock[]>([]);

  useEffect(() => {
    async function loadBlog() {
      if (!blogId) return;

      const blog = await getAdminBlogById(blogId);

      if (!blog) {
        setErrorMessage("Blog post not found.");
        setIsLoading(false);
        return;
      }

      setTitle(blog.title);
      setSlug(blog.slug);
      setSubtext(blog.subtext);
      setSummary(blog.summary ?? "");
      setCoverImageUrl(blog.cover_image_url ?? "");
      setCoverAlt(blog.cover_image_alt ?? "");
      setAuthorName(blog.author_name ?? "");
      setReadingTime(blog.reading_time_minutes?.toString() ?? "");
      setTags((blog.tags ?? []).join(", "));
      setIsPublished(blog.is_published);

      setBlocks(
        (blog.blog_blocks ?? []).map((block) => ({
          key: block.id,
          id: block.id,
          block_type: block.block_type,
          text: block.text ?? block.heading ?? "",
          image_url: block.image_url ?? "",
          image_alt: block.image_alt ?? "",
          image_caption: block.image_caption ?? "",
          list_items: (block.list_items ?? []).join("\n"),
        }))
      );

      setIsLoading(false);
    }

    void loadBlog();
  }, [blogId]);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function addBlock(type: BlockType) {
    setBlocks((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        block_type: type,
        text: "",
        image_url: "",
        image_alt: "",
        image_caption: "",
        list_items: "",
      },
    ]);
  }

  function removeBlock(key: string) {
    setBlocks((current) =>
      current.filter((block) => block.key !== key)
    );
  }

  function moveBlock(index: number, direction: "up" | "down") {
    setBlocks((current) => {
      const next = [...current];
      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= next.length) return current;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateBlock(key: string, updates: Partial<EditableBlock>) {
    setBlocks((current) =>
      current.map((block) =>
        block.key === key ? { ...block, ...updates } : block
      )
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const cleanSlug = generateSlug(slug);

      if (!title.trim() || !cleanSlug || !subtext.trim()) {
        throw new Error("Title, slug, and subtext are required.");
      }

      await updateBlog(blogId, {
        title: title.trim(),
        slug: cleanSlug,
        subtext: subtext.trim(),
        summary: summary.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        cover_image_alt: coverAlt.trim() || null,
        author_name: authorName.trim() || null,
        reading_time_minutes: readingTime
          ? Number(readingTime)
          : null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      });

      const preparedBlocks = blocks
        .map((block) => ({
          block_type: block.block_type,
          heading:
            block.block_type === "heading" ||
            block.block_type === "subheading"
              ? block.text.trim() || null
              : null,
          text:
            block.block_type === "paragraph" ||
            block.block_type === "quote"
              ? block.text.trim() || null
              : null,
          image_url:
            block.block_type === "image"
              ? block.image_url.trim() || null
              : null,
          image_alt:
            block.block_type === "image"
              ? block.image_alt.trim() || null
              : null,
          image_caption:
            block.block_type === "image"
              ? block.image_caption.trim() || null
              : null,
          list_items:
            block.block_type === "list"
              ? block.list_items
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : null,
        }))
        .filter((block) => {
          if (block.block_type === "image") {
            return Boolean(block.image_url);
          }

          if (block.block_type === "list") {
            return Boolean(block.list_items?.length);
          }

          return Boolean(block.heading || block.text);
        });

      await replaceBlogBlocks(blogId, preparedBlocks);

      router.push("/admin/blogs");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update the blog post."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-paper-line bg-paper p-10 text-center dark:border-ink-line dark:bg-ink-surface">
        <p className="font-display text-2xl">Loading blog post…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-gold-600">
            Editorial operations
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-tightest">
            Edit blog post
          </h1>
        </div>

        <button
          type="submit"
          form="edit-blog-form"
          disabled={isSaving}
          className="rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </header>

      {errorMessage ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <form
        id="edit-blog-form"
        onSubmit={handleSave}
        className="space-y-6"
      >
        <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <h2 className="font-display text-2xl">Post details</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
              <span className="mt-1 block text-xs text-black/45 dark:text-white/45">
                Public URL: /blogs/{slug || "your-slug"}
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Subtext</span>
              <input
                value={subtext}
                onChange={(event) => setSubtext(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Summary</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Author name</span>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">
                Reading time (minutes)
              </span>
              <input
                type="number"
                min={1}
                value={readingTime}
                onChange={(event) => setReadingTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Tags</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Cover image URL</span>
              <input
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">
                Cover image alt text
              </span>
              <input
                value={coverAlt}
                onChange={(event) => setCoverAlt(event.target.value)}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) =>
                  setIsPublished(event.target.checked)
                }
                className="h-4 w-4"
              />
              <span className="text-sm font-semibold">
                Publish this blog post
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addBlock("heading")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + Heading
            </button>

            <button
              type="button"
              onClick={() => addBlock("subheading")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + Subheading
            </button>

            <button
              type="button"
              onClick={() => addBlock("paragraph")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + Paragraph
            </button>

            <button
              type="button"
              onClick={() => addBlock("image")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + Inline image
            </button>

            <button
              type="button"
              onClick={() => addBlock("quote")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + Quote
            </button>

            <button
              type="button"
              onClick={() => addBlock("list")}
              className="rounded-full border border-paper-line px-4 py-2 text-xs font-semibold dark:border-ink-line"
            >
              + List
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {blocks.map((block, index) => (
              <article
                key={block.key}
                className="rounded-2xl border border-paper-line bg-paper-soft p-5 dark:border-ink-line dark:bg-ink"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[.14em] text-black/45 dark:text-white/45">
                    Block {index + 1} · {block.block_type}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveBlock(index, "up")}
                      className="rounded-full border border-paper-line px-3 py-1 text-xs dark:border-ink-line"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => moveBlock(index, "down")}
                      className="rounded-full border border-paper-line px-3 py-1 text-xs dark:border-ink-line"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => removeBlock(block.key)}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 dark:border-red-800 dark:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  {block.block_type === "image" ? (
                    <input
                      value={block.image_url}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          image_url: event.target.value,
                        })
                      }
                      placeholder="Image URL"
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  ) : block.block_type === "list" ? (
                    <textarea
                      value={block.list_items}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          list_items: event.target.value,
                        })
                      }
                      rows={4}
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  ) : (
                    <textarea
                      value={block.text}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          text: event.target.value,
                        })
                      }
                      rows={block.block_type === "paragraph" ? 4 : 2}
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}