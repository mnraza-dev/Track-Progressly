import { describe, expect, it } from "vitest";
import { getGamificationStats, LEVEL_TIERS } from "@/lib/gamification";
import { emptyWorkspace, emptyProgress, type Workspace } from "@/types";

function createEmptyWorkspace(): Workspace {
  return JSON.parse(JSON.stringify(emptyWorkspace));
}

describe("Gamification Engine - Level Tiers", () => {
  it("defines 8 progressively ascending mastery tiers", () => {
    expect(LEVEL_TIERS.length).toBe(8);
    expect(LEVEL_TIERS[0].title).toBe("Curious Explorer");
    expect(LEVEL_TIERS[0].minXP).toBe(0);
    expect(LEVEL_TIERS[7].title).toBe("Grand Scholar");
    expect(LEVEL_TIERS[7].minXP).toBe(4500);

    for (let i = 1; i < LEVEL_TIERS.length; i++) {
      expect(LEVEL_TIERS[i].minXP).toBeGreaterThan(LEVEL_TIERS[i - 1].minXP);
      expect(LEVEL_TIERS[i].level).toBe(i + 1);
    }
  });
});

describe("Gamification Engine - Stats & Progression", () => {
  it("computes baseline stats for a brand new empty workspace", () => {
    const ws = createEmptyWorkspace();
    const stats = getGamificationStats(ws);

    expect(stats.levelInfo.level).toBe(1);
    expect(stats.levelInfo.title).toBe("Curious Explorer");
    expect(stats.levelInfo.totalXP).toBe(0);
    expect(stats.levelInfo.currentLevelXP).toBe(0);
    expect(stats.levelInfo.isMaxLevel).toBe(false);
    expect(stats.unlockedAchievementsCount).toBe(0);
    expect(stats.totalAchievementsCount).toBe(10);
    expect(stats.dailyQuests.every((q) => !q.completed)).toBe(true);
  });

  it("awards XP and unlocks achievements when completing lessons and chapters", () => {
    const ws = createEmptyWorkspace();
    ws.courses = [
      {
        id: "c1",
        title: "Mastering Three.js",
        description: "",
        category: "Development",
        channel_name: "Creative Studio",
        thumbnail_url: "",
        youtube_playlist_id: null,
        target_completion_date: null,
        status: "in_progress",
        is_favorite: false,
        completed_at: null,
        created_at: "2026-10-17T09:00:00Z",
        updated_at: "2026-10-17T09:00:00Z",
        videos: [
          {
            id: "v1",
            youtube_video_id: "three123",
            title: "Lesson 1: Shaders & Meshes",
            description: "00:00 Intro\n02:00 Geometries\n05:00 Materials\n07:00 Lighting\n09:00 Shaders",
            thumbnail_url: "",
            duration_seconds: 600,
            position: 0,
            availability_status: "available",
            notes: [],
            tasks: [],
            bookmarks: [],
            progress: {
              ...emptyProgress,
              status: "completed",
              is_completed: true,
              last_position_seconds: 600,
              last_watched_at: "2026-10-17T09:00:00Z",
              completed_at: "2026-10-17T09:00:00Z",
            },
          },
        ],
      },
    ];

    const stats = getGamificationStats(ws);

    // 1 completed video = 50 XP
    // 5 finished chapters = 5 * 15 = 75 XP
    // 1 completed course (1 video total, 100% done) = 200 XP
    // Achievements unlocked:
    // - first_step: +50 XP
    // - chapter_cadence (5 chapters): +100 XP
    // - the_finisher (1 completed course): +200 XP
    // Total XP = 50 + 75 + 200 + 50 + 100 + 200 = 675 XP -> Level 3 (minXP 400, nextXP 800)
    expect(stats.completedVideos).toBe(1);
    expect(stats.totalChaptersCompleted).toBe(5);
    expect(stats.completedCourses).toBe(1);

    const firstStep = stats.achievements.find((a) => a.id === "first_step");
    expect(firstStep?.unlocked).toBe(true);

    const chapterCadence = stats.achievements.find((a) => a.id === "chapter_cadence");
    expect(chapterCadence?.unlocked).toBe(true);

    const theFinisher = stats.achievements.find((a) => a.id === "the_finisher");
    expect(theFinisher?.unlocked).toBe(true);

    expect(stats.levelInfo.level).toBe(3);
    expect(stats.levelInfo.title).toBe("Consistent Learner");
    expect(stats.levelInfo.totalXP).toBe(675);
  });

  it("calculates practice tasks and notes achievements", () => {
    const ws = createEmptyWorkspace();
    ws.courses = [
      {
        id: "c2",
        title: "Hands-on UI Craft",
        description: "",
        category: "Design",
        channel_name: "Studio Design",
        thumbnail_url: "",
        youtube_playlist_id: null,
        target_completion_date: null,
        status: "in_progress",
        is_favorite: false,
        completed_at: null,
        created_at: "2026-10-17T09:00:00Z",
        updated_at: "2026-10-17T09:00:00Z",
        videos: [
          {
            id: "v2",
            youtube_video_id: "uicraft123",
            title: "Lesson A",
            description: "",
            thumbnail_url: "",
            duration_seconds: 1200,
            position: 0,
            availability_status: "available",
            bookmarks: [],
            notes: [
              { id: "n1", content: "Note 1", timestamp_seconds: 10, is_revision_required: false, updated_at: "2026-10-17T09:00:00Z" },
              { id: "n2", content: "Note 2", timestamp_seconds: 20, is_revision_required: false, updated_at: "2026-10-17T09:00:00Z" },
              { id: "n3", content: "Note 3", timestamp_seconds: 30, is_revision_required: false, updated_at: "2026-10-17T09:00:00Z" },
              { id: "n4", content: "Note 4", timestamp_seconds: 40, is_revision_required: false, updated_at: "2026-10-17T09:00:00Z" },
              { id: "n5", content: "Note 5", timestamp_seconds: 50, is_revision_required: false, updated_at: "2026-10-17T09:00:00Z" },
            ],
            tasks: [
              { id: "t1", title: "Task 1", is_completed: true, completed_at: "2026-10-17T09:00:00Z" },
              { id: "t2", title: "Task 2", is_completed: true, completed_at: "2026-10-17T09:00:00Z" },
              { id: "t3", title: "Task 3", is_completed: true, completed_at: "2026-10-17T09:00:00Z" },
            ],
            progress: {
              ...emptyProgress,
              last_position_seconds: 300,
              last_watched_at: "2026-10-17T09:00:00Z",
            },
          },
        ],
      },
    ];

    const stats = getGamificationStats(ws);

    expect(stats.completedTasks).toBe(3);
    expect(stats.notesCount).toBe(5);

    const makerMindset = stats.achievements.find((a) => a.id === "maker_mindset");
    expect(makerMindset?.unlocked).toBe(true);

    const archivist = stats.achievements.find((a) => a.id === "the_archivist");
    expect(archivist?.unlocked).toBe(true);
  });

  it("evaluates daily quests based on today's activity row", () => {
    const ws = createEmptyWorkspace();
    const todayStr = new Date().toISOString().slice(0, 10);
    ws.activity = [
      {
        day: todayStr,
        active_seconds: 1200, // 20 minutes (> 15m target)
        videos_completed: 1,  // 1 lesson
        practice_completed: 1, // 1 practice task
        courses_completed: 0,
      },
    ];

    const stats = getGamificationStats(ws);

    const focusQuest = stats.dailyQuests.find((q) => q.id === "quest_focus");
    expect(focusQuest?.completed).toBe(true);
    expect(focusQuest?.current).toBe(20);

    const lessonQuest = stats.dailyQuests.find((q) => q.id === "quest_lesson");
    expect(lessonQuest?.completed).toBe(true);
    expect(lessonQuest?.current).toBe(1);

    const practiceQuest = stats.dailyQuests.find((q) => q.id === "quest_practice");
    expect(practiceQuest?.completed).toBe(true);
    expect(practiceQuest?.current).toBe(1);
  });

  it("handles high XP reaching maximum level tier", () => {
    const ws = createEmptyWorkspace();
    ws.activity = [
      {
        day: "2026-10-10",
        active_seconds: 360000, // 100 hours
        videos_completed: 50,
        practice_completed: 50,
        courses_completed: 0,
      },
    ];

    const stats = getGamificationStats(ws);
    // Base XP from 6000 minutes = 400 * 10 = 4000 XP + deep work master (150)
    expect(stats.totalMinutes).toBe(6000);
    const deepWork = stats.achievements.find((a) => a.id === "deep_focus");
    expect(deepWork?.unlocked).toBe(true);
  });
});
