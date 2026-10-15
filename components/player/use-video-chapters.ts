"use client";
import { useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/types";
import { parseVideoChapters } from "@/lib/youtube/chapters";

type Metadata = { description: string; duration: number };
const lookups = new Map<
  string,
  { expires: number; request: Promise<Metadata> }
>();
function lookup(videoId: string) {
  const cached = lookups.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.request;
  const request = fetch("/api/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: videoId }),
  }).then(async (response) => {
    if (!response.ok) throw new Error("Video metadata unavailable");
    const preview = await response.json();
    const video = preview.videos?.find(
      (item: { youtube_video_id: string }) => item.youtube_video_id === videoId,
    );
    return {
      description:
        typeof video?.description === "string" ? video.description : "",
      duration: Number(video?.duration_seconds) || 0,
    };
  });
  if (lookups.size >= 100) lookups.delete(lookups.keys().next().value!);
  lookups.set(videoId, { expires: Date.now() + 10 * 60 * 1000, request });
  return request;
}

export function useVideoChapters(lesson?: Lesson) {
  const videoId = lesson?.youtube_video_id || "";
  const description = lesson?.description || "";
  const available = lesson?.availability_status === "available";
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<{
    videoId: string;
    attempt: number;
    metadata?: Metadata;
    error?: boolean;
  } | null>(null);
  const needsLookup = available && Boolean(videoId) && !description.trim();
  useEffect(() => {
    if (!needsLookup) return;
    let cancelled = false;
    void lookup(videoId)
      .then((metadata) => {
        if (!cancelled) setRemote({ videoId, attempt, metadata });
      })
      .catch(() => {
        if (!cancelled) setRemote({ videoId, attempt, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, videoId, attempt]);
  const current =
    remote?.videoId === videoId && remote.attempt === attempt ? remote : null;
  const text = description.trim()
    ? description
    : current?.metadata?.description || "";
  const duration = lesson?.duration_seconds || current?.metadata?.duration || 0;
  const chapters = useMemo(
    () => (available ? parseVideoChapters(text, duration) : []),
    [available, text, duration],
  );
  return {
    chapters,
    loading: needsLookup && !current,
    error: needsLookup && Boolean(current?.error),
    retry: () => {
      lookups.delete(videoId);
      setAttempt((value) => value + 1);
    },
  };
}
