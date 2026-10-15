"use client";
import { useState } from "react";
import { Search, ListVideo, Play } from "lucide-react";
import {
  chapterAt,
  chapterTimestamp,
  type VideoChapter,
} from "@/lib/youtube/chapters";

export function VideoChapters({
  chapters,
  position,
  onSeek,
}: {
  chapters: VideoChapter[];
  position: number;
  onSeek: (seconds: number) => void;
}) {
  const [query, setQuery] = useState("");
  const active = chapterAt(chapters, position);
  const filtered = chapters
    .map((chapter, index) => ({ ...chapter, index }))
    .filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(query.toLowerCase()) ||
        chapterTimestamp(chapter.start_seconds).includes(query),
    );
  return (
    <section className="video-chapters" aria-label="Video chapters">
      <div className="chapter-heading">
        <div>
          <span className="section-index">JUMP TO AN IDEA</span>
          <h3>
            In this lesson <span>{chapters.length}</span>
          </h3>
          <p>From the video description</p>
        </div>
        <ListVideo size={19} />
      </div>
      <label className="search-input chapter-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search video chapters"
          placeholder="Find a chapter..."
        />
      </label>
      <ol className="chapter-list">
        {filtered.map((chapter) => (
          <li key={chapter.start_seconds}>
            <button
              onClick={() => onSeek(chapter.start_seconds)}
              aria-current={active === chapter.index ? "true" : undefined}
              aria-label={`Jump to ${chapter.title} at ${chapterTimestamp(chapter.start_seconds)}`}
            >
              <span className="chapter-number">
                {active === chapter.index ? (
                  <Play size={11} fill="currentColor" />
                ) : (
                  String(chapter.index + 1).padStart(2, "0")
                )}
              </span>
              <span className="chapter-label">
                <strong>{chapter.title}</strong>
                <small>
                  <time>{chapterTimestamp(chapter.start_seconds)}</time>
                  {chapter.end_seconds !== null && (
                    <>
                      <i />
                      {chapterTimestamp(
                        chapter.end_seconds - chapter.start_seconds,
                      )}{" "}
                      long
                    </>
                  )}
                </small>
              </span>
              {active === chapter.index && (
                <span className="chapter-active-dot" aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>
      {!filtered.length && (
        <p className="chapter-no-results">No chapters match “{query}”.</p>
      )}
      <div className="chapter-footer">
        <span />
        Select a chapter to jump there.
      </div>
    </section>
  );
}
