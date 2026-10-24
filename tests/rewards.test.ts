import { describe, it, expect } from "vitest";
import { emptyWorkspace, emptyProgress, type Workspace } from "@/types";
import { reconcileRewards } from "@/lib/rewards";
import { getGamificationStats, LEVEL_TIERS } from "@/lib/gamification";
import { applyMutation } from "@/features/courses/local-reducer";
import { earnedCelebration } from "@/lib/celebrations";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { createExport } from "@/lib/exports";
const now = new Date("2026-10-24T12:00:00Z");
function fixture(): Workspace {
  const data = structuredClone(emptyWorkspace);
  data.courses.push({
    id: "c1",
    title: "Learn",
    description: "",
    category: "Development",
    channel_name: "",
    thumbnail_url: "",
    youtube_playlist_id: null,
    status: "in_progress",
    is_favorite: false,
    target_completion_date: null,
    completed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    videos: [
      {
        id: "v1",
        youtube_video_id: "j942wKiXFu8",
        title: "React",
        description: "0:00 First\n1:00 Second",
        thumbnail_url: "",
        duration_seconds: 120,
        position: 0,
        availability_status: "available",
        progress: { ...emptyProgress },
        notes: [],
        tasks: [],
        bookmarks: [],
      },
    ],
  });
  return data;
}
const xp = (data: Workspace) =>
  getGamificationStats(data, now).levelInfo.totalXP;
describe("persistent rewards", () => {
  it("never awards lesson XP twice after undo/re-complete, archive, delete, or re-import", () => {
    let data = fixture();
    data = applyMutation(data, {
      op: "progress",
      video_id: "v1",
      status: "completed",
      active_seconds: 0,
    });
    const earned = xp(data);
    data = applyMutation(data, {
      op: "progress",
      video_id: "v1",
      status: "in_progress",
      active_seconds: 0,
    });
    expect(xp(data)).toBe(earned);
    data = applyMutation(data, {
      op: "progress",
      video_id: "v1",
      status: "completed",
      active_seconds: 0,
    });
    expect(xp(data)).toBe(earned);
    data = applyMutation(data, {
      op: "update_course",
      id: "c1",
      patch: { status: "archived" },
    });
    expect(xp(data)).toBe(earned);
    data = applyMutation(data, { op: "delete_course", id: "c1" });
    expect(xp(data)).toBe(earned);
    const replacement = fixture().courses[0];
    replacement.id = "different";
    replacement.videos[0].progress.is_completed = true;
    data.courses.push(replacement);
    expect(xp(data)).toBe(earned);
  });
  it("ignores unavailable lessons and seeking, and requires useful notes once per video", () => {
    const data = fixture();
    const video = data.courses[0].videos[0];
    video.progress.last_position_seconds = 120;
    expect(xp(data)).toBe(0);
    video.notes.push({
      id: "n1",
      content: "  ",
      timestamp_seconds: 0,
      is_revision_required: false,
      updated_at: now.toISOString(),
    });
    expect(xp(data)).toBe(0);
    video.notes[0].content = "A useful idea about components.";
    video.notes.push({ ...video.notes[0], id: "n2" });
    expect(xp(data)).toBe(10);
    video.availability_status = "unavailable";
    video.progress.is_completed = true;
    expect(xp(data)).toBe(0);
  });
  it("awards historical daily quests once and keeps them after activity changes", () => {
    const data = fixture();
    data.activity = [
      {
        day: "2026-10-23",
        active_seconds: 900,
        videos_completed: 1,
        practice_completed: 1,
        courses_completed: 0,
      },
    ];
    data.rewards = reconcileRewards(data, now);
    expect(xp(data)).toBe(30 + 10 + 35 + 40 + 45);
    expect(reconcileRewards(data, now)).toEqual(data.rewards);
    data.activity = [];
    expect(xp(data)).toBe(160);
  });
  it("keeps streak achievements and XP after a missed day", () => {
    const data = fixture();
    data.activity = ["21", "22", "23"].map((day) => ({
      day: `2026-10-${day}`,
      active_seconds: 1,
      videos_completed: 0,
      practice_completed: 0,
      courses_completed: 0,
    }));
    data.rewards = reconcileRewards(data, now);
    const before = xp(data);
    expect(
      getGamificationStats(data, now).achievements.find(
        (a) => a.id === "streak_spark",
      )?.unlocked,
    ).toBe(true);
    expect(
      getGamificationStats(data, new Date("2026-11-01T12:00:00Z")).levelInfo
        .totalXP,
    ).toBe(before);
  });
  it("respects timezone resets and ignores future activity", () => {
    const data = fixture();
    data.profile.timezone = "America/Los_Angeles";
    data.activity = [
      {
        day: "2026-10-24",
        active_seconds: 900,
        videos_completed: 1,
        practice_completed: 0,
        courses_completed: 0,
      },
    ];
    expect(
      getGamificationStats(
        data,
        new Date("2026-10-24T01:00:00Z"),
      ).dailyQuests.every((q) => !q.completed),
    ).toBe(true);
    expect(
      getGamificationStats(data, now).dailyQuests.filter((q) => q.completed),
    ).toHaveLength(2);
  });
  it("handles all level boundaries and maximum rank", () => {
    for (const tier of LEVEL_TIERS) {
      const data = fixture();
      data.rewards = {
        version: 1,
        events: { existing: { xp: tier.minXP, earned_at: now.toISOString() } },
      };
      const stats = getGamificationStats(data, now);
      expect(stats.levelInfo.level).toBe(tier.level);
      expect(stats.levelInfo.levelProgressPercent).toBe(
        tier.level === 8 ? 100 : 0,
      );
    }
  });
  it("creates a celebration only for newly persisted rewards", () => {
    const data = fixture();
    const after = applyMutation(data, {
      op: "progress",
      video_id: "v1",
      status: "completed",
      active_seconds: 0,
    });
    const event = earnedCelebration(data, after);
    expect(event?.kind).toBe("level");
    expect(event?.level).toBeGreaterThan(1);
    expect(earnedCelebration(after, after)).toBeNull();
  });
  it("round-trips earned rewards in complete backups", () => {
    const data = fixture();
    data.courses[0].videos[0].progress.is_completed = true;
    data.rewards = reconcileRewards(data, now);
    expect(
      parseWorkspaceBackup(createExport(data, "backup").content).rewards,
    ).toEqual(data.rewards);
  });
});

describe("reward backup integrity", () => {
  it("rejects invalid completion dates and malformed reward days before restore", () => {
    const data = fixture();
    data.courses[0].videos[0].progress.completed_at = "invalid";
    expect(() => parseWorkspaceBackup(JSON.stringify(data))).toThrow(
      /incomplete or invalid/,
    );
    data.courses[0].videos[0].progress.completed_at = null;
    data.rewards = {
      version: 1,
      events: { "day:invalid": { xp: 30, earned_at: now.toISOString() } },
    };
    expect(() => parseWorkspaceBackup(JSON.stringify(data))).toThrow(
      /incomplete or invalid/,
    );
  });
});
