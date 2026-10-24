"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  EyeOff,
  Zap,
} from "lucide-react";
import { useFeedback } from "@/stores/feedback";
import { unlockAudio, playFeedbackSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import { useWorkspace } from "@/stores/workspace";
import { learningTime, localDay, cn } from "@/lib/utils";
import type { PlayerHandle } from "./youtube-player";

import { useFocusTimerStore, TIMER_PRESETS } from "@/stores/focus-timer";

type StudyFocusTimerProps = {
  isVideoPlaying: boolean;
  playerRef: React.RefObject<PlayerHandle | null>;
  className?: string;
  defaultOpen?: boolean;
};

export function StudyFocusTimer({
  isVideoPlaying,
  playerRef,
  className,
}: StudyFocusTimerProps) {
  const { data, notify } = useWorkspace();
  const { soundEnabled, setSoundEnabled } = useFeedback();
  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) void unlockAudio();
  };

  // Persistent Zustand Store
  const {
    targetSeconds,
    remainingSeconds,
    sessionFocusSeconds,
    isCompleted,
    isExpanded,
    selectPreset: setTargetPreset,
    tickSecond,
    resetTimer,
    addFiveMinutes,
    toggleExpanded,
    setCompleted,
  } = useFocusTimerStore();

  // Tab visibility state
  const [isTabVisible, setIsTabVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  // Today's total logged study time
  const todayDay = localDay(new Date(), data.profile.timezone);
  const todayActivity = data.activity.find((a) => a.day === todayDay);
  const todayBaseMinutes = Math.floor(
    (todayActivity?.active_seconds || 0) / 60,
  );
  const totalTodayMinutes = todayBaseMinutes;
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
    setCompleted(true);
    fireConfetti();
    if (soundEnabled) {
      playFeedbackSound("focus");
    }
    notify(
      `🎉 Focus sprint completed! You logged a focused ${learningTime(targetSeconds / 60)} study session!`,
    );
  }, [soundEnabled, targetSeconds, notify, setCompleted]);

  useEffect(() => {
    if (!isTimerRunning) return;

    const interval = setInterval(() => {
      const completed = tickSecond();
      if (completed) {
        clearInterval(interval);
        handleTimerComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, tickSecond, handleTimerComplete]);

  // Set target preset
  const selectPreset = (seconds: number) => {
    setTargetPreset(seconds);
    notify(`Focus target set to ${learningTime(seconds / 60)}`);
  };

  // Reset timer
  const handleReset = () => {
    resetTimer();
    notify("Timer reset to target.");
  };

  // Add 5 min
  const handleAddFiveMinutes = () => {
    addFiveMinutes();
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

  // Check if timer is mid-session paused (e.g. 13m remaining out of 15m)
  const isPausedMidSession =
    !isVideoPlaying &&
    remainingSeconds < targetSeconds &&
    remainingSeconds > 0 &&
    !isCompleted;

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
    return `${learningTime(mins, true)}${remSecs ? ` ${remSecs}s` : ""}`;
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
            ) : isPausedMidSession ? (
              <span className="timer-status-badge paused">
                <Pause size={12} />
                Paused ({formatTimeRemaining(remainingSeconds)} remaining)
              </span>
            ) : !isVideoPlaying ? (
              <span className="timer-status-badge ready">
                <Zap size={12} />
                Ready to study
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
            onClick={toggleSound}
            title={
              soundEnabled ? "Mute chime sound" : "Enable completion chime"
            }
            aria-label={
              soundEnabled ? "Mute chime sound" : "Enable completion chime"
            }
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
                / {learningTime(targetSeconds / 60)} target
              </span>
              <span className="focus-timer-micro-state">
                {isCompleted
                  ? "Well done!"
                  : isTimerRunning
                    ? "Time counting"
                    : !isTabVisible
                      ? "Return to tab"
                      : isPausedMidSession
                        ? "Hit resume to continue"
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
                ) : isPausedMidSession ? (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Resume video</span>
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
                  {learningTime(totalTodayMinutes)}
                  <small className="goal-ref">
                    {" "}
                    / {learningTime(dailyGoalMinutes)} goal
                  </small>
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
              / {learningTime(targetSeconds / 60)}
            </span>
          </div>
          <div className="collapsed-session-stat">
            <span>
              Session: <strong>{formatSessionTime(sessionFocusSeconds)}</strong>
            </span>
          </div>
          <div className="collapsed-actions">
            <button
              type="button"
              className="icon-button"
              onClick={handleTogglePlayPause}
              title={
                isVideoPlaying
                  ? "Pause video"
                  : isPausedMidSession
                    ? "Resume video"
                    : "Play video"
              }
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
