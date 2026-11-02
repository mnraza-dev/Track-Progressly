import type { Lesson } from "@/types";
import { telegramPostPattern } from "@/lib/telegram/parse";

type Source = Pick<Lesson, "youtube_video_id" | "source" | "telegram_post">;
export function lessonKey(lesson: Source) {
  return lesson.source === "telegram"
    ? `telegram:${lesson.telegram_post}`
    : `youtube:${lesson.youtube_video_id}`;
}
export function lessonUrl(lesson: Source, seconds?: number) {
  if (lesson.source === "telegram")
    return telegramPostPattern.test(lesson.telegram_post || "")
      ? `https://t.me/${lesson.telegram_post}`
      : "https://telegram.org/";
  return `https://www.youtube.com/watch?v=${encodeURIComponent(lesson.youtube_video_id)}${seconds === undefined ? "" : `&t=${Math.floor(Math.max(0, seconds))}s`}`;
}
