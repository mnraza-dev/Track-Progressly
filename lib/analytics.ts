import {
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import type { Activity } from "@/types";
export type ActivityMetric = "minutes" | "videos" | "practice" | "courses";
export function chartData(
  activity: Activity[],
  today: string,
  days: number,
  metric: ActivityMetric,
) {
  const end = new Date(`${today}T12:00:00Z`);
  const first = activity.reduce(
    (day, row) => (row.day < day ? row.day : day),
    today,
  );
  const count =
    days ||
    Math.max(
      7,
      differenceInCalendarDays(end, new Date(`${first}T12:00:00Z`)) + 1,
    );
  const byDay = new Map(activity.map((row) => [row.day, row]));
  const groups = new Map<string, { name: string; value: number }>();
  for (let i = 0; i < count; i++) {
    const date = subDays(end, count - 1 - i);
    const day = format(date, "yyyy-MM-dd");
    const row = byDay.get(day);
    const period =
      metric === "courses"
        ? startOfMonth(date)
        : metric === "videos"
          ? startOfWeek(date, { weekStartsOn: 1 })
          : date;
    const key = format(period, "yyyy-MM-dd");
    const name = format(
      period,
      metric === "courses"
        ? "MMM yyyy"
        : metric === "videos" || count > 7
          ? "MMM d"
          : "EEE",
    );
    const previous = groups.get(key) || { name, value: 0 };
    previous.value +=
      metric === "minutes"
        ? (row?.active_seconds || 0) / 60
        : metric === "videos"
          ? row?.videos_completed || 0
          : metric === "courses"
            ? row?.courses_completed || 0
            : row?.practice_completed || 0;
    groups.set(key, previous);
  }
  return [...groups.values()].map((row) => ({
    ...row,
    value: metric === "minutes" ? Math.round(row.value) : row.value,
  }));
}
