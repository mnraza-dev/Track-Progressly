"use client";
import { learningTime } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ArrowUpRight, BookOpen } from "lucide-react";
import {
  courseBreakdown,
  lessonDistribution,
  lessonSegments,
  weekdayData,
} from "@/lib/analytics";
import { chartTooltipStyle } from "./activity-chart";
import type { Activity, Course } from "@/types";

export function LearningMix({ courses }: { courses: Course[] }) {
  const distribution = lessonDistribution(courses);
  const total = distribution.reduce((n, row) => n + row.value, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const current = distribution.find((row) => row.key === selected);
  return (
    <section
      className="panel learning-mix-panel"
      aria-labelledby="learning-mix-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="learning-mix-title">Lesson status</h2>
        </div>
        <BookOpen size={19} />
      </div>
      <div className="donut-wrap" data-chart="lesson-distribution">
        <ResponsiveContainer width="100%" height={230} minWidth={0}>
          <PieChart>
            <Pie
              data={
                total
                  ? distribution.filter((row) => row.value > 0)
                  : [
                      {
                        key: "empty",
                        name: "No lessons yet",
                        value: 1,
                        color: "var(--border)",
                      },
                    ]
              }
              dataKey="value"
              nameKey="name"
              innerRadius={77}
              outerRadius={98}
              paddingAngle={total ? 3 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onClick={(row) =>
                total > 0 &&
                typeof row.key === "string" &&
                setSelected(selected === row.key ? null : row.key)
              }
            >
              {(total
                ? distribution.filter((row) => row.value > 0)
                : [{ key: "empty", color: "var(--border)" }]
              ).map((row) => (
                <Cell
                  key={row.key}
                  fill={row.color}
                  opacity={selected && selected !== row.key ? 0.3 : 1}
                />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value) => [`${value} lessons`]}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-live="polite">
          <strong>{current ? current.value : total}</strong>
          <span>{current ? current.name : "available lessons"}</span>
        </div>
      </div>
      <div className="mix-legend">
        {distribution.map((row) => (
          <button
            key={row.key}
            aria-pressed={selected === row.key}
            onClick={() => setSelected(selected === row.key ? null : row.key)}
          >
            <i style={{ background: row.color }} />
            <span>{row.name}</span>
            <strong>{row.value}</strong>
            <small>{total ? Math.round((row.value / total) * 100) : 0}%</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CourseComparison({ courses }: { courses: Course[] }) {
  const rows = courseBreakdown(courses);
  return (
    <section className="panel comparison-panel">
      <div className="panel-heading">
        <div>
          <span className="section-index">YOUR FINISH LINES</span>
          <h2>Course by course</h2>
          <p>Available lessons, split by their current status.</p>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="comparison-legend">
            {lessonSegments.map((segment) => (
              <span key={segment.key}>
                <i style={{ background: segment.color }} />
                {segment.name}
              </span>
            ))}
          </div>
          <div
            className="chart-plot"
            data-chart="course-comparison"
            style={{ height: Math.max(160, rows.length * 58 + 36) }}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                layout="vertical"
                data={rows}
                margin={{ left: 0, right: 12, bottom: 0, top: 6 }}
                barSize={17}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--border)"
                  strokeDasharray="2 5"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={105}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(name: string) =>
                    name.length > 16 ? `${name.slice(0, 15)}…` : name
                  }
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  cursor={{
                    fill: "color-mix(in srgb, var(--chart-1) 5%, transparent)",
                  }}
                  formatter={(value, name) => [`${value} lessons`, name]}
                />
                {lessonSegments.map((segment) => (
                  <Bar
                    key={segment.key}
                    dataKey={segment.key}
                    name={segment.name}
                    fill={segment.color}
                    stackId="lessons"
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="course-chart-links">
            {rows.map((row) => (
              <Link key={row.id} href={`/courses/${row.id}`}>
                <span>{row.name}</span>
                <strong>
                  {row.total
                    ? Math.round((row.completed / row.total) * 100)
                    : 0}
                  %
                </strong>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
          <details className="chart-data">
            <summary>View course data</summary>
            <div className="chart-table-scroll">
              <table>
                <caption>Available lessons in each course</caption>
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    {lessonSegments.map((segment) => (
                      <th scope="col" key={segment.key}>
                        {segment.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.name}</th>
                      {lessonSegments.map((segment) => (
                        <td key={segment.key}>{row[segment.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="chart-placeholder">
          <BookOpen size={27} />
          <p>Your courses will appear here as you add them.</p>
          <Link href="/courses/new">
            Add a course <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}

export function WeekdayRhythm({ activity }: { activity: Activity[] }) {
  const rows = weekdayData(activity);
  const maximum = Math.max(...rows.map((row) => row.minutes));
  return (
    <section className="panel rhythm-panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly rhythm</h2>
        </div>
      </div>
      <div
        className="chart-plot"
        data-chart="weekday-rhythm"
        style={{ height: 220 }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={rows}
            margin={{ top: 10, right: 8, left: 0, bottom: 8 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="2 5"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              dy={8}
            />
            <YAxis
              width={48}
              allowDecimals={false}
              tickFormatter={(value) => learningTime(Number(value), true)}
              axisLine={false}
              tickLine={false}
              domain={[0, maximum ? "auto" : 60]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value) => [learningTime(Number(value)), "Learning"]}
              cursor={{
                fill: "color-mix(in srgb, var(--chart-2) 5%, transparent)",
              }}
            />
            <Bar
              dataKey="minutes"
              radius={[5, 5, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell
                  key={row.name}
                  fill={
                    maximum > 0 && row.minutes === maximum
                      ? "var(--chart-2)"
                      : "var(--chart-4)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>View weekday data</summary>
        <table>
          <caption>Total learning time by weekday</caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{learningTime(row.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
