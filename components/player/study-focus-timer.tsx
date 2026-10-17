"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Flame,
  CheckCircle2,
  EyeOff,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import { useWorkspace } from "@/stores/workspace";
import { duration, localDay, cn } from "@/lib/utils";
import type { PlayerHandle } from "./youtube-player";

type StudyFocusTimerProps = {
  isVideoPlaying: boolean;
  playerRef: React.RefObject<PlayerHandle | null>;
  className?: string;
  defaultOpen?: boolean;
};

const TIMER_PRESETS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 hr", seconds: 60 * 60 },
];

function playCompletionChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Chime note 1 (E5 - 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Chime note 2 (G#5 - 830.61Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.18);
    gain2.gain.setValueAtTime(0.2, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.9);

    // Chime note 3 (B5 - 987.77Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(987.77, now + 0.38);
    gain3.gain.setValueAtTime(0.22, now + 0.38);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.38);
    osc3.stop(now + 1.4);
  } catch {}
}

export function StudyFocusTimer({
  isVideoPlaying,
  playerRef,
  className,
  defaultOpen = true,
}: StudyFocusTimerProps) {
  const { data, notify } = useWorkspace();

  // Selected Target Duration (defaults to 30 min)
  const [targetSeconds, setTargetSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 30 * 60;
    try {
      const saved = localStorage.getItem("progressly_focus_target_seconds");
      return saved ? parseInt(saved, 10) : 30 * 60;
    } catch {
      return 30 * 60;
    }
  });

  // Remaining countdown seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 30 * 60;
    try {
      const saved = localStorage.getItem("progressly_focus_target_seconds");
      return saved ? parseInt(saved, 10) : 30 * 60;
    } catch {
      return 30 * 60;
    }
  });

  // Total seconds spent learning in this session
  const [sessionFocusSeconds, setSessionFocusSeconds] = useState<number>(0);

  // Tab visibility state
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  // UI state
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    try {
      const saved = localStorage.getItem("progressly_focus_timer_expanded");
      return saved !== null ? saved === "true" : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  // Today's total logged study time
  const todayDay = localDay(new Date(), data.profile.timezone);
  const todayActivity = data.activity.find((a) => a.day === todayDay);
  const todayBaseMinutes = Math.floor(
    (todayActivity?.active_seconds || 0) / 60,
  );
  const totalTodayMinutes =
    todayBaseMinutes + Math.floor(sessionFocusSeconds / 60);
  const dailyGoalMinutes =
    data.goals.find((g) => g.goal_type === "daily_minutes")?.target_value ||
    data.profile.daily_minutes;

  // Listen for tab visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === "visible";
      setIsTabVisible(visible);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Timer Tick Logic:
  // Timer runs ONLY when video is playing AND tab is visible AND remaining > 0
  const isTimerRunning =
    isVideoPlaying && isTabVisible && remainingSeconds > 0 && !isCompleted;

  const handleTimerComplete = useCallback(() => {
    setIsCompleted(true);
    fireConfetti();
    if (soundEnabled) {
      playCompletionChime();
    }
    notify(
      `🎉 Focus sprint completed! You logged a focused ${Math.round(targetSeconds / 60)}m study session!`,
    );
  }, [soundEnabled, targetSeconds, notify]);

  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimerComplete();
          return 0;
        }
        return prev - 1;
      });
      setSessionFocusSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, handleTimerComplete]);

  // Set target preset
  const selectPreset = (seconds: number) => {
    setTargetSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsCompleted(false);
    try {
      localStorage.setItem(
        "progressly_focus_target_seconds",
        seconds.toString(),
      );
    } catch {}
    notify(
      `Focus target set to ${seconds >= 3600 ? `${seconds / 3600} hr` : `${seconds / 60} min`}`,
    );
  };

  // Reset timer
  const handleReset = () => {
    setRemainingSeconds(targetSeconds);
    setIsCompleted(false);
    notify("Timer reset to target.");
  };

  // Add 5 min
  const handleAddFiveMinutes = () => {
    setTargetSeconds((prev) => prev + 300);
    setRemainingSeconds((prev) => prev + 300);
    setIsCompleted(false);
    notify("+5 minutes added to study session.");
  };

  // Toggle video play/pause
  const handleTogglePlayPause = () => {
    if (isVideoPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("progressly_focus_timer_expanded", String(next));
      } catch {}
      return next;
    });
  };

  // Circular progress math
  const RADIUS = 62;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~389.56
  const progressPercent = Math.max(
    0,
    Math.min(1, remainingSeconds / targetSeconds),
  );
  const strokeOffset = CIRCUMFERENCE * (1 - progressPercent);

  // Time formatting
  const formatTimeRemaining = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatSessionTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins === 0) return `${remSecs}s`;
    return `${mins}m ${remSecs}s`;
  };

  return (
    <div
      className={cn(
        "panel study-focus-timer-card",
        isTimerRunning && "is-running",
        !isTabVisible && isVideoPlaying && "is-away",
        isCompleted && "is-completed",
        className,
      )}
    >
      {/* Header Bar */}
      <div className="focus-timer-header">
        <div className="focus-timer-title-group">
          <div className="focus-timer-kicker">
            <Clock size={14} className="text-primary" />
            <span>STUDY SPRINT TIMER</span>
          </div>
          <div className="focus-timer-status-row">
            {isCompleted ? (
              <span className="timer-status-badge completed">
                <CheckCircle2 size={12} />
                Sprint Completed!
              </span>
            ) : isTimerRunning ? (
              <span className="timer-status-badge active">
                <span className="timer-pulse-dot" />
                Focusing (video playing)
              </span>
            ) : !isTabVisible ? (
              <span className="timer-status-badge away">
                <EyeOff size={12} />
                Paused (tab inactive)
              </span>
            ) : !isVideoPlaying ? (
              <span className="timer-status-badge paused">
                <Pause size={12} />
                Paused (video paused)
              </span>
            ) : (
              <span className="timer-status-badge ready">
                <Zap size={12} />
                Ready to study
              </span>
            )}
          </div>
        </div>

        <div className="focus-timer-header-controls">
          <button
            type="button"
            className="icon-button focus-timer-sound-btn"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute chime sound" : "Enable completion chime"}
            aria-label={soundEnabled ? "Mute chime sound" : "Enable completion chime"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            type="button"
            className="icon-button focus-timer-toggle-btn"
            onClick={toggleExpanded}
            title={isExpanded ? "Collapse timer" : "Expand timer"}
            aria-label={isExpanded ? "Collapse timer" : "Expand timer"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Main Body */}
      {isExpanded ? (
        <div className="focus-timer-body">
          {/* Left Column: Circular Graph */}
          <div className="focus-timer-circular-wrap">
            <svg
              className="focus-timer-svg"
              width="156"
              height="156"
              viewBox="0 0 156 156"
              aria-label={`Study focus timer: ${formatTimeRemaining(remainingSeconds)} remaining`}
            >
              <defs>
                <linearGradient
                  id="focusRingGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="var(--primary, #3b82f6)" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>

              {/* Background Track */}
              <circle
                className="focus-ring-track"
                cx="78"
                cy="78"
                r={RADIUS}
                fill="none"
                strokeWidth="10"
              />

              {/* Animated Progress Ring */}
              <circle
                className="focus-ring-fill"
                cx="78"
                cy="78"
                r={RADIUS}
                fill="none"
                stroke="url(#focusRingGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                transform="rotate(-90 78 78)"
              />
            </svg>

            {/* Inner Content */}
            <div className="focus-timer-circle-inner">
              <span className="focus-timer-countdown">
                {formatTimeRemaining(remainingSeconds)}
              </span>
              <span className="focus-timer-target-tag">
                / {targetSeconds >= 3600 ? `${targetSeconds / 3600}h` : `${targetSeconds / 60}m`} target
              </span>
              <span className="focus-timer-micro-state">
                {isCompleted
                  ? "Well done!"
                  : isTimerRunning
                    ? "Time counting"
                    : !isTabVisible
                      ? "Return to tab"
                      : "Hit play on video"}
              </span>
            </div>
          </div>

          {/* Right Column: Controls, Presets & Live Learning Metrics */}
          <div className="focus-timer-details-col">
            {/* Presets Row */}
            <div className="focus-timer-presets-group">
              <span className="presets-label">Session Target:</span>
              <div className="presets-buttons-row">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={cn(
                      "preset-pill-btn",
                      targetSeconds === p.seconds && "selected",
                    )}
                    onClick={() => selectPreset(p.seconds)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions: Play/Pause video, Reset, +5m */}
            <div className="focus-timer-actions-row">
              <Button
                size="sm"
                variant={isVideoPlaying ? "outline" : "default"}
                onClick={handleTogglePlayPause}
                className="timer-play-btn"
              >
                {isVideoPlaying ? (
                  <>
                    <Pause size={14} />
                    <span>Pause video</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Play video</span>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                title="Reset timer to target"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddFiveMinutes}
                title="Add 5 minutes to timer"
              >
                <Plus size={13} />
                <span>+5m</span>
              </Button>
            </div>

            {/* Time Spent on Learning Metrics */}
            <div className="focus-timer-metrics-strip">
              <div className="focus-metric-box">
                <span className="focus-metric-label">Session Focus:</span>
                <strong className="focus-metric-value">
                  {formatSessionTime(sessionFocusSeconds)}
                </strong>
              </div>
              <div className="focus-metric-box">
                <span className="focus-metric-label">Today Total:</span>
                <strong className="focus-metric-value">
                  {totalTodayMinutes}m
                  <small className="goal-ref"> / {dailyGoalMinutes}m goal</small>
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Compact View */
        <div className="focus-timer-collapsed-row">
          <div className="collapsed-countdown-group" onClick={toggleExpanded}>
            <span className="collapsed-time">
              {formatTimeRemaining(remainingSeconds)}
            </span>
            <span className="collapsed-target">
              / {targetSeconds >= 3600 ? `${targetSeconds / 3600}h` : `${targetSeconds / 60}m`}
            </span>
          </div>
          <div className="collapsed-session-stat">
            <span>Session: <strong>{formatSessionTime(sessionFocusSeconds)}</strong></span>
          </div>
          <div className="collapsed-actions">
            <button
              type="button"
              className="icon-button"
              onClick={handleTogglePlayPause}
              title={isVideoPlaying ? "Pause video" : "Play video"}
            >
              {isVideoPlaying ? (
                <Pause size={14} />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={handleReset}
              title="Reset timer"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
