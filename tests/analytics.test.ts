import { describe, it, expect } from "vitest";
import {
  chartData,
  dailySeries,
  lessonDistribution,
  weekdayData,
} from "@/lib/analytics";
import { emptyProgress, type Course, type Lesson } from "@/types";
import { longestStreak } from "@/lib/utils";
const rows = [
  {
    day: "2026-09-30",
    active_seconds: 60,
    videos_completed: 1,
    practice_completed: 0,
    courses_completed: 1,
  },
  {
    day: "2026-10-01",
    active_seconds: 120,
    videos_completed: 2,
    practice_completed: 1,
    courses_completed: 1,
  },
  {
    day: "2026-10-03",
    active_seconds: 60,
    videos_completed: 1,
    practice_completed: 0,
    courses_completed: 0,
  },
];
describe("Analytics aggregation", () => {
  it("groups lessons by week, courses by month, and time by day", () => {
    expect(
      chartData(rows, "2026-10-03", 7, "videos").map((row) => row.value),
    ).toEqual([0, 4]);
    expect(
      chartData(rows, "2026-10-03", 7, "courses").map((row) => row.value),
    ).toEqual([1, 1]);
    expect(
      chartData(rows, "2026-10-03", 7, "minutes").reduce(
        (n, row) => n + row.value,
        0,
      ),
    ).toBe(4);
  });
  it("all-time charts include records older than 90 days", () => {
    const older = { ...rows[0], day: "2025-09-30" };
    expect(
      chartData([older, ...rows], "2026-10-03", 0, "courses").reduce(
        (n, row) => n + row.value,
        0,
      ),
    ).toBe(3);
  });
  it("finds the longest streak even after a break", () => {
    expect(longestStreak(rows)).toBe(2);
    expect(longestStreak([])).toBe(0);
  });
  it("fills inactive days without including activity outside the selected days", () => {
    const data = dailySeries(
      [...rows, { ...rows[0], day: "2026-10-04", active_seconds: 9999 }],
      "2026-10-03",
      3,
    );
    expect(data.map((row) => row.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(data.map((row) => row.minutes)).toEqual([2, 0, 1]);
    expect(data[1].videos).toBe(0);
  });
  it("partitions available lessons exactly once and excludes archived courses", () => {
    const lesson = (
      status: Lesson["progress"]["status"],
      completed = false,
      available = true,
    ) =>
      ({
        availability_status: available ? "available" : "unavailable",
        progress: { ...emptyProgress, status, is_completed: completed },
      }) as Lesson;
    const course = {
      id: "course",
      title: "Course",
      status: "in_progress",
      videos: [
        lesson("completed", true),
        lesson("in_progress"),
        lesson("needs_revision"),
        lesson("not_started"),
        lesson("completed", true, false),
      ],
    } as Course;
    const archived = { ...course, status: "archived" } as Course;
    expect(
      lessonDistribution([course, archived]).map((row) => row.value),
    ).toEqual([1, 1, 1, 1]);
    expect(lessonDistribution([]).map((row) => row.value)).toEqual([
      0, 0, 0, 0,
    ]);
  });
  it("aggregates weekdays across calendar weeks without counting sessions as days", () => {
    expect(weekdayData(rows).map((row) => row.minutes)).toEqual([
      0, 0, 1, 2, 0, 1, 0,
    ]);
  });
});
