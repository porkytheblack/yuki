"use client";

import { AlertCircle } from "lucide-react";
import type { TextContent } from "@/types";

interface TextCardContentProps {
  content: TextContent;
}

export function TextCardContent({ content }: TextCardContentProps) {
  const { body, is_error } = content;

  return (
    <div
      className={`
        ${is_error ? "text-error" : "text-neutral-700 dark:text-neutral-300"}
      `}
    >
      {is_error && (
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-error" />
          <span className="font-medium text-error">Error</span>
        </div>
      )}
      <p className="leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}
