import { describe, it, expect } from "vitest";
import { chartData } from "@/lib/analytics";
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
});
