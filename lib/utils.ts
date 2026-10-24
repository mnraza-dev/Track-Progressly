import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Course, Activity } from "@/types";
import { format, subDays } from "date-fns";
import {
  parseVideoChapters,
  chapterProgressPercent,
} from "@/lib/youtube/chapters";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function completion(course: Course) {
  const available = course.videos.filter(
    (v) => v.availability_status === "available",
  );
  if (!available.length) return 0;
  if (available.length === 1) {
    const single = available[0];
    if (single.progress.is_completed) return 100;
    const chapters = parseVideoChapters(
      single.description || "",
      single.duration_seconds || 0,
    );
    if (chapters.length > 0) {
      return chapterProgressPercent(
        chapters,
        single.progress.last_position_seconds || 0,
        single.duration_seconds || 0,
        single.progress.is_completed,
      );
    }
  }
  return Math.round(
    (available.filter((v) => v.progress.is_completed).length /
      available.length) *
      100,
  );
}
export function duration(seconds: number) {
  if (seconds >= 3600)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
}
export function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function localDay(date = new Date(), timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function streak(
  activity: Activity[],
  timezone: string,
  allowWeekendRest = false,
) {
  const days = new Set(
    activity
      .filter((a) => a.active_seconds > 0 || a.videos_completed > 0)
      .map((a) => a.day),
  );
  const today = localDay(new Date(), timezone);
  let cursor = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) {
    cursor = subDays(cursor, 1);
    if (allowWeekendRest) {
      while (
        (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) &&
        !days.has(format(cursor, "yyyy-MM-dd"))
      ) {
        cursor = subDays(cursor, 1);
      }
    }
  }
  let count = 0;
  while (true) {
    const dayStr = format(cursor, "yyyy-MM-dd");
    if (days.has(dayStr)) {
      count++;
      cursor = subDays(cursor, 1);
    } else if (
      allowWeekendRest &&
      (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6)
    ) {
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }
  return count;
}
export function longestStreak(activity: Activity[]) {
  const days = [
    ...new Set(
      activity
        .filter((a) => a.active_seconds > 0 || a.videos_completed > 0)
        .map((a) => a.day),
    ),
  ].sort();
  let longest = 0;
  let current = 0;
  let previous = "";
  for (const day of days) {
    const yesterday = format(
      subDays(new Date(`${day}T12:00:00Z`), 1),
      "yyyy-MM-dd",
    );
    current = previous === yesterday ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}
export function downloadText(
  text: string,
  filename: string,
  mime = "text/markdown;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
