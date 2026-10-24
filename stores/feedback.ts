"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type FeedbackPreferences = {
  soundEnabled: boolean; volume: number; celebrationsEnabled: boolean; quietWhilePlaying: boolean;
  videoPlaying: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setCelebrationsEnabled: (enabled: boolean) => void;
  setQuietWhilePlaying: (enabled: boolean) => void;
  setVideoPlaying: (playing: boolean) => void;
};
export const useFeedback = create<FeedbackPreferences>()(persist((set) => ({
  soundEnabled: false, volume: 0.35, celebrationsEnabled: true, quietWhilePlaying: true, videoPlaying: false,
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  setCelebrationsEnabled: (celebrationsEnabled) => set({ celebrationsEnabled }),
  setQuietWhilePlaying: (quietWhilePlaying) => set({ quietWhilePlaying }),
  setVideoPlaying: (videoPlaying) => set({ videoPlaying }),
}), {
  name: "progressly-feedback-v1",
  partialize: ({ soundEnabled, volume, celebrationsEnabled, quietWhilePlaying }) => ({ soundEnabled, volume, celebrationsEnabled, quietWhilePlaying }),
  merge: (saved, current) => {
    if (!saved || typeof saved !== "object") return current;
    const value = saved as Partial<FeedbackPreferences>;
    return { ...current,
      soundEnabled: value.soundEnabled === true,
      volume: typeof value.volume === "number" && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : current.volume,
      celebrationsEnabled: value.celebrationsEnabled !== false,
      quietWhilePlaying: value.quietWhilePlaying !== false,
    };
  },
}));
