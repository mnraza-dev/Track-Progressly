import type { Workspace } from "@/types";
import { completion, streak, localDay } from "@/lib/utils";
import { parseVideoChapters, completedChaptersCount } from "@/lib/youtube/chapters";

export type LevelTier = {
  level: number;
  title: string;
  minXP: number;
  nextXP: number;
};

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, title: "Curious Explorer", minXP: 0, nextXP: 150 },
  { level: 2, title: "Dedicated Apprentice", minXP: 150, nextXP: 400 },
  { level: 3, title: "Consistent Learner", minXP: 400, nextXP: 800 },
  { level: 4, title: "Knowledge Crafter", minXP: 800, nextXP: 1400 },
  { level: 5, title: "Master Practitioner", minXP: 1400, nextXP: 2200 },
  { level: 6, title: "Insight Sculptor", minXP: 2200, nextXP: 3200 },
  { level: 7, title: "Studio Polymath", minXP: 3200, nextXP: 4500 },
  { level: 8, title: "Grand Scholar", minXP: 4500, nextXP: 6000 },
];

export type Achievement = {
  id: string;
  title: string;
  description: string;
  category: "streak" | "lessons" | "chapters" | "practice" | "notes" | "courses";
  icon: "flame" | "check" | "layers" | "trophy" | "book" | "sparkles" | "target";
  xpReward: number;
  current: number;
  target: number;
  unlocked: boolean;
  progressPercent: number;
};

export type LevelInfo = {
  level: number;
  title: string;
  totalXP: number;
  currentLevelXP: number;
  xpNeededForNext: number;
  levelProgressPercent: number;
  isMaxLevel: boolean;
};

export type DailyQuest = {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
  xpReward: number;
  icon: "target" | "play" | "check";
};

