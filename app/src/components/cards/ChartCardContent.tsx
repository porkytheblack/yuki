"use client";

import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ChartContent } from "@/types";

interface ChartCardContentProps {
  content: ChartContent;
}

// Color palette for charts
const COLORS = [
  "#3b82f6", // primary-500
  "#22c55e", // success
  "#f59e0b", // warning
  "#ef4444", // error
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export function ChartCardContent({ content }: ChartCardContentProps) {
  const { chart_type, title, data, caption } = content;

  const renderChart = () => {
    switch (chart_type) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ label, percent }) =>
                  `${label} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(value)
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fill: "#71717a" }} />
              <YAxis tick={{ fill: "#71717a" }} />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fill: "#71717a" }} />
              <YAxis tick={{ fill: "#71717a" }} />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fill: "#71717a" }} />
              <YAxis tick={{ fill: "#71717a" }} />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <p className="text-neutral-500">Unsupported chart type</p>;
    }
  };

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
          {title}
        </h3>
      )}
      {renderChart()}
      {caption && (
        <p className="text-sm text-neutral-500 text-center">{caption}</p>
      )}
    </div>
  );
}
