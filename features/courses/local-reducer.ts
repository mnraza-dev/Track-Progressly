import type { Workspace, Course } from "@/types";
import { emptyProgress } from "@/types";
import type { Mutation } from "@/lib/validations";
import { localDay } from "@/lib/utils";
import { createId } from "@/lib/id";
export function applyMutation(state: Workspace, mutation: Mutation): Workspace {
  const next = structuredClone(state);
  const now = new Date().toISOString();
  const findVideo = (id: string) =>
    next.courses.flatMap((c) => c.videos).find((v) => v.id === id);
  const activity = (at = now) => {
    const day = localDay(new Date(at), next.profile.timezone);
    let row = next.activity.find((a) => a.day === day);
    if (!row) {
      row = {
        day,
        active_seconds: 0,
        videos_completed: 0,
        practice_completed: 0,
        courses_completed: 0,
      };
      next.activity.push(row);
    }
    return row;
  };
  switch (mutation.op) {
    case "create_course": {
      if (
        mutation.course.youtube_playlist_id &&
        next.courses.some(
          (c) => c.youtube_playlist_id === mutation.course.youtube_playlist_id,
        )
      )
        throw new Error("This playlist is already in your library.");
      if (
        !mutation.course.youtube_playlist_id &&
        mutation.course.videos.length === 1 &&
        next.courses.some(
          (c) =>
            !c.youtube_playlist_id &&
            c.videos.length === 1 &&
            c.videos[0].youtube_video_id ===
              mutation.course.videos[0].youtube_video_id,
        )
      )
        throw new Error("This video is already in your library.");
      const course: Course = {
        ...mutation.course,
        id: createId(),
        created_at: now,
        updated_at: now,
        is_favorite: false,
        status: "in_progress",
        completed_at: null,
        videos: mutation.course.videos.map((v) => ({
          ...v,
          id: createId(),
          progress: { ...emptyProgress },
          notes: [],
          tasks: [],
          bookmarks: [],
        })),
      };
      next.courses.unshift(course);
      break;
    }
    case "update_course": {
      const c = next.courses.find((c) => c.id === mutation.id);
      if (c) Object.assign(c, mutation.patch, { updated_at: now });
      break;
    }
    case "delete_course":
      next.courses = next.courses.filter((c) => c.id !== mutation.id);
      break;
    case "progress": {
      const v = findVideo(mutation.video_id);
      if (!v) throw new Error("Lesson not found.");
      const course = next.courses.find((c) =>
        c.videos.some((v) => v.id === mutation.video_id),
      )!;
      if (mutation.status) {
        v.progress.status = mutation.status;
        v.progress.is_completed = mutation.status === "completed";
        v.progress.completed_at = v.progress.is_completed
          ? v.progress.completed_at || now
          : null;
      }
      if (mutation.position !== undefined)
        v.progress.last_position_seconds = mutation.position;
      v.progress.watched_seconds += mutation.active_seconds;
      v.progress.last_watched_at = now;
      course.updated_at = now;
      const available = course.videos.filter(
        (l) => l.availability_status === "available",
      );
      if (!["paused", "archived"].includes(course.status))
        course.status =
          available.length && available.every((l) => l.progress.is_completed)
            ? "completed"
            : "in_progress";
      const row = activity();
      row.active_seconds += mutation.active_seconds;
      course.completed_at =
        course.status === "completed" ? course.completed_at || now : null;
      break;
    }
    case "save_note": {
      const v = findVideo(mutation.video_id);
      if (v) {
        const note = {
          id: mutation.id,
          content: mutation.content,
          timestamp_seconds: mutation.timestamp_seconds,
          is_revision_required: mutation.is_revision_required,
          updated_at: now,
        };
        const index = v.notes.findIndex((n) => n.id === mutation.id);
        if (index >= 0) v.notes[index] = note;
        else v.notes.push(note);
      }
      break;
    }
    case "delete_note":
      next.courses.forEach((c) =>
        c.videos.forEach((v) => {
          v.notes = v.notes.filter((n) => n.id !== mutation.id);
        }),
      );
      break;
    case "task": {
      const v = findVideo(mutation.video_id);
      if (v) {
        const existing = v.tasks.find((t) => t.id === mutation.id);
        const task = {
          completed_at: mutation.is_completed
            ? existing?.completed_at || now
            : null,
          id: mutation.id,
          title: mutation.title,
          is_completed: mutation.is_completed,
        };
        const index = v.tasks.findIndex((t) => t.id === mutation.id);
        if (index >= 0) v.tasks[index] = task;
        else v.tasks.push(task);
      }
      break;
    }
    case "delete_task":
      next.courses.forEach((c) =>
        c.videos.forEach((v) => {
          v.tasks = v.tasks.filter((t) => t.id !== mutation.id);
        }),
      );
      break;
    case "bookmark": {
      const v = findVideo(mutation.video_id);
      if (v)
        v.bookmarks.push({
          id: mutation.id,
          timestamp_seconds: mutation.timestamp_seconds,
          label: mutation.label,
        });
      break;
    }
    case "delete_bookmark":
      next.courses.forEach((c) =>
        c.videos.forEach((v) => {
          v.bookmarks = v.bookmarks.filter((b) => b.id !== mutation.id);
        }),
      );
      break;
    case "goal":
      next.goals = next.goals.filter((g) => g.goal_type !== mutation.goal_type);
      next.goals.push({
        id: mutation.id,
        goal_type: mutation.goal_type,
        target_value: mutation.target_value,
        start_date: now.slice(0, 10),
        end_date: null,
      });
      break;
    case "delete_goal":
      next.goals = next.goals.filter((g) => g.id !== mutation.id);
      break;
    case "profile":
      next.profile = {
        display_name: mutation.display_name,
        timezone: mutation.timezone,
        daily_minutes: mutation.daily_minutes,
        auto_complete: mutation.auto_complete,
      };
      break;
    case "refresh_course":
      throw new Error(
        "Connect Supabase and YouTube to refresh playlist metadata.",
      );
  }
  // Mirror PostgreSQL analytics: completions belong to their saved dates,
  // and undo/delete removes them rather than inflating historical totals.
  next.activity.forEach((row) => {
    row.videos_completed = 0;
    row.practice_completed = 0;
    row.courses_completed = 0;
  });
  next.courses.forEach((course) => {
    if (course.status === "completed" && course.completed_at)
      activity(course.completed_at).courses_completed++;
    course.videos.forEach((video) => {
      if (video.progress.is_completed && video.progress.completed_at)
        activity(video.progress.completed_at).videos_completed++;
      video.tasks.forEach((task) => {
        if (task.is_completed && task.completed_at)
          activity(task.completed_at).practice_completed++;
      });
    });
  });
  next.activity.sort((a, b) => a.day.localeCompare(b.day));
  return next;
}
