import { describe, expect, it } from "vitest";
import { DEFAULT_TOUR_STEPS } from "@/components/tour/tour-context";

describe("Product Tour Configuration", () => {
  it("contains all essential dashboard and studio feature steps", () => {
    expect(DEFAULT_TOUR_STEPS.length).toBe(7);

    const stepIds = DEFAULT_TOUR_STEPS.map((s) => s.id);
    expect(stepIds).toEqual([
      "resume-hero",
      "stats-grid",
      "gamification-quests",
      "weekly-consistency",
      "practice-queue",
      "revision-queue",
      "sidebar-nav",
    ]);
  });

  it("each tour step has valid targets, non-empty titles, descriptions, and badges", () => {
    DEFAULT_TOUR_STEPS.forEach((step, index) => {
      expect(step.id).toBeTruthy();
      expect(step.target).toMatch(/^\[data-tour=".*"\]$/);
      expect(step.title.length).toBeGreaterThan(5);
      expect(step.description.length).toBeGreaterThan(20);
      expect(step.badge).toBe(`0${index + 1} / 07`);
      expect(["top", "bottom", "left", "right"]).toContain(step.placement);
    });
  });
});
