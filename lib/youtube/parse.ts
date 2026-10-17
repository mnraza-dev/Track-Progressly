const videoPattern = /^[a-zA-Z0-9_-]{11}$/;
const playlistPattern = /^(PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{8,100}$/;

export function parseTimestampParam(t: string | null): number | undefined {
  if (!t) return undefined;
  const clean = t.trim().toLowerCase();
  if (/^\d+s?$/.test(clean)) {
    const num = parseInt(clean, 10);
    return num > 0 ? num : undefined;
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(clean);
  if (match && (match[1] || match[2] || match[3])) {
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    const s = parseInt(match[3] || "0", 10);
    const total = h * 3600 + m * 60 + s;
    return total > 0 ? total : undefined;
  }
  return undefined;
}

export function parseYouTube(input: string): {
  type: "playlist" | "video";
  id: string;
  startSeconds?: number;
} {
  const value = input.trim();
  if (videoPattern.test(value)) return { type: "video", id: value };
  if (playlistPattern.test(value)) return { type: "playlist", id: value };
  let url: URL;
  try {
    url = new URL(value.startsWith("www.") ? `https://${value}` : value);
  } catch {
    throw new Error("Enter a valid YouTube video or playlist URL or ID.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    ![
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
      "www.youtu.be",
    ].includes(url.hostname)
  )
    throw new Error("Please use a youtube.com or youtu.be link.");

  const playlist = url.searchParams.get("list");
  if (playlist && playlistPattern.test(playlist))
    return { type: "playlist", id: playlist };

  const id = url.hostname.endsWith("youtu.be")
    ? url.pathname.split("/")[1]
    : url.searchParams.get("v") ||
      (/^\/(shorts|embed|live)\//.test(url.pathname)
        ? url.pathname.split("/")[2]
        : "");

  const timeParam =
    url.searchParams.get("t") ||
    url.searchParams.get("start") ||
    (url.hash.startsWith("#t=") ? url.hash.slice(3) : null);
  const startSeconds = parseTimestampParam(timeParam);

  if (id && videoPattern.test(id)) {
    return startSeconds !== undefined
      ? { type: "video", id, startSeconds }
      : { type: "video", id };
  }

  throw new Error(
    "This link does not contain a valid YouTube video or playlist.",
  );
}

export function parseDuration(iso: string) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  return match
    ? Number(match[1] || 0) * 86400 +
        Number(match[2] || 0) * 3600 +
        Number(match[3] || 0) * 60 +
        Number(match[4] || 0)
    : 0;
}
