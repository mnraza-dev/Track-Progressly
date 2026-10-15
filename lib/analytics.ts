import {
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import type { Activity, Course } from "@/types";
export type ActivityMetric = "minutes" | "videos" | "practice" | "courses";
export function dailySeries(activity: Activity[], today: string, days = 7) {
  const byDay = new Map(activity.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(`${today}T12:00:00Z`), days - 1 - i);
    const day = format(date, "yyyy-MM-dd");
    const row = byDay.get(day);
    return {
      day,
      name: format(date, "EEE"),
      label: format(date, "MMM d, yyyy"),
      minutes: (row?.active_seconds || 0) / 60,
      videos: row?.videos_completed || 0,
      practice: row?.practice_completed || 0,
      courses: row?.courses_completed || 0,
    };
  });
}
export const lessonSegments = [
  { key: "completed", name: "Completed", color: "#648d7b" },
  { key: "in_progress", name: "In progress", color: "#8d7ade" },
  { key: "needs_revision", name: "Needs revision", color: "#cf835c" },
  { key: "not_started", name: "Not started", color: "#c4c5bd" },
] as const;
export function courseBreakdown(courses: Course[]) {
  return courses
    .filter((course) => course.status !== "archived")
    .map((course) => {
      const counts = {
        completed: 0,
        in_progress: 0,
        needs_revision: 0,
        not_started: 0,
      };
      course.videos
        .filter((v) => v.availability_status === "available")
        .forEach((v) => {
          const status = v.progress.is_completed
            ? "completed"
            : v.progress.status === "completed"
              ? "in_progress"
              : v.progress.status;
          counts[status]++;
        });
      return {
        id: course.id,
        name: course.title,
        ...counts,
        total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      };
    });
}
export function lessonDistribution(courses: Course[]) {
  const rows = courseBreakdown(courses);
  return lessonSegments.map((segment) => ({
    ...segment,
    value: rows.reduce((n, row) => n + row[segment.key], 0),
  }));
}
export function weekdayData(activity: Activity[]) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name, index) => ({
    name,
    minutes: Math.round(
      activity
        .filter(
          (row) =>
            (new Date(`${row.day}T12:00:00Z`).getUTCDay() + 6) % 7 === index,
        )
        .reduce((n, row) => n + row.active_seconds, 0) / 60,
    ),
  }));
}
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
  const groups = new Map<
    string,
    { name: string; label: string; value: number }
  >();
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
    const previous = groups.get(key) || {
      name,
      label: format(period, metric === "courses" ? "MMMM yyyy" : "MMM d, yyyy"),
      value: 0,
    };
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
