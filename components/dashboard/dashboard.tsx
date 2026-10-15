"use client";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CircleCheck,
  Clock3,
  Flame,
  ChevronDown,
  Play,
  Link2,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/stores/workspace";
import { completion, duration, streak, localDay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCard, CourseArtwork } from "@/components/courses/course-card";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { LearningLandscape } from "@/components/analytics/learning-landscape";
import { LearningMix } from "@/components/analytics/progress-charts";
import { dailySeries } from "@/lib/analytics";
import { isConnected } from "@/lib/supabase/client";
import { SceneArtwork } from "@/components/three/scene-provider";
import { ProductStage } from "@/components/three/product-stage";
export function Dashboard() {
  const { data } = useWorkspace();
  const router = useRouter();
  const [period, setPeriod] = useState(7);
  const [now] = useState(() => new Date());
  const [link, setLink] = useState("");
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
  const days = streak(activity, profile.timezone);
  const today = activity.find(
    (a) => a.day === localDay(new Date(), profile.timezone),
  );
  const todayMinutes = Math.floor((today?.active_seconds || 0) / 60);
  const dailyGoal =
    data.goals.find((g) => g.goal_type === "daily_minutes")?.target_value ||
    profile.daily_minutes;
  return (
    <div className="dashboard-studio">
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
          <p>Everything you’re learning, all in one place.</p>
        </div>
        <div className="heading-actions">
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
      <section className="dashboard-hero">
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
      <section className="stats-grid">
        <Stat
          icon={<BookOpen size={18} />}
          label="Courses in progress"
          value={courses.filter((c) => c.status === "in_progress").length}
          color="purple"
          detail={`${courses.filter((c) => c.status !== "archived").length} in your personal library`}
          index="01"
        />
        <Stat
          icon={<CircleCheck size={18} />}
          label="Lessons completed"
          value={videoCount}
          color="green"
          detail={
            done
              ? `${done} ${done === 1 ? "course" : "courses"} finished`
              : "One lesson at a time"
          }
          index="02"
        />
        <Stat
          icon={<Clock3 size={18} />}
          label="Time invested"
          value={seconds ? duration(seconds) : "0h"}
          color="blue"
          detail="Time spent actually learning"
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
          detail={days ? "Keep the momentum" : "Your next session is day one"}
          index="04"
        />
      </section>
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
              label="A stack of sculptural books in ink, violet, and chartreuse"
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
      <div className="learning-perspective-grid">
        <LearningLandscape activity={activity} timezone={profile.timezone} />
        <LearningMix courses={courses} />
      </div>
      <div className="section-heading explore-heading">
        <div>
          <span className="section-index">ROOM FOR SOMETHING NEW</span>
          <h2>
            Follow your curiosity<span className="serif-arrow">↗</span>
          </h2>
          <p>Three directions. Endless things to make.</p>
        </div>
        <span className="explore-label">LEARNING HAS NO FINISH LINE.</span>
      </div>
      <div className="inspiration-grid">
        {[
          {
            category: "Development",
            title: "Build for the web.",
            subtitle: "Interfaces, components, and ideas that work.",
            path: "Development",
            number: "01",
          },
          {
            category: "Data & Python",
            title: "Think in possibilities.",
            subtitle: "Patterns to discover. Problems to solve.",
            path: "Data & Python",
            number: "02",
          },
          {
            category: "Design",
            title: "Make it mean something.",
            subtitle: "Shape, form, and a different point of view.",
            path: "Design",
            number: "03",
          },
        ].map((c) => (
          <Link
            key={c.category}
            href={`/courses/new?category=${encodeURIComponent(c.path)}`}
            className="inspiration-card"
          >
            <CourseArtwork category={c.category} />
            <div>
              <span className="tiny-label">
                {c.number} / {c.category}
              </span>
              <h3>{c.title}</h3>
              <p>{c.subtitle}</p>
              <span className="inspiration-arrow">
                <ArrowUpRight size={19} />
              </span>
            </div>
          </Link>
        ))}
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
    <Card className="stat-card">
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
