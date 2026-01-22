"use client";

import { ChartCardContent } from "./ChartCardContent";
import type { MixedContent } from "@/types";

interface MixedCardContentProps {
  content: MixedContent;
}

export function MixedCardContent({ content }: MixedCardContentProps) {
  const { body, chart } = content;

  return (
    <div className="space-y-6">
      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
        {body}
      </p>
      <ChartCardContent content={chart} />
    </div>
  );
}
