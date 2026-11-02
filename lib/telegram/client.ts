import type { ImportPreview } from "@/types";
import type { TelegramPage } from "./service";
import { parseTelegram } from "./parse";

export async function importTelegramChannel(
  input: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (videos: number, pages: number, message?: string) => void;
  } = {},
): Promise<ImportPreview> {
  const channel = parseTelegram(input);
  const videos = new Map<string, ImportPreview["videos"][number]>();
  let preview: TelegramPage | undefined;
  let before: string | undefined;
  for (let pages = 1; pages <= 2000; pages++) {
    options.signal?.throwIfAborted();
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: channel, before }),
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
      });
      if (response.status !== 429 || attempt === 2) break;
      const seconds = Math.max(
        1,
        Math.min(60, Number(response.headers.get("Retry-After")) || 60),
      );
      options.onProgress?.(
        videos.size,
        pages - 1,
        `Telegram is limiting requests. Retrying in ${seconds} seconds…`,
      );
      await response.body?.cancel();
      await pause(seconds * 1000, options.signal);
    }
    options.signal?.throwIfAborted();
    if (!response) throw new Error("Telegram import failed. Please retry.");
    const result: TelegramPage & { error?: string } = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Telegram import failed. Please retry.");
    options.signal?.throwIfAborted();
    preview ??= result;
    result.videos.forEach((video) => videos.set(video.telegram_post!, video));
    options.onProgress?.(videos.size, pages);
    if (videos.size > 5000)
      throw new Error(
        "This channel has more than 5,000 videos. Import a smaller channel.",
      );
    if (!result.next_before) {
      if (!videos.size)
        throw new Error(
          "No video posts were found in this channel’s public web history. Its files may only be available inside Telegram.",
        );
      return {
        ...preview,
        videos: [...videos.values()].sort((a, b) => a.position - b.position),
      };
    }
    if (
      !/^[1-9]\d{0,15}$/.test(result.next_before) ||
      (before && Number(result.next_before) >= Number(before))
    )
      throw new Error(
        "Telegram returned a repeated history page. Please retry.",
      );
    before = result.next_before;
  }
  throw new Error(
    "This channel’s history is too large to scan in one import. No partial course was saved.",
  );
}

function pause(milliseconds: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason || new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
