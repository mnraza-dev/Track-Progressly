import type { Workspace } from "@/types";
import { localDay, longestStreak } from "@/lib/utils";

export type RewardEvent = { xp: number; earned_at: string };
export type RewardLedger = { version: 1; events: Record<string, RewardEvent> };
export const XP_RULES = {
  lesson: 50,
  practice: 25,
  note: 10,
  course: 200,
  activeDay: 30,
  focusBlock: 10,
  questFocus: 35,
  questLesson: 40,
  questPractice: 45,
} as const;
export const ACHIEVEMENT_RULES = [
  {
    id: "first_step",
    title: "First Step Forward",
    description: "Complete your first available lesson",
    category: "lessons",
    icon: "check",
    metric: "lessons",
    target: 1,
    xpReward: 50,
  },
  {
    id: "streak_spark",
    title: "Momentum Spark",
    description: "Build a 3-day learning streak",
    category: "streak",
    icon: "flame",
    metric: "bestStreak",
    target: 3,
    xpReward: 75,
  },
  {
    id: "streak_master",
    title: "Unstoppable Force",
    description: "Build a 7-day learning streak",
    category: "streak",
    icon: "flame",
    metric: "bestStreak",
    target: 7,
    xpReward: 150,
  },
  {
    id: "lesson_cadence",
    title: "Finding Your Rhythm",
    description: "Complete 5 different lessons",
    category: "lessons",
    icon: "layers",
    metric: "lessons",
    target: 5,
    xpReward: 100,
  },
  {
    id: "lesson_virtuoso",
    title: "Beyond the Tutorial",
    description: "Complete 20 different lessons",
    category: "lessons",
    icon: "layers",
    metric: "lessons",
    target: 20,
    xpReward: 250,
  },
  {
    id: "maker_mindset",
    title: "Maker Mindset",
    description: "Complete 3 practice tasks",
    category: "practice",
    icon: "target",
    metric: "practice",
    target: 3,
    xpReward: 100,
  },
  {
    id: "execution_prodigy",
    title: "Built, Not Just Watched",
    description: "Complete 10 practice tasks",
    category: "practice",
    icon: "target",
    metric: "practice",
    target: 10,
    xpReward: 200,
  },
  {
    id: "the_archivist",
    title: "The Archivist",
    description: "Write a useful note in 5 different lessons (10+ characters)",
    category: "notes",
    icon: "book",
    metric: "notes",
    target: 5,
    xpReward: 75,
  },
  {
    id: "the_finisher",
    title: "The Finisher",
    description: "Complete every available lesson in a course",
    category: "courses",
    icon: "trophy",
    metric: "courses",
    target: 1,
    xpReward: 200,
  },
  {
    id: "deep_focus",
    title: "Deep Work Master",
    description: "Log 120 minutes of active learning",
    category: "focus",
    icon: "sparkles",
    metric: "minutes",
    target: 120,
    xpReward: 150,
  },
] as const;

export function rewardMetrics(ledger: RewardLedger) {
  const keys = Object.keys(ledger.events);
  const count = (prefix: string) =>
    keys.filter((key) => key.startsWith(prefix)).length;
  const days = keys
    .filter((key) => key.startsWith("day:"))
    .map((key) => ({
      day: key.slice(4),
      active_seconds: 1,
      videos_completed: 0,
      practice_completed: 0,
      courses_completed: 0,
    }));
  return {
    lessons: count("lesson:"),
    practice: count("practice:"),
    notes: count("note:"),
    courses: count("course:"),
    bestStreak: longestStreak(days),
    minutes: Object.entries(ledger.events)
      .filter(([key]) => key.startsWith("focus:"))
      .reduce((n, [, event]) => n + (event.xp / XP_RULES.focusBlock) * 15, 0),
  };
}

/** Monotonic, idempotent personal rewards. Repeating or undoing an action never re-awards XP. */
export function reconcileRewards(
  workspace: Workspace,
  now = new Date(),
): RewardLedger {
  const ledger: RewardLedger = {
    version: 1,
    events: { ...workspace.rewards?.events },
  };
  const at = now.toISOString();
  const today = localDay(now, workspace.profile.timezone);
  function earn(key: string, xp: number, earnedAt = at) {
    const old = ledger.events[key];
    if (xp > (old?.xp ?? 0))
      ledger.events[key] = { xp, earned_at: old?.earned_at || earnedAt };
  }
  for (const course of workspace.courses) {
    const available = course.videos.filter(
      (v) => v.availability_status === "available",
    );
    for (const video of available) {
      if (video.progress.is_completed)
        earn(
          `lesson:${video.youtube_video_id}`,
          XP_RULES.lesson,
          video.progress.completed_at || at,
        );
      if (video.notes.some((note) => note.content.trim().length >= 10))
        earn(`note:${video.youtube_video_id}`, XP_RULES.note);
      for (const task of video.tasks)
        if (task.is_completed)
          earn(
            `practice:${task.id}`,
            XP_RULES.practice,
            task.completed_at || at,
          );
    }
    if (available.length && available.every((v) => v.progress.is_completed))
      earn(
        `course:${
          course.youtube_playlist_id ||
          course.videos
            .map((v) => v.youtube_video_id)
            .sort()
            .join("-")
        }`,
        XP_RULES.course,
        course.completed_at || at,
      );
  }
  for (const row of workspace.activity) {
    if (row.day > today) continue;
    if (
      row.active_seconds > 0 ||
      row.videos_completed > 0 ||
      row.practice_completed > 0
    )
      earn(`day:${row.day}`, XP_RULES.activeDay);
    const blocks = Math.floor(
      Math.min(86400, Math.max(0, row.active_seconds)) / 900,
    );
    if (blocks) earn(`focus:${row.day}`, blocks * XP_RULES.focusBlock);
    if (row.active_seconds >= 900)
      earn(`quest_focus:${row.day}`, XP_RULES.questFocus);
    if (row.videos_completed >= 1)
      earn(`quest_lesson:${row.day}`, XP_RULES.questLesson);
    if (row.practice_completed >= 1)
      earn(`quest_practice:${row.day}`, XP_RULES.questPractice);
  }
  const metrics = rewardMetrics(ledger);
  for (const rule of ACHIEVEMENT_RULES)
    if (metrics[rule.metric] >= rule.target)
      earn(`achievement:${rule.id}`, rule.xpReward);
  return ledger;
}
