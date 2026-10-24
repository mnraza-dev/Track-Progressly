import { z } from "zod";
import type { Workspace } from "@/types";

const id = z.string().min(1).max(200);
const text = z.string().max(50000);
const seconds = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableDate = z.string().nullable();
const workspaceSchema = z.object({
  profile: z.object({
    display_name: z.string().max(100),
    timezone: z.string().refine((value) => {
      try {
        Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
    daily_minutes: z.number().int().min(1).max(1440),
    auto_complete: z.boolean(),
    weekend_rest: z.boolean().optional(),
  }),
  courses: z
    .array(
      z.object({
        id,
        title: text,
        description: text,
        category: text,
        channel_name: text,
        thumbnail_url: text,
        youtube_playlist_id: z.string().nullable(),
        status: z.enum([
          "not_started",
          "in_progress",
          "completed",
          "paused",
          "archived",
        ]),
        is_favorite: z.boolean(),
        target_completion_date: nullableDate,
        completed_at: nullableDate,
        created_at: z.string(),
        updated_at: z.string(),
        videos: z
          .array(
            z.object({
              id,
              youtube_video_id: z.string().regex(/^[\w-]{11}$/),
              title: text,
              description: text,
              thumbnail_url: text,
              duration_seconds: seconds,
              position: z.number().int().min(0),
              availability_status: z.enum(["available", "unavailable"]),
              progress: z.object({
                status: z.enum([
                  "not_started",
                  "in_progress",
                  "completed",
                  "needs_revision",
                ]),
                last_position_seconds: seconds,
                watched_seconds: seconds,
                is_completed: z.boolean(),
                last_watched_at: nullableDate,
                completed_at: nullableDate,
              }),
              notes: z.array(
                z.object({
                  id,
                  content: text,
                  timestamp_seconds: seconds,
                  is_revision_required: z.boolean(),
                  updated_at: z.string(),
                }),
              ),
              tasks: z.array(
                z.object({
                  id,
                  title: text,
                  is_completed: z.boolean(),
                  completed_at: nullableDate,
                }),
              ),
              bookmarks: z.array(
                z.object({ id, timestamp_seconds: seconds, label: text }),
              ),
            }),
          )
          .max(5000),
      }),
    )
    .max(5000),
  goals: z.array(
    z.object({
      id,
      goal_type: z.enum(["daily_minutes", "daily_videos", "weekly_minutes"]),
      target_value: z.number().int().min(1).max(10080),
      start_date: z.string(),
      end_date: nullableDate,
    }),
  ),
  activity: z.array(
    z.object({
      day: z.string().date(),
      active_seconds: seconds,
      videos_completed: seconds,
      practice_completed: seconds,
      courses_completed: seconds,
    }),
  ),
});

export function parseWorkspaceBackup(content: string): Workspace {
  if (content.length > 25_000_000)
    throw new Error(
      "This backup is too large. Choose a file smaller than 25 MB.",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("This file is not valid JSON. Choose a Progressly backup.");
  }
  let workspace: unknown = parsed;
  if (parsed && typeof parsed === "object" && "workspace" in parsed) {
    const envelope = parsed as {
      app?: unknown;
      version?: unknown;
      workspace: unknown;
    };
    if (envelope.app !== "progressly" || envelope.version !== 1)
      throw new Error(
        "This backup format is not supported. Choose a Progressly version 1 backup.",
      );
    workspace = envelope.workspace;
  }
  const result = workspaceSchema.safeParse(workspace);
  if (!result.success)
    throw new Error(
      "This backup is incomplete or invalid. Your current workspace has not been changed.",
    );
  return result.data;
}
