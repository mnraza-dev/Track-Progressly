"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CircleCheck,
  Clock3,
  Flame,
  Target,
  ChevronDown,
  Play,
  Sparkles,
  SquarePlay as Youtube,
  Link2,
  Check,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/stores/workspace";
import { completion, duration, streak, localDay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CourseCard, CourseArtwork } from "@/components/courses/course-card";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { isConnected } from "@/lib/supabase/client";
export function Dashboard() {
  const { data } = useWorkspace();
  const [period, setPeriod] = useState(7);
  const [now] = useState(() => new Date());
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
  const completedAvailableCount = courses
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
  const days = streak(activity, profile.timezone);
  const today = activity.find(
    (a) => a.day === localDay(new Date(), profile.timezone),
  );
  const todayMinutes = Math.floor((today?.active_seconds || 0) / 60);
  const dailyGoal =
    data.goals.find((g) => g.goal_type === "daily_minutes")?.target_value ||
    profile.daily_minutes;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            YOUR LEARNING, A LITTLE MORE INTENTIONAL
          </div>
          <h1>
            {profile.display_name
              ? `Welcome back, ${profile.display_name.split(" ")[0]}`
              : "A good day to learn"}{" "}
            <span className="wave">✺</span>
          </h1>
          <p>Pick up where you left off. One small step is all it takes.</p>
        </div>
        <div className="heading-actions">
          <span className="date-label">
            {format(new Date(), "EEEE, MMM d")}
          </span>
          <Button asChild>
            <Link href="/courses/new">
              <Plus size={17} />
              Add course
            </Link>
          </Button>
        </div>
      </div>
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            BUILD A HABIT. OPEN A POSSIBILITY.
          </span>
          <h2>
            Small steps.
            <br />
            Extraordinary progress.
          </h2>
          <p>
            You bring the curiosity. We’ll help you turn
            <br className="desktop-break" /> your saved tutorials into skills
            that stay.
          </p>
          <Button asChild>
            <Link href={active.length ? "/continue" : "/courses/new"}>
              <Play size={15} fill="currentColor" />
              {active.length
                ? "Let’s keep learning"
                : "Start your learning journey"}
              <ArrowRight size={16} />
            </Link>
          </Button>
          <span className="hero-footnote">
            <Check size={13} />
            Your pace. Your path. Always free.
          </span>
        </div>
        <div className="hero-art">
          <Image
            width={450}
            height={250}
            src="/artwork/learning.svg"
            alt="A video lesson, a stack of books, and a little progress"
          />
          <span className="hero-art-label">
            <Sparkles size={12} />A little wiser, every day.
          </span>
        </div>
      </section>
      <section className="stats-grid">
        <Stat
          icon={<BookOpen size={19} />}
          label="Courses in progress"
          value={courses.filter((c) => c.status === "in_progress").length}
          color="purple"
          detail={`${courses.filter((c) => c.status !== "archived").length} courses in your library`}
        />
        <Stat
          icon={<CircleCheck size={19} />}
          label="Lessons completed"
          value={videoCount}
          color="green"
          detail={
            done
              ? `${done} ${done === 1 ? "course" : "courses"} completed. Keep it up!`
              : "Every lesson is a step forward"
          }
        />
        <Stat
          icon={<Clock3 size={19} />}
          label="Time well spent"
          value={seconds ? duration(seconds) : "0h"}
          color="blue"
          detail="Real time invested in yourself"
        />
        <Stat
          icon={<Flame size={19} />}
          label="Current streak"
          value={
            <>
              {days}
              <small> {days === 1 ? "day" : "days"}</small>
            </>
          }
          color="orange"
          detail={
            days
              ? "Look at you showing up!"
              : "Your next session starts a streak"
          }
        />
      </section>
      <div className="section-heading">
        <div>
          <h2>
            Continue learning{" "}
            <span className="count-pill">{active.length}</span>
          </h2>
          <p>
            {availableCount
              ? `${Math.round((completedAvailableCount / availableCount) * 100)}% of your learning library completed. Keep your momentum.`
              : "A little momentum goes a long way."}
          </p>
        </div>
        <Link href="/courses" className="text-link">
          View all courses <ArrowRight size={15} />
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
            <span className="video-stack video-stack-back" />
            <span className="video-stack">
              <Youtube size={37} strokeWidth={1.5} />
              <span />
              <span />
            </span>
            <span className="video-stack-plus">
              <Plus size={17} />
            </span>
          </div>
          <div className="start-course-copy">
            <span className="tiny-label">
              FROM “SAVED FOR LATER” TO “I DID IT”
            </span>
            <h3>Your next chapter starts here.</h3>
            <p>
              Bring a YouTube playlist or video. Keep your progress,
              <br className="desktop-break" /> notes, and practice together in
              one calm space.
            </p>
            <Link href="/courses/new" className="text-link">
              Add your first course <ArrowRight size={16} />
            </Link>
          </div>
          <div className="import-quick-card">
            <span>
              <Link2 size={16} />A link is all you need
            </span>
            <Link href="/courses/new" className="fake-input">
              youtube.com/playlist?list=...
              <ArrowUpRight size={16} />
            </Link>
            <p>
              <Check size={12} />
              No downloads. Just better learning.
            </p>
          </div>
        </div>
      )}
      <div className="dashboard-panels">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Learning activity</h2>
              <p>Your consistency, at a glance.</p>
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
                activity
                  .filter(
                    (a) =>
                      a.day >=
                      new Date(now.getTime() - period * 86400000)
                        .toISOString()
                        .slice(0, 10),
                  )
                  .reduce((n, a) => n + a.active_seconds, 0) / 60,
              )}{" "}
              <span>min</span>
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
              Your story starts with your first learning session.
            </div>
          )}
        </section>
        <section className="panel daily-goal-panel">
          <div className="panel-heading">
            <div>
              <h2>Your daily intention</h2>
              <p>Show up for your future self.</p>
            </div>
            <span className="goal-icon">
              <Target size={20} />
            </span>
          </div>
          <div className="goal-ring">
            <svg width="150" height="150" viewBox="0 0 150 150">
              <circle
                cx="75"
                cy="75"
                r="62"
                fill="none"
                stroke="var(--purple-light)"
                strokeWidth="9"
              />
              <circle
                cx="75"
                cy="75"
                r="62"
                fill="none"
                stroke="#8b6bd6"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(1, todayMinutes / dailyGoal) * 390} 390`}
                transform="rotate(-90 75 75)"
              />
            </svg>
            <div>
              <strong>
                {todayMinutes}
                <span> / {dailyGoal}</span>
              </strong>
              <small>minutes today</small>
            </div>
          </div>
          <div className="goal-encouragement">
            <Zap size={14} />
            {todayMinutes >= dailyGoal
              ? "Intention met. Celebrate that!"
              : "A little focus can make a big difference."}
          </div>
          <Link href="/goals" className="goal-edit-link">
            {data.goals.length ? "Manage your goals" : "Make it your goal"}
            <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="section-heading explore-heading">
        <div>
          <h2>
            Follow your curiosity <Sparkles size={17} />
          </h2>
          <p>A few directions your next chapter could take.</p>
        </div>
        <span className="explore-label">A WORLD OF POSSIBILITIES</span>
      </div>
      <div className="inspiration-grid">
        {[
          {
            category: "Development",
            title: "Build something for the web.",
            subtitle: "From your first component to your next big idea.",
            path: "Development",
          },
          {
            category: "Data & Python",
            title: "Find a new way to think.",
            subtitle: "Solve problems. Make sense of the possibilities.",
            path: "Data & Python",
          },
          {
            category: "Design",
            title: "Make good ideas feel great.",
            subtitle: "A little craft. A whole new perspective.",
            path: "Design",
          },
        ].map((c) => (
          <Link
            key={c.category}
            href={`/courses/new?category=${encodeURIComponent(c.path)}`}
            className="inspiration-card"
          >
            <CourseArtwork category={c.category} />
            <div>
              <span className="tiny-label">{c.category}</span>
              <h3>{c.title}</h3>
              <p>{c.subtitle}</p>
              <span className="inspiration-arrow">
                <ArrowUpRight size={17} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!isConnected && (
        <div className="local-mode-banner">
          <span className="local-dot" />
          <span>
            <strong>Your personal local workspace.</strong> Changes are saved in
            this browser. Connect Supabase for accounts and secure cloud sync.
          </span>
          <Link href="/settings">
            Workspace settings <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <div className="dashboard-bottom-note">
        <span>✳</span>Stop collecting tutorials. Start completing them.
      </div>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
  color,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <p>{detail}</p>
    </div>
  );
}
