"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChartNoAxesCombined, BookOpen, Download, Layers } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import {
  duration,
  learningTime,
  localDay,
  completion,
  streak,
  longestStreak,
} from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ActivityChart } from "./activity-chart";
import { LearningMix } from "./progress-charts";
import {
  parseVideoChapters,
  completedChaptersCount,
} from "@/lib/youtube/chapters";

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LearningOverview({
  dailyIntention,
}: {
  dailyIntention: ReactNode;
}) {
  const { data, notify } = useWorkspace();
  const [range, setRange] = useState(7);
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

  // Activity totals for the selected period
  const total = activity.reduce((n, a) => n + a.active_seconds, 0);
  const videos = activity.reduce((n, a) => n + a.videos_completed, 0);
  const coursesDone = activity.reduce((n, a) => n + a.courses_completed, 0);

  // Library totals for the exported report
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

  // Progress by category
  const categoryStats = useMemo(() => {
    const cats = Array.from(
      new Set(
        data.courses
          .filter((c) => c.status !== "archived")
          .map((c) => c.category || "General"),
      ),
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

  // Detailed course progress
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
    const content = `# Progressly Study Report
Generated: ${new Date().toLocaleString()}
Workspace: ${data.profile.display_name || "Learner"} (${data.profile.timezone})

## 1. Learning Summary
- Total Active Study Time: ${duration(total)}
- Lessons Completed: ${videos}
- Courses Completed: ${coursesDone}
- Current Streak: ${streak(data.activity, data.profile.timezone, data.profile.weekend_rest)} days (Best: ${longestStreak(data.activity)} days)

## 2. Category Progress
${categoryStats
  .map(
    (c) =>
      `- **${c.category}**: ${c.percent}% completed (${c.completedVideos}/${c.totalVideos} lessons, ${duration(c.totalDuration)}, ${c.totalNotes} notes)`,
  )
  .join("\n")}

## 3. Notes & Practice
- Total Notes Created: ${allNotes.length}
- Timestamped Notes: ${timestampedNotes}
- Practice Tasks Completed: ${completedTasks} of ${allTasks.length} (${practiceRate}%)

## 4. Course-by-Course Progress
${courseDiagnostics
  .map(
    (c) =>
      `- **${c.title}** [${c.category}]
  Status: ${c.status} | Progress: ${c.progress}% (${c.completedVideos}/${c.totalVideos} lessons)
  Study time: ${duration(c.watchedDuration)} of ${duration(c.totalDuration)}
  Chapters: ${c.completedChapters}/${c.totalChapters} | Tasks: ${c.doneTasks}/${c.totalTasks} | Notes: ${c.totalNotes}`,
  )
  .join("\n\n")}

---
*Progressly — Less collecting. More completing.*
`;

    downloadText(content, `progressly-study-report-${reportDate}.md`);
    notify("Study report downloaded.");
  };

  return (
    <section
      id="learning-overview"
      className="learning-overview"
      aria-labelledby="learning-overview-title"
    >
      <div className="learning-overview-heading">
        <div>
          <h2 id="learning-overview-title">Learning overview</h2>
          <p>
            {learningTime(Math.floor(total / 60), true)} focused · {videos}{" "}
            lessons completed
          </p>
        </div>
        <div className="analytics-header-actions">
          <select
            className="period-select"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            aria-label="Learning period"
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
            <span>Export report</span>
          </Button>
        </div>
      </div>

      <div className="dashboard-panels">
        {/* Daily activity */}
        <section className="panel activity-panel analytics-main-chart">
          <div className="panel-heading">
            <div>
              <h2>Learning activity</h2>
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
              Your first session will appear here.
            </div>
          )}
        </section>

        {dailyIntention}
      </div>

      <details className="learning-overview-details">
        <summary>More insights</summary>
        <div className="learning-overview-breakdowns">
          <div className="analytics-dual-grid">
            {/* Category progress */}
            <section className="panel category-matrix-panel">
              <div className="panel-heading">
                <div>
                  <h2>Progress by category</h2>
                </div>
                <Layers size={20} />
              </div>

              <div className="category-mastery-cards-grid">
                {categoryStats.map((cat) => (
                  <div key={cat.category} className="category-mastery-card">
                    <div className="category-card-top">
                      <span className="category-badge">{cat.category}</span>
                      <span className="category-percent-tag">
                        {cat.percent}%
                      </span>
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
                    <p>Add a course to see category progress.</p>
                  </div>
                )}
              </div>
            </section>

            <LearningMix courses={data.courses} />
          </div>
        </div>
      </details>
    </section>
  );
}
