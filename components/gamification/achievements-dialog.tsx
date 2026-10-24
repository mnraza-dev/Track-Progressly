"use client";
import { useState } from "react";
import {
  Trophy,
  LockKeyhole,
  CheckCircle2,
  Sparkles,
  Flame,
  BookOpen,
  Target,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LEVEL_TIERS, type getGamificationStats } from "@/lib/gamification";
import { LevelBadge, LEVEL_BADGES } from "./level-badge";
import { FeedbackControls } from "./feedback-controls";
import { useFeedback } from "@/stores/feedback";
import { fireConfetti } from "@/lib/confetti";
import { playFeedbackSound, unlockAudio } from "@/lib/sounds";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ReturnType<typeof getGamificationStats>;
};
const icons = {
  flame: Flame,
  check: CheckCircle2,
  layers: Layers,
  trophy: Trophy,
  book: BookOpen,
  sparkles: Sparkles,
  target: Target,
};
export function AchievementsDialog({ open, onOpenChange, stats }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const { levelInfo } = stats;
  const level = selected || levelInfo.level;
  const tier = LEVEL_TIERS[level - 1];
  const artwork = LEVEL_BADGES[level - 1];
  const earned = level <= levelInfo.level;
  const filtered = stats.achievements.filter(
    (a) => filter === "all" || (filter === "earned" ? a.unlocked : !a.unlocked),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rewards-dialog w-[calc(100vw-2rem)] sm:max-w-[1000px] gap-6 rounded-2xl p-4 sm:p-8">
        <DialogHeader>
          <span className="eyebrow">THE PROGRESSLY COLLECTION</span>
          <DialogTitle className="text-2xl font-medium tracking-tight sm:text-3xl">
            Your effort. Made visible.
          </DialogTitle>
          <DialogDescription>
            Eight ranks to grow through. Small wins worth keeping.
          </DialogDescription>
        </DialogHeader>
        <div className="rewards-hero">
          <div className="rewards-hero-art">
            <LevelBadge level={levelInfo.level} decorative />
            <span className="rewards-orbit" aria-hidden="true" />
          </div>
          <div className="rewards-hero-copy">
            <span className="rewards-rank-label">
              LEVEL {levelInfo.level} / {LEVEL_TIERS.length} ·{" "}
              {LEVEL_BADGES[levelInfo.level - 1].material}
            </span>
            <h2>{levelInfo.title}</h2>
            <p>
              <strong>{levelInfo.totalXP.toLocaleString()} XP</strong>
              <span>
                {levelInfo.isMaxLevel
                  ? "The full collection. Yours."
                  : `${(LEVEL_TIERS[levelInfo.level].minXP - levelInfo.totalXP).toLocaleString()} XP to ${LEVEL_TIERS[levelInfo.level].title}`}
              </span>
            </p>
            <div
              className="rewards-meter"
              role="progressbar"
              aria-label="Progress to next level"
              aria-valuenow={levelInfo.levelProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${levelInfo.levelProgressPercent}%` }} />
            </div>
            <small>
              Earned XP and achievements stay yours when you archive, undo, or
              take a break.
            </small>
          </div>
        </div>
        <Tabs defaultValue="levels" className="rewards-tabs">
          <TabsList aria-label="Rewards collection">
            <TabsTrigger value="levels">Level badges</TabsTrigger>
            <TabsTrigger value="achievements">
              Achievements{" "}
              <span>
                {stats.unlockedAchievementsCount}/{stats.totalAchievementsCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="guide">XP & sound</TabsTrigger>
          </TabsList>
          <TabsContent value="levels">
            <div className="level-collection" aria-label="Eight level badges">
              {LEVEL_TIERS.map((item) => (
                <button
                  key={item.level}
                  className={cn(
                    "level-collectible",
                    item.level <= levelInfo.level && "earned",
                    level === item.level && "selected",
                  )}
                  aria-pressed={level === item.level}
                  aria-label={`Level ${item.level}: ${item.title}, ${item.level <= levelInfo.level ? "earned" : `${item.minXP} XP required`}`}
                  onClick={() => setSelected(item.level)}
                >
                  <span className="level-collectible-top">
                    LV. {String(item.level).padStart(2, "0")}
                    {item.level <= levelInfo.level ? (
                      <CheckCircle2 size={14} aria-hidden="true" />
                    ) : (
                      <LockKeyhole size={13} aria-hidden="true" />
                    )}
                  </span>
                  <LevelBadge
                    level={item.level}
                    locked={item.level > levelInfo.level}
                    decorative
                  />
                  <strong>{item.title}</strong>
                  <small>{item.minXP.toLocaleString()} XP</small>
                </button>
              ))}
            </div>
            <section
              className="level-detail"
              aria-label="Level details"
              aria-live="polite"
            >
              <LevelBadge level={level} decorative />
              <div>
                <span className="eyebrow">
                  {earned ? "IN YOUR COLLECTION" : "YOUR NEXT HORIZONS"} ·{" "}
                  {artwork.material}
                </span>
                <h3>{artwork.name}</h3>
                <p>{artwork.story}</p>
                <small>
                  {earned
                    ? `Level ${level} earned · ${tier.minXP.toLocaleString()} XP milestone`
                    : `${Math.max(0, tier.minXP - levelInfo.totalXP).toLocaleString()} more XP to unlock this badge`}
                </small>
              </div>
              {earned && (
                <Button
                  variant="outline"
                  aria-label="Celebrate this level"
                  onClick={async () => {
                    if (useFeedback.getState().celebrationsEnabled)
                      fireConfetti();
                    await unlockAudio();
                    playFeedbackSound("level", true);
                  }}
                >
                  <Sparkles size={15} />
                  Celebrate
                </Button>
              )}
            </section>
          </TabsContent>
          <TabsContent value="achievements">
            <div
              className="rewards-filter"
              role="group"
              aria-label="Filter achievements"
            >
              {[
                ["all", "All"],
                ["earned", "Earned"],
                ["next", "In progress"],
              ].map(([id, title]) => (
                <button
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {title}
                </button>
              ))}
            </div>
            <div className="milestone-grid">
              {filtered.map((item) => {
                const Icon = icons[item.icon];
                return (
                  <article
                    className={cn(
                      "milestone-card",
                      item.unlocked && "milestone-earned",
                    )}
                    key={item.id}
                  >
                    <div className="milestone-top">
                      <span className="milestone-icon">
                        <Icon size={21} aria-hidden="true" />
                      </span>
                      <span>+{item.xpReward} XP</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div
                      className="rewards-meter"
                      role="progressbar"
                      aria-label={item.title}
                      aria-valuenow={Math.min(item.target, item.current)}
                      aria-valuemax={item.target}
                      aria-valuemin={0}
                    >
                      <i style={{ width: `${item.progressPercent}%` }} />
                    </div>
                    <footer>
                      {item.unlocked ? (
                        <span>
                          <CheckCircle2 size={13} />
                          Earned
                        </span>
                      ) : (
                        <span>
                          {Math.min(item.current, item.target)} / {item.target}
                        </span>
                      )}
                      <small>
                        {item.unlocked
                          ? "Added to your collection"
                          : `${item.progressPercent}% of the way`}
                      </small>
                    </footer>
                  </article>
                );
              })}
            </div>
            {!filtered.length && (
              <p className="rewards-empty">
                Your first milestone is waiting. Start with one lesson or
                practice task.
              </p>
            )}
          </TabsContent>
          <TabsContent value="guide">
            <div className="rewards-guide">
              <section>
                <h3>Every point has a story.</h3>
                <p>
                  Rewards recognize your personal learning milestones. They are
                  not a test of knowledge or a verified qualification.
                </p>
                <dl className="xp-rules">
                  <div>
                    <dt>Complete a lesson</dt>
                    <dd>50 XP</dd>
                  </div>
                  <div>
                    <dt>Finish a practice task</dt>
                    <dd>25 XP</dd>
                  </div>
                  <div>
                    <dt>First useful note per video (10+ characters)</dt>
                    <dd>10 XP</dd>
                  </div>
                  <div>
                    <dt>Finish every available lesson in a course</dt>
                    <dd>200 XP</dd>
                  </div>
                  <div>
                    <dt>Show up on an active day</dt>
                    <dd>30 XP</dd>
                  </div>
                  <div>
                    <dt>Every 15 minutes of active learning</dt>
                    <dd>10 XP</dd>
                  </div>
                </dl>
                <p className="rewards-rule-note">
                  Daily quests add 35 XP for focus, 40 XP for a lesson, and 45
                  XP for practice. Each reward is awarded once. Replaying,
                  undoing, or re-importing the same video does not award lesson
                  XP again. Seeking through chapters does not earn XP.
                </p>
                <h3>Your XP breakdown</h3>
                <dl className="xp-rules">
                  {stats.xpBreakdown.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.xp.toLocaleString()} XP</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <FeedbackControls />
            </div>
          </TabsContent>
        </Tabs>
        <footer className="rewards-dialog-footer">
          <span>
            <Sparkles size={14} />
            Consistency, at your pace.
          </span>
          <button onClick={() => onOpenChange(false)}>
            Back to learning <ArrowUpRight size={14} />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
