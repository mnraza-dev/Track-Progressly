"use client";
import { reconcileRewards } from "@/lib/rewards";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { earnedCelebration, type Celebration } from "@/lib/celebrations";
import { create } from "zustand";
import { emptyWorkspace, type Workspace } from "@/types";
import { isConnected } from "@/lib/supabase/client";
import { mutationSchema, type Mutation } from "@/lib/validations";
import { applyMutation } from "@/features/courses/local-reducer";
const storageKey = "learntrack-workspace-v1";
let pending: Promise<void> = Promise.resolve();
type State = {
  data: Workspace;
  loaded: boolean;
  error: string | null;
  toast: string | null;
  celebration: Celebration | null;
  load: () => Promise<void>;
  mutate: (mutation: Mutation) => Promise<void>;
  restore: (data: Workspace) => Promise<void>;
  notify: (message: string) => void;
};
export const useWorkspace = create<State>((set, get) => ({
  data: emptyWorkspace,
  loaded: false,
  error: null,
  toast: null,
  celebration: null,
  notify: (message) => {
    set({ toast: message });
    setTimeout(() => {
      if (get().toast === message) set({ toast: null });
    }, 4000);
  },
  load: async () => {
    try {
      if (isConnected) {
        const res = await fetch("/api/workspace", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Could not load your workspace.");
        set({ data, loaded: true, error: null });
      } else {
        const stored = localStorage.getItem(storageKey);
        const data = stored
          ? parseWorkspaceBackup(stored)
          : structuredClone(emptyWorkspace);
        data.rewards = reconcileRewards(data);
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch {
          get().notify(
            "Workspace loaded, but browser storage is full or unavailable. Export a backup before making changes.",
          );
        }
        set({
          data,
          loaded: true,
          error: null,
        });
      }
    } catch (error) {
      set({
        loaded: true,
        error:
          error instanceof Error ? error.message : "Could not load workspace.",
      });
    }
  },
  restore: async (data) => {
    if (isConnected)
      throw new Error("Restore is available in browser workspaces only.");
    const job = pending
      .catch(() => {})
      .then(() => {
        localStorage.setItem(storageKey, JSON.stringify(data));
        set({ data, error: null, loaded: true });
      });
    pending = job;
    await job;
  },
  mutate: async (input) => {
    const parsed = mutationSchema.parse(input);
    const job = pending
      .catch(() => {})
      .then(async () => {
        try {
          if (isConnected) {
            const response = await fetch("/api/workspace", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "Could not save changes.");
            if (parsed.op === "create_course" || parsed.op === "refresh_course")
              await get().load();
            else {
              const before = get().data;
              const data = applyMutation(before, parsed);
              if (result.rewards) data.rewards = result.rewards;
              if (parsed.op === "submit_quiz" && result.quiz_attempt) {
                const video = data.courses
                  .flatMap((c) => c.videos)
                  .find((v) => v.id === parsed.video_id);
                if (video)
                  video.quiz_attempts = [
                    ...(video.quiz_attempts || []).filter(
                      (a) => a.id !== parsed.id,
                    ),
                    result.quiz_attempt,
                  ].slice(-100);
              }
              set({ data, celebration: earnedCelebration(before, data) });
            }
          } else {
            const before = get().data;
            const data = applyMutation(before, parsed);
            localStorage.setItem(storageKey, JSON.stringify(data));
            set({ data, celebration: earnedCelebration(before, data) });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not save changes.";
          get().notify(message);
          throw error;
        }
      });
    pending = job;
    await job;
  },
}));
