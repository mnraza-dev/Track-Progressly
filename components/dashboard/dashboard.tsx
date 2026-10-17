"use client";

import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CircleCheck,
  CheckCircle2,
  Clock3,
  Flame,
  ChevronDown,
  Play,
  Link2,
  Check,
  Sparkles,
  RotateCcw,
  ListTodo,
  Calendar,
  Layers,
  Circle,
  Trophy,
  ShieldCheck,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/stores/workspace";
import { getGamificationStats } from "@/lib/gamification";
import { AchievementsDialog } from "@/components/gamification/achievements-dialog";
import {
  completion,
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
import { ActivityChart } from "@/components/analytics/activity-chart";
import { LearningLandscape } from "@/components/analytics/learning-landscape";
import { LearningMix } from "@/components/analytics/progress-charts";
import { dailySeries } from "@/lib/analytics";
import { isConnected } from "@/lib/supabase/client";
import { SceneArtwork } from "@/components/three/scene-provider";
import { ProductStage } from "@/components/three/product-stage";
import { fireConfetti } from "@/lib/confetti";

export function Dashboard() {
  const { data, mutate, notify } = useWorkspace();
  const { startTour } = useTour();
  const router = useRouter();
  const [period, setPeriod] = useState(7);
  const [now] = useState(() => new Date());
  const [link, setLink] = useState("");
  const [taskFilter, setTaskFilter] = useState<"pending" | "all">("pending");
  const [hero3dMode, setHero3dMode] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const gamificationStats = useMemo(() => getGamificationStats(data), [data]);

  const { courses, activity, profile } = data;

  const active = courses.filter(
    (c) => !["completed", "archived"].includes(c.status),
  );

  const done = courses.filter(
    (c) => completion(c) === 100 && c.videos.length > 0,
  ).length;

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

  const seconds = activity.reduce((n, a) => n + a.active_seconds, 0);
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
  const { totalCompletedChapters, totalChaptersCount } = useMemo(() => {
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

    const percent =
      dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;

    return {
      chapters,
      activeChapter,
      currentChapterIdx,
      finishedChapters,
      percent,
    };
  }, [resumeLessonItem]);

  // 5. Weekly consistency days (Mon - Sun of current week)
  const { weekDays, activeDaysThisWeek, totalMinutesThisWeek } = useMemo(() => {
    const todayStr = localDay(now, profile.timezone);
    const todayDate = new Date(`${todayStr}T12:00:00Z`);
    const dayOfWeek = (todayDate.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun

    const daysList = Array.from({ length: 7 }, (_, i) => {
      const diff = i - dayOfWeek;
      const d = new Date(todayDate.getTime() + diff * 86400000);
      const dayStr = d.toISOString().slice(0, 10);
      const dayActivity = activity.find((a) => a.day === dayStr);
      const daySeconds = dayActivity?.active_seconds || 0;
      const dayMinutes = Math.floor(daySeconds / 60);
      const isToday = dayStr === todayStr;
      const isPast = dayStr < todayStr;
      const isGoalMet = dayMinutes >= dailyGoal && dailyGoal > 0;

      return {
        dayStr,
        dayName: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        dateNum: d.getUTCDate(),
        dayMinutes,
        isToday,
        isPast,
        isGoalMet,
        hasActivity: dayMinutes > 0,
      };
    });

    const activeCount = daysList.filter((w) => w.hasActivity).length;
    const totalMinutes = daysList.reduce((acc, w) => acc + w.dayMinutes, 0);

    return {
      weekDays: daysList,
      activeDaysThisWeek: activeCount,
      totalMinutesThisWeek: totalMinutes,
    };
  }, [activity, dailyGoal, now, profile.timezone]);

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
          <p>Everything you’re learning, practicing, and remembering.</p>
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

          <span className="date-label">
            <span>{format(now, "EEE")}</span>
            {format(now, "MMM d")}
          </span>

          <Button asChild>
            <Link href="/courses/new">
              <Plus size={17} />
              Add course
            </Link>
          </Button>
        </div>
      </div>

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
                <div
                  style={{ width: `${resumeDetails?.percent || 0}%` }}
                />
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
              <Link href={active.length ? "/continue" : "/courses/new"}>
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

      {/* Enriched Stats Grid */}
      <section className="stats-grid" data-tour="stats-grid">
        <Stat
          icon={<BookOpen size={18} />}
          label="Courses in progress"
          value={courses.filter((c) => c.status === "in_progress").length}
          color="purple"
          detail={`${courses.filter((c) => c.status !== "archived").length} in library · ${done} finished`}
          index="01"
        />
        <Stat
          icon={<CircleCheck size={18} />}
          label="Lessons & Chapters"
          value={videoCount}
          color="green"
          detail={
            totalCompletedChapters > 0
              ? `${totalCompletedChapters} chapters finished`
              : `${availableCount ? Math.round((completedCount / availableCount) * 100) : 0}% library progress`
          }
          index="02"
        />
        <Stat
          icon={<CheckCircle2 size={18} />}
          label="Practice tasks done"
          value={
            allPracticeTasks.length
              ? `${completedTasksCount} / ${allPracticeTasks.length}`
              : "0"
          }
          color="blue"
          detail={
            pendingTasks.length
              ? `${pendingTasks.length} pending action items`
              : "All exercises completed"
          }
          index="03"
        />
        <Stat
          icon={<Flame size={18} />}
          label="Current streak"
          value={
            <>
              {days}
              <small>{days === 1 ? "day" : "days"}</small>
            </>
          }
          color="orange"
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
      {/* Gamification: Level Mastery & Daily Quests */}
      <section
        className="panel dashboard-gamification-panel"
        data-tour="gamification-quests"
      >
        <div className="gamification-hero-split">
          {/* Left Column: 3D Trophy & Rank Progress */}
          <div className="gamification-trophy-side">
            <div className="gamification-trophy-stage">
              <SceneArtwork
                kind="trophy"
                progress={gamificationStats.levelInfo.levelProgressPercent / 100}
                interactive
                label={`Level ${gamificationStats.levelInfo.level} Trophy: ${gamificationStats.levelInfo.title}`}
              />
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
                  <strong>{gamificationStats.levelInfo.totalXP.toLocaleString()}</strong> XP
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
                    Achievements & Badges ({gamificationStats.unlockedAchievementsCount}/{gamificationStats.totalAchievementsCount})
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

      {/* Weekly Consistency Tracker */}
      <section className="panel weekly-consistency-panel" data-tour="weekly-consistency">
        <div className="weekly-header">
          <div>
            <span className="section-index">7-DAY MOMENTUM</span>
            <h2>Weekly Consistency</h2>
          </div>
          <div className="weekly-summary-pill">
            <Calendar size={14} />
            <span>
              <strong>{activeDaysThisWeek} of 7 days</strong> active this week
              · {totalMinutesThisWeek}m focused
            </span>
          </div>
        </div>

        <div className="weekly-days-grid">
          {weekDays.map((w) => (
            <div
              key={w.dayStr}
              className={cn(
                "weekly-day-card",
                w.isToday && "weekly-day-today",
                w.isGoalMet && "weekly-day-goal-met",
                w.hasActivity && !w.isGoalMet && "weekly-day-active",
              )}
            >
              <span className="weekly-day-name">{w.dayName}</span>
              <span className="weekly-day-number">{w.dateNum}</span>
              <div className="weekly-status-indicator">
                {w.isGoalMet ? (
                  <CheckCircle2 size={17} className="weekly-check-icon" />
                ) : w.hasActivity ? (
                  <div className="weekly-partial-dot" />
                ) : (
                  <div className="weekly-rest-dot" />
                )}
              </div>
              <span className="weekly-day-minutes">
                {w.hasActivity ? `${w.dayMinutes}m` : "—"}
              </span>
              {w.isToday && <span className="weekly-today-badge">TODAY</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Practice Checklist & Revision Queue (High Utility Interactive Section) */}
      <div className="dashboard-action-grid">
        {/* Practice Checklist Panel */}
        <section className="panel practice-queue-panel" data-tour="practice-queue">
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
                <ListTodo size={28} className="empty-state-icon" />
                <p>
                  <strong>No practice tasks yet.</strong> Add hands-on exercises
                  while watching lessons to turn tutorials into real skills.
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
                  <CheckCircle2 size={32} className="celebrate-icon" />
                  <p>
                    <strong>All practice tasks completed!</strong>
                    <br />
                    Outstanding work following through on your exercises.
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
        <section className="panel revision-queue-panel" data-tour="revision-queue">
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
                  <span className="revision-course-name">
                    {n.courseTitle}
                  </span>
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
                  <span className="revision-lesson-title">
                    {n.videoTitle}
                  </span>
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
                <Sparkles size={28} className="empty-state-icon" />
                <p>
                  <strong>All caught up on revisions!</strong>
                  <br />
                  Flag notes with the revision tag during study to revisit
                  critical concepts here.
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

      {/* Analytics & Intention Panels */}
      <div className="dashboard-panels">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">SHOWING UP, OVER TIME</span>
              <h2>Learning activity</h2>
            </div>
            <label className="compact-select">
              <select
                aria-label="Activity period"
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              >
                <option value={7}>This week</option>
                <option value={30}>Last 30 days</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="activity-summary">
            <strong>
              {Math.round(
                dailySeries(
                  activity,
                  localDay(now, profile.timezone),
                  period,
                ).reduce((n, day) => n + day.minutes, 0),
              )}
              <span>minutes of focus</span>
            </strong>
            <span className="activity-summary-caption">
              <span className="legend-dot" />
              Learning time
            </span>
          </div>
          <ActivityChart
            activity={activity}
            timezone={profile.timezone}
            days={period}
          />
          {!activity.length && (
            <div className="chart-empty-caption">
              Your first session will bring this chart to life.
            </div>
          )}
        </section>

        <section className="panel daily-goal-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">A LITTLE, EVERY DAY</span>
              <h2>Your daily intention</h2>
            </div>
            <span className="goal-day-tag">TODAY</span>
          </div>
          <div className="goal-ring">
            <SceneArtwork
              kind="goal"
              progress={Math.min(1, todayMinutes / dailyGoal)}
              label={`Daily learning goal: ${todayMinutes} of ${dailyGoal} minutes completed`}
            />
            <div className="goal-ring-value">
              <strong>
                {todayMinutes}
                <span> / {dailyGoal}</span>
              </strong>
              <small>minutes today</small>
            </div>
          </div>
          <div className="goal-encouragement">
            {todayMinutes >= dailyGoal
              ? "You made the time. Well done."
              : "A small commitment. A real difference."}
          </div>
          <Link href="/goals" className="goal-edit-link">
            {data.goals.length ? "Adjust your goals" : "Set your intention"}
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>

      {/* Perspective Charts */}
      <div className="learning-perspective-grid">
        <LearningLandscape activity={activity} timezone={profile.timezone} />
        <LearningMix courses={courses} />
      </div>

      {!isConnected && (
        <div className="local-mode-banner">
          <span className="local-dot" />
          <span>
            <strong>Personal. Local. Yours.</strong> Your work is saved in this
            browser. Come back here to pick up where you left off.
          </span>
          <Link href="/settings">
            Workspace settings
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      <div className="dashboard-bottom-note">
        <span className="little-star">✳</span>Less collecting. More completing.
      </div>

      <AchievementsDialog
        open={achievementsOpen}
        onOpenChange={setAchievementsOpen}
        stats={gamificationStats}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
  detail,
  index,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
  detail: string;
  index: string;
}) {
  return (
    <Card className="stat-card gap-0">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-bottom">
        <p>{detail}</p>
        <span>{index}</span>
      </div>
    </Card>
  );
}
