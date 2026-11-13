"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
type BlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "image"
  | "quote"
  | "list";

interface BlogBlockDraft {
  key: string;
  block_type: BlockType;
  heading: string;
  text: string;
  image_url: string;
  image_alt: string;
  image_caption: string;
  list_items: string;
}

const emptyBlock = (): BlogBlockDraft => ({
  key: crypto.randomUUID(),
  block_type: "paragraph",
  heading: "",
  text: "",
  image_url: "",
  image_alt: "",
  image_caption: "",
  list_items: "",
});

export default function NewBlogPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subtext, setSubtext] = useState("");
  const [summary, setSummary] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [readingTime, setReadingTime] = useState("");
  const [tags, setTags] = useState("");

  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");

  const [blocks, setBlocks] = useState<BlogBlockDraft[]>([emptyBlock()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slug) {
      setSlug(generateSlug(value));
    }
  }

  function addBlock(type: BlockType) {
    setBlocks((current) => [
      ...current,
      {
        ...emptyBlock(),
        block_type: type,
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
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [
        next[targetIndex],
        next[index],
      ];

      return next;
    });
  }

  function updateBlock(key: string, updates: Partial<BlogBlockDraft>) {
    setBlocks((current) =>
      current.map((block) =>
        block.key === key
          ? {
              ...block,
              ...updates,
            }
          : block
      )
    );
  }

  async function uploadImage(
    file: File,
    folder: "covers" | "inline"
  ): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("blog-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage
      .from("blog-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleCoverUpload(file: File) {
    setCoverImage(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleInlineImageUpload(
    key: string,
    file: File
  ) {
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const imageUrl = await uploadImage(file, "inline");
      updateBlock(key, { image_url: imageUrl });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not upload the inline image."
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (!title.trim() || !slug.trim() || !subtext.trim()) {
        throw new Error("Title, slug, and subtext are required.");
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("You must be signed in as an admin.");
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_access")
        .select("id, username, email, role")
        .eq("auth_user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError || !admin) {
        throw new Error("Active admin profile not found.");
      }

      let coverImageUrl: string | null = null;

      if (coverImage) {
        coverImageUrl = await uploadImage(coverImage, "covers");
      }

      const { data: blog, error: blogError } = await supabase
        .from("blogs")
        .insert({
          slug: slug.trim(),
          title: title.trim(),
          subtext: subtext.trim(),
          summary: summary.trim() || null,
          cover_image_url: coverImageUrl,
          cover_image_alt: coverAlt.trim() || null,
          author_name: authorName.trim() || admin.username,
          reading_time_minutes: readingTime
            ? Number(readingTime)
            : null,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          is_published: false,
          created_by: admin.id,
        })
        .select("id")
        .single();

      if (blogError || !blog) {
        throw new Error(blogError?.message ?? "Could not create blog.");
      }

      const validBlocks = blocks
        .map((block, index) => ({
          blog_id: blog.id,
          position: index + 1,
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

      if (validBlocks.length > 0) {
        const { error: blocksError } = await supabase
          .from("blog_blocks")
          .insert(validBlocks);

        if (blocksError) {
          throw new Error(blocksError.message);
        }
      }

      router.push("/admin/blogs");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not create the blog post."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-gold-600">
            Editorial operations
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-tightest">
            New blog post
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">
            Create a structured article with a cover image, headings,
            subheadings, paragraphs, inline images, quotes, and lists.
          </p>
        </div>

        <button
          type="submit"
          form="new-blog-form"
          disabled={isSaving || isUploading}
          className="rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save draft"}
        </button>
      </header>

      {errorMessage ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <form
        id="new-blog-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <h2 className="font-display text-2xl">Post details</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold">Title</span>
              <input
                value={title}
                onChange={(event) =>
                  handleTitleChange(event.target.value)
                }
                required
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required
                placeholder="how-to-prepare-for-jamb"
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Subtext</span>
              <input
                value={subtext}
                onChange={(event) => setSubtext(event.target.value)}
                required
                placeholder="A practical study plan for aspirants"
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Summary</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Author name</span>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="Defaults to your admin username"
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
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
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Tags</span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="JAMB, Study Tips, Admissions"
                className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <h2 className="font-display text-2xl">Cover image</h2>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            This is the large featured image shown at the top of the blog.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr]">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-paper-line bg-paper-soft dark:border-ink-line dark:bg-ink">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <p className="text-xs text-black/40 dark:text-white/40">
                  No cover image selected
                </p>
              )}
            </div>

            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void handleCoverUpload(file);
                  }
                }}
                className="w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm dark:border-ink-line dark:bg-ink"
              />

              <label className="block">
                <span className="text-sm font-semibold">
                  Cover image alt text
                </span>
                <input
                  value={coverAlt}
                  onChange={(event) => setCoverAlt(event.target.value)}
                  placeholder="Student studying for JAMB"
                  className="mt-2 w-full rounded-xl border border-paper-line bg-paper-soft px-4 py-3 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl">Article content</h2>
              <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                Add content blocks in the order they should appear.
              </p>
            </div>

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
          </div>

          <div className="mt-6 space-y-4">
            {blocks.map((block, index) => (
              <article
                key={block.key}
                className="rounded-2xl border border-paper-line bg-paper-soft p-5 dark:border-ink-line dark:bg-ink"
              >
                <div className="flex items-center justify-between gap-3">
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

                <div className="mt-4 space-y-4">
                  {block.block_type === "heading" ||
                  block.block_type === "subheading" ? (
                    <input
                      value={block.text}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          text: event.target.value,
                        })
                      }
                      placeholder={
                        block.block_type === "heading"
                          ? "Main section heading"
                          : "Smaller section heading"
                      }
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  ) : null}

                  {block.block_type === "paragraph" ||
                  block.block_type === "quote" ? (
                    <textarea
                      value={block.text}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          text: event.target.value,
                        })
                      }
                      rows={4}
                      placeholder={
                        block.block_type === "paragraph"
                          ? "Write the paragraph content"
                          : "Write the quote"
                      }
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  ) : null}

                  {block.block_type === "image" ? (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];

                          if (file) {
                            void handleInlineImageUpload(
                              block.key,
                              file
                            );
                          }
                        }}
                        className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                      />

                      {isUploading ? (
                        <p className="text-xs text-black/45 dark:text-white/45">
                          Uploading image…
                        </p>
                      ) : null}

                      {block.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={block.image_url}
                          alt={block.image_alt || "Inline blog image"}
                          className="max-h-64 w-full rounded-xl object-cover"
                        />
                      ) : null}

                      <input
                        value={block.image_alt}
                        onChange={(event) =>
                          updateBlock(block.key, {
                            image_alt: event.target.value,
                          })
                        }
                        placeholder="Image alt text"
                        className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                      />

                      <input
                        value={block.image_caption}
                        onChange={(event) =>
                          updateBlock(block.key, {
                            image_caption: event.target.value,
                          })
                        }
                        placeholder="Optional image caption"
                        className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                      />
                    </>
                  ) : null}

                  {block.block_type === "list" ? (
                    <textarea
                      value={block.list_items}
                      onChange={(event) =>
                        updateBlock(block.key, {
                          list_items: event.target.value,
                        })
                      }
                      rows={4}
                      placeholder={"First item\nSecond item\nThird item"}
                      className="w-full rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm dark:border-ink-line dark:bg-ink-surface"
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}