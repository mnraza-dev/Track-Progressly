import { z } from "zod";
export const importVideoSchema = z.object({
  youtube_video_id: z.string().regex(/^[\w-]{11}$/),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  thumbnail_url: z.string().max(2000).default(""),
  duration_seconds: z.number().int().min(0).max(604800).default(0),
  position: z.number().int().min(0),
  availability_status: z
    .enum(["available", "unavailable"])
    .default("available"),
});
export const courseSchema = z.object({
  title: z.string().trim().min(1).max(250),
  description: z.string().max(10000).default(""),
  category: z.string().max(80).default("Development"),
  channel_name: z.string().max(250).default(""),
  thumbnail_url: z.string().max(2000).default(""),
  youtube_playlist_id: z.string().max(120).nullable().default(null),
  target_completion_date: z.string().date().nullable().default(null),
  videos: z.array(importVideoSchema).min(1).max(5000),
});
export const mutationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create_course"), course: courseSchema }),
  z.object({
    op: z.literal("update_course"),
    id: z.uuid(),
    patch: z.object({
      title: z.string().trim().min(1).max(250).optional(),
      description: z.string().max(10000).optional(),
      category: z.string().max(80).optional(),
      status: z
        .enum(["not_started", "in_progress", "completed", "paused", "archived"])
        .optional(),
      is_favorite: z.boolean().optional(),
      target_completion_date: z.string().date().nullable().optional(),
    }),
  }),
  z.object({ op: z.literal("delete_course"), id: z.uuid() }),
  z.object({ op: z.literal("refresh_course"), id: z.uuid() }),
  z.object({
    op: z.literal("progress"),
    video_id: z.uuid(),
    status: z
      .enum(["not_started", "in_progress", "completed", "needs_revision"])
      .optional(),
    position: z.number().min(0).max(604800).optional(),
    active_seconds: z.number().int().min(0).max(60).default(0),
  }),
  z.object({
    op: z.literal("save_note"),
    video_id: z.uuid(),
    id: z.uuid(),
    content: z.string().max(50000),
    timestamp_seconds: z.number().int().min(0).max(604800),
    is_revision_required: z.boolean(),
  }),
  z.object({ op: z.literal("delete_note"), id: z.uuid() }),
  z.object({
    op: z.literal("task"),
    video_id: z.uuid(),
    id: z.uuid(),
    title: z.string().trim().min(1).max(500),
    is_completed: z.boolean(),
  }),
  z.object({ op: z.literal("delete_task"), id: z.uuid() }),
  z.object({
    op: z.literal("bookmark"),
    video_id: z.uuid(),
    id: z.uuid(),
    timestamp_seconds: z.number().int().min(0).max(604800),
    label: z.string().max(500),
  }),
  z.object({ op: z.literal("delete_bookmark"), id: z.uuid() }),
  z.object({
    op: z.literal("goal"),
    id: z.uuid(),
    goal_type: z.enum(["daily_minutes", "daily_videos", "weekly_minutes"]),
    target_value: z.number().int().min(1).max(10080),
  }),
  z.object({ op: z.literal("delete_goal"), id: z.uuid() }),
  z.object({
    op: z.literal("profile"),
    display_name: z.string().trim().max(100),
    timezone: z.string().refine((v) => {
      try {
        Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone."),
    daily_minutes: z.number().int().min(1).max(1440),
    auto_complete: z.boolean(),
    weekend_rest: z.boolean().optional(),
  }),
]);
export type Mutation = z.infer<typeof mutationSchema>;
