"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartNoAxesCombined,
  Clock3,
  BookOpen,
  TrendingUp,
  Brain,
  Sparkles,
  Download,
  Flame,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import {
  duration,
  localDay,
  completion,
  streak,
  longestStreak,
} from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ActivityChart } from "./activity-chart";
import { LearningLandscape } from "./learning-landscape";
import {
  LearningMix,
  WeekdayRhythm,
  CourseComparison,
} from "./progress-charts";
import { weekdayData } from "@/lib/analytics";
import {
  parseVideoChapters,
  completedChaptersCount,
} from "@/lib/youtube/chapters";
import { fireConfetti } from "@/lib/confetti";

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Analytics() {
  const { data, notify } = useWorkspace();
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<
    "minutes" | "videos" | "practice" | "courses"
  >("minutes");

  const today = localDay(new Date(), data.profile.timezone);
  const threshold = format(
    subDays(new Date(`${today}T12:00:00Z`), range - 1),
    "yyyy-MM-dd",
  );

  const activity = useMemo(
    () =>
      data.activity.filter(
        (a) => a.day <= today && (range === 0 || a.day >= threshold),
      ),
    [data.activity, today, range, threshold],
  );

  // 1. Core aggregates
  const total = activity.reduce((n, a) => n + a.active_seconds, 0);
  const videos = activity.reduce((n, a) => n + a.videos_completed, 0);
  const coursesDone = activity.reduce((n, a) => n + a.courses_completed, 0);
  const activeDays = activity.filter((a) => a.active_seconds > 0);
  const avgDailySeconds = activeDays.length
    ? Math.round(total / activeDays.length)
    : 0;

  // 2. Practice & Notes Knowledge Capital
  const allTasks = useMemo(
    () => data.courses.flatMap((c) => c.videos.flatMap((v) => v.tasks)),
    [data.courses],
  );
  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const practiceRate = allTasks.length
    ? Math.round((completedTasks / allTasks.length) * 100)
    : 0;

  const allNotes = useMemo(
    () => data.courses.flatMap((c) => c.videos.flatMap((v) => v.notes)),
    [data.courses],
  );
  const timestampedNotes = allNotes.filter(
    (n) => n.timestamp_seconds > 0,
  ).length;
  const reviewedNotes = allNotes.filter((n) => !n.is_revision_required).length;

  // 3. Active vs. Passive Learning Balance
  const totalStudyMinutes = Math.round(
    data.activity.reduce((sum, row) => sum + row.active_seconds, 0) / 60,
  );
  const activeActionsCount = completedTasks + allNotes.length;
  // Healthy active balance benchmark: 1 active engagement action per 15-20 min of study
  const activeRatioScore =
    totalStudyMinutes > 0
      ? Math.min(
          100,
          Math.round(((activeActionsCount * 18) / totalStudyMinutes) * 100),
        )
      : activeActionsCount > 0
        ? 100
        : 0;

  // 4. Velocity & Completion Forecast
  const last30Threshold = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const last30Videos = data.activity
    .filter((a) => a.day >= last30Threshold)
    .reduce((sum, a) => sum + a.videos_completed, 0);
  const weeklyLessonVelocity = Number(((last30Videos / 30) * 7).toFixed(1));

  const activeCourses = useMemo(
    () =>
      data.courses.filter((c) => !["completed", "archived"].includes(c.status)),
    [data.courses],
  );
  const remainingLessons = activeCourses.reduce(
    (sum, c) =>
      sum +
      c.videos.filter(
        (v) =>
          v.availability_status === "available" && !v.progress.is_completed,
      ).length,
    0,
  );
  const remainingSeconds = activeCourses.reduce(
    (sum, c) =>
      sum +
      c.videos
        .filter(
          (v) =>
            v.availability_status === "available" && !v.progress.is_completed,
        )
        .reduce((s, v) => s + (v.duration_seconds || 600), 0),
    0,
  );
  const estimatedDaysToComplete =
    weeklyLessonVelocity > 0
      ? Math.ceil((remainingLessons / weeklyLessonVelocity) * 7)
      : null;

  // 5. Category Mastery
  const categoryStats = useMemo(() => {
    const cats = Array.from(
      new Set(data.courses.map((c) => c.category || "General")),
    );
    return cats
      .map((cat) => {
        const catCourses = data.courses.filter(
          (c) => (c.category || "General") === cat && c.status !== "archived",
        );
        const catVideos = catCourses.flatMap((c) =>
          c.videos.filter((v) => v.availability_status === "available"),
        );
        const catCompletedVideos = catVideos.filter(
          (v) => v.progress.is_completed,
        );
        const catNotes = catCourses.flatMap((c) =>
          c.videos.flatMap((v) => v.notes),
        );
        const catDuration = catVideos.reduce(
          (sum, v) => sum + (v.duration_seconds || 0),
          0,
        );
        const percent = catVideos.length
          ? Math.round((catCompletedVideos.length / catVideos.length) * 100)
          : 0;
        return {
          category: cat,
          totalCourses: catCourses.length,
          completedCourses: catCourses.filter((c) => completion(c) === 100)
            .length,
          totalVideos: catVideos.length,
          completedVideos: catCompletedVideos.length,
          totalNotes: catNotes.length,
          totalDuration: catDuration,
          percent,
        };
      })
      .sort((a, b) => b.totalDuration - a.totalDuration);
  }, [data.courses]);

  // 6. Circadian & Weekday Rhythm
  const weekdayRows = useMemo(() => weekdayData(activity), [activity]);
  const peakWeekday = useMemo(() => {
    const sorted = [...weekdayRows].sort((a, b) => b.minutes - a.minutes);
    return sorted[0]?.minutes > 0 ? sorted[0] : null;
  }, [weekdayRows]);

  const weekdayFocusMinutes = weekdayRows
    .filter((w) => w.name !== "Sat" && w.name !== "Sun")
    .reduce((sum, w) => sum + w.minutes, 0);
  const weekendFocusMinutes = weekdayRows
    .filter((w) => w.name === "Sat" || w.name === "Sun")
    .reduce((sum, w) => sum + w.minutes, 0);

  // 7. Course Diagnostics List
  const courseDiagnostics = useMemo(() => {
    return data.courses
      .filter((c) => c.status !== "archived")
      .map((course) => {
        const availableVideos = course.videos.filter(
          (v) => v.availability_status === "available",
        );
        const completedVideos = availableVideos.filter(
          (v) => v.progress.is_completed,
        );
        const totalDuration = availableVideos.reduce(
          (sum, v) => sum + (v.duration_seconds || 0),
          0,
        );
        const watchedDuration = availableVideos.reduce(
          (sum, v) =>
            sum +
            (v.progress.is_completed
              ? v.duration_seconds || 0
              : v.progress.last_position_seconds || 0),
          0,
        );

        let totalChapters = 0;
        let completedChapters = 0;
        availableVideos.forEach((v) => {
          const chs = parseVideoChapters(
            v.description || "",
            v.duration_seconds || 0,
          );
          if (chs.length > 0) {
            totalChapters += chs.length;
            completedChapters += completedChaptersCount(
              chs,
              v.progress.last_position_seconds || 0,
              v.duration_seconds || 0,
              v.progress.is_completed,
            );
          }
        });

        const courseNotes = availableVideos.flatMap((v) => v.notes);
        const courseTasks = availableVideos.flatMap((v) => v.tasks);
        const doneTasks = courseTasks.filter((t) => t.is_completed).length;
        const progress = completion(course);

        return {
          id: course.id,
          title: course.title,
          category: course.category,
          channel: course.channel_name || "Self-directed",
          progress,
          totalVideos: availableVideos.length,
          completedVideos: completedVideos.length,
          totalDuration,
          watchedDuration,
          totalChapters,
          completedChapters,
          totalNotes: courseNotes.length,
          totalTasks: courseTasks.length,
          doneTasks,
          status: course.status,
        };
      })
      .sort((a, b) => b.progress - a.progress);
  }, [data.courses]);

  const handleExportReport = () => {
    const reportDate = format(new Date(), "yyyy-MM-dd");
    const content = `# Progressly Study & Learning Diagnostic Report
Generated: ${new Date().toLocaleString()}
Workspace: ${data.profile.display_name || "Learner"} (${data.profile.timezone})

## 1. Executive Summary
- Total Active Study Time: ${duration(total)}
- Lessons Completed: ${videos}
- Courses Completed: ${coursesDone}
- Current Streak: ${streak(data.activity, data.profile.timezone, data.profile.weekend_rest)} days (Best: ${longestStreak(data.activity)} days)
- Weekly Learning Velocity: ${weeklyLessonVelocity} lessons / week
- Active Participation Indicator: ${activeRatioScore}%

## 2. Category & Subject Mastery
${categoryStats
  .map(
    (c) =>
      `- **${c.category}**: ${c.percent}% completed (${c.completedVideos}/${c.totalVideos} lessons, ${duration(c.totalDuration)}, ${c.totalNotes} notes)`,
  )
  .join("\n")}

## 3. Knowledge Capital & Hands-On Retention
- Total Notes Created: ${allNotes.length}
- Timestamped Video Bookmarks: ${timestampedNotes}
- Practice Tasks Completed: ${completedTasks} of ${allTasks.length} (${practiceRate}%)

## 4. Course-by-Course Progress
${courseDiagnostics
  .map(
    (c) =>
      `- **${c.title}** [${c.category}]
  Status: ${c.status} | Progress: ${c.progress}% (${c.completedVideos}/${c.totalVideos} lessons)
  Time Invested: ${duration(c.watchedDuration)} of ${duration(c.totalDuration)}
  Chapters: ${c.completedChapters}/${c.totalChapters} | Tasks: ${c.doneTasks}/${c.totalTasks} | Notes: ${c.totalNotes}`,
  )
  .join("\n\n")}

---
*Progressly — Less collecting. More completing.*
`;

    downloadText(content, `progressly-study-report-${reportDate}.md`);
    fireConfetti();
    notify("Study & diagnostic report downloaded.");
  };

  return (
    <div className="analytics-page-root">
      {/* Page Heading & Controls */}
      <div className="page-heading analytics-page-heading">
        <div>
          <span className="eyebrow">COMPREHENSIVE LEARNING INTELLIGENCE</span>
          <h1>Your learning, in perspective.</h1>
          <p>Your study time, course progress, practice, and weekly rhythm.</p>
        </div>
        <div className="analytics-header-actions">
          <select
            className="period-select"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            aria-label="Analytics period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={0}>All time</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            className="export-report-btn"
          >
            <Download size={14} />
            <span>Export Study Record (.md)</span>
          </Button>
        </div>
      </div>

      {/* Row 1: Executive KPI Metrics */}
      <div className="stats-grid analytics-stats">
        <Card className="stat-card gap-0">
          <div className="stat-top">
            <span>Time Invested</span>
            <span className="stat-icon purple">
              <Clock3 size={19} />
            </span>
          </div>
          <div className="stat-value">{duration(total)}</div>
          <p>
            {activeDays.length} active sessions · avg{" "}
            {duration(avgDailySeconds)} / day
          </p>
        </Card>

        <Card className="stat-card gap-0">
          <div className="stat-top">
            <span>Completion Velocity</span>
            <span className="stat-icon green">
              <TrendingUp size={19} />
            </span>
          </div>
          <div className="stat-value">
            {weeklyLessonVelocity} <small style={{ fontSize: 13 }}>/ wk</small>
          </div>
          <p>
            {estimatedDaysToComplete
              ? `~${estimatedDaysToComplete} days to finish active courses`
              : "Keep momentum going"}
          </p>
        </Card>

        <Card className="stat-card gap-0">
          <div className="stat-top">
            <span>Active Retention</span>
            <span className="stat-icon orange">
              <Brain size={19} />
            </span>
          </div>
          <div className="stat-value">{activeRatioScore}%</div>
          <p>
            {completedTasks} tasks done · {allNotes.length} notes recorded
          </p>
        </Card>

        <Card className="stat-card gap-0">
          <div className="stat-top">
            <span>Knowledge Capital</span>
            <span className="stat-icon blue">
              <BookOpen size={19} />
            </span>
          </div>
          <div className="stat-value">
            {allNotes.length} <small style={{ fontSize: 13 }}>notes</small>
          </div>
          <p>
            {timestampedNotes} timestamped · {reviewedNotes} reviewed
          </p>
        </Card>
      </div>

      {/* Row 2: Velocity & Forecast + Active/Passive Retention Balance */}
      <div className="analytics-dual-grid">
        {/* Card 1: Study Velocity & Course Graduation Forecast */}
        <section className="panel velocity-forecast-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">PACING & FORECAST</span>
              <h2>Study Velocity & Completion</h2>
              <p>Predictive pacing based on your recent 30-day rhythm.</p>
            </div>
            <span className="velocity-tag-badge">
              <Zap size={13} />
              {weeklyLessonVelocity >= 4
                ? "High Velocity"
                : weeklyLessonVelocity >= 1.5
                  ? "Steady Rhythm"
                  : "Gentle Pace"}
            </span>
          </div>

          <div className="velocity-card-body">
            <div className="velocity-metrics-row">
              <div className="velocity-metric-item">
                <span className="velocity-metric-label">Weekly Pace</span>
                <strong className="velocity-metric-val">
                  {weeklyLessonVelocity}
                  <span>lessons / week</span>
                </strong>
              </div>
              <div className="velocity-metric-item">
                <span className="velocity-metric-label">Active Workload</span>
                <strong className="velocity-metric-val">
                  {remainingLessons}
                  <span>lessons remaining</span>
                </strong>
              </div>
              <div className="velocity-metric-item">
                <span className="velocity-metric-label">
                  Remaining Duration
                </span>
                <strong className="velocity-metric-val">
                  {duration(remainingSeconds)}
                  <span>to complete</span>
                </strong>
              </div>
            </div>

            <div className="forecast-banner">
              <Sparkles size={16} className="text-primary" />
              <div>
                <strong>
                  {estimatedDaysToComplete
                    ? `Projected graduation in ~${estimatedDaysToComplete} days`
                    : "Complete 1 lesson this week to generate graduation projections."}
                </strong>
                <p>
                  At your current rate, you are on track to master your
                  currently active courses with sustained momentum.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Cognitive Retention Balance (Active vs Passive Learning) */}
        <section className="panel retention-balance-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">LEARNING HABITS</span>
              <h2>Active vs. Passive Balance</h2>
              <p>
                Notes and practice across your library. A habit indicator, not a
                measure of recall.
              </p>
            </div>
            <Brain size={20} className="text-primary" />
          </div>

          <div className="retention-card-body">
            <div className="retention-score-strip">
              <div className="retention-score-label">
                <span>Active Participation Indicator</span>
                <strong>{activeRatioScore}%</strong>
              </div>
              <div className="retention-progress-bar">
                <div
                  className="retention-progress-fill"
                  style={{ width: `${activeRatioScore}%` }}
                />
              </div>
            </div>

            <div className="retention-breakdown-grid">
              <div className="retention-breakdown-item">
                <div className="retention-item-dot watch" />
                <div>
                  <strong>{duration(total)}</strong>
                  <span>Watch intake</span>
                </div>
              </div>
              <div className="retention-breakdown-item">
                <div className="retention-item-dot practice" />
                <div>
                  <strong>
                    {completedTasks} / {allTasks.length}
                  </strong>
                  <span>Hands-on tasks</span>
                </div>
              </div>
              <div className="retention-breakdown-item">
                <div className="retention-item-dot notes" />
                <div>
                  <strong>{allNotes.length}</strong>
                  <span>Conceptual notes</span>
                </div>
              </div>
            </div>

            <div className="retention-insight-box">
              <p>
                {activeRatioScore >= 70 ? (
                  <>
                    <strong>Making room for practice.</strong> You regularly
                    apply concepts through notes and practice exercises rather
                    than just passively observing.
                  </>
                ) : (
                  <>
                    <strong>Try one active step:</strong> Take 1 timestamped
                    note or complete a practice task every 15 minutes of video,
                    then try explaining the idea in your own words.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Row 3: Category & Subject Mastery Matrix */}
      <section className="panel category-matrix-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">TOPIC SPECIALIZATION</span>
            <h2>Category & Subject Mastery</h2>
            <p>Your learning investment split across domains and skills.</p>
          </div>
          <Layers size={20} />
        </div>

        <div className="category-mastery-cards-grid">
          {categoryStats.map((cat) => (
            <div key={cat.category} className="category-mastery-card">
              <div className="category-card-top">
                <span className="category-badge">{cat.category}</span>
                <span className="category-percent-tag">{cat.percent}%</span>
              </div>
              <div className="category-progress-track">
                <div
                  className="category-progress-bar"
                  style={{ width: `${cat.percent}%` }}
                />
              </div>
              <div className="category-card-stats">
                <div>
                  <strong>
                    {cat.completedVideos} / {cat.totalVideos}
                  </strong>
                  <span>lessons</span>
                </div>
                <div>
                  <strong>{duration(cat.totalDuration)}</strong>
                  <span>content</span>
                </div>
                <div>
                  <strong>{cat.totalNotes}</strong>
                  <span>notes</span>
                </div>
                <div>
                  <strong>
                    {cat.completedCourses} / {cat.totalCourses}
                  </strong>
                  <span>finished</span>
                </div>
              </div>
            </div>
          ))}

          {!categoryStats.length && (
            <div className="small-empty">
              <BookOpen size={24} />
              <p>
                No courses added yet. Add a course to see category breakdowns.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Row 4: Interactive Metric Activity Timeline */}
      <section className="panel analytics-main-chart">
        <div className="panel-heading">
          <div>
            <span className="section-index">CHRONOLOGICAL PROGRESS</span>
            <h2>Daily Learning Activity</h2>
            <p>
              {metric === "minutes"
                ? "Active playback focus time aggregated by timezone."
                : metric === "videos"
                  ? "Lessons completed over time."
                  : metric === "courses"
                    ? "Course graduation timeline."
                    : "Hands-on practice exercises completed."}
            </p>
          </div>
          <ChartNoAxesCombined size={23} />
        </div>
        <div className="tabs">
          {[
            { value: "minutes", label: "Learning time" },
            { value: "videos", label: "Lessons completed" },
            { value: "courses", label: "Courses completed" },
            { value: "practice", label: "Practice tasks" },
          ].map((t) => (
            <button
              key={t.value}
              className={metric === t.value ? "selected" : ""}
              onClick={() => setMetric(t.value as typeof metric)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ActivityChart
          activity={activity}
          timezone={data.profile.timezone}
          days={range}
          metric={metric}
          height={280}
        />
        {!activity.length && (
          <div className="chart-empty-caption">
            Every journey starts somewhere. Your first session will bring this
            chart to life.
          </div>
        )}
      </section>

      {/* Row 5: Circadian Rhythm + Learning Mix */}
      <div className="analytics-dual-grid">
        <div className="panel rhythm-container-panel">
          <WeekdayRhythm activity={activity} />
          <div className="rhythm-extra-summary">
            <div className="rhythm-pill">
              <Sun size={14} className="text-yellow-500" />
              <span>
                Weekday Focus: <strong>{weekdayFocusMinutes}m</strong>
              </span>
            </div>
            <div className="rhythm-pill">
              <Moon size={14} className="text-indigo-400" />
              <span>
                Weekend Focus: <strong>{weekendFocusMinutes}m</strong>
              </span>
            </div>
            {peakWeekday && (
              <div className="rhythm-pill highlight">
                <Flame size={14} className="text-orange-500" />
                <span>
                  Peak Day:{" "}
                  <strong>
                    {peakWeekday.name} ({peakWeekday.minutes}m)
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <LearningMix courses={data.courses} />
      </div>

      {/* Row 6: 3D Week in Dimension */}
      <div className="learning-landscape-analytics-container">
        <LearningLandscape
          activity={data.activity}
          timezone={data.profile.timezone}
        />
      </div>

      <CourseComparison courses={data.courses} />

      {/* Row 7: Course-by-Course In-Depth Diagnostics Matrix */}
      <section className="panel course-diagnostics-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">COURSE DIAGNOSTICS</span>
            <h2>Course-by-Course Health Matrix</h2>
            <p>
              Detailed breakdown of duration, chapters, practice, and notes per
              course.
            </p>
          </div>
          <Link href="/courses" className="text-link">
            Open library
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="course-diag-cards-list">
          {courseDiagnostics.map((c) => (
            <div key={c.id} className="course-diag-card">
              <div className="course-diag-main">
                <div className="course-diag-title-row">
                  <span className="category-badge">{c.category}</span>
                  <strong className="course-diag-title">{c.title}</strong>
                  <span className="course-diag-channel">{c.channel}</span>
                </div>
                <div className="course-diag-progress-row">
                  <div className="course-diag-progress-track">
                    <div
                      className="course-diag-progress-fill"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <span className="course-diag-progress-pct">
                    {c.progress}%
                  </span>
                </div>
              </div>

              <div className="course-diag-meta-grid">
                <div className="diag-meta-item">
                  <span>Watched / Total</span>
                  <strong>
                    {duration(c.watchedDuration)} / {duration(c.totalDuration)}
                  </strong>
                </div>
                <div className="diag-meta-item">
                  <span>Lessons</span>
                  <strong>
                    {c.completedVideos} / {c.totalVideos}
                  </strong>
                </div>
                <div className="diag-meta-item">
                  <span>Chapters</span>
                  <strong>
                    {c.totalChapters > 0
                      ? `${c.completedChapters} / ${c.totalChapters}`
                      : "—"}
                  </strong>
                </div>
                <div className="diag-meta-item">
                  <span>Practice Tasks</span>
                  <strong>
                    {c.totalTasks > 0
                      ? `${c.doneTasks} / ${c.totalTasks}`
                      : "—"}
                  </strong>
                </div>
                <div className="diag-meta-item">
                  <span>Notes</span>
                  <strong>{c.totalNotes}</strong>
                </div>
              </div>

              <div className="course-diag-action">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/courses/${c.id}`}>
                    Inspect
                    <ArrowRight size={13} />
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {!courseDiagnostics.length && (
            <div className="small-empty">
              <BookOpen size={24} />
              <p>
                Add courses to your library to populate the diagnostic matrix.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer Insight */}
      <p className="analytics-data-caption">
        {
          activity.filter(
            (a) =>
              a.active_seconds > 0 ||
              a.videos_completed > 0 ||
              a.practice_completed > 0,
          ).length
        }{" "}
        active sessions recorded in this period · Timezone:{" "}
        {data.profile.timezone}. Data is computed directly from your private
        workspace activity records.
      </p>
    </div>
  );
}
