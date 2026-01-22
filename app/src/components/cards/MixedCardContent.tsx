"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartCardContent } from "./ChartCardContent";
import type { MixedContent, ChartContent } from "@/types";

interface MixedCardContentProps {
  content: MixedContent;
}

function isValidChartContent(chart: unknown): chart is ChartContent {
  if (!chart || typeof chart !== "object") return false;
  const c = chart as Record<string, unknown>;
  return (
    typeof c.chart_type === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.data)
  );
}

export function MixedCardContent({ content }: MixedCardContentProps) {
  if (!content) {
    return (
      <div className="text-neutral-500">
        Unable to display content
      </div>
    );
  }

  const { body, chart } = content;

  return (
    <div className="space-y-6">
      {body && (
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {body}
          </ReactMarkdown>
        </div>
      )}
      {isValidChartContent(chart) ? (
        <ChartCardContent content={chart} />
      ) : (
        <div className="text-neutral-500 text-sm">
          Chart data unavailable
        </div>
      )}
    </div>
  );
}
