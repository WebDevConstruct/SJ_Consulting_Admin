import { z } from "zod";
export const announcementSchema = z.object({
  id : z.string().uuid(),
  created_at : z.string(),
  category: z.enum(["mentorship", "unilag", "jamb", "accommodation"]),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(180),
  subtext: z.string().trim().min(3, "Subtext is required.").max(300),
  content: z.string().trim().min(10, "Content must be at least 10 characters."),
  summary: z.string().trim().max(500).optional().or(z.literal("")),
  image_url: z.string().url("Enter a valid image URL.").optional().or(z.literal("")),
  link: z.string().url("Enter a valid URL.").refine(value => !value || /^https?:\/\//i.test(value), "Link must start with http:// or https://.").optional().or(z.literal("")),
  location: z.string().trim().max(180).optional().or(z.literal("")),
  event_date: z.string().optional().or(z.literal("")),
  slug : z.string().trim().min(3, "Slug must be at least 3 characters.").max(180),
  source_name : z.string().trim().min(3, "Source name must be at least 3 characters.").max(180),
  is_published: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.category === "accommodation" && !value.location) ctx.addIssue({ code:"custom", path:["location"], message:"Location is required for accommodation information." });
});
export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
