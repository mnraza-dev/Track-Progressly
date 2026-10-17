"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export type TourStep = {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  icon?: "play" | "sparkles" | "target" | "check" | "rotate" | "compass" | "book";
  placement?: "top" | "bottom" | "left" | "right";
  badge?: string;
};

export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: "resume-hero",
    target: '[data-tour="resume-hero"]',
    title: "Continue Where You Left Off",
    description:
      "Pick up your latest course instantly. Progressly tracks your exact video timestamp, active chapter, and lesson status so you never lose your place.",
    icon: "play",
    placement: "bottom",
    badge: "01 / 07",
  },
  {
    id: "stats-grid",
    target: '[data-tour="stats-grid"]',
    title: "Actionable Learning Metrics",
    description:
      "Stay on top of your courses in progress, completed lessons and chapters, hands-on practice tasks, and continuous learning streak.",
    icon: "sparkles",
    placement: "bottom",
    badge: "02 / 07",
  },
  {
    id: "gamification-quests",
    target: '[data-tour="gamification-quests"]',
    title: "Mastery Tiers & Daily Quests",
    description:
      "Level up your craft as you study. Earn XP for lessons, chapters, and practice, track daily discipline quests, and unlock 10 collectible learning badges.",
    icon: "sparkles",
    placement: "bottom",
    badge: "03 / 07",
  },
  {
    id: "weekly-consistency",
    target: '[data-tour="weekly-consistency"]',
    title: "Weekly Consistency Tracker",
    description:
      "Consistency beats intensity. Check your daily learning momentum across all 7 days of the week and stay committed to your daily intention.",
    icon: "target",
    placement: "bottom",
    badge: "04 / 07",
  },
  {
    id: "practice-queue",
    target: '[data-tour="practice-queue"]',
    title: "Practice & Action Items",
    description:
      "Turn tutorials into real skills. Check off practice exercises and projects directly from your dashboard without digging through lessons.",
    icon: "check",
    placement: "top",
    badge: "05 / 07",
  },
  {
    id: "revision-queue",
    target: '[data-tour="revision-queue"]',
    title: "Knowledge Retention & Revision",
    description:
      "Never forget key insights. Review notes flagged for revision and jump directly to the exact video timestamp with a single click.",
    icon: "rotate",
    placement: "top",
    badge: "06 / 07",
  },
  {
    id: "sidebar-nav",
    target: '[data-tour="sidebar-nav"]',
    title: "Focus-Ready Learning Studio",
    description:
      "Navigate your library, search notes and courses with ⌘K, or collapse the sidebar for a clean, distraction-free study space.",
    icon: "compass",
    placement: "right",
    badge: "07 / 07",
  },
];

type TourContextType = {
  isOpen: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  closeTour: () => void;
  completeTour: () => void;
};

const TourContext = createContext<TourContextType | null>(null);

const STORAGE_KEY = "progressly_tour_seen_v1";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = DEFAULT_TOUR_STEPS;

  // Check if first-time user after brief delay
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  const completeTour = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        completeTour();
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index);
      }
    },
    [steps.length],
  );

  return (
    <TourContext.Provider
      value={{
        isOpen,
        currentStep,
        steps,
        startTour,
        nextStep,
        prevStep,
        goToStep,
        closeTour,
        completeTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return {
      isOpen: false,
      currentStep: 0,
      steps: DEFAULT_TOUR_STEPS,
      startTour: () => {},
      nextStep: () => {},
      prevStep: () => {},
      goToStep: () => {},
      closeTour: () => {},
      completeTour: () => {},
    };
  }
  return ctx;
}

