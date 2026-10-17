"use client";
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { AlertCircle, ExternalLink, Play, LoaderCircle } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { isConnected } from "@/lib/supabase/client";
import type { Lesson } from "@/types";
import { timestamp } from "@/lib/utils";
type Player = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: () => void;
      };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<void> | null = null;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise)
    apiPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        apiPromise = null;
        reject(new Error("The YouTube player timed out."));
      }, 15000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        previous?.();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timeout);
        apiPromise = null;
        reject(new Error("The YouTube player could not load."));
      };
      document.head.appendChild(script);
    });
  return apiPromise;
}
export type PlayerHandle = {
  seek: (seconds: number) => void;
  position: () => number;
  save: () => void;
  setSpeed: (rate: number) => void;
  getSpeed: () => number;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
};
export const YouTubePlayer = forwardRef<
  PlayerHandle,
  {
    lesson: Lesson;
    onPositionChange?: (seconds: number) => void;
    onEnded?: () => void;
    onPlayStateChange?: (playing: boolean) => void;
  }
>(({ lesson, onPositionChange, onEnded, onPlayStateChange }, ref) => {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(0);
  const latest = useRef(lesson.progress.last_position_seconds);
  const readyRef = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const reportPosition = useRef(onPositionChange);
  const reportPlayState = useRef(onPlayStateChange);
  useEffect(() => {
    reportPosition.current = onPositionChange;
  }, [onPositionChange]);
  useEffect(() => {
    reportPlayState.current = onPlayStateChange;
  }, [onPlayStateChange]);
  const { mutate, notify, data } = useWorkspace();
  const auto = useRef(data.profile.auto_complete);
  const complete = useRef(lesson.progress.is_completed);
  useEffect(() => {
    auto.current = data.profile.auto_complete;
    complete.current = lesson.progress.is_completed;
  }, [data.profile.auto_complete, lesson.progress.is_completed]);
  useImperativeHandle(ref, () => ({
    seek: (seconds) => {
      if (!Number.isFinite(seconds)) return;
      const position = Math.max(0, seconds);
      latest.current = position;
      reportPosition.current?.(position);
      if (readyRef.current && player.current) {
        player.current.seekTo(position, true);
        player.current.playVideo();
      } else pendingSeek.current = position;
    },
    position: () => player.current?.getCurrentTime?.() ?? latest.current,
    save: () => {
      void save().then((success) =>
        notify(
          success
            ? "Playback position saved."
            : "Playback tracking is not ready. Try again after the video loads.",
        ),
      );
    },
    setSpeed: (rate: number) => {
      if (player.current?.setPlaybackRate) {
        player.current.setPlaybackRate(rate);
      }
      try {
        localStorage.setItem("progressly_playback_speed", String(rate));
      } catch {}
    },
    getSpeed: () => player.current?.getPlaybackRate?.() ?? 1,
    play: () => player.current?.playVideo?.(),
    pause: () => player.current?.pauseVideo?.(),
    isPlaying: () => player.current?.getPlayerState?.() === 1,
  }));
  async function save(final = false) {
    const seconds = active.current;
    active.current = 0;
    const position = player.current?.getCurrentTime?.() ?? latest.current;
    latest.current = position;
    if (!ready && !final) return false;
    const mutation = {
      op: "progress" as const,
      video_id: lesson.id,
      position,
      active_seconds: Math.min(60, Math.floor(seconds)),
    };
    try {
      if (final && isConnected) {
        void fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation),
          keepalive: true,
        });
      } else await mutate(mutation);
      return true;
    } catch {
      active.current += seconds;
      return false;
    }
  }
  useEffect(() => {
    let disposed = false;
    let tick: ReturnType<typeof setInterval>;
    let last = Date.now();
    let sinceSave = 0;
    async function mount() {
      try {
        await loadAPI();
        if (disposed || !container.current) return;
        const element = document.createElement("div");
        container.current.replaceChildren(element);
        player.current = new window.YT!.Player(element, {
          videoId: lesson.youtube_video_id,
          width: "100%",
          height: "100%",
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            origin: window.location.origin,
            start: Math.floor(lesson.progress.last_position_seconds),
          },
          events: {
            onReady: () => {
              if (disposed) return;
              readyRef.current = true;
              setReady(true);
              if (pendingSeek.current !== null) {
                player.current?.seekTo(pendingSeek.current, true);
                player.current?.playVideo();
                latest.current = pendingSeek.current;
                pendingSeek.current = null;
              }
              try {
                const savedSpeed = parseFloat(
                  localStorage.getItem("progressly_playback_speed") || "1",
                );
                if (savedSpeed && savedSpeed !== 1) {
                  player.current?.setPlaybackRate?.(savedSpeed);
                }
              } catch {}
              reportPosition.current?.(
                player.current?.getCurrentTime() ?? latest.current,
              );
              reportPlayState.current?.(
                player.current?.getPlayerState?.() === 1,
              );
            },
            onStateChange: (e) => {
              reportPlayState.current?.(e.data === 1);
              if (e.data === 0) {
                onEnded?.();
              }
              if (e.data === 2 || e.data === 0) {
                const pos =
                  player.current?.getCurrentTime?.() ?? latest.current;
                latest.current = pos;
                reportPosition.current?.(pos);
                const seconds = active.current;
                active.current = 0;
                void mutate({
                  op: "progress",
                  video_id: lesson.id,
                  position: pos,
                  active_seconds: Math.min(60, Math.floor(seconds)),
                }).catch(() => {
                  active.current += seconds;
                });
              }
            },
            onError: () => setError(true),
          },
        });
        tick = setInterval(() => {
          const elapsed = Math.min(2, (Date.now() - last) / 1000);
          last = Date.now();
          if (readyRef.current && document.visibilityState === "visible") {
            latest.current =
              player.current?.getCurrentTime?.() ?? latest.current;
            reportPosition.current?.(latest.current);
          }
          if (
            player.current?.getPlayerState?.() === 1 &&
            document.visibilityState === "visible"
          ) {
            active.current += elapsed;
            sinceSave += elapsed;
            latest.current =
              player.current.getCurrentTime?.() ?? latest.current;
            const total = player.current.getDuration?.() || 0;
            if (
              auto.current &&
              !complete.current &&
              total > 0 &&
              latest.current / total >= 0.9
            ) {
              complete.current = true;
              void mutate({
                op: "progress",
                video_id: lesson.id,
                status: "completed",
                position: latest.current,
                active_seconds: 0,
              }).catch(() => {
                complete.current = false;
              });
            }
            if (sinceSave >= 15) {
              sinceSave = 0;
              const count = active.current;
              active.current = 0;
              void mutate({
                op: "progress",
                video_id: lesson.id,
                position: latest.current,
                active_seconds: Math.min(60, Math.floor(count)),
              }).catch(() => {
                active.current += count;
              });
            }
          }
        }, 1000);
      } catch {
        if (!disposed) setError(true);
      }
    }
    void mount();
    const flush = () => {
      const count = active.current;
      active.current = 0;
      const mutation = {
        op: "progress" as const,
        video_id: lesson.id,
        position: latest.current,
        active_seconds: Math.min(60, Math.floor(count)),
      };
      if (isConnected)
        void fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation),
          keepalive: true,
        });
      else void mutate(mutation).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => {
      disposed = true;
      readyRef.current = false;
      reportPlayState.current?.(false);
      clearInterval(tick);
      window.removeEventListener("pagehide", flush);
      if (player.current) {
        latest.current = player.current.getCurrentTime?.() ?? latest.current;
        flush();
        player.current.destroy?.();
        player.current = null;
      }
    };
    // The player is mounted once per lesson; mutable settings are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.youtube_video_id, mutate]);
  return (
    <>
      <div className="player-container">
        <div ref={container} className="player-mount" />
        {!ready && !error && (
          <div className="player-loading">
            <LoaderCircle size={27} className="spin" />
            <span>Getting your lesson ready...</span>
          </div>
        )}
        {error && (
          <div className="player-error">
            <AlertCircle size={30} />
            <h3>This video couldn’t play here.</h3>
            <p>YouTube or your browser may restrict embedded playback.</p>
            <a
              href={`https://www.youtube.com/watch?v=${lesson.youtube_video_id}`}
              target="_blank"
              rel="noreferrer"
            >
              Watch on YouTube <ExternalLink size={15} />
            </a>
          </div>
        )}
      </div>
      {lesson.progress.last_position_seconds > 5 && (
        <button
          className="resume-banner"
          onClick={() => {
            player.current?.seekTo?.(
              lesson.progress.last_position_seconds,
              true,
            );
            player.current?.playVideo?.();
          }}
        >
          <Play size={14} />
          Continue watching from{" "}
          {timestamp(lesson.progress.last_position_seconds)}
          <span>Resume video →</span>
        </button>
      )}
    </>
  );
});
YouTubePlayer.displayName = "YouTubePlayer";
