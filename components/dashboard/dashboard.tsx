"use client";

import { LevelBadge } from "@/components/gamification/level-badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Play,
  Link2,
  Check,
  Sparkles,
  ListTodo,
  Circle,
  Trophy,
  Target,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useGamification } from "@/components/gamification/use-gamification";
import { AchievementsDialog } from "@/components/gamification/achievements-dialog";
import {
  learningTime,
  duration,
  streak,
  longestStreak,
  localDay,
  timestamp,
  cn,
} from "@/lib/utils";
import {
  parseVideoChapters,
  chapterAt,
  completedChaptersCount,
} from "@/lib/youtube/chapters";
import { useTour } from "@/components/tour/tour-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard } from "@/components/courses/course-card";
import { MomentumHeatmap } from "@/components/dashboard/momentum-heatmap";
import {
  StudyIllustration,
  type StudyIllustrationKind,
} from "@/components/dashboard/study-illustration";
import { LearningOverview } from "@/components/analytics/learning-overview";
import { isConnected } from "@/lib/supabase/client";
import { SceneArtwork } from "@/components/three/scene-provider";
import { ProductStage } from "@/components/three/product-stage";
import { fireConfetti } from "@/lib/confetti";

export function Dashboard() {
  const { data, mutate, notify } = useWorkspace();
  const { startTour } = useTour();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [link, setLink] = useState("");
  const [taskFilter, setTaskFilter] = useState<"pending" | "all">("pending");
  const [hero3dMode, setHero3dMode] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const gamificationStats = useGamification(data);

  const { courses, activity, profile } = data;

  const active = courses.filter(
    (c) => !["completed", "archived"].includes(c.status),
  );

  const availableCount = courses
    .filter((c) => c.status !== "archived")
    .reduce(
      (n, c) =>
        n +
        c.videos.filter((v) => v.availability_status === "available").length,
      0,
    );

  const completedCount = courses
    .filter((c) => c.status !== "archived")
    .reduce(
      (n, c) =>
        n +
        c.videos.filter(
          (v) =>
            v.availability_status === "available" && v.progress.is_completed,
        ).length,
      0,
    );

  const videoCount = courses.reduce(
    (n, c) => n + c.videos.filter((v) => v.progress.is_completed).length,
    0,
  );

  const days = streak(activity, profile.timezone, profile.weekend_rest);
  const bestStreak = longestStreak(activity);

  const today = activity.find(
    (a) => a.day === localDay(new Date(), profile.timezone),
  );
  const todayMinutes = Math.floor((today?.active_seconds || 0) / 60);
  const dailyGoal =
    data.goals.find((g) => g.goal_type === "daily_minutes")?.target_value ||
    profile.daily_minutes;

  // 1. Chapters aggregation across library
  const { totalCompletedChapters } = useMemo(() => {
    let completed = 0;
    let total = 0;
    courses
      .filter((c) => c.status !== "archived")
      .forEach((c) => {
        c.videos.forEach((v) => {
          const chapters = parseVideoChapters(
            v.description || "",
            v.duration_seconds || 0,
          );
          if (chapters.length > 0) {
            total += chapters.length;
            completed += completedChaptersCount(
              chapters,
              v.progress.last_position_seconds || 0,
              v.duration_seconds || 0,
              v.progress.is_completed,
            );
          }
        });
      });
    return { totalCompletedChapters: completed, totalChaptersCount: total };
  }, [courses]);

  // 2. Practice tasks across all active courses
  const allPracticeTasks = useMemo(() => {
    return courses
      .filter((c) => c.status !== "archived")
      .flatMap((c) =>
        c.videos.flatMap((v) =>
          v.tasks.map((t) => ({
            ...t,
            courseId: c.id,
            courseTitle: c.title,
            videoId: v.id,
            videoTitle: v.title,
          })),
        ),
      );
  }, [courses]);

  const pendingTasks = useMemo(
    () => allPracticeTasks.filter((t) => !t.is_completed),
    [allPracticeTasks],
  );

  const completedTasksCount = useMemo(
    () => allPracticeTasks.filter((t) => t.is_completed).length,
    [allPracticeTasks],
  );

  // 3. Notes requiring revision
  const revisionNotes = useMemo(() => {
    return courses
      .filter((c) => c.status !== "archived")
      .flatMap((c) =>
        c.videos.flatMap((v) =>
          v.notes
            .filter((n) => n.is_revision_required)
            .map((n) => ({
              ...n,
              courseId: c.id,
              courseTitle: c.title,
              videoId: v.id,
              videoTitle: v.title,
            })),
        ),
      );
  }, [courses]);

  // 4. Identify the active lesson to resume
  const resumeLessonItem = useMemo(() => {
    const availableLessonsWithCourse = courses
      .filter((c) => c.status !== "archived")
      .flatMap((c) =>
        c.videos
          .filter((v) => v.availability_status === "available")
          .map((v) => ({ ...v, course: c })),
      );

    if (!availableLessonsWithCourse.length) return null;

    // Pick most recently watched
    const watched = availableLessonsWithCourse
      .filter((v) => v.progress.last_watched_at)
      .sort((a, b) =>
        (b.progress.last_watched_at || "").localeCompare(
          a.progress.last_watched_at || "",
        ),
      )[0];

    if (watched) return watched;

    // Or first with playback position > 0 that is incomplete
    const inFlight = availableLessonsWithCourse.find(
      (v) => v.progress.last_position_seconds > 0 && !v.progress.is_completed,
    );
    if (inFlight) return inFlight;

    // Or first incomplete lesson in an active course
    const firstIncomplete = availableLessonsWithCourse.find(
      (v) => !v.progress.is_completed && v.course.status === "in_progress",
    );
    if (firstIncomplete) return firstIncomplete;

    return availableLessonsWithCourse[0];
  }, [courses]);

  // Details for the resume lesson
  const resumeDetails = useMemo(() => {
    if (!resumeLessonItem) return null;

    const chapters = parseVideoChapters(
      resumeLessonItem.description || "",
      resumeLessonItem.duration_seconds || 0,
    );

    const pos = resumeLessonItem.progress.last_position_seconds || 0;
    const dur = resumeLessonItem.duration_seconds || 0;

    const currentChapterIdx = chapterAt(chapters, pos);
    const activeChapter =
      currentChapterIdx >= 0 ? chapters[currentChapterIdx] : null;

    const finishedChapters = completedChaptersCount(
      chapters,
      pos,
      dur,
      resumeLessonItem.progress.is_completed,
    );

    const percent = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;

    return {
      chapters,
      activeChapter,
      currentChapterIdx,
      finishedChapters,
      percent,
    };
  }, [resumeLessonItem]);

  // Handlers for interactive actions
  const handleToggleTask = async (task: {
    videoId: string;
    id: string;
    title: string;
    is_completed: boolean;
  }) => {
    try {
      if (!task.is_completed) {
        fireConfetti();
      }
      await mutate({
        op: "task",
        video_id: task.videoId,
        id: task.id,
        title: task.title,
        is_completed: !task.is_completed,
      });
      notify(
        !task.is_completed
          ? "Practice task marked done!"
          : "Practice task re-opened.",
      );
    } catch {
      notify("Could not update task.");
    }
  };

  const handleMarkReviewed = async (note: {
    videoId: string;
    id: string;
    content: string;
    timestamp_seconds: number;
  }) => {
    try {
      await mutate({
        op: "save_note",
        video_id: note.videoId,
        id: note.id,
        content: note.content,
        timestamp_seconds: note.timestamp_seconds,
        is_revision_required: false,
      });
      notify("Note marked as reviewed.");
    } catch {
      notify("Could not update note.");
    }
  };

  return (
    <div className="dashboard-studio">
      {/* Page Heading with Tour Trigger Button */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            YOUR PERSONAL LEARNING SPACE
          </div>
          <h1>
            {profile.display_name
              ? `Welcome back, ${profile.display_name.split(" ")[0]}`
              : "A good day to learn"}
            <span className="heading-period">.</span>
          </h1>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={startTour}
            className="tour-launch-button"
            title="Start interactive product tour"
          >
            <Sparkles size={15} className="tour-sparkle-icon" />
            <span>Product Tour</span>
          </Button>

          <Button asChild>
            <Link href="/courses/new">
              <Plus size={17} />
              Add course
            </Link>
          </Button>
        </div>
      </div>

      {/* Enriched Stats Grid */}
      <section className="stats-grid" data-tour="stats-grid">
        <Stat
          illustration="focus"
          label="Learning today"
          value={learningTime(todayMinutes, true)}
          detail={
            todayMinutes >= dailyGoal
              ? "Daily goal reached"
              : `${learningTime(dailyGoal - todayMinutes, true)} to daily goal`
          }
          index="01"
        />
        <Stat
          illustration="lessons"
          label="Lessons & Chapters"
          value={videoCount}
          detail={
            totalCompletedChapters > 0
              ? `${totalCompletedChapters} chapters finished`
              : `${availableCount ? Math.round((completedCount / availableCount) * 100) : 0}% library progress`
          }
          index="02"
        />
        <Stat
          illustration="practice"
          label="Practice tasks done"
          value={
            allPracticeTasks.length
              ? `${completedTasksCount} / ${allPracticeTasks.length}`
              : "0"
          }
          detail={
            pendingTasks.length
              ? `${pendingTasks.length} pending action items`
              : "All exercises completed"
          }
          index="03"
        />
        <Stat
          illustration="streak"
          label="Current streak"
          value={
            <>
              {days}
              <small>{days === 1 ? "day" : "days"}</small>
            </>
          }
          detail={
            bestStreak > days
              ? `Best streak: ${bestStreak} days`
              : days
                ? "Keep the momentum"
                : "Your next session is day one"
          }
          index="04"
        />
      </section>

      {/* Resume Hero ("Jump Back In") OR Starter Hero */}
      {resumeLessonItem ? (
        <section className="dashboard-resume-hero" data-tour="resume-hero">
          <div className="resume-hero-left">
            <div className="resume-kicker-row">
              <span className="resume-kicker">
                <span className="resume-pulse-dot" />
                PICK UP WHERE YOU STOPPED
              </span>
              <span className="resume-category-tag">
                {resumeLessonItem.course.category}
              </span>
            </div>

            <h2 className="resume-course-title">
              <Link
                href={`/courses/${resumeLessonItem.course.id}`}
                className="hover:underline"
              >
                {resumeLessonItem.course.title}
              </Link>
            </h2>

            <div className="resume-lesson-row">
              <span className="resume-lesson-icon">
                <Play size={13} fill="currentColor" />
              </span>
              <strong>{resumeLessonItem.title}</strong>
              <span className="resume-channel">
                by {resumeLessonItem.course.channel_name}
              </span>
            </div>

            {/* Active Chapter indicator if chapters exist */}
            {resumeDetails?.activeChapter && (
              <div className="resume-chapter-box">
                <span className="resume-chapter-dot" />
                <span className="resume-chapter-text">
                  Chapter {resumeDetails.currentChapterIdx + 1} of{" "}
                  {resumeDetails.chapters.length}:{" "}
                  <strong>{resumeDetails.activeChapter.title}</strong>
                </span>
                <span className="resume-chapter-tag">
                  {resumeDetails.finishedChapters}/
                  {resumeDetails.chapters.length} done
                </span>
              </div>
            )}

            {/* Progress Track & Details */}
            <div className="resume-progress-container">
              <div className="resume-progress-meta">
                <span>
                  {resumeLessonItem.progress.last_position_seconds > 0
                    ? `${timestamp(resumeLessonItem.progress.last_position_seconds)} / ${duration(resumeLessonItem.duration_seconds)}`
                    : duration(resumeLessonItem.duration_seconds)}
                </span>
                <strong>{resumeDetails?.percent || 0}% completed</strong>
              </div>
              <div className="progress-track">
                <div style={{ width: `${resumeDetails?.percent || 0}%` }} />
              </div>
            </div>

            {/* Actions & Badges */}
            <div className="resume-actions-row">
              <Button asChild size="default" className="resume-primary-btn">
                <Link
                  href={`/courses/${resumeLessonItem.course.id}/learn/${resumeLessonItem.id}`}
                >
                  <Play size={15} fill="currentColor" />
                  <span>Resume Lesson</span>
                  <ArrowRight size={15} />
                </Link>
              </Button>

              <Button asChild variant="outline" size="default">
                <Link href={`/courses/${resumeLessonItem.course.id}`}>
                  View course outline
                </Link>
              </Button>

              <div className="resume-micro-stats">
                {resumeLessonItem.tasks.length > 0 && (
                  <span title="Tasks for this lesson">
                    <ListTodo size={14} />
                    {
                      resumeLessonItem.tasks.filter((t) => !t.is_completed)
                        .length
                    }{" "}
                    practice
                  </span>
                )}
                {resumeLessonItem.notes.length > 0 && (
                  <span title="Notes taken on this lesson">
                    <BookOpen size={14} />
                    {resumeLessonItem.notes.length} notes
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="resume-hero-right">
            <div className="resume-view-switch">
              <button
                type="button"
                className={cn("resume-view-pill", !hero3dMode && "active")}
                onClick={() => setHero3dMode(false)}
                aria-label="Show video preview"
              >
                <Play size={11} fill="currentColor" />
                <span>Video</span>
              </button>
              <button
                type="button"
                className={cn("resume-view-pill", hero3dMode && "active")}
                onClick={() => setHero3dMode(true)}
                aria-label="Show 3D interactive stage"
              >
                <Sparkles size={11} />
                <span>3D Stage</span>
              </button>
            </div>

            {hero3dMode ? (
              <div className="resume-3d-stage">
                <SceneArtwork
                  kind={
                    resumeLessonItem.course.category === "Development"
                      ? "code"
                      : resumeLessonItem.course.category === "Data & Python"
                        ? "data"
                        : resumeLessonItem.course.category === "Design"
                          ? "design"
                          : "rings"
                  }
                  progress={(resumeDetails?.percent || 0) / 100}
                  interactive
                  label={`3D interactive artifact for ${resumeLessonItem.course.title}`}
                />
                <div className="resume-3d-caption">
                  <span className="resume-3d-hint">
                    <Sparkles size={11} /> Interactive 3D Model · Drag to rotate
                  </span>
                  <strong>{resumeDetails?.percent || 0}% Progress</strong>
                </div>
              </div>
            ) : (
              <Link
                href={`/courses/${resumeLessonItem.course.id}/learn/${resumeLessonItem.id}`}
                className="resume-thumbnail-link"
                aria-label="Resume this video lesson"
              >
                {resumeLessonItem.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resumeLessonItem.thumbnail_url}
                    alt={resumeLessonItem.title}
                    className="resume-thumbnail-img"
                  />
                ) : (
                  <div className="resume-thumbnail-placeholder">
                    <Play size={36} fill="currentColor" />
                  </div>
                )}
                <div className="resume-thumbnail-overlay">
                  <div className="resume-play-bubble">
                    <Play size={20} fill="currentColor" />
                  </div>
                  <span className="resume-thumbnail-duration">
                    {duration(resumeLessonItem.duration_seconds)}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="dashboard-hero" data-tour="resume-hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span className="hero-number">01 —</span>THE ART OF FOLLOWING
              THROUGH
            </span>
            <h2>
              Less someday.
              <br />
              <em>More today.</em>
            </h2>
            <p>
              A home for the tutorials you want to finish.
              <br />
              Your progress, notes, and practice. Together.
            </p>
            <Button asChild>
              <Link
                href={
                  active.length ? `/courses/${active[0].id}` : "/courses/new"
                }
              >
                {active.length ? (
                  <Play size={15} fill="currentColor" />
                ) : (
                  <Plus size={16} />
                )}{" "}
                {active.length
                  ? "Pick up where you left off"
                  : "Find your first course"}
                <ArrowUpRight size={17} />
              </Link>
            </Button>
            <div className="hero-learning-path">
              <span>
                <i>01</i>Watch
              </span>
              <span className="path-line" />
              <span>
                <i>02</i>Practice
              </span>
              <span className="path-line" />
              <span>
                <i>03</i>Remember
              </span>
            </div>
          </div>
          <div className="hero-art">
            <ProductStage compact />
          </div>
          <span className="hero-edge-mark" aria-hidden="true">
            ＋
          </span>
        </section>
      )}

      {/* Gamification: Level Mastery & Daily Quests */}
      <section
        className="panel dashboard-gamification-panel"
        data-tour="gamification-quests"
      >
        <div className="gamification-hero-split">
          {/* Left Column: 3D Trophy & Rank Progress */}
          <div className="gamification-trophy-side">
            <div className="gamification-trophy-stage">
              <LevelBadge level={gamificationStats.levelInfo.level} />
            </div>
            <div className="gamification-trophy-details">
              <div className="gamification-rank-kicker">
                <span className="section-index">STUDIO MASTERY</span>
                <span className="gamification-tier-pill">
                  TIER {gamificationStats.levelInfo.level} OF 8
                </span>
              </div>
              <h3 className="gamification-rank-title">
                {gamificationStats.levelInfo.title}
              </h3>
              <div className="gamification-xp-row">
                <span className="gamification-total-xp">
                  <strong>
                    {gamificationStats.levelInfo.totalXP.toLocaleString()}
                  </strong>{" "}
                  XP
                </span>
                <span className="gamification-next-xp">
                  {gamificationStats.levelInfo.isMaxLevel ? (
                    "Maximum Level Reached"
                  ) : (
                    <>
                      {gamificationStats.levelInfo.currentLevelXP} /{" "}
                      {gamificationStats.levelInfo.xpNeededForNext} XP to Level{" "}
                      {gamificationStats.levelInfo.level + 1}
                    </>
                  )}
                </span>
              </div>
              <div className="gamification-progress-bar">
                <div
                  className="gamification-progress-fill"
                  style={{
                    width: `${gamificationStats.levelInfo.levelProgressPercent}%`,
                  }}
                />
              </div>
              <div className="gamification-actions">
                <Button
                  variant="outline"
                  size="sm"
                  className="view-achievements-btn"
                  onClick={() => setAchievementsOpen(true)}
                >
                  <Trophy size={14} className="text-yellow-500" />
                  <span>
                    Achievements & Badges (
                    {gamificationStats.unlockedAchievementsCount}/
                    {gamificationStats.totalAchievementsCount})
                  </span>
                  <ArrowRight size={13} />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Today's Daily Quests */}
          <div className="gamification-quests-side">
            <div className="quests-side-header">
              <div>
                <span className="section-index">DAILY DISCIPLINE</span>
                <h3>Today’s Focus Quests</h3>
              </div>
              <span className="quests-reset-tag">Daily reset</span>
            </div>

            <div className="quests-cards-list">
              {gamificationStats.dailyQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={cn(
                    "dashboard-quest-card",
                    quest.completed && "quest-done",
                  )}
                >
                  <div className="dashboard-quest-icon">
                    {quest.completed ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : quest.id === "quest_focus" ? (
                      <Target size={15} />
                    ) : quest.id === "quest_lesson" ? (
                      <Play size={14} fill="currentColor" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                  </div>
                  <div className="dashboard-quest-info">
                    <div className="dashboard-quest-title-row">
                      <strong>{quest.title}</strong>
                      <span className="dashboard-quest-xp">
                        +{quest.xpReward} XP
                      </span>
                    </div>
                    <p>{quest.description}</p>
                    <div className="dashboard-quest-meter">
                      <div className="dashboard-quest-meter-track">
                        <div
                          className="dashboard-quest-meter-fill"
                          style={{
                            width: `${Math.min(100, Math.round((quest.current / quest.target) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="dashboard-quest-progress-num">
                        {quest.completed
                          ? "Completed"
                          : `${quest.current}/${quest.target}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MomentumHeatmap
        activity={activity}
        timezone={profile.timezone}
        dailyGoal={dailyGoal}
        now={now}
      />

      {/* Practice Checklist & Revision Queue (High Utility Interactive Section) */}
      <div className="dashboard-action-grid">
        {/* Practice Checklist Panel */}
        <section
          className="panel practice-queue-panel"
          data-tour="practice-queue"
        >
          <div className="panel-heading">
            <div>
              <span className="section-index">HANDS-ON LEARNING</span>
              <h2>
                Practice Checklist
                <span className="count-pill">{pendingTasks.length}</span>
              </h2>
            </div>
            <div className="practice-filter-pills">
              <button
                className={cn(taskFilter === "pending" && "active")}
                onClick={() => setTaskFilter("pending")}
              >
                Pending ({pendingTasks.length})
              </button>
              <button
                className={cn(taskFilter === "all" && "active")}
                onClick={() => setTaskFilter("all")}
              >
                All ({allPracticeTasks.length})
              </button>
            </div>
          </div>

          <div className="practice-checklist-body">
            {(taskFilter === "pending" ? pendingTasks : allPracticeTasks)
              .slice(0, 5)
              .map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "practice-task-row",
                    t.is_completed && "practice-task-done",
                  )}
                >
                  <button
                    className="task-checkbox-btn"
                    onClick={() => handleToggleTask(t)}
                    aria-label={
                      t.is_completed
                        ? "Mark task incomplete"
                        : "Mark task complete"
                    }
                  >
                    {t.is_completed ? (
                      <CheckCircle2 size={18} className="task-checked-icon" />
                    ) : (
                      <Circle size={18} className="task-unchecked-icon" />
                    )}
                  </button>

                  <div className="practice-task-content">
                    <span className="task-title-text">{t.title}</span>
                    <Link
                      href={`/courses/${t.courseId}/learn/${t.videoId}`}
                      className="task-source-link"
                    >
                      <span>{t.courseTitle}</span>
                      <i>·</i>
                      <small>{t.videoTitle}</small>
                    </Link>
                  </div>
                </div>
              ))}

            {allPracticeTasks.length === 0 && (
              <div className="practice-empty-state">
                <StudyIllustration
                  kind="practice"
                  className="empty-study-illustration"
                />
                <p>
                  <strong>No practice tasks yet.</strong> Add an exercise from
                  any lesson.
                </p>
                <Link href="/courses" className="text-link">
                  Open a course to start
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {allPracticeTasks.length > 0 &&
              pendingTasks.length === 0 &&
              taskFilter === "pending" && (
                <div className="practice-celebrate-state">
                  <StudyIllustration
                    kind="streak"
                    className="empty-study-illustration"
                  />
                  <p>
                    <strong>All practice tasks completed!</strong>
                  </p>
                  <button
                    onClick={() => setTaskFilter("all")}
                    className="text-link"
                  >
                    View completed tasks
                  </button>
                </div>
              )}
          </div>
        </section>

        {/* Revision Queue Panel */}
        <section
          className="panel revision-queue-panel"
          data-tour="revision-queue"
        >
          <div className="panel-heading">
            <div>
              <span className="section-index">KNOWLEDGE RETENTION</span>
              <h2>
                Notes to Review
                <span className="count-pill">{revisionNotes.length}</span>
              </h2>
            </div>
            <Link href="/notes" className="text-link">
              All notes
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="revision-queue-body">
            {revisionNotes.slice(0, 3).map((n) => (
              <div key={n.id} className="revision-note-item">
                <div className="revision-note-top">
                  <span className="revision-course-name">{n.courseTitle}</span>
                  <Link
                    href={`/courses/${n.courseId}/learn/${n.videoId}`}
                    className="revision-timestamp-pill"
                    title="Jump to video timestamp"
                  >
                    <Play size={10} fill="currentColor" />
                    <span>{timestamp(n.timestamp_seconds)}</span>
                  </Link>
                </div>

                <p className="revision-note-content">{n.content}</p>

                <div className="revision-note-footer">
                  <span className="revision-lesson-title">{n.videoTitle}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mark-reviewed-btn"
                    onClick={() => handleMarkReviewed(n)}
                  >
                    <Check size={13} />
                    <span>Mark reviewed</span>
                  </Button>
                </div>
              </div>
            ))}

            {revisionNotes.length === 0 && (
              <div className="revision-empty-state">
                <StudyIllustration
                  kind="lessons"
                  className="empty-study-illustration"
                />
                <p>
                  <strong>No notes to review.</strong>
                  <br />
                  Flag a note while studying to review it here.
                </p>
                <Link href="/notes" className="text-link">
                  Browse your notes library
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Continue Learning Course Cards */}
      <div className="section-heading">
        <div>
          <span className="section-index">YOUR NEXT STEP</span>
          <h2>
            Continue learning<span className="count-pill">{active.length}</span>
          </h2>
          <p>
            {availableCount
              ? `${Math.round((completedCount / availableCount) * 100)}% of your library completed. Keep going.`
              : "A course worth starting is a course worth finishing."}
          </p>
        </div>
        <Link href="/courses" className="text-link">
          Your library
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {active.length ? (
        <div className="course-grid">
          {active.slice(0, 3).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <div className="start-course-panel">
          <div className="start-course-visual">
            <SceneArtwork
              kind="books"
              label="A stack of sculptural books in teal, copper, and sage"
            />
          </div>
          <div className="start-course-copy">
            <span className="tiny-label">YOUR LIBRARY IS A BLANK PAGE</span>
            <h3>
              You bring the link.
              <br />
              <em>We’ll keep your place.</em>
            </h3>
            <p>
              Import a YouTube playlist or video.
              <br />
              Make a little space for what comes next.
            </p>
          </div>
          <form
            className="import-quick-card"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                `/courses/new${link.trim() ? `?url=${encodeURIComponent(link.trim())}` : ""}`,
              );
            }}
          >
            <label htmlFor="quick-course-link">One link. A fresh start.</label>
            <div className="quick-link-input">
              <Link2 size={16} />
              <Input
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                id="quick-course-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste a YouTube link..."
              />
              <button type="submit" aria-label="Import this YouTube link">
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="import-quick-footer">
              <span>
                <Check size={12} />
                Playlists & individual videos
              </span>
              <Link href="/courses/new">
                Or create manually
                <ArrowRight size={12} />
              </Link>
            </div>
          </form>
        </div>
      )}

      <LearningOverview
        dailyIntention={
          <section
            className="panel daily-goal-panel"
            aria-labelledby="daily-intention-title"
          >
            <div className="panel-heading">
              <div>
                <h2 id="daily-intention-title">Your daily intention</h2>
              </div>
              <span className="goal-day-tag">TODAY</span>
            </div>
            <div className="goal-ring">
              <SceneArtwork
                kind="goal"
                progress={Math.min(1, todayMinutes / dailyGoal)}
                label={`Daily learning goal: ${learningTime(todayMinutes)} of ${learningTime(dailyGoal)} completed`}
              />
              <div className="goal-ring-value">
                <strong>{learningTime(todayMinutes, true)}</strong>
                <span>of {learningTime(dailyGoal, true)} goal</span>
              </div>
            </div>
            <Link href="/goals" className="goal-edit-link">
              {data.goals.length ? "Adjust your goals" : "Set your intention"}
              <ArrowUpRight size={15} />
            </Link>
          </section>
        }
      />

      {!isConnected && (
        <div className="local-mode-banner">
          <span className="local-dot" />
          <span>Saved in this browser.</span>
          <Link href="/settings">
            Workspace settings
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      <AchievementsDialog
        open={achievementsOpen}
        onOpenChange={setAchievementsOpen}
        stats={gamificationStats}
      />
    </div>
  );
}

function Stat({
  illustration,
  label,
  value,
  detail,
  index,
}: {
  illustration: StudyIllustrationKind;
  label: string;
  value: React.ReactNode;
  detail: string;
  index: string;
}) {
  return (
    <Card className="stat-card stat-card-illustrated gap-0">
      <div className="stat-top">
        <span>{label}</span>
        <StudyIllustration kind={illustration} className="stat-illustration" />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-bottom">
        <p>{detail}</p>
        <span>{index}</span>
      </div>
    </Card>
  );
}