export function getGamificationStats(workspace: Workspace) {
  const { courses, activity, profile } = workspace;
  const nonArchivedCourses = courses.filter((c) => c.status !== "archived");

  // 1. Lessons completed
  const completedVideos = nonArchivedCourses.reduce(
    (sum, c) => sum + c.videos.filter((v) => v.progress.is_completed).length,
    0,
  );

  // 2. Chapters completed
  let totalChaptersCompleted = 0;
  nonArchivedCourses.forEach((c) => {
    c.videos.forEach((v) => {
      const chaps = parseVideoChapters(v.description || "", v.duration_seconds || 0);
      if (chaps.length > 0) {
        totalChaptersCompleted += completedChaptersCount(
          chaps,
          v.progress.last_position_seconds || 0,
          v.duration_seconds || 0,
          v.progress.is_completed,
        );
      }
    });
  });

  // 3. Practice tasks completed
  const allTasks = nonArchivedCourses.flatMap((c) =>
    c.videos.flatMap((v) => v.tasks),
  );
  const completedTasks = allTasks.filter((t) => t.is_completed).length;

  // 4. Notes written
  const allNotes = nonArchivedCourses.flatMap((c) =>
    c.videos.flatMap((v) => v.notes),
  );
  const notesCount = allNotes.length;

  // 5. Courses finished (100% completion)
  const completedCourses = nonArchivedCourses.filter(
    (c) => completion(c) === 100 && c.videos.length > 0,
  ).length;

  // 6. Streak & Active time
  const currentStreak = streak(activity, profile.timezone);
  const totalSeconds = activity.reduce((sum, a) => sum + (a.active_seconds || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  // Raw action XP
  const baseXP =
    completedVideos * 50 +
    totalChaptersCompleted * 15 +
    completedTasks * 25 +
    notesCount * 10 +
    completedCourses * 200 +
    currentStreak * 30 +
    Math.floor(totalMinutes / 15) * 10;

  // Compute Achievements
  const rawAchievements: Array<Omit<Achievement, "progressPercent" | "unlocked">> = [
    {
      id: "first_step",
      title: "First Step Forward",
      description: "Complete your first lesson in any course",
      category: "lessons",
      icon: "check",
      xpReward: 50,
      current: completedVideos,
      target: 1,
    },
    {
      id: "streak_spark",
      title: "Momentum Spark",
      description: "Maintain a 3-day learning streak",
      category: "streak",
      icon: "flame",
      xpReward: 75,
      current: currentStreak,
      target: 3,
    },
    {
      id: "streak_master",
      title: "Unstoppable Force",
      description: "Maintain a 7-day learning streak",
      category: "streak",
      icon: "flame",
      xpReward: 150,
      current: currentStreak,
      target: 7,
    },
    {
      id: "chapter_cadence",
      title: "Chapter Cadence",
      description: "Finish 5 video chapters across your courses",
      category: "chapters",
      icon: "layers",
      xpReward: 100,
      current: totalChaptersCompleted,
      target: 5,
    },
    {
      id: "chapter_virtuoso",
      title: "Chapter Virtuoso",
      description: "Finish 20 video chapters",
      category: "chapters",
      icon: "layers",
      xpReward: 250,
      current: totalChaptersCompleted,
      target: 20,
    },
    {
      id: "maker_mindset",
      title: "Maker Mindset",
      description: "Complete 3 practice tasks and exercises",
      category: "practice",
      icon: "target",
      xpReward: 100,
      current: completedTasks,
      target: 3,
    },
    {
      id: "execution_prodigy",
      title: "Execution Prodigy",
      description: "Complete 10 practice tasks",
      category: "practice",
      icon: "target",
      xpReward: 200,
      current: completedTasks,
      target: 10,
    },
    {
      id: "the_archivist",
      title: "The Archivist",
      description: "Capture 5 thoughtful study notes",
      category: "notes",
      icon: "book",
      xpReward: 75,
      current: notesCount,
      target: 5,
    },
    {
      id: "the_finisher",
      title: "The Finisher",
      description: "Complete a full course from start to finish",
      category: "courses",
      icon: "trophy",
      xpReward: 200,
      current: completedCourses,
      target: 1,
    },
    {
      id: "deep_focus",
      title: "Deep Work Master",
      description: "Log at least 120 minutes of total focus time",
      category: "streak",
      icon: "sparkles",
      xpReward: 150,
      current: totalMinutes,
      target: 120,
    },
  ];

  const achievements: Achievement[] = rawAchievements.map((a) => {
    const unlocked = a.current >= a.target;
    const progressPercent = Math.min(100, Math.round((a.current / a.target) * 100));
    return {
      ...a,
      unlocked,
      progressPercent,
    };
  });

  const achievementBonusXP = achievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.xpReward, 0);

  const totalXP = baseXP + achievementBonusXP;

  // Level computation
  let currentTier = LEVEL_TIERS[0];
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_TIERS[i].minXP) {
      currentTier = LEVEL_TIERS[i];
      break;
    }
  }

  const isMaxLevel = currentTier.level === LEVEL_TIERS[LEVEL_TIERS.length - 1].level;
  const xpInCurrentLevel = totalXP - currentTier.minXP;
  const xpNeededForNext = currentTier.nextXP - currentTier.minXP;
  const levelProgressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

  const levelInfo: LevelInfo = {
    level: currentTier.level,
    title: currentTier.title,
    totalXP,
    currentLevelXP: xpInCurrentLevel,
    xpNeededForNext,
    levelProgressPercent,
    isMaxLevel,
  };

  // Daily quests for today
  const todayStr = localDay(new Date(), profile.timezone);
  const todayRow = activity.find((a) => a.day === todayStr);
  const todayMinutes = Math.floor((todayRow?.active_seconds || 0) / 60);

  const dailyQuests: DailyQuest[] = [
    {
      id: "quest_focus",
      title: "Daily Focus Time",
      description: "Focus for at least 15 minutes today",
      current: todayMinutes,
      target: 15,
      completed: todayMinutes >= 15,
      xpReward: 35,
      icon: "target",
    },
    {
      id: "quest_lesson",
      title: "One Lesson Closer",
      description: "Finish at least 1 lesson or chapter today",
      current: (todayRow?.videos_completed || 0),
      target: 1,
      completed: (todayRow?.videos_completed || 0) >= 1,
      xpReward: 40,
      icon: "play",
    },
    {
      id: "quest_practice",
      title: "Hands-on Exercise",
      description: "Complete 1 practice task today",
      current: (todayRow?.practice_completed || 0),
      target: 1,
      completed: (todayRow?.practice_completed || 0) >= 1,
      xpReward: 45,
      icon: "check",
    },
  ];

  return {
    levelInfo,
    achievements,
    dailyQuests,
    unlockedAchievementsCount: achievements.filter((a) => a.unlocked).length,
    totalAchievementsCount: achievements.length,
    completedVideos,
    totalChaptersCompleted,
    completedTasks,
    notesCount,
    completedCourses,
    currentStreak,
    totalMinutes,
  };
}
