import { describe, it, expect } from "vitest";

describe("Study Focus Timer logic & presets", () => {
  const PRESETS = [
    { label: "5 min", seconds: 5 * 60 },
    { label: "15 min", seconds: 15 * 60 },
    { label: "30 min", seconds: 30 * 60 },
    { label: "1 hr", seconds: 60 * 60 },
  ];

  it("defines standard study sprint intervals correctly", () => {
    expect(PRESETS.find((p) => p.label === "5 min")?.seconds).toBe(300);
    expect(PRESETS.find((p) => p.label === "15 min")?.seconds).toBe(900);
    expect(PRESETS.find((p) => p.label === "30 min")?.seconds).toBe(1800);
    expect(PRESETS.find((p) => p.label === "1 hr")?.seconds).toBe(3600);
  });

  it("calculates circular graph progress and stroke offsets accurately", () => {
    const RADIUS = 62;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    const calcOffset = (remaining: number, target: number) => {
      const progress = Math.max(0, Math.min(1, remaining / target));
      return CIRCUMFERENCE * (1 - progress);
    };

    // Full time remaining: offset should be 0 (full circle visible)
    expect(calcOffset(1800, 1800)).toBeCloseTo(0, 2);

    // Half time remaining: offset should be half of circumference
    expect(calcOffset(900, 1800)).toBeCloseTo(CIRCUMFERENCE / 2, 2);

    // Time finished: offset should be total circumference (circle fully depleted)
    expect(calcOffset(0, 1800)).toBeCloseTo(CIRCUMFERENCE, 2);
  });

  it("evaluates synchronization state between video playback and tab visibility", () => {
    const shouldTick = (
      isVideoPlaying: boolean,
      isTabVisible: boolean,
      remaining: number,
      isCompleted: boolean,
    ) => isVideoPlaying && isTabVisible && remaining > 0 && !isCompleted;

    // Both video playing and tab visible -> timer ticks
    expect(shouldTick(true, true, 500, false)).toBe(true);

    // Video paused -> timer must pause
    expect(shouldTick(false, true, 500, false)).toBe(false);

    // Tab hidden (user navigated to another tab) -> timer must pause even if video plays
    expect(shouldTick(true, false, 500, false)).toBe(false);

    // Both paused/hidden -> timer must pause
    expect(shouldTick(false, false, 500, false)).toBe(false);

    // Timer completed (0s remaining) -> timer must stop
    expect(shouldTick(true, true, 0, true)).toBe(false);
  });

  it("formats countdown strings correctly for minutes and hours", () => {
    const formatTimeRemaining = (totalSecs: number) => {
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      }
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    expect(formatTimeRemaining(3600)).toBe("1:00:00");
    expect(formatTimeRemaining(1800)).toBe("30:00");
    expect(formatTimeRemaining(900)).toBe("15:00");
    expect(formatTimeRemaining(300)).toBe("05:00");
    expect(formatTimeRemaining(75)).toBe("01:15");
    expect(formatTimeRemaining(9)).toBe("00:09");
  });
});
