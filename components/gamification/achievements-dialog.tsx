"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Flame,
  CheckCircle2,
  Layers,
  Target,
  BookOpen,
  Sparkles,
  Play,
  Award,
  ChevronRight,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { SceneArtwork } from "@/components/three/scene-provider";
import {
  LEVEL_TIERS,
  type getGamificationStats,
  type Achievement,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { fireConfetti } from "@/lib/confetti";

type AchievementsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ReturnType<typeof getGamificationStats>;
};

export function AchievementsDialog({
  open,
  onOpenChange,
  stats,
}: AchievementsDialogProps) {
  const [filter, setFilter] = useState<"all" | "unlocked" | "in_progress">("all");
  const { levelInfo, achievements, dailyQuests } = stats;

  const filteredAchievements = achievements.filter((a) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "in_progress") return !a.unlocked;
    return true;
  });

  const getAchievementIcon = (iconName: Achievement["icon"], unlocked: boolean) => {
    const size = 20;
    switch (iconName) {
      case "flame":
        return <Flame size={size} className={unlocked ? "text-amber-500" : "text-muted-foreground"} />;
      case "check":
        return <CheckCircle2 size={size} className={unlocked ? "text-emerald-500" : "text-muted-foreground"} />;
      case "layers":
        return <Layers size={size} className={unlocked ? "text-teal-500" : "text-muted-foreground"} />;
      case "trophy":
        return <Trophy size={size} className={unlocked ? "text-yellow-500" : "text-muted-foreground"} />;
      case "book":
        return <BookOpen size={size} className={unlocked ? "text-cyan-500" : "text-muted-foreground"} />;
      case "sparkles":
        return <Sparkles size={size} className={unlocked ? "text-indigo-500" : "text-muted-foreground"} />;
      case "target":
      default:
        return <Target size={size} className={unlocked ? "text-rose-500" : "text-muted-foreground"} />;
    }
  };

  const handleCelebrate = () => {
    fireConfetti();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="achievements-modal-content">
        <DialogHeader className="sr-only">
          <DialogTitle>Your Rank & Achievements</DialogTitle>
          <DialogDescription>
            Track your level progression, daily quests, and learning badges.
          </DialogDescription>
        </DialogHeader>

        {/* Hero Level & Trophy Card */}
        <div className="achievements-hero-card">
          <div className="achievements-hero-visual">
            <div className="achievements-3d-wrapper">
              <SceneArtwork
                kind="trophy"
                progress={levelInfo.levelProgressPercent / 100}
                interactive
                label={`Level ${levelInfo.level} Trophy: ${levelInfo.title}`}
              />
            </div>
            <button
              type="button"
              className="achievements-celebrate-bubble"
              onClick={handleCelebrate}
              title="Celebrate your progress!"
              aria-label="Celebrate progress"
            >
              <Sparkles size={14} />
            </button>
          </div>

          <div className="achievements-hero-details">
            <div className="achievements-level-badge-row">
              <span className="achievements-level-pill">
                LEVEL {levelInfo.level} OF 8
              </span>
              <span className="achievements-unlocked-count">
                <ShieldCheck size={13} className="text-emerald-500" />
                {stats.unlockedAchievementsCount} of {stats.totalAchievementsCount} Badges Unlocked
              </span>
            </div>

            <h2 className="achievements-level-title">{levelInfo.title}</h2>

            <div className="achievements-xp-row">
              <span className="achievements-xp-number">
                <strong>{levelInfo.totalXP.toLocaleString()}</strong> XP
              </span>
              <span className="achievements-xp-target">
                {levelInfo.isMaxLevel ? (
                  "Master Tier Reached"
                ) : (
                  <>
                    <strong>{levelInfo.currentLevelXP}</strong> / {levelInfo.xpNeededForNext} XP to Lv. {levelInfo.level + 1}
                  </>
                )}
              </span>
            </div>

            <div className="achievements-progress-track">
              <div
                className="achievements-progress-fill"
                style={{ width: `${levelInfo.levelProgressPercent}%` }}
              />
            </div>

            <p className="achievements-philosophy-note">
              Earn XP for watching lessons (+50), completing chapters (+15), practicing exercises (+25), taking notes (+10), and maintaining consistency (+30/day).
            </p>
          </div>
        </div>

        {/* Daily Quests Strip */}
        <div className="achievements-quests-section">
          <div className="achievements-section-title">
            <div className="title-left">
              <span className="title-kicker">DAILY DISCIPLINE</span>
              <h3>Today’s Focus Quests</h3>
            </div>
            <span className="daily-quests-tag">Resets daily</span>
          </div>

          <div className="achievements-quests-grid">
            {dailyQuests.map((quest) => (
              <div
                key={quest.id}
                className={cn(
                  "quest-card-item",
                  quest.completed && "quest-card-completed",
                )}
              >
                <div className="quest-header">
                  <div className="quest-icon-bubble">
                    {quest.id === "quest_focus" && <Target size={15} />}
                    {quest.id === "quest_lesson" && <Play size={14} fill="currentColor" />}
                    {quest.id === "quest_practice" && <CheckCircle2 size={15} />}
                  </div>
                  <span className="quest-xp-reward">+{quest.xpReward} XP</span>
                </div>
                <strong className="quest-title">{quest.title}</strong>
                <p className="quest-desc">{quest.description}</p>
                <div className="quest-progress-row">
                  <div className="quest-progress-track">
                    <div
                      className="quest-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.round((quest.current / quest.target) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="quest-progress-text">
                    {quest.completed ? "Done" : `${quest.current}/${quest.target}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements Filter Tabs & Grid */}
        <div className="achievements-gallery-section">
          <div className="achievements-section-title">
            <div className="title-left">
              <span className="title-kicker">COLLECTED MILESTONES</span>
              <h3>Learning Badges</h3>
            </div>
            <div className="achievements-tabs">
              <button
                type="button"
                className={cn("achievements-tab-btn", filter === "all" && "active")}
                onClick={() => setFilter("all")}
              >
                All ({achievements.length})
              </button>
              <button
                type="button"
                className={cn("achievements-tab-btn", filter === "unlocked" && "active")}
                onClick={() => setFilter("unlocked")}
              >
                Unlocked ({stats.unlockedAchievementsCount})
              </button>
              <button
                type="button"
                className={cn("achievements-tab-btn", filter === "in_progress" && "active")}
                onClick={() => setFilter("in_progress")}
              >
                In Progress ({achievements.length - stats.unlockedAchievementsCount})
              </button>
            </div>
          </div>

          <div className="achievements-grid">
            {filteredAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className={cn(
                  "achievement-badge-card",
                  achievement.unlocked && "badge-unlocked",
                )}
              >
                <div className="badge-card-top">
                  <div className="badge-icon-frame">
                    {getAchievementIcon(achievement.icon, achievement.unlocked)}
                  </div>
                  <div className="badge-meta-pills">
                    <span className="badge-category-tag">
                      {achievement.category.toUpperCase()}
                    </span>
                    <span className="badge-xp-tag">+{achievement.xpReward} XP</span>
                  </div>
                </div>

                <div className="badge-content">
                  <strong className="badge-title">{achievement.title}</strong>
                  <p className="badge-desc">{achievement.description}</p>
                </div>

                <div className="badge-footer">
                  <div className="badge-progress-track">
                    <div
                      className="badge-progress-fill"
                      style={{ width: `${achievement.progressPercent}%` }}
                    />
                  </div>
                  <div className="badge-status-row">
                    <span className="badge-progress-numbers">
                      {achievement.current} / {achievement.target}
                    </span>
                    {achievement.unlocked ? (
                      <span className="badge-unlocked-status">
                        <CheckCircle2 size={12} />
                        Unlocked
                      </span>
                    ) : (
                      <span className="badge-locked-status">
                        <Lock size={11} />
                        {achievement.progressPercent}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Level Tiers Roadmap */}
        <div className="achievements-roadmap-section">
          <div className="achievements-section-title">
            <div className="title-left">
              <span className="title-kicker">RANK HIERARCHY</span>
              <h3>Studio Mastery Path</h3>
            </div>
            <span className="roadmap-current-status">
              Tier {levelInfo.level} of 8
            </span>
          </div>

          <div className="tiers-roadmap-track">
            {LEVEL_TIERS.map((tier) => {
              const isCurrent = tier.level === levelInfo.level;
              const isPassed = tier.level < levelInfo.level;
              return (
                <div
                  key={tier.level}
                  className={cn(
                    "tier-step-card",
                    isCurrent && "tier-step-current",
                    isPassed && "tier-step-passed",
                  )}
                >
                  <div className="tier-step-header">
                    <span className="tier-number-bubble">
                      {isPassed ? <CheckCircle2 size={13} /> : `L${tier.level}`}
                    </span>
                    <span className="tier-min-xp">{tier.minXP} XP</span>
                  </div>
                  <strong className="tier-title">{tier.title}</strong>
                  {isCurrent && <span className="tier-active-pill">CURRENT RANK</span>}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
