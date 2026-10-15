import { describe, expect, it } from "vitest";
import { parseVideoChapters, chapterAt, chapterTimestamp } from "@/lib/youtube/chapters";

describe("Creator video timestamps", () => {
  it("extracts timestamp-first and title-first sections, including hours", () => {
    expect(parseVideoChapters("An introduction to React\nChapters:\n00:00 Introduction\n[01:20] - Components\nPractice - 05:30\n1:02:03 Next steps", 4000).map((row) => [row.start_seconds, row.title, row.end_seconds])).toEqual([[0, "Introduction", 80], [80, "Components", 330], [330, "Practice", 3723], [3723, "Next steps", 4000]]);
  });
  it("sorts and deduplicates timestamps and excludes sections outside the video", () => {
    expect(parseVideoChapters("2:00 Practice\n0:00 Welcome\n0:00 Duplicate\n10:00 Too late\n12:00 Outside", 600).map((row) => row.title)).toEqual(["Welcome", "Practice"]);
  });
  it("does not invent chapters from URLs, invalid times, ranges, or bare timestamps", () => {
    expect(parseVideoChapters("https://youtu.be/example?t=1:20\n00:99 Invalid\n1:2 Invalid\n00:30\n2:00–3:00 Range\n00:00:60 Invalid seconds")).toEqual([]);
    expect(parseVideoChapters("")).toEqual([]);
  });
  it("keeps a lone useful timestamp and an unknown final duration", () => {
    expect(parseVideoChapters("03:10 Useful explanation")).toEqual([{ title: "Useful explanation", start_seconds: 190, end_seconds: null }]);
  });
  it("marks the current chapter at boundaries, including seeking back to zero", () => {
    const chapters = parseVideoChapters("0:00 Welcome\n1:20 Components\n3:30 Practice", 600);
    expect(chapterAt(chapters, 79)).toBe(0);
    expect(chapterAt(chapters, 80)).toBe(1);
    expect(chapterAt(chapters, 211)).toBe(2);
    expect(chapterAt(chapters, 0)).toBe(0);
    expect(chapterAt(parseVideoChapters("1:00 First section"), 0)).toBe(-1);
  });
  it("formats long sections unambiguously", () => {
    expect(chapterTimestamp(0)).toBe("0:00");
    expect(chapterTimestamp(80)).toBe("1:20");
    expect(chapterTimestamp(3723)).toBe("1:02:03");
  });
});
