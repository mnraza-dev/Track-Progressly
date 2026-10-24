"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FocusTimerPreset = {
  label: string;
  seconds: number;
};

export const TIMER_PRESETS: FocusTimerPreset[] = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "1 Hour", seconds: 60 * 60 },
];

export interface FocusTimerState {
  targetSeconds: number;
  remainingSeconds: number;
  sessionFocusSeconds: number;
  isCompleted: boolean;
  soundEnabled: boolean;
  isExpanded: boolean;
  hasHydrated: boolean;

  // Actions
  selectPreset: (seconds: number) => void;
  tickSecond: () => boolean; // returns true if reached 0 and completed
  resetTimer: () => void;
  addFiveMinutes: () => void;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setCompleted: (completed: boolean) => void;
  setRemainingSeconds: (seconds: number) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const STORAGE_KEY = "progressly_focus_timer_store_v1";

export const useFocusTimerStore = create<FocusTimerState>()(
  persist(
    (set, get) => {
      const defaultSecs = 30 * 60;
      return {
        targetSeconds: defaultSecs,
        remainingSeconds: defaultSecs,
        sessionFocusSeconds: 0,
        isCompleted: false,
        soundEnabled: true,
        isExpanded: true,
        hasHydrated: false,

        selectPreset: (seconds: number) => {
          set({
            targetSeconds: seconds,
            remainingSeconds: seconds,
            isCompleted: false,
          });
        },

        tickSecond: () => {
          const { remainingSeconds, sessionFocusSeconds } = get();
          if (remainingSeconds <= 1) {
            set({
              remainingSeconds: 0,
              sessionFocusSeconds: sessionFocusSeconds + 1,
              isCompleted: true,
            });
            return true;
          }
          set({
            remainingSeconds: remainingSeconds - 1,
            sessionFocusSeconds: sessionFocusSeconds + 1,
          });
          return false;
        },

        resetTimer: () => {
          const { targetSeconds } = get();
          set({
            remainingSeconds: targetSeconds,
            isCompleted: false,
          });
        },

        addFiveMinutes: () => {
          set((state) => ({
            targetSeconds: state.targetSeconds + 300,
            remainingSeconds: state.remainingSeconds + 300,
            isCompleted: false,
          }));
        },

        toggleSound: () => {
          set((state) => ({ soundEnabled: !state.soundEnabled }));
        },

        setSoundEnabled: (enabled: boolean) => {
          set({ soundEnabled: enabled });
        },

        toggleExpanded: () => {
          set((state) => ({ isExpanded: !state.isExpanded }));
        },

        setExpanded: (expanded: boolean) => {
          set({ isExpanded: expanded });
        },

        setCompleted: (completed: boolean) => {
          set({ isCompleted: completed });
        },

        setRemainingSeconds: (seconds: number) => {
          set({ remainingSeconds: Math.max(0, seconds) });
        },

        setHasHydrated: (hydrated: boolean) => {
          set({ hasHydrated: hydrated });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        targetSeconds: state.targetSeconds,
        remainingSeconds: state.remainingSeconds,
        sessionFocusSeconds: state.sessionFocusSeconds,
        isCompleted: state.isCompleted,
        soundEnabled: state.soundEnabled,
        isExpanded: state.isExpanded,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
      },
    },
  ),
);
