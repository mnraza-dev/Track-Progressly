"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { Lesson } from "@/types";
import { parseVideoChapters, type VideoChapter } from "@/lib/youtube/chapters";

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

  const storageKey = lesson?.id
    ? `progressly_custom_chapters_${lesson.id}`
    : videoId
      ? `progressly_custom_chapters_${videoId}`
      : "";

  const [customText, setCustomText] = useState<string>("");

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setCustomText("");
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      setCustomText(saved || "");
    } catch {
      setCustomText("");
    }
  }, [storageKey]);

  // Check if the local lesson description actually contains chapters
  const localChapters = useMemo(
    () =>
      available && description.trim()
        ? parseVideoChapters(description, lesson?.duration_seconds || 0)
        : [],
    [available, description, lesson?.duration_seconds],
  );

  // If local description has no chapters and no custom text is set, fetch remote YouTube metadata
  const needsLookup =
    available && Boolean(videoId) && localChapters.length === 0 && !customText.trim();

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

  // Prefer custom text -> local description (if it has chapters) -> remote description
  const text = useMemo(() => {
    if (customText.trim()) return customText;
    if (localChapters.length > 0) return description;
    if (current?.metadata?.description) return current.metadata.description;
    return description;
  }, [
    customText,
    localChapters.length,
    description,
    current?.metadata?.description,
  ]);

  const duration = lesson?.duration_seconds || current?.metadata?.duration || 0;
  const chapters: VideoChapter[] = useMemo(
    () => (available ? parseVideoChapters(text, duration) : []),
    [available, text, duration],
  );

  const saveCustomChapters = useCallback(
    (newText: string) => {
      setCustomText(newText);
      if (storageKey && typeof window !== "undefined") {
        try {
          if (newText.trim()) {
            localStorage.setItem(storageKey, newText.trim());
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch {}
      }
    },
    [storageKey],
  );

  const clearCustomChapters = useCallback(() => {
    setCustomText("");
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
  }, [storageKey]);

  const retry = useCallback(() => {
    if (videoId) {
      lookups.delete(videoId);
    }
    setAttempt((value) => value + 1);
  }, [videoId]);

  return {
    chapters,
    loading: needsLookup && !current && !customText.trim(),
    error: needsLookup && Boolean(current?.error),
    hasCustomChapters: Boolean(customText.trim()),
    saveCustomChapters,
    clearCustomChapters,
    retry,
  };
}
