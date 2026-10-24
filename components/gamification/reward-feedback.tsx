"use client";
import { useEffect, useState } from "react";
import { X, ArrowUpRight, Sparkles } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useFeedback } from "@/stores/feedback";
import { playFeedbackSound, stopSounds, unlockAudio } from "@/lib/sounds";
import type { Celebration } from "@/lib/celebrations";
import { LEVEL_TIERS } from "@/lib/gamification";
import { LevelBadge } from "./level-badge";
import { fireConfetti } from "@/lib/confetti";

export function RewardFeedback({
  onViewCollection,
}: {
  onViewCollection: () => void;
}) {
  const [event, setEvent] = useState<Celebration | null>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const unlock = () => {
      void unlockAudio();
    };
    const hide = () => {
      if (document.hidden) {
        stopSounds();
        setEvent(null);
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", hide);
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      const reward = state.celebration;
      if (!reward || reward.id === previous.celebration?.id || document.hidden)
        return;
      clearTimeout(timeout);
      setEvent(reward);
      playFeedbackSound(reward.kind);
      if (
        useFeedback.getState().celebrationsEnabled &&
        ["level", "course", "achievement"].includes(reward.kind)
      )
        fireConfetti();
      timeout = setTimeout(
        () => setEvent(null),
        reward.kind === "level" ? 9000 : 6000,
      );
    });
    const mute = useFeedback.subscribe((state, previous) => {
      if ((!state.soundEnabled && previous.soundEnabled) || state.volume === 0)
        stopSounds();
    });
    return () => {
      unsubscribe();
      mute();
      clearTimeout(timeout);
      stopSounds();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  if (!event) return null;
  return (
    <aside
      className={`reward-toast reward-${event.kind}`}
      aria-label="Learning reward"
    >
      <button
        className="icon-button reward-close"
        aria-label="Dismiss learning reward"
        onClick={() => setEvent(null)}
      >
        <X size={16} />
      </button>
      <div className="reward-toast-content">
        <LevelBadge level={event.level} decorative />
        <div role="status" aria-live="polite">
          <span className="reward-eyebrow">
            <Sparkles size={12} />+{event.xp} XP EARNED
          </span>
          <h2>{event.title}</h2>
          <p>
            {event.kind === "level"
              ? LEVEL_TIERS[event.level - 1].title
              : "Your effort is part of your story."}
          </p>
          {event.achievementIds.length > 0 && (
            <small>
              {event.achievementIds.length} achievement
              {event.achievementIds.length === 1 ? "" : "s"} added to your
              collection
            </small>
          )}
        </div>
      </div>
      <button
        className="reward-view"
        onClick={() => {
          setEvent(null);
          onViewCollection();
        }}
      >
        View your collection <ArrowUpRight size={15} />
      </button>
    </aside>
  );
}
