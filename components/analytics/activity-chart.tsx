"use client";
import { useId, useState } from "react";
import { ChartArea, ChartColumn } from "lucide-react";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { chartData, type ActivityMetric } from "@/lib/analytics";
import { learningTime, localDay } from "@/lib/utils";
import type { Activity } from "@/types";

export const chartTooltipStyle = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px #161b1920",
};
export function ActivityChart({
  activity,
  timezone,
  days = 7,
  metric = "minutes",
  goal,
  height = 220,
}: {
  activity: Activity[];
  timezone: string;
  days?: number;
  metric?: ActivityMetric;
  goal?: number;
  height?: number;
}) {
  const [view, setView] = useState<"area" | "bar">("area");
  const gradient = `activity-${useId().replace(/:/g, "")}`;
  const data = chartData(
    activity,
    localDay(new Date(), timezone),
    days,
    metric,
  );
  const unit =
    metric === "videos" ? "lessons" : metric === "practice" ? "tasks" : metric;
  return (
    <div className="activity-chart chart-frame" data-chart="activity">
      <div className="chart-tools">
        <span>
          <i className="chart-key" />
          {unit === "minutes" ? "Active learning time" : `Completed ${unit}`}
        </span>
        <div className="chart-view-switch" aria-label="Activity chart view">
          <button
            aria-label="Show activity as an area chart"
            aria-pressed={view === "area"}
            onClick={() => setView("area")}
          >
            <ChartArea size={15} />
          </button>
          <button
            aria-label="Show activity as a bar chart"
            aria-pressed={view === "bar"}
            onClick={() => setView("bar")}
          >
            <ChartColumn size={15} />
          </button>
        </div>
      </div>
      <div className="chart-plot" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 15, right: 12, left: 0, bottom: 8 }}
            barCategoryGap="35%"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
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
              minTickGap={22}
            />
            <YAxis
              width={48}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              allowDecimals={false}
              tickFormatter={(value) =>
                metric === "minutes"
                  ? learningTime(Number(value), true)
                  : String(value)
              }
              domain={[
                0,
                data.every((v) => !v.value)
                  ? Math.max(goal || 0, metric === "minutes" ? 60 : 5)
                  : "auto",
              ]}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: "var(--foreground)", marginBottom: 5 }}
              cursor={
                view === "bar"
                  ? {
                      fill: "color-mix(in srgb, var(--chart-1) 8%, transparent)",
                    }
                  : { stroke: "var(--chart-1)", strokeDasharray: "3 4" }
              }
              labelFormatter={(_, payload) => payload[0]?.payload.label || ""}
              formatter={(value) => [
                metric === "minutes"
                  ? learningTime(Number(value))
                  : `${value} ${unit}`,
                "Learning",
              ]}
            />
            {goal && metric === "minutes" ? (
              <ReferenceLine
                y={goal}
                stroke="var(--chart-2)"
                strokeDasharray="5 5"
                ifOverflow="extendDomain"
                label={{
                  value: `Goal ${learningTime(goal)}`,
                  fill: "var(--chart-2)",
                  fontSize: 12,
                  position: "insideTopRight",
                }}
              />
            ) : null}
            {view === "area" ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                fill={`url(#${gradient})`}
                activeDot={{
                  r: 5,
                  fill: "var(--chart-1)",
                  stroke: "var(--surface)",
                  strokeWidth: 3,
                }}
                isAnimationActive={false}
              />
            ) : (
              <Bar
                dataKey="value"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>View chart data</summary>
        <div className="chart-table-scroll">
          <table>
            <caption>Learning activity in {timezone}</caption>
            <thead>
              <tr>
                <th scope="col">
                  {metric === "courses"
                    ? "Month"
                    : metric === "videos"
                      ? "Week starting"
                      : "Date"}
                </th>
                <th scope="col">
                  {metric === "minutes" ? "Learning time" : unit}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {metric === "minutes" ? learningTime(row.value) : row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
