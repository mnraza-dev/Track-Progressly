import { getGamificationStats } from "@/lib/gamification";
import type { Workspace } from "@/types";
import type { SoundKind } from "@/lib/sounds";
export type Celebration = {
  id: number;
  kind: SoundKind;
  xp: number;
  level: number;
  previousLevel: number;
  achievementIds: string[];
  title: string;
};
let sequence = 0;
export function earnedCelebration(
  before: Workspace,
  after: Workspace,
): Celebration | null {
  const previous = getGamificationStats(before);
  const next = getGamificationStats(after);
  const xp = next.levelInfo.totalXP - previous.levelInfo.totalXP;
  if (xp <= 0) return null;
  const achievementIds = next.achievements
    .filter(
      (a) =>
        a.unlocked &&
        !previous.achievements.some((p) => p.id === a.id && p.unlocked),
    )
    .map((a) => a.id);
  const kind: SoundKind =
    next.levelInfo.level > previous.levelInfo.level
      ? "level"
      : next.completedCourses > previous.completedCourses
        ? "course"
        : achievementIds.length
          ? "achievement"
          : next.completedTasks > previous.completedTasks
            ? "practice"
            : next.completedVideos > previous.completedVideos
              ? "lesson"
              : "xp";
  const title =
    kind === "level"
      ? `Level ${next.levelInfo.level} unlocked`
      : kind === "course"
        ? "A course. Completed."
        : kind === "achievement"
          ? "New achievement earned"
          : kind === "practice"
            ? "Made by doing."
            : kind === "lesson"
              ? "One lesson closer."
              : "Small steps add up.";
  return {
    id: ++sequence,
    kind,
    xp,
    level: next.levelInfo.level,
    previousLevel: previous.levelInfo.level,
    achievementIds,
    title,
  };
}
