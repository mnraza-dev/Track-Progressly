"use client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import {
  ArrowLeft,
  Play,
  Search,
  Check,
  Circle,
  Clock,
  Star,
  Pencil,
  Trash2,
  RotateCcw,
  Save,
  ChevronRight,
  ListVideo,
  CircleCheck,
  ExternalLink,
  Pause,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { completion, duration, timestamp, cn } from "@/lib/utils";
import {
  chapterAt,
  completedChaptersCount,
  chapterProgressPercent,
} from "@/lib/youtube/chapters";
import { Button } from "@/components/ui/button";
import { WorkspaceDialog as Dialog } from "@/components/ui/workspace-dialog";
import { Progress } from "@/components/ui/progress";
import {
  YouTubePlayer,
  type PlayerHandle,
} from "@/components/player/youtube-player";
import { LessonNotes } from "@/components/notes/lesson-notes";
import { VideoChapters } from "@/components/player/video-chapters";
import { useVideoChapters } from "@/components/player/use-video-chapters";
export function CourseWorkspace({
  courseId,
  videoId,
}: {
  courseId: string;
  videoId?: string;
}) {
  const router = useRouter();
  const { data, mutate, notify } = useWorkspace();
  const course = data.courses.find((c) => c.id === courseId);
  const [query, setQuery] = useState("");
  const [selectedId] = useState(
    () =>
      videoId ||
      course?.videos
        .filter(
          (v) =>
            v.progress.last_watched_at && v.availability_status === "available",
        )
        .sort((a, b) =>
          (b.progress.last_watched_at || "").localeCompare(
            a.progress.last_watched_at || "",
          ),
        )[0]?.id ||
      course?.videos.find(
        (v) =>
          !v.progress.is_completed && v.availability_status === "available",
      )?.id ||
      course?.videos[0]?.id,
  );
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(course?.title || "");
  const [description, setDescription] = useState(course?.description || "");
  const [category, setCategory] = useState(course?.category || "Development");
  const [deadline, setDeadline] = useState(
    course?.target_completion_date || "",
  );
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<
    "auto" | "lessons" | "chapters"
  >("auto");
  const [playback, setPlayback] = useState<{
    lessonId: string;
    seconds: number;
  } | null>(null);
  const player = useRef<PlayerHandle>(null);
  const lesson = videoId
    ? course?.videos.find((v) => v.id === videoId)
    : course?.videos.find((v) => v.id === selectedId) ||
      course?.videos.find(
        (v) =>
          !v.progress.is_completed && v.availability_status === "available",
      ) ||
      course?.videos[0];
  const {
    chapters,
    loading: chaptersLoading,
    error: chaptersError,
    retry: retryChapters,
  } = useVideoChapters(lesson);
  if (!course)
    return (
      <div className="large-empty">
        <ListVideo size={35} />
        <h2>Course not found</h2>
        <p>
          This course may have been deleted, or belongs to another workspace.
        </p>
        <Button asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    );
  const isSingleLessonWithChapters =
    course.videos.length === 1 && chapters.length > 0;
  const [manualChapters, setManualChapters] = useState<Set<number>>(() => {
    if (typeof window === "undefined" || !course?.id || !lesson?.id) {
      return new Set<number>();
    }
    try {
      const saved = localStorage.getItem(
        `progressly_chapters_${course.id}_${lesson.id}`,
      );
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const toggleChapterComplete = (chapterIndex: number) => {
    setManualChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterIndex)) {
        next.delete(chapterIndex);
      } else {
        next.add(chapterIndex);
      }
      try {
        if (course?.id && lesson?.id) {
          localStorage.setItem(
            `progressly_chapters_${course.id}_${lesson.id}`,
            JSON.stringify([...next]),
          );
        }
      } catch {}
      return next;
    });
  };

  const position =
    playback?.lessonId === lesson?.id
      ? playback?.seconds || 0
      : lesson?.progress.last_position_seconds || 0;
  const completedChapters = completedChaptersCount(
    chapters,
    position,
    lesson?.duration_seconds,
    lesson?.progress.is_completed,
    manualChapters,
  );
  const remainingChapters = Math.max(0, chapters.length - completedChapters);
  const chapterPercent = chapterProgressPercent(
    chapters,
    position,
    lesson?.duration_seconds,
    lesson?.progress.is_completed,
    manualChapters,
  );
  const percent = isSingleLessonWithChapters
    ? chapterPercent
    : completion(course);
  const showChapters =
    lesson?.availability_status === "available" &&
    (sidebarView === "chapters" ||
      (sidebarView === "auto" && chapters.length > 0));
  const filtered = course.videos.filter((v) =>
    v.title.toLowerCase().includes(query.toLowerCase()),
  );
  const currentIndex = course.videos.findIndex((v) => v.id === lesson?.id);
  const next = course.videos
    .slice(currentIndex + 1)
    .find((v) => v.availability_status === "available");
  return (
    <>
      <Link href="/courses" className="back-link">
        <ArrowLeft size={15} />
        My courses
      </Link>
      <div className="course-workspace-heading">
        <div>
          <span className="category-badge">{course.category}</span>
          <h1>{course.title}</h1>
          <p>
            {course.channel_name || "Your personal course"}
            <span>·</span>
            {isSingleLessonWithChapters ? (
              <>
                1 lesson<span>·</span>
                {chapters.length} chapters
              </>
            ) : (
              <>{course.videos.length} lessons</>
            )}
            <span>·</span>
            {course.videos.some((v) => v.duration_seconds > 0)
              ? duration(
                  course.videos.reduce((n, v) => n + v.duration_seconds, 0),
                )
              : "Duration unavailable"}
          </p>
        </div>
        <div className="course-actions">
          <button
            className={cn("icon-button", !sidebarOpen && "active")}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>
          <button
            className={cn("icon-button", course.is_favorite && "favorite-icon")}
            aria-label="Toggle favorite"
            onClick={() =>
              void mutate({
                op: "update_course",
                id: course.id,
                patch: { is_favorite: !course.is_favorite },
              })
            }
          >
            <Star
              size={19}
              fill={course.is_favorite ? "currentColor" : "none"}
            />
          </button>
          <button
            className="icon-button"
            aria-label="Edit course"
            onClick={() => setEdit(true)}
          >
            <Pencil size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Pause or resume course"
            onClick={() =>
              void mutate({
                op: "update_course",
                id: course.id,
                patch: {
                  status: course.status === "paused" ? "in_progress" : "paused",
                },
              })
            }
          >
            {course.status === "paused" ? (
              <Play size={18} />
            ) : (
              <Pause size={18} />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Archive course"
            onClick={() =>
              void mutate({
                op: "update_course",
                id: course.id,
                patch: {
                  status:
                    course.status === "archived" ? "in_progress" : "archived",
                },
              }).then(() =>
                notify(
                  course.status === "archived"
                    ? "Course restored."
                    : "Course archived.",
                ),
              )
            }
          >
            <Archive size={18} />
          </button>
          {course.youtube_playlist_id && (
            <button
              className="icon-button"
              aria-label="Refresh playlist metadata"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void mutate({ op: "refresh_course", id: course.id })
                  .then(() =>
                    notify("Playlist refreshed. Your progress is preserved."),
                  )
                  .catch(() => {})
                  .finally(() => setRefreshing(false));
              }}
            >
              <RotateCcw size={18} className={refreshing ? "spin" : ""} />
            </button>
          )}
          <button
            className="icon-button danger-text"
            aria-label="Delete course"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {course.status === "paused" && (
        <div className="info-banner">
          <Pause size={16} />
          This course is paused. Resume it whenever you’re ready.
        </div>
      )}
      <div
        className={cn("learning-layout", !sidebarOpen && "sidebar-collapsed")}
      >
        {sidebarOpen && (
          <aside className="panel lesson-sidebar">
            <div className="sidebar-top-bar">
              {lesson?.availability_status === "available" ? (
                <div
                  className="sidebar-view-switch"
                  aria-label="Lesson navigation"
                >
                  <button
                    aria-pressed={!showChapters}
                    onClick={() => setSidebarView("lessons")}
                  >
                    Lessons <span>{course.videos.length}</span>
                  </button>
                  <button
                    aria-pressed={showChapters}
                    onClick={() => setSidebarView("chapters")}
                  >
                    Chapters <span>{chaptersLoading ? "…" : chapters.length}</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <button
                className="icon-button sidebar-collapse-button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
            {showChapters ? (
              <VideoChapters
                key={lesson!.id}
                chapters={chapters}
                position={position}
                duration={lesson?.duration_seconds}
                isLessonCompleted={lesson?.progress.is_completed}
                completedIndices={manualChapters}
                onToggleComplete={toggleChapterComplete}
                loading={chaptersLoading}
                error={chaptersError}
                onRetry={retryChapters}
                onSeek={(seconds) => player.current?.seek(seconds)}
              />
            ) : (
              <>
                <div className="lesson-sidebar-header">
                  <div>
                    <h3>Your learning path</h3>
                    <strong>{percent}%</strong>
                  </div>
                  <Progress value={percent} />
                  <p>
                    {isSingleLessonWithChapters ? (
                      <>
                        {completedChapters} completed · {remainingChapters} to go
                        <span className="chapter-count-tag">
                          {" "}({chapters.length} chapters)
                        </span>
                      </>
                    ) : (
                      <>
                        {
                          course.videos.filter((v) => v.progress.is_completed)
                            .length
                        }{" "}
                        completed ·{" "}
                        {
                          course.videos.filter(
                            (v) =>
                              v.availability_status === "available" &&
                              !v.progress.is_completed,
                          ).length
                        }{" "}
                        to go
                      </>
                    )}
                  </p>
                  <div className="search-input">
                    <Search size={15} />
                    <Input
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Find a lesson..."
                      aria-label="Search lessons"
                    />
                  </div>
                </div>
                <div className="lesson-list">
                  {filtered.slice(0, page * 50).map((v, index) => (
                    <Link
                      key={v.id}
                      href={`/courses/${course.id}/learn/${v.id}`}
                      className={cn(
                        "lesson-item",
                        lesson?.id === v.id && "current-lesson",
                        v.availability_status !== "available" &&
                          "unavailable-lesson",
                      )}
                    >
                      <span
                        className={cn(
                          "lesson-state",
                          v.progress.is_completed && "lesson-state-complete",
                        )}
                      >
                        {v.progress.is_completed ? (
                          <Check size={13} />
                        ) : v.progress.status === "needs_revision" ? (
                          <RotateCcw size={13} />
                        ) : lesson?.id === v.id ? (
                          <Play size={12} fill="currentColor" />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <strong>{v.title}</strong>
                        <small>
                          {v.availability_status !== "available"
                            ? "Unavailable · progress preserved"
                            : isSingleLessonWithChapters
                              ? `${completedChapters} of ${chapters.length} chapters completed (${percent}%)`
                              : v.duration_seconds
                                ? duration(v.duration_seconds)
                                : "YouTube video"}
                          {v.progress.last_position_seconds > 0 &&
                            !v.progress.is_completed &&
                            !isSingleLessonWithChapters && (
                              <>
                                {" "}
                                · {timestamp(v.progress.last_position_seconds)}
                              </>
                            )}
                        </small>
                      </div>
                      {v.progress.is_completed && (
                        <CircleCheck size={13} className="green-text" />
                      )}
                    </Link>
                  ))}
                  {filtered.length > page * 50 && (
                    <Button
                      className="load-more"
                      variant="ghost"
                      onClick={() => setPage(page + 1)}
                    >
                      Load more lessons
                    </Button>
                  )}
                  {!filtered.length && (
                    <p className="small-empty">No lessons match your search.</p>
                  )}
                </div>
                <div className="lesson-sidebar-footer">
                  <span>✳</span>
                  {isSingleLessonWithChapters
                    ? `${remainingChapters > 0 ? `${remainingChapters} chapters to go.` : "All chapters completed!"}`
                    : "One lesson closer to your goal."}
                </div>
              </>
            )}
          </aside>
        )}
        <div className="learning-main">
          {!sidebarOpen && (
            <div className="sidebar-open-control">
              <Button
                variant="outline"
                size="sm"
                className="sidebar-open-button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <PanelLeftOpen size={15} />
                <span>
                  {showChapters
                    ? `Chapters (${completedChapters}/${chapters.length})`
                    : `Lessons (${course.videos.filter((v) => v.progress.is_completed).length}/${course.videos.length})`}
                </span>
              </Button>
              {isSingleLessonWithChapters && (
                <span className="sidebar-open-progress">
                  {percent}% completed · {completedChapters} of {chapters.length} chapters
                </span>
              )}
            </div>
          )}
          {lesson ? (
            <>
              {lesson.availability_status === "available" ? (
                <YouTubePlayer
                  key={`player:${lesson.id}`}
                  ref={player}
                  lesson={lesson}
                  onPositionChange={(seconds) =>
                    setPlayback((current) =>
                      current?.lessonId === lesson.id &&
                      Math.floor(current.seconds) === Math.floor(seconds)
                        ? current
                        : { lessonId: lesson.id, seconds },
                    )
                  }
                />
              ) : (
                <div className="unavailable-player">
                  <Circle size={30} />
                  <h3>This lesson is unavailable</h3>
                  <p>
                    It may be private, deleted, or restricted. Your notes and
                    progress are preserved.
                  </p>
                </div>
              )}
              <div className="lesson-detail">
                <span className="eyebrow">
                  {isSingleLessonWithChapters ? (
                    <>
                      CHAPTER {Math.max(1, chapterAt(chapters, position) + 1)} OF{" "}
                      {chapters.length} · LESSON 1 OF 1
                    </>
                  ) : (
                    <>
                      LESSON {currentIndex + 1} OF {course.videos.length}
                    </>
                  )}
                </span>
                <h2>{lesson.title}</h2>
                <div className="lesson-detail-actions">
                  <Button
                    variant={
                      lesson.progress.is_completed ? "outline" : "default"
                    }
                    onClick={() =>
                      void mutate({
                        op: "progress",
                        video_id: lesson.id,
                        status: lesson.progress.is_completed
                          ? "in_progress"
                          : "completed",
                        position:
                          player.current?.position() ||
                          lesson.progress.last_position_seconds,
                        active_seconds: 0,
                      }).then(() =>
                        notify(
                          lesson.progress.is_completed
                            ? "Lesson marked in progress."
                            : "One more step forward. Lesson completed!",
                        ),
                      )
                    }
                  >
                    <Check size={16} />
                    {lesson.progress.is_completed
                      ? "Completed · Undo"
                      : "Mark as completed"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => player.current?.save()}
                  >
                    <Save size={15} />
                    Save progress
                  </Button>
                  <select
                    className="lesson-status-select"
                    aria-label="Lesson status"
                    value={lesson.progress.status}
                    onChange={(e) =>
                      void mutate({
                        op: "progress",
                        video_id: lesson.id,
                        status: e.target.value as typeof lesson.progress.status,
                        active_seconds: 0,
                      })
                    }
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="needs_revision">Needs revision</option>
                  </select>
                  <a
                    className="icon-button"
                    href={`https://www.youtube.com/watch?v=${lesson.youtube_video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open on YouTube"
                  >
                    <ExternalLink size={17} />
                  </a>
                </div>
              </div>
              <LessonNotes
                key={`notes:${lesson.id}`}
                lesson={lesson}
                player={player}
              />
              <div className="lesson-navigation">
                <span>
                  <Clock size={14} />
                  Progress saves while you play. Learning at your pace.
                </span>
                {next && (
                  <Link href={`/courses/${course.id}/learn/${next.id}`}>
                    Next lesson <ChevronRight size={17} />
                  </Link>
                )}
              </div>
              {course.description && (
                <details className="course-description">
                  <summary>About this course</summary>
                  <p>{course.description}</p>
                </details>
              )}
            </>
          ) : (
            <div className="large-empty">
              <h2>Lesson not found</h2>
              <p>Select an available lesson from your learning path.</p>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={edit}
        onOpenChange={setEdit}
        title="Make this course yours"
        description="A title, an intention, and a date to work toward."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({
              op: "update_course",
              id: course.id,
              patch: {
                title,
                description,
                category,
                target_completion_date: deadline || null,
              },
            }).then(() => {
              setEdit(false);
              notify("Course details updated.");
            });
          }}
        >
          <label>
            Course title
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Category
            <Input
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label>
            Target completion date
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label>
            Learning intention
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </label>
          <Button type="submit">
            <Save size={16} />
            Save changes
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this course?"
        description="The course, lesson progress, notes, bookmarks, and practice tasks will be permanently deleted."
      >
        <div className="form-actions">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Keep course
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              void mutate({ op: "delete_course", id: course.id }).then(() => {
                router.push("/courses");
              })
            }
          >
            <Trash2 size={16} />
            Delete course
          </Button>
        </div>
      </Dialog>
    </>
  );
}
