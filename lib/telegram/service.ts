import type { ImportPreview } from "@/types";
import { parseTelegram, TelegramError, telegramPostPattern } from "./parse";
import dns from "node:dns";

function getTelegramDispatcher() {
  let undici: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    undici = require("undici");
  } catch {
    return undefined;
  }
  const proxy =
    process.env.TELEGRAM_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.all_proxy;
  if (proxy && undici?.ProxyAgent) {
    try {
      return new undici.ProxyAgent(proxy);
    } catch {
      // Ignore invalid proxy configuration
    }
  }
  if (!undici?.Agent) return undefined;
  try {
    const resolver = new dns.Resolver();
    resolver.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);
    return new undici.Agent({
      connect: {
        lookup: (
          hostname: string,
          options: unknown,
          callback: (
            err: NodeJS.ErrnoException | null,
            address: unknown,
            family?: number,
          ) => void,
        ) => {
          const cb = (typeof options === "function" ? options : callback) as (
            err: NodeJS.ErrnoException | null,
            address: unknown,
            family?: number,
          ) => void;
          const opts = (typeof options === "object" && options !== null
            ? options
            : {}) as { all?: boolean };
          resolver.resolve4(hostname, (err, addresses) => {
            if (!err && addresses && addresses.length > 0) {
              if (opts.all) {
                return cb(
                  null,
                  addresses.map((address) => ({ address, family: 4 })),
                );
              }
              return cb(null, addresses[0], 4);
            }
            (dns.lookup as any)(hostname, options, callback);
          });
        },
      },
    });
  } catch {
    return undefined;
  }
}

let telegramDispatcher: ReturnType<typeof getTelegramDispatcher> | undefined;

export type TelegramPage = ImportPreview & { next_before: string | null };
const cache = new Map<string, { expires: number; page: TelegramPage }>();
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
function text(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? match;
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .trim();
}
function content(html: string, className: string) {
  return (
    html.match(
      new RegExp(
        `<div\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
        "i",
      ),
    )?.[1] || ""
  );
}

/** Parse only post metadata. No HTML or temporary Telegram media URL reaches the app. */
export function parseTelegramPage(
  html: string,
  channel: string,
  before?: string,
): TelegramPage {
  const blocks = html
    .split(
      /(?=<div\b[^>]*class="[^"]*\btgme_widget_message\b[^"]*"[^>]*data-post=")/i,
    )
    .slice(1);
  const videos: ImportPreview["videos"] = [];
  const seen = new Set<string>();
  const ids: number[] = [];
  for (const block of blocks) {
    const post = block.match(/\bdata-post="([^"]+)"/)?.[1];
    if (
      !post ||
      !telegramPostPattern.test(post) ||
      post.split("/")[0].toLowerCase() !== channel
    )
      continue;
    const id = Number(post.split("/")[1]);
    if (!Number.isSafeInteger(id) || (before && id >= Number(before))) continue;
    ids.push(id);
    const filename = text(content(block, "tgme_widget_message_document_title"));
    const isVideo =
      /\btgme_widget_message_video(?:_player|_thumb|_duration)?\b/.test(
        block,
      ) || /\.(?:mp4|m4v|mov|webm|mkv|avi)$/i.test(filename);
    if (!isVideo || seen.has(post)) continue;
    seen.add(post);
    const caption = text(content(block, "tgme_widget_message_text"));
    const clock = text(
      block.match(
        /class="[^"]*\btgme_widget_message_video_duration\b[^"]*"[^>]*>([^<]*)</,
      )?.[1] || "",
    );
    const duration = /^\d+(?::\d{2}){1,2}$/.test(clock)
      ? clock.split(":").reduce((sum, n) => sum * 60 + Number(n), 0)
      : 0;
    videos.push({
      source: "telegram",
      telegram_post: `${channel}/${id}`,
      youtube_video_id: "",
      title: (
        filename ||
        caption.split("\n").find((line) => line.trim()) ||
        `Video ${id}`
      ).slice(0, 500),
      description: caption.slice(0, 10000),
      thumbnail_url: "",
      duration_seconds: Math.max(0, Math.min(Math.round(duration), 604800)),
      position: id,
      availability_status: "available",
    });
  }
  // Telegram exposes the older-page cursor on its public preview pager.
  const pagerTags =
    html.match(
      /<a\b[^>]*class="[^"]*\b(?:tme_messages_more|js-messages_more)\b[^"]*"[^>]*>/g,
    ) || [];
  const cursors = pagerTags.flatMap((tag) => {
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!href) return [];
    let url: URL;
    try {
      url = new URL(text(href), `https://t.me/s/${channel}`);
    } catch {
      return [];
    }
    if (
      url.origin !== "https://t.me" ||
      url.pathname.toLowerCase() !== `/s/${channel}`
    )
      return [];
    const value = url.searchParams.get("before") || "";
    if (!/^[1-9]\d{0,15}$/.test(value)) return [];
    const id = Number(value);
    return Number.isSafeInteger(id) ? [id] : [];
  });
  if (before && cursors.some((id) => id >= Number(before)))
    throw new TelegramError(
      "Telegram returned a repeated history cursor. Please retry.",
      502,
    );
  const next = cursors.length ? Math.min(...cursors) : null;
  const title =
    text(content(html, "tgme_channel_info_header_title")) || channel;
  const description = text(content(html, "tgme_channel_info_description"));
  if (!blocks.length && !/\btgme_channel_info\b/.test(html))
    throw new TelegramError(
      "This channel has no public web preview. Check the username or open it in Telegram.",
      422,
    );
  if (next && ids.length && next > Math.min(...ids))
    throw new TelegramError(
      "Telegram returned an invalid history cursor. Please retry.",
      502,
    );
  return {
    title: title.slice(0, 250),
    description: description.slice(0, 10000),
    channel_name: channel,
    telegram_channel: channel,
    thumbnail_url: "",
    youtube_playlist_id: null,
    videos: videos.sort((a, b) => a.position - b.position),
    next_before: next ? String(next) : null,
  };
}

