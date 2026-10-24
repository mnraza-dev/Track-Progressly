"use client";
import { useMemo, useState } from "react";
import { Box, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { dailySeries } from "@/lib/analytics";
import { learningTime, localDay } from "@/lib/utils";
import { SceneArtwork } from "@/components/three/scene-provider";
import type { Activity } from "@/types";

export function LearningLandscape({
  activity,
  timezone,
}: {
  activity: Activity[];
  timezone: string;
}) {
  const [selected, setSelected] = useState(6);
  const [metric, setMetric] = useState<"minutes" | "videos">("minutes");
  const today = localDay(new Date(), timezone);
  const days = useMemo(() => dailySeries(activity, today), [activity, today]);
  const values = useMemo(() => days.map((day) => day[metric]), [days, metric]);
  const current = days[selected];
  const total = values.reduce((n, v) => n + v, 0);
  return (
    <section
      className="panel landscape-panel"
      aria-labelledby="landscape-title"
    >
      <div className="landscape-heading">
        <div>
          <span className="section-index">A DIFFERENT PERSPECTIVE</span>
          <h2 id="landscape-title">Your week, in dimension.</h2>
        </div>
        <Box size={19} aria-hidden="true" />
      </div>
      <div className="landscape-body">
        <div className="landscape-copy">
          <span className="landscape-period">LAST 7 DAYS</span>
          <strong>
            {metric === "minutes" ? learningTime(total, true) : total}
            <span>
              {metric === "minutes" ? "of focus" : "lessons completed"}
            </span>
          </strong>
          <p>Each column is a day you made space for learning.</p>
          <div className="landscape-metrics" aria-label="3D timeline metric">
            <button
              onClick={() => setMetric("minutes")}
              aria-pressed={metric === "minutes"}
            >
              Learning time
            </button>
            <button
              onClick={() => setMetric("videos")}
              aria-pressed={metric === "videos"}
            >
              Lessons
            </button>
          </div>
          <Link href="/goals">
            Make room for tomorrow <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="landscape-visual">
          <SceneArtwork
            kind="timeline"
            values={values}
            selected={selected}
            interactive
            label={`Interactive learning timeline. ${metric === "minutes" ? learningTime(total) : `${total} lessons`} in the last seven days. Drag or use arrow keys to rotate.`}
          />
          <span className="landscape-hint">
            DRAG TO EXPLORE · SELECT A DAY BELOW
          </span>
        </div>
      </div>
      <div className="landscape-days" aria-label="Timeline days">
        {days.map((day, index) => (
          <button
            key={day.day}
            onClick={() => setSelected(index)}
            aria-pressed={selected === index}
            aria-label={`${day.label}: ${metric === "minutes" ? learningTime(day[metric]) : `${day[metric]} lessons`}`}
          >
            <span>{day.name}</span>
            <strong>
              {metric === "minutes"
                ? learningTime(day[metric], true)
                : day[metric]}
            </strong>
            <i />
          </button>
        ))}
      </div>
      <div className="landscape-footer" aria-live="polite">
        <span>{current.label}</span>
        <strong>
          {metric === "minutes"
            ? learningTime(current[metric])
            : `${current[metric]} lessons`}
        </strong>
        <span>Heights relative to this week’s maximum</span>
      </div>
    </section>
  );
}
