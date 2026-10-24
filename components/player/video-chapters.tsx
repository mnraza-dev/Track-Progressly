"use client";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useId, useState } from "react";
import {
  Search,
  ListVideo,
  Play,
  Check,
  CircleCheck,
  Circle,
  LoaderCircle,
  RotateCcw,
  FileText,
  Pencil,
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
import { fireConfetti } from "@/lib/confetti";

export function VideoChapters({
  chapters,
  position,
  duration = 0,
  isLessonCompleted = false,
  completedIndices,
  onToggleComplete,
  onSeek,
  loading = false,
  error = false,
  onRetry,
  hasCustomChapters = false,
  onSaveCustomChapters,
  onClearCustomChapters,
}: {
  chapters: VideoChapter[];
  position: number;
  duration?: number;
  isLessonCompleted?: boolean;
  completedIndices?: Set<number>;
  onToggleComplete?: (chapterIndex: number) => void;
  onSeek: (seconds: number) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  hasCustomChapters?: boolean;
  onSaveCustomChapters?: (text: string) => void;
  onClearCustomChapters?: () => void;
}) {
  const stateId = useId();
  const [query, setQuery] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const active = chapterAt(chapters, position);
  const completedCount = completedChaptersCount(
    chapters,
    position,
    duration,
    isLessonCompleted,
    completedIndices,
  );
  const remainingCount = Math.max(0, chapters.length - completedCount);
  const percent = chapterProgressPercent(
    chapters,
    position,
    duration,
    isLessonCompleted,
    completedIndices,
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
            {hasCustomChapters && (
              <span
                className="chapter-custom-tag"
                title="Custom timestamps applied"
              >
                Custom
              </span>
            )}
          </h3>
          <p>
            {completedCount} completed · {remainingCount} to go
          </p>
        </div>
        <div className="chapter-heading-progress">
          <strong className="text-2xl font-bold blur-sm">{percent}%</strong>
        </div>
      </div>
      {chapters.length > 0 && !loading && !error && (
        <div className="chapter-progress-box">
          <Progress value={percent} />
          <p>
            {completedCount} of {chapters.length} chapters completed ({percent}
            %)
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
          <div className="chapter-empty-icon">
            <ListVideo size={24} />
          </div>
          <p className="chapter-empty-title">No chapter timestamps found</p>
          <p className="chapter-empty-desc">
            We couldn’t find timestamps in this video’s description. You can
            re-scan YouTube or paste timestamps manually.
          </p>
          <div className="chapter-empty-actions">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="chapter-action-btn"
              >
                <RotateCcw size={13} />
                Re-scan YouTube
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditorOpen((v) => !v)}
              className="chapter-action-btn chapter-action-btn-primary"
            >
              <FileText size={13} />
              {isEditorOpen ? "Close paste box" : "Paste timestamps"}
            </button>
          </div>
          {isEditorOpen && (
            <div className="chapter-paste-panel">
              <label
                htmlFor="chapter-paste-textarea"
                className="chapter-paste-label"
              >
                Paste timestamps from description or comments:
              </label>
              <textarea
                id="chapter-paste-textarea"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={
                  "00:00 Introduction\n02:15 Project Setup\n06:40 Coding Components\n15:00 Wrap up"
                }
                rows={5}
                className="chapter-paste-textarea"
              />
              <div className="chapter-paste-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (customInput.trim()) {
                      onSaveCustomChapters?.(customInput);
                      setIsEditorOpen(false);
                      setCustomInput("");
                    }
                  }}
                  disabled={!customInput.trim()}
                  className="chapter-paste-apply-btn"
                >
                  <Check size={13} />
                  Apply Chapters
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="chapter-paste-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
            {filtered.map((chapter) => {
              const isCompleted = isChapterCompleted(
                chapter,
                chapter.index,
                chapters,
                position,
                duration,
                isLessonCompleted,
                completedIndices?.has(chapter.index),
              );
              const isActive = active === chapter.index;
              return (
                <li key={chapter.start_seconds}>
                  <div
                    className={cn(
                      "chapter-row",
                      isCompleted && "chapter-item-completed",
                      isActive && "chapter-item-active",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSeek(chapter.start_seconds)}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={`Jump to ${chapter.title} at ${chapterTimestamp(chapter.start_seconds)}`}
                      aria-describedby={`${stateId}-${chapter.index}`}
                      className="chapter-jump-btn"
                    >
                      <span
                        id={`${stateId}-${chapter.index}`}
                        className="sr-only"
                      >
                        {isCompleted ? "Completed chapter" : "Not completed"}
                      </span>
                      <span
                        className={cn(
                          "chapter-number",
                          isCompleted && "chapter-number-complete",
                          isActive && !isCompleted && "chapter-number-active",
                        )}
                      >
                        {isCompleted ? (
                          <Check size={12} strokeWidth={2.5} />
                        ) : isActive ? (
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
                          {isCompleted && (
                            <>
                              <i />
                              <span className="chapter-badge-done">
                                <Check size={10} strokeWidth={2.5} /> Done
                              </span>
                            </>
                          )}
                        </small>
                      </span>
                      {isActive && !isCompleted && (
                        <span
                          className="chapter-active-dot"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCompleted) {
                          fireConfetti({ x: e.clientX, y: e.clientY });
                        }
                        onToggleComplete?.(chapter.index);
                      }}
                      className={cn(
                        "chapter-mark-btn",
                        isCompleted
                          ? "chapter-marked-done"
                          : "chapter-marked-pending",
                      )}
                      title={
                        isCompleted
                          ? "Mark chapter as incomplete"
                          : "Mark chapter as completed"
                      }
                      aria-label={
                        isCompleted
                          ? `Mark ${chapter.title} as incomplete`
                          : `Mark ${chapter.title} as completed`
                      }
                    >
                      {isCompleted ? (
                        <CircleCheck size={18} className="check-done-icon" />
                      ) : (
                        <Circle size={18} className="check-pending-icon" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {!filtered.length && (
            <p className="chapter-no-results">No chapters match “{query}”.</p>
          )}
          <div className="chapter-footer">
            <span>Select a chapter to jump there.</span>
            {hasCustomChapters ? (
              <button
                type="button"
                onClick={() => onClearCustomChapters?.()}
                className="chapter-footer-reset-btn"
                title="Reset to video's original chapters"
              >
                Reset to original
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditorOpen((v) => !v)}
                className="chapter-footer-paste-btn"
                title="Paste custom or missing timestamps"
              >
                <Pencil size={11} />
                Edit / Paste
              </button>
            )}
          </div>
          {isEditorOpen && (
            <div className="chapter-paste-panel">
              <label
                htmlFor="chapter-paste-textarea-active"
                className="chapter-paste-label"
              >
                Paste or edit timestamps:
              </label>
              <textarea
                id="chapter-paste-textarea-active"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={
                  "00:00 Introduction\n02:15 Project Setup\n06:40 Coding Components\n15:00 Wrap up"
                }
                rows={5}
                className="chapter-paste-textarea"
              />
              <div className="chapter-paste-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (customInput.trim()) {
                      onSaveCustomChapters?.(customInput);
                      setIsEditorOpen(false);
                      setCustomInput("");
                    }
                  }}
                  disabled={!customInput.trim()}
                  className="chapter-paste-apply-btn"
                >
                  <Check size={13} />
                  Apply Chapters
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="chapter-paste-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
