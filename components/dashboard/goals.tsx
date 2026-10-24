"use client";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Target,
  Clock,
  Play,
  Check,
  Trash2,
  Flame,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import {
  learningTime,
  localDay,
  streak,
  longestStreak,
  completion,
} from "@/lib/utils";
import { subDays, format } from "date-fns";
import { SceneArtwork } from "@/components/three/scene-provider";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { createId } from "@/lib/id";
import { WorkspaceDialog as Dialog } from "@/components/ui/workspace-dialog";
export function Goals() {
  const { data, mutate, notify } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<
    "daily_minutes" | "daily_videos" | "weekly_minutes"
  >("daily_minutes");
  const [value, setValue] = useState(30);
  const today = localDay(new Date(), data.profile.timezone);
  const todayData = data.activity.find((a) => a.day === today);
  const week = data.activity.filter(
    (a) =>
      a.day >= format(subDays(new Date(`${today}T12:00:00Z`), 6), "yyyy-MM-dd"),
  );
  const currentStreak = streak(
    data.activity,
    data.profile.timezone,
    data.profile.weekend_rest,
  );
  const weekMinutes = Math.floor(
    week
      .filter((row) => row.day <= today)
      .reduce((n, row) => n + row.active_seconds, 0) / 60,
  );
  const goalRings = useMemo(
    () =>
      data.goals.slice(0, 3).map((goal) => {
        const actual =
          goal.goal_type === "daily_videos"
            ? todayData?.videos_completed || 0
            : goal.goal_type === "daily_minutes"
              ? (todayData?.active_seconds || 0) / 60
              : weekMinutes;
        return actual / goal.target_value;
      }),
    [data.goals, todayData, weekMinutes],
  );
  const dailyTarget =
    data.goals.find((g) => g.goal_type === "daily_minutes")?.target_value ||
    data.profile.daily_minutes;
  const labels = {
    daily_minutes: "Daily learning time",
    daily_videos: "Daily lesson target",
    weekly_minutes: "Weekly learning time",
  };
  const deadlines = data.courses.filter(
    (c) => c.target_completion_date && c.status !== "archived",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SMALL INTENTIONS. LASTING HABITS.</span>
          <h1>Learning goals</h1>
          <p>
            Make a little room for learning. Your future self will thank you.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Set a goal
        </Button>
      </div>
      <div className="goal-overview">
        <SceneArtwork
          kind="rings"
          values={goalRings}
          className="goal-overview-art"
          label={`Progress toward your first three learning goals: ${goalRings.length ? goalRings.map((value) => `${Math.round(Math.min(1, value) * 100)} percent`).join(", ") : "no goals set yet"}`}
        />
        <div>
          <span className="stat-icon orange">
            <Flame size={22} />
          </span>
          <div>
            <strong>
              {currentStreak}
              <span> day streak</span>
            </strong>
            <p>
              {currentStreak
                ? "Keep showing up. It adds up."
                : "Your next session can be day one."}
            </p>
            <small className="streak-best">
              Personal best: {longestStreak(data.activity)} days
            </small>
          </div>
        </div>
        <div>
          <span className="stat-icon purple">
            <Clock size={22} />
          </span>
          <div>
            <strong>
              {learningTime(weekMinutes)}
              <span> this week</span>
            </strong>
            <p>Time invested in the person you’re becoming.</p>
          </div>
        </div>
      </div>
      {data.goals.length ? (
        <div className="goal-cards">
          {data.goals.map((g) => {
            const actual =
              g.goal_type === "daily_videos"
                ? todayData?.videos_completed || 0
                : g.goal_type === "daily_minutes"
                  ? Math.floor((todayData?.active_seconds || 0) / 60)
                  : weekMinutes;
            const met = actual >= g.target_value;
            return (
              <section key={g.id} className="panel goal-card">
                <div className="panel-heading">
                  <span className="goal-icon">
                    {g.goal_type === "daily_videos" ? (
                      <Play size={21} />
                    ) : (
                      <Target size={21} />
                    )}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Delete goal"
                    onClick={() => void mutate({ op: "delete_goal", id: g.id })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <h3>{labels[g.goal_type]}</h3>
                <p>
                  {g.goal_type === "weekly_minutes"
                    ? "A little progress across seven days."
                    : "An intention for today, and every day."}
                </p>
                <div className="goal-card-numbers">
                  <strong>
                    {g.goal_type === "daily_videos"
                      ? actual
                      : learningTime(actual)}
                    <span>
                      {" "}
                      /{" "}
                      {g.goal_type === "daily_videos"
                        ? g.target_value
                        : learningTime(g.target_value)}
                    </span>
                  </strong>
                  <span>
                    {g.goal_type === "daily_videos"
                      ? "lessons"
                      : "learning time"}
                  </span>
                </div>
                <Progress value={(actual / g.target_value) * 100} />
                <div className="goal-card-footer">
                  {met ? (
                    <>
                      <Check size={15} />
                      Goal met. Celebrate that!
                    </>
                  ) : (
                    <>
                      <Clock size={14} />
                      {g.goal_type === "daily_videos"
                        ? `${g.target_value - actual} lessons`
                        : learningTime(g.target_value - actual)}{" "}
                      to go
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="goal-empty panel">
          <SceneArtwork
            kind="goal"
            className="goal-empty-scene"
            label="A three-dimensional learning goal waiting to be filled"
          />
          <div>
            <h2>A habit starts with an intention.</h2>
            <p>
              Set a realistic daily or weekly goal. A few minutes is a great
              place to start.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            Set your first goal
          </Button>
        </div>
      )}
      <section className="panel weekly-goal-chart">
        <div className="panel-heading">
          <div>
            <span className="section-index">
              PROGRESS AGAINST YOUR INTENTION
            </span>
            <h2>A little more consistent</h2>
            <p>
              Your last seven days, with your {dailyTarget}-minute daily target.
            </p>
          </div>
          <Target size={21} />
        </div>
        <ActivityChart
          activity={data.activity}
          timezone={data.profile.timezone}
          goal={dailyTarget}
          height={250}
        />
      </section>
      <section className="panel calendar-panel">
        <div className="panel-heading">
          <div>
            <h2>Every day is a new opportunity</h2>
            <p>Your learning calendar · last 12 weeks</p>
          </div>
          <CalendarDays size={22} />
        </div>
        <div className="activity-calendar">
          {Array.from({ length: 84 }, (_, i) => {
            const d = format(
              subDays(new Date(`${today}T12:00:00Z`), 83 - i),
              "yyyy-MM-dd",
            );
            const row = data.activity.find((a) => a.day === d);
            const minutes = Math.floor((row?.active_seconds || 0) / 60);
            return (
              <div
                key={d}
                className={`calendar-cell level-${minutes >= 60 ? 4 : minutes >= 30 ? 3 : minutes > 0 ? 2 : row?.videos_completed ? 1 : 0}`}
                title={`${d}: ${learningTime(minutes)}, ${row?.videos_completed || 0} lessons completed`}
              />
            );
          })}
        </div>
        <div className="calendar-footer">
          <span>Showing up counts.</span>
          <span>
            Less
            <i className="calendar-cell level-0" />
            <i className="calendar-cell level-2" />
            <i className="calendar-cell level-4" />
            More
          </span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Course milestones</h2>
          <p>Give your next finish line a date.</p>
        </div>
        <Link href="/courses" className="text-link">
          Manage courses
          <ArrowUpRight size={15} />
        </Link>
      </div>
      {deadlines.length ? (
        <div className="milestone-list">
          {deadlines.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="panel milestone"
            >
              <span className="goal-icon">
                <Target size={19} />
              </span>
              <div>
                <h3>{c.title}</h3>
                <p>
                  Target:{" "}
                  {format(
                    new Date(`${c.target_completion_date}T12:00:00`),
                    "MMM d, yyyy",
                  )}
                </p>
              </div>
              <Progress value={completion(c)} />
              <strong>{completion(c)}%</strong>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel milestone-empty">
          <CalendarDays size={20} />
          <p>
            Add a target completion date in any course to see its milestone
            here.
          </p>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Make room for learning"
        description="Choose a goal you can return to consistently."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({
              op: "goal",
              id: createId(),
              goal_type: type,
              target_value: value,
            }).then(() => {
              setOpen(false);
              notify("A new intention. A new possibility. Goal added.");
            });
          }}
        >
          <label>
            What would you like to work toward?
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="daily_minutes">Daily learning minutes</option>
              <option value="daily_videos">Daily lessons completed</option>
              <option value="weekly_minutes">Weekly learning minutes</option>
            </select>
          </label>
          <label>
            Target {type === "daily_videos" ? "lessons" : "minutes"}
            <Input
              type="number"
              min={1}
              max={10080}
              required
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
          {type !== "daily_videos" && value >= 60 && (
            <p className="muted">Your target: {learningTime(value)}</p>
          )}
          <div className="info-banner">
            <Target size={16} />
            Consistency matters more than a big number.
          </div>
          <Button type="submit">
            <Plus size={16} />
            Set my goal
          </Button>
        </form>
      </Dialog>
    </>
  );
}
