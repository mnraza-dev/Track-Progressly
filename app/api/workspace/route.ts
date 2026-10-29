import { readJsonBody, RequestBodyError } from "@/lib/http/body";
import {
  authenticatedWorkspace,
  WorkspaceAccessError,
} from "@/lib/supabase/workspace";
import { mutationSchema } from "@/lib/validations";
import { emptyProgress } from "@/types";
import { importYouTube } from "@/lib/youtube/service";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAllowedOrigin } from "@/lib/http/origin";
async function allRows(db: SupabaseClient, table: string, order = "id") {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await db
      .from(table)
      .select("*")
      .order(order)
      .range(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...result.data);
    if (result.data.length < 1000) break;
  }
  return rows;
}
function failure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Database operation failed. Check that the migrations have been applied.";
  const duplicate = (error as { code?: string })?.code === "23505";
  return Response.json(
    {
      error: duplicate
        ? "This course is already in your library."
        : message === "UNAUTHORIZED"
          ? "Please sign in to access your workspace."
          : message,
    },
    {
      status:
        error instanceof WorkspaceAccessError
          ? error.status
          : message === "UNAUTHORIZED"
            ? 401
            : duplicate
              ? 409
              : error instanceof RequestBodyError
                ? error.status
                : error instanceof z.ZodError
                  ? 400
                  : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function GET() {
  try {
    const { db, user } = await authenticatedWorkspace();
    const [
      courses,
      videos,
      progress,
      notes,
      tasks,
      bookmarks,
      goals,
      profile,
      activity,
      rewards,
      quizzes,
      quizAttempts,
    ] = await Promise.all([
      allRows(db, "courses", "updated_at"),
      allRows(db, "course_videos", "position"),
      allRows(db, "video_progress"),
      allRows(db, "video_notes"),
      allRows(db, "practice_tasks"),
      allRows(db, "video_bookmarks"),
      allRows(db, "learning_goals"),
      db
        .from("profiles")
        .select(
          "display_name, timezone, daily_minutes, auto_complete, weekend_rest",
        )
        .eq("id", user.id)
        .single(),
      db.rpc("learning_analytics"),
      db.rpc("sync_learning_rewards"),
      allRows(db, "lesson_quizzes"),
      allRows(db, "lesson_quiz_attempts", "completed_at"),
    ]);
    if (profile.error) throw profile.error;
    if (activity.error) throw activity.error;
    if (rewards.error) throw rewards.error;
    return Response.json(
      {
        courses: courses
          .map((c) => ({
            ...c,
            videos: videos
              .filter((v) => v.course_id === c.id)
              .map((v) => ({
                ...v,
                progress:
                  progress.find((p) => p.course_video_id === v.id) ||
                  emptyProgress,
                quiz: (() => {
                  const quiz = quizzes.find((q) => q.course_video_id === v.id);
                  return quiz
                    ? { version: quiz.version, questions: quiz.questions }
                    : undefined;
                })(),
                quiz_attempts: quizAttempts
                  .filter((a) => a.course_video_id === v.id)
                  .slice(-100),
                notes: notes.filter((n) => n.course_video_id === v.id),
                tasks: tasks.filter((t) => t.course_video_id === v.id),
                bookmarks: bookmarks.filter((b) => b.course_video_id === v.id),
              })),
          }))
          .reverse(),
        goals,
        profile: profile.data,
        activity: activity.data,
        rewards: rewards.data,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!hasAllowedOrigin(request))
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 4_000_000)
    return Response.json(
      { error: "This import is too large. Please use a smaller playlist." },
      { status: 413 },
    );
  try {
    const { db, user } = await authenticatedWorkspace();
    const m = mutationSchema.parse(await readJsonBody(request, 4_000_000));
    const baselineRewards = await db.rpc("sync_learning_rewards");
    if (baselineRewards.error) throw baselineRewards.error;
    let result;
    switch (m.op) {
      case "save_quiz":
        result = await db.rpc("save_lesson_quiz", {
          video: m.video_id,
          payload: m.quiz,
        });
        break;
      case "submit_quiz":
        result = await db.rpc("submit_lesson_quiz", {
          video: m.video_id,
          attempt_id: m.id,
          quiz_version: m.quiz_version,
          answers: m.answers,
        });
        break;
      case "create_course":
        result = await db.rpc("import_course", { payload: m.course });
        break;
      case "update_course":
        result = await db
          .from("courses")
          .update({ ...m.patch, updated_at: new Date().toISOString() })
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "delete_course":
        result = await db
          .from("courses")
          .delete()
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "refresh_course": {
        const c = await db
          .from("courses")
          .select("youtube_playlist_id")
          .eq("id", m.id)
          .eq("user_id", user.id)
          .single();
        if (!c.data?.youtube_playlist_id)
          throw new Error("Only imported playlists can be refreshed.");
        const limit = await db.rpc("consume_import_quota");
        if (limit.error || !limit.data)
          throw new Error(
            "Import limit reached. Please try again in a minute.",
          );
        const preview = await importYouTube(
          c.data.youtube_playlist_id,
          fetch,
          true,
        );
        result = await db.rpc("refresh_course_metadata", {
          target: m.id,
          payload: preview,
        });
        break;
      }
      case "progress":
        result = await db.rpc("save_video_progress", {
          video: m.video_id,
          new_status: m.status || null,
          playback_position: m.position ?? null,
          active: m.active_seconds,
        });
        break;
      case "save_note":
        result = await db.from("video_notes").upsert({
          id: m.id,
          user_id: user.id,
          course_video_id: m.video_id,
          content: m.content,
          timestamp_seconds: m.timestamp_seconds,
          is_revision_required: m.is_revision_required,
          updated_at: new Date().toISOString(),
        });
        break;
      case "delete_note":
        result = await db
          .from("video_notes")
          .delete()
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "task":
        result = await db.from("practice_tasks").upsert({
          id: m.id,
          user_id: user.id,
          course_video_id: m.video_id,
          title: m.title,
          is_completed: m.is_completed,
          completed_at: m.is_completed ? new Date().toISOString() : null,
        });
        break;
      case "delete_task":
        result = await db
          .from("practice_tasks")
          .delete()
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "bookmark":
        result = await db.from("video_bookmarks").insert({
          id: m.id,
          user_id: user.id,
          course_video_id: m.video_id,
          timestamp_seconds: m.timestamp_seconds,
          label: m.label,
        });
        break;
      case "delete_bookmark":
        result = await db
          .from("video_bookmarks")
          .delete()
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "goal":
        result = await db.from("learning_goals").upsert(
          {
            id: m.id,
            user_id: user.id,
            goal_type: m.goal_type,
            target_value: m.target_value,
          },
          { onConflict: "user_id,goal_type" },
        );
        break;
      case "delete_goal":
        result = await db
          .from("learning_goals")
          .delete()
          .eq("id", m.id)
          .eq("user_id", user.id);
        break;
      case "profile": {
        const profile = {
          display_name: m.display_name,
          timezone: m.timezone,
          daily_minutes: m.daily_minutes,
          auto_complete: m.auto_complete,
          weekend_rest: m.weekend_rest ?? false,
        };
        result = await db
          .from("profiles")
          .update({ ...profile, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        break;
      }
    }
    if (result?.error) throw result.error;
    const rewards = await db.rpc("sync_learning_rewards");
    if (rewards.error) throw rewards.error;
    return Response.json(
      {
        ok: true,
        rewards: rewards.data,
        quiz_attempt: m.op === "submit_quiz" ? result?.data : undefined,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
