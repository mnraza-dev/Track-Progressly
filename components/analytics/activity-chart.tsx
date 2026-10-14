"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { chartData } from "@/lib/analytics";
import { localDay } from "@/lib/utils";
import type { Activity } from "@/types";
export function ActivityChart({
  activity,
  timezone,
  days = 7,
  metric = "minutes",
}: {
  activity: Activity[];
  timezone: string;
  days?: number;
  metric?: "minutes" | "videos" | "practice" | "courses";
}) {
  const today = localDay(new Date(), timezone);
  const data = chartData(activity, today, days, metric);
  return (
    <div className="activity-chart">
      <ResponsiveContainer width="100%" height={190}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 4, left: -28, bottom: 0 }}
          barCategoryGap="32%"
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            dy={9}
            interval={
              data.length > 30
                ? Math.floor(data.length / 7)
                : data.length > 7
                  ? Math.floor(data.length / 6)
                  : 0
            }
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            allowDecimals={false}
            domain={[
              0,
              data.every((v) => !v.value)
                ? metric === "minutes"
                  ? 60
                  : 5
                : "auto",
            ]}
          />
          <Tooltip
            cursor={{ fill: "var(--purple-light)" }}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 12,
            }}
            formatter={(value) => [`${value} ${metric}`, "Learning"]}
          />
          <Bar
            dataKey="value"
            fill="#8b6bd6"
            radius={[5, 5, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
