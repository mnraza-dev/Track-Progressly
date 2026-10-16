"use client";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import {
  Search,
  ListVideo,
  Play,
  Check,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import {
  chapterAt,
  chapterTimestamp,
  isChapterCompleted,
  completedChaptersCount,
  chapterProgressPercent,
  type VideoChapter,
} from "@/lib/youtube/chapters";
import { cn } from "@/lib/utils";

export function VideoChapters({
  chapters,
  position,
  duration = 0,
  isLessonCompleted = false,
  onSeek,
  loading = false,
  error = false,
  onRetry,
}: {
  chapters: VideoChapter[];
  position: number;
  duration?: number;
  isLessonCompleted?: boolean;
  onSeek: (seconds: number) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const active = chapterAt(chapters, position);
  const completedCount = completedChaptersCount(
    chapters,
    position,
    duration,
    isLessonCompleted,
  );
  const remainingCount = Math.max(0, chapters.length - completedCount);
  const percent = chapterProgressPercent(
    chapters,
    position,
    duration,
    isLessonCompleted,
  );
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
          <span className="section-index">CHAPTER PROGRESS</span>
          <h3>
            In this lesson <span>{chapters.length} chapters</span>
          </h3>
          <p>
            {completedCount} completed · {remainingCount} to go
          </p>
        </div>
        <div className="chapter-heading-progress">
          <strong>{percent}%</strong>
        </div>
      </div>
      {chapters.length > 0 && !loading && !error && (
        <div className="chapter-progress-box">
          <Progress value={percent} />
          <p>
            {completedCount} of {chapters.length} chapters completed ({percent}%)
          </p>
        </div>
      )}
      {loading ? (
        <div className="chapter-empty">
          <LoaderCircle size={22} className="spin" />
          <p>Looking for video chapters…</p>
        </div>
      ) : error ? (
        <div className="chapter-empty">
          <p>We couldn’t check this video’s chapters.</p>
          <button onClick={onRetry}>
            <RotateCcw size={13} />
            Try again
          </button>
        </div>
      ) : !chapters.length ? (
        <div className="chapter-empty">
          <ListVideo size={24} />
          <p>No chapter timestamps were found in this video’s description.</p>
        </div>
      ) : (
        <>
          <label className="search-input chapter-search">
            <Search size={14} />
            <Input
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
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
        </>
      )}
    </section>
  );
}
