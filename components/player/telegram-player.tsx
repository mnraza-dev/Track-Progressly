"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telegramPostPattern } from "@/lib/telegram/parse";

/** Telegram owns playback. Do not synthesize watch time or expose a fake PlayerHandle. */
export function TelegramPlayer({
  post,
  title,
}: {
  post: string;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const valid = telegramPostPattern.test(post);
  useEffect(() => {
    const host = container.current;
    if (!host || !valid) return;
    host.replaceChildren();
    const observer = new MutationObserver(() => {
      const frame = host.querySelector("iframe");
      if (frame) {
        frame.title = `Telegram video: ${title}`;
        setState("ready");
        clearTimeout(timer);
      }
    });
    observer.observe(host, { childList: true, subtree: true });
    const timer = setTimeout(() => setState("error"), 15000);
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-post", post);
    script.setAttribute("data-width", "100%");
    script.setAttribute("data-userpic", "false");
    script.onerror = () => {
      clearTimeout(timer);
      setState("error");
    };
    host.appendChild(script);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      script.onerror = null;
      host.replaceChildren();
    };
  }, [post, title, valid, attempt]);
  return (
    <section
      className="panel telegram-player"
      aria-label="Telegram video player"
    >
      <div className="telegram-widget" ref={container} />
      {state === "loading" && valid && (
        <p className="telegram-player-status" role="status">
          <LoaderCircle size={18} className="spin" /> Loading Telegram post…
        </p>
      )}
      {(state === "error" || !valid) && (
        <div className="telegram-player-status" role="alert">
          <p>
            Telegram’s player could not load. Retry, or open the original post.
          </p>
          {valid && (
            <Button
              variant="outline"
              onClick={() => {
                setState("loading");
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCcw size={15} /> Retry player
            </Button>
          )}
        </div>
      )}
      <div className="telegram-playback-help">
        <p>
          Videos play directly from Telegram. Mark lessons complete here;
          automatic watch time, resume, and timestamp seeking aren’t available.
        </p>
        {valid && (
          <a href={`https://t.me/${post}`} target="_blank" rel="noreferrer">
            Open in Telegram <ExternalLink size={14} />
          </a>
        )}
      </div>
    </section>
  );
}
