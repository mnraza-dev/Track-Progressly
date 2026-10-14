"use client";
import { useState } from "react";
import {
  ChartNoAxesCombined,
  Clock3,
  CircleCheck,
  BookOpen,
  Code2,
  TrendingUp,
  Target,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { completion, duration, localDay } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ActivityChart } from "./activity-chart";
import { Progress } from "@/components/ui/progress";
export function Analytics() {
  const { data } = useWorkspace();
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<
    "minutes" | "videos" | "practice" | "courses"
  >("minutes");
  const today = localDay(new Date(), data.profile.timezone);
  const threshold = format(
    subDays(new Date(`${today}T12:00:00Z`), range - 1),
    "yyyy-MM-dd",
  );
  const activity = data.activity.filter(
    (a) => range === 0 || a.day >= threshold,
  );
  const total = activity.reduce((n, a) => n + a.active_seconds, 0);
  const videos = activity.reduce((n, a) => n + a.videos_completed, 0);
  const courses = activity.reduce((n, a) => n + a.courses_completed, 0);
  const tasks = data.courses.flatMap((c) => c.videos.flatMap((v) => v.tasks));
  const practiceRate = tasks.length
    ? Math.round(
        (tasks.filter((t) => t.is_completed).length / tasks.length) * 100,
      )
    : 0;
  const days: Record<string, number> = {};
  activity.forEach((a) => {
    const day = format(new Date(`${a.day}T12:00:00Z`), "EEEE");
    days[day] = (days[day] || 0) + a.active_seconds;
  });
  const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>Look how far you’re going.</h1>
          <p>
            Real learning. Meaningful progress. A little perspective on your
            journey.
          </p>
        </div>
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
      </div>
      <div className="stats-grid analytics-stats">
        {[
          {
            icon: Clock3,
            label: "Time invested",
            value: duration(total),
            color: "purple",
            detail: "Tracked during active playback",
          },
          {
            icon: CircleCheck,
            label: "Lessons completed",
            value: videos,
            color: "green",
            detail: "One step at a time",
          },
          {
            icon: BookOpen,
            label: "Courses completed",
            value: courses,
            color: "blue",
            detail: "Knowledge you followed through on",
          },
          {
            icon: Code2,
            label: "Practice completion",
            value: `${practiceRate}%`,
            color: "orange",
            detail: `${tasks.filter((t) => t.is_completed).length} of ${tasks.length} tasks · all time`,
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={19} />
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>
      <section className="panel analytics-main-chart">
        <div className="panel-heading">
          <div>
            <h2>Small efforts, adding up.</h2>
            <p>
              {metric === "minutes"
                ? "Active playback time, aggregated by your selected timezone."
                : metric === "videos"
                  ? "Lessons completed per week, from your explicit completion records."
                  : metric === "courses"
                    ? "Courses completed per month, from your saved completion dates."
                    : "Tasks you practiced, separate from what you watched."}
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
        />
        {!activity.length && (
          <div className="chart-empty-caption">
            Every journey starts somewhere. Your first session will bring this
            chart to life.
          </div>
        )}
      </section>
      <div className="analytics-bottom">
        <section className="panel course-completion-panel">
          <div className="panel-heading">
            <div>
              <h2>Course by course</h2>
              <p>A clearer view of your finish lines.</p>
            </div>
            <Target size={21} />
          </div>
          {data.courses.length ? (
            data.courses
              .filter((c) => c.status !== "archived")
              .map((c) => (
                <div className="completion-row" key={c.id}>
                  <div>
                    <span>{c.title}</span>
                    <strong>{completion(c)}%</strong>
                  </div>
                  <Progress value={completion(c)} />
                </div>
              ))
          ) : (
            <div className="small-empty">
              <BookOpen size={27} />
              <p>Course progress will appear as you learn.</p>
            </div>
          )}
        </section>
        <section className="panel insights-panel">
          <span className="goal-icon">
            <TrendingUp size={23} />
          </span>
          <h2>Find your rhythm.</h2>
          <p>
            {best && best[1] > 0
              ? `${best[0]} is your most active learning day. Keep making space for what works for you.`
              : "Your best learning rhythm is the one that fits your life. Start small, and keep coming back."}
          </p>
          <div>
            <CalendarDays size={15} />
            {
              activity.filter(
                (a) => a.active_seconds > 0 || a.videos_completed > 0,
              ).length
            }{" "}
            active learning days in this period
          </div>
          <div>
            <Clock3 size={15} />
            Timezone: {data.profile.timezone}
          </div>
        </section>
      </div>
    </>
  );
}
