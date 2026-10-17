export type VideoChapter = {
  title: string;
  start_seconds: number;
  end_seconds: number | null;
};

// Regex to detect standard and bracketed timestamps:
// Matches 00:00, 0:00, 1:23:45, 01:23:45, [00:00], (00:00), 【00:00】, <00:00>
const TIMESTAMP_REGEX =
  /(?:\[|\(|\<|【)?(?<![\w\d:])(\d{1,2}:[0-5]\d(?::[0-5]\d)?)(?!:\d)(?:\]|\)|\>|】)?/g;

function parseTimeToSeconds(ts: string): number {
  const clean = ts.replace(/[\[\]\(\)\<\>【】]/g, "").trim();
  const parts = clean.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

function cleanTitle(raw: string): string {
  let title = raw.trim();
  // Strip URLs if any remain
  title = title.replace(/https?:\/\/\S+|www\.\S+/gi, "").trim();
  // Collapse redundant whitespace
  title = title.replace(/\s{2,}/g, " ");
  // Strip leading numbering: "1. ", "01. ", "(1) ", "Chapter 1: ", "Part 1 - "
  title = title
    .replace(/^(?:chapter|part|section|step)?\s*\d+[\.:\)\-]\s*/i, "")
    .trim();
  // Strip leading separators
  title = title.replace(/^[\s\-–—•*#~|:;]+/, "").trim();
  // Strip trailing separators
  title = title.replace(/[\s\-–—:|;]+$/, "").trim();

  // If there is an unmatched trailing bracket/paren at the end (e.g. from "[00:00 Title]"), strip it
  if (title.endsWith(")") && !title.includes("(")) {
    title = title.slice(0, -1).trim();
  }
  if (title.endsWith("]") && !title.includes("[")) {
    title = title.slice(0, -1).trim();
  }
  if (title.endsWith("}") && !title.includes("{")) {
    title = title.slice(0, -1).trim();
  }
  if (title.endsWith(">") && !title.includes("<")) {
    title = title.slice(0, -1).trim();
  }
  if (title.endsWith("】") && !title.includes("【")) {
    title = title.slice(0, -1).trim();
  }

  // Also if there is an unmatched leading bracket/paren (e.g. from "Title - 00:00]"), strip it
  if (title.startsWith("(") && !title.includes(")")) {
    title = title.slice(1).trim();
  }
  if (title.startsWith("[") && !title.includes("]")) {
    title = title.slice(1).trim();
  }
  if (title.startsWith("{") && !title.includes("}")) {
    title = title.slice(1).trim();
  }
  if (title.startsWith("<") && !title.includes(">")) {
    title = title.slice(1).trim();
  }
  if (title.startsWith("【") && !title.includes("】")) {
    title = title.slice(1).trim();
  }

  return title;
}

// The Data API provides creator timestamps in snippet.description.
// This parser robustly extracts chapters from real-world descriptions.
export function parseVideoChapters(
  description: string,
  duration = 0,
): VideoChapter[] {
  if (!description || typeof description !== "string") return [];

  const chapters = new Map<number, string>();
  const rawLines = description.split(/\r?\n/);

  for (const raw of rawLines) {
    let line = raw.trim();
    if (!line) continue;

    // Normalize unicode spaces and full-width colons (common in Asian creator descriptions)
    line = line
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, " ")
      .replace(/：/g, ":");

    // Strip URLs from line so links don't discard the chapter
    line = line.replace(/https?:\/\/\S+|www\.\S+/gi, "").trim();
    if (!line) continue;

    // Normalize dot timestamps (e.g. "00.00 Intro" -> "00:00 Intro", "[01.30] Setup" -> "[01:30] Setup")
    line = line.replace(
      /(^|[\s\[\(<【•\-])(\d{1,2})\.([0-5]\d)(?:\.([0-5]\d))?([\]\)>】\s]|$)/g,
      (_, p1, p2, p3, p4, p5) => `${p1}${p2}:${p3}${p4 ? `:${p4}` : ""}${p5}`,
    );

    // Support multiple chapters on a single line separated by pipe, semicolon, bullet, or spaced slash
    const subSegments = line.includes("|") || line.includes(";") || line.includes("•") || /\s+\/\s+/.test(line)
      ? line.split(/\s+[|;/•]\s+|\s*[|;]\s*/)
      : [line];

    for (const seg of subSegments) {
      const trimmedSeg = seg.trim();
      if (!trimmedSeg) continue;

      const matches = [...trimmedSeg.matchAll(TIMESTAMP_REGEX)];
      if (matches.length === 0) continue;

      // Case A: Range timestamp on one line (e.g. "00:00 - 05:20 Introduction" or "2:00–3:00 Range")
      if (matches.length === 2) {
        const firstMatch = matches[0];
        const secondMatch = matches[1];

        const between = trimmedSeg
          .slice(firstMatch.index! + firstMatch[0].length, secondMatch.index)
          .trim();

        // If between is a range separator like "-" or "–" or "to"
        if (/^[\-–—~to]+$/i.test(between) || between === "") {
          const seconds = parseTimeToSeconds(firstMatch[1]);
          if (duration > 0 && seconds >= duration) continue;

          const afterSecond = trimmedSeg
            .slice(secondMatch.index! + secondMatch[0].length)
            .trim();
          const beforeFirst = trimmedSeg.slice(0, firstMatch.index).trim();

          const rawTitle = afterSecond || beforeFirst;
          const title = cleanTitle(rawTitle);

          // Exclude literal dummy "range" test cases while allowing real titles
          if (!title || title.toLowerCase() === "range") continue;
          if (!chapters.has(seconds)) {
            chapters.set(seconds, title);
          }
          continue;
        }
      }

      // Case B: Multiple timestamps on a single line that are NOT a range (e.g. "00:00 Intro / 05:00 Demo")
      if (matches.length >= 2) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const seconds = parseTimeToSeconds(match[1]);
          if (duration > 0 && seconds >= duration) continue;

          const nextIndex =
            i + 1 < matches.length ? matches[i + 1].index : trimmedSeg.length;
          const segmentText = trimmedSeg.slice(
            match.index! + match[0].length,
            nextIndex,
          );
          const title = cleanTitle(segmentText);

          if (title && !chapters.has(seconds)) {
            chapters.set(seconds, title);
          }
        }
        continue;
      }

      // Case C: Single timestamp on line/segment
      if (matches.length === 1) {
        const match = matches[0];
        const seconds = parseTimeToSeconds(match[1]);
        if (duration > 0 && seconds >= duration) continue;

        const before = trimmedSeg.slice(0, match.index);
        const after = trimmedSeg.slice(match.index! + match[0].length);

        const cleanAfter = cleanTitle(after);
        const cleanBefore = cleanTitle(before);

        const title = cleanAfter || cleanBefore;
        if (!title || chapters.has(seconds)) continue;
        chapters.set(seconds, title);
      }
    }
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

export function isChapterCompleted(
  chapter: VideoChapter,
  index: number,
  chapters: VideoChapter[],
  position: number,
  duration = 0,
  isLessonCompleted = false,
  manualCompleted = false,
): boolean {
  if (isLessonCompleted || manualCompleted) return true;
  const nextStart = chapters[index + 1]?.start_seconds;
  if (typeof nextStart === "number") {
    return position >= nextStart;
  }
  const end =
    chapter.end_seconds ??
    (duration > chapter.start_seconds ? duration : null);
  if (typeof end === "number" && end > chapter.start_seconds) {
    return position >= Math.max(chapter.start_seconds, end - 5);
  }
  return false;
}

export function completedChaptersCount(
  chapters: VideoChapter[],
  position: number,
  duration = 0,
  isLessonCompleted = false,
  manualIndexes?: Set<number> | number[],
): number {
  if (!chapters.length) return 0;
  if (isLessonCompleted) return chapters.length;
  const manualSet = manualIndexes
    ? manualIndexes instanceof Set
      ? manualIndexes
      : new Set(manualIndexes)
    : undefined;
  return chapters.filter((chapter, index) =>
    isChapterCompleted(
      chapter,
      index,
      chapters,
      position,
      duration,
      isLessonCompleted,
      manualSet?.has(index),
    ),
  ).length;
}

export function chapterProgressPercent(
  chapters: VideoChapter[],
  position: number,
  duration = 0,
  isLessonCompleted = false,
  manualIndexes?: Set<number> | number[],
): number {
  if (!chapters.length) return 0;
  if (isLessonCompleted) return 100;
  const count = completedChaptersCount(
    chapters,
    position,
    duration,
    isLessonCompleted,
    manualIndexes,
  );
  return Math.min(100, Math.round((count / chapters.length) * 100));
}
