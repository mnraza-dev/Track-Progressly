"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { Workspace } from "@/types";
import { getGamificationStats } from "@/lib/gamification";
function subscribe(listener: () => void) {
  const timer = setInterval(listener, 30000);
  document.addEventListener("visibilitychange", listener);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", listener);
  };
}
export function useGamification(data: Workspace) {
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 30000),
    () => 0,
  );
  return useMemo(
    () =>
      getGamificationStats(data, tick ? new Date(tick * 30000) : new Date()),
    [data, tick],
  );
}