function handleFetchError(error: unknown, url: URL): never {
  console.error(
    `[telegram-service] Network request failed for ${url.toString()}:`,
    error,
  );
  const isTimeout =
    error instanceof Error &&
    (error.name === "ConnectTimeoutError" ||
      (error as any).cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.message.includes("Connect Timeout") ||
      (error as any).cause?.message?.includes("Connect Timeout"));
  throw new TelegramError(
    isTimeout
      ? "Telegram connection timed out. Your ISP or network is blocking direct access to Telegram. Enable a VPN (e.g. Cloudflare WARP) or configure TELEGRAM_PROXY in .env.local."
      : "Telegram could not be reached. Please check your network or VPN, or try again shortly.",
    502,
  );
}

export async function importTelegramPage(
  input: string,
  before?: string,
  request: typeof fetch = fetch,
): Promise<TelegramPage> {
  const channel = parseTelegram(input);
  if (before && !/^[1-9]\d{0,15}$/.test(before))
    throw new TelegramError("Invalid Telegram history cursor.");
  const key = `${channel}:${before || "latest"}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return structuredClone(cached.page);
  const url = new URL(`https://t.me/s/${channel}`);
  if (before) url.searchParams.set("before", before);
  const init: RequestInit & { dispatcher?: unknown } = {
    cache: "no-store",
    redirect: "error",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  };
  telegramDispatcher ??= getTelegramDispatcher();
  if (telegramDispatcher) init.dispatcher = telegramDispatcher;

  const webProxy = process.env.TELEGRAM_WEB_PROXY;
  const target = webProxy
    ? `${webProxy}${encodeURIComponent(url.toString())}`
    : url;

  let response: Response;
  try {
    response = await request(target as unknown as URL, init);
  } catch (error) {
    if (!webProxy && request === fetch) {
      try {
        console.warn(
          `[telegram-service] Direct connection to ${url.toString()} failed. Attempting fallback web proxy...`,
        );
        response = await fetch(
          `https://corsproxy.io/?${encodeURIComponent(url.toString())}`,
          {
            cache: "no-store",
            headers: init.headers,
            signal: AbortSignal.timeout(15000),
          },
        );
      } catch (fallbackError) {
        console.error(
          `[telegram-service] Fallback web proxy failed:`,
          fallbackError,
        );
        handleFetchError(error, url);
      }
    } else {
      handleFetchError(error, url);
    }
  }
  if (!response.ok)
    throw new TelegramError(
      response.status === 429
        ? "Telegram is limiting requests. Wait a minute and try again."
        : "Telegram’s public channel preview is unavailable.",
      response.status === 429 ? 429 : 502,
    );
  if (Number(response.headers.get("content-length")) > 4_000_000)
    throw new TelegramError("Telegram’s preview response was too large.", 502);
  // Bound decompressed responses as well as Content-Length.
  const reader = response.body?.getReader();
  if (!reader)
    throw new TelegramError("Telegram returned an empty response.", 502);
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4_000_000)
        throw new TelegramError(
          "Telegram’s preview response was too large.",
          502,
        );
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
  const page = parseTelegramPage(html, channel, before);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 60_000, page });
  return structuredClone(page);
}
