import type { Workspace } from "@/types";
import { ACHIEVEMENT_RULES, reconcileRewards, rewardMetrics } from "@/lib/rewards";
import { streak, localDay } from "@/lib/utils";
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
  id: string; title: string; description: string;
  category: "streak" | "lessons" | "practice" | "notes" | "courses" | "focus";
  icon: "flame" | "check" | "layers" | "trophy" | "book" | "sparkles" | "target";
  xpReward: number; current: number; target: number; unlocked: boolean; progressPercent: number;
  earnedAt: string | null;
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

export function getGamificationStats(workspace: Workspace, now = new Date()) {
  const ledger = reconcileRewards(workspace, now);
  const metrics = rewardMetrics(ledger);
  const achievements: Achievement[] = ACHIEVEMENT_RULES.map((rule) => {
    const earnedAt = ledger.events[`achievement:${rule.id}`]?.earned_at || null;
    const current = earnedAt ? Math.max(rule.target, metrics[rule.metric]) : metrics[rule.metric];
    return { ...rule, current, unlocked: !!earnedAt, earnedAt, progressPercent: Math.min(100, Math.round(current / rule.target * 100)) };
  });
  const totalXP = Object.values(ledger.events).reduce((sum, event) => sum + event.xp, 0);
  const currentTier = [...LEVEL_TIERS].reverse().find((tier) => totalXP >= tier.minXP) || LEVEL_TIERS[0];
  const isMaxLevel = currentTier.level === LEVEL_TIERS.length;
  const levelInfo: LevelInfo = {
    level: currentTier.level, title: currentTier.title, totalXP,
    currentLevelXP: totalXP - currentTier.minXP,
    xpNeededForNext: currentTier.nextXP - currentTier.minXP,
    levelProgressPercent: isMaxLevel ? 100 : Math.min(100, Math.floor((totalXP - currentTier.minXP) / (currentTier.nextXP - currentTier.minXP) * 100)),
    isMaxLevel,
  };
  const today = localDay(now, workspace.profile.timezone);
  const todayRow = workspace.activity.find((row) => row.day === today);
  const quest = (id: string, title: string, description: string, current: number, target: number, xpReward: number, icon: DailyQuest["icon"]): DailyQuest => ({ id, title, description, current, target, xpReward, icon, completed: !!ledger.events[`${id}:${today}`] });
  const dailyQuests = [
    quest("quest_focus", "Daily Focus Time", "Log 15 minutes of active learning today", Math.floor((todayRow?.active_seconds || 0) / 60), 15, 35, "target"),
    quest("quest_lesson", "One Lesson Closer", "Complete one available lesson today", todayRow?.videos_completed || 0, 1, 40, "play"),
    quest("quest_practice", "Hands-on Exercise", "Complete one practice task today", todayRow?.practice_completed || 0, 1, 45, "check"),
  ];
  let totalChaptersCompleted = 0;
  for (const course of workspace.courses) for (const video of course.videos) {
    if (video.availability_status !== "available") continue;
    const chapters = parseVideoChapters(video.description, video.duration_seconds);
    totalChaptersCompleted += completedChaptersCount(chapters, video.progress.last_position_seconds, video.duration_seconds, video.progress.is_completed);
  }
  const xpBreakdown = [
    { label: "Lessons", prefix: "lesson:" }, { label: "Practice", prefix: "practice:" },
    { label: "Useful notes", prefix: "note:" }, { label: "Courses", prefix: "course:" },
    { label: "Consistency", prefix: "day:" }, { label: "Focus time", prefix: "focus:" },
    { label: "Daily quests", prefix: "quest_" }, { label: "Achievements", prefix: "achievement:" },
  ].map((item) => ({ label: item.label, xp: Object.entries(ledger.events).filter(([key]) => key.startsWith(item.prefix)).reduce((sum, [, event]) => sum + event.xp, 0) }));
  return {
    levelInfo, achievements, dailyQuests, xpBreakdown, ledger,
    unlockedAchievementsCount: achievements.filter((a) => a.unlocked).length,
    totalAchievementsCount: achievements.length,
    completedVideos: metrics.lessons, totalChaptersCompleted,
    completedTasks: metrics.practice, notesCount: metrics.notes, completedCourses: metrics.courses,
    currentStreak: streak(workspace.activity, workspace.profile.timezone, workspace.profile.weekend_rest),
    totalMinutes: Math.max(metrics.minutes, Math.floor(workspace.activity.reduce((sum, row) => sum + row.active_seconds, 0) / 60)),
  };
}
