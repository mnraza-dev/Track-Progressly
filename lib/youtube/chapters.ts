export type VideoChapter = {
  title: string;
  start_seconds: number;
  end_seconds: number | null;
};

// The Data API provides creator timestamps in snippet.description, not a
// separate chapter resource. Derive navigation without changing saved metadata.
export function parseVideoChapters(
  description: string,
  duration = 0,
): VideoChapter[] {
  const chapters = new Map<number, string>();
  const timePattern = /(?<![\d:\w/=?])\d{1,3}:[0-5]\d(?::[0-5]\d)?(?![\d:])/g;
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /https?:\/\/|www\./i.test(line)) continue;
    const matches = [...line.matchAll(timePattern)];
    if (matches.length !== 1) continue;
    const match = matches[0];
    const parts = match[0].split(":").map(Number);
    const seconds =
      parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];
    if (duration > 0 && seconds >= duration) continue;
    const before = line
      .slice(0, match.index)
      .replace(/^[\s\-–—•*#]+|[\s\-–—:|\[(]+$/g, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    const after = line
      .slice(match.index + match[0].length)
      .replace(/^[\s\-–—:|\])]+/g, "")
      .trim();
    const title = after || before;
    if (!title || chapters.has(seconds)) continue;
    chapters.set(seconds, title);
  }
  const entries = [...chapters].sort(([a], [b]) => a - b);
  return entries.map(([start_seconds, title], index) => ({
    title,
    start_seconds,
    end_seconds:
      entries[index + 1]?.[0] ?? (duration > start_seconds ? duration : null),
  }));
}

export function chapterAt(chapters: VideoChapter[], seconds: number) {
  for (let index = chapters.length - 1; index >= 0; index--) {
    if (seconds >= chapters[index].start_seconds) return index;
  }
  return -1;
}

export function chapterTimestamp(seconds: number) {
  const value = Math.floor(seconds);
  const minutes = Math.floor(value / 60);
  const tail = String(value % 60).padStart(2, "0");
  return value >= 3600
    ? `${Math.floor(value / 3600)}:${String(minutes % 60).padStart(2, "0")}:${tail}`
    : `${minutes}:${tail}`;
}
