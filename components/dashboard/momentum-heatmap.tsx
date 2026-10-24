"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { learningTime, localDay } from "@/lib/utils";
import type { Activity } from "@/types";

const DAY = 86_400_000;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});
const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function MomentumHeatmap({
  activity,
  timezone,
  dailyGoal,
  now,
}: {
  activity: Activity[];
  timezone: string;
  dailyGoal: number;
  now: Date;
}) {
  const today = localDay(now, timezone);
  const [selected, setSelected] = useState(today);
  const scroll = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const { weeks, firstDay, activeDays } = useMemo(() => {
    const end = new Date(`${today}T12:00:00Z`).getTime();
    const first = end - 364 * DAY;
    const start = first - new Date(first).getUTCDay() * DAY;
    const byDay = new Map(activity.map((row) => [row.day, row]));
    let activeDays = 0;
    const weeks = Array.from(
      { length: Math.floor((end - start) / (7 * DAY)) + 1 },
      (_, week) => {
        return weekdays.map((_, day) => {
          const time = start + (week * 7 + day) * DAY;
          const date = new Date(time);
          const key = date.toISOString().slice(0, 10);
          const row = byDay.get(key);
          const available = time >= first && time <= end;
          const seconds = Math.max(0, row?.active_seconds || 0);
          const lessons = row?.videos_completed || 0;
          const practice = row?.practice_completed || 0;
          const active =
            seconds > 0 ||
            lessons > 0 ||
            practice > 0 ||
            (row?.courses_completed || 0) > 0;
          const ratio = seconds / (Math.max(1, dailyGoal) * 60);
          const level = !active
            ? 0
            : ratio >= 1
              ? 4
              : ratio >= 0.5
                ? 3
                : ratio >= 0.25
                  ? 2
                  : 1;
          if (available && active) activeDays++;
          return { date, key, available, seconds, lessons, practice, level };
        });
      },
    );
    return {
      weeks,
      firstDay: new Date(first).toISOString().slice(0, 10),
      activeDays,
    };
  }, [activity, today, dailyGoal]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, []);

  const current = weeks
    .flat()
    .find((day) => day.key === selected && day.available);
  const details = current
    ? `${dateFormat.format(current.date)} · ${learningTime(current.seconds / 60, true)} focused${current.lessons ? ` · ${current.lessons} lesson${current.lessons === 1 ? "" : "s"}` : ""}${current.practice ? ` · ${current.practice} practice task${current.practice === 1 ? "" : "s"}` : ""}`
    : "Select a day to see your activity.";

  return (
    <section
      className="panel momentum-panel"
      data-tour="weekly-consistency"
      aria-labelledby="momentum-title"
    >
      <div className="momentum-heading">
        <h2 id="momentum-title">Learning momentum</h2>
        <span>{activeDays} active days · past year</span>
      </div>
      <div className="momentum-scroll" ref={scroll}>
        <table
          className="momentum-grid"
          aria-label="Daily learning activity over the past year"
        >
          <thead>
            <tr>
              <td />
              {weeks.map((week, index) => (
                <th key={week[0].key} className="momentum-month" scope="col">
                  <span>
                    {(index === 0
                      ? weeks[1]?.[0].date.getUTCMonth() ===
                        week[0].date.getUTCMonth()
                      : week[0].date.getUTCMonth() !==
                        weeks[index - 1][0].date.getUTCMonth()) &&
                    index < weeks.length - 1
                      ? monthFormat.format(week[0].date)
                      : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((name, row) => (
              <tr key={name}>
                <th scope="row" className="momentum-weekday">
                  <span className={row % 2 === 0 ? "sr-only" : undefined}>
                    {name}
                  </span>
                </th>
                {weeks.map((week) => {
                  const day = week[row];
                  const label = `${dateFormat.format(day.date)}: ${learningTime(day.seconds / 60)}, ${day.lessons} lessons completed, ${day.practice} practice tasks completed`;
                  return (
                    <td key={day.key}>
                      {day.available && (
                        <button
                          type="button"
                          className="momentum-cell"
                          data-level={day.level}
                          aria-label={label}
                          title={label}
                          aria-pressed={selected === day.key}
                          aria-current={day.key === today ? "date" : undefined}
                          tabIndex={selected === day.key ? 0 : -1}
                          ref={(element) => {
                            if (element) buttons.current.set(day.key, element);
                            else buttons.current.delete(day.key);
                          }}
                          onClick={() => setSelected(day.key)}
                          onFocus={() => setSelected(day.key)}
                          onKeyDown={(event) => {
                            const offsets: Record<string, number> = {
                              ArrowLeft: -7,
                              ArrowRight: 7,
                              ArrowUp: -1,
                              ArrowDown: 1,
                            };
                            if (
                              !(event.key in offsets) &&
                              event.key !== "Home" &&
                              event.key !== "End"
                            )
                              return;
                            event.preventDefault();
                            const next =
                              event.key === "Home"
                                ? firstDay
                                : event.key === "End"
                                  ? today
                                  : new Date(
                                      day.date.getTime() +
                                        offsets[event.key] * DAY,
                                    )
                                      .toISOString()
                                      .slice(0, 10);
                            if (next < firstDay || next > today) return;
                            const button = buttons.current.get(next);
                            button?.focus({ preventScroll: true });
                            button?.scrollIntoView({
                              block: "nearest",
                              inline: "nearest",
                            });
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="momentum-footer">
        <p role="status" aria-live="polite">
          {details}
        </p>
        <div
          className="momentum-legend"
          aria-label="Activity intensity: empty cells mean no activity; brighter cells mean more progress toward your daily goal"
        >
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i
              key={level}
              className="momentum-cell"
              data-level={level}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
