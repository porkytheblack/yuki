"use client";

import { AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
      <div className="prose prose-neutral dark:prose-invert max-w-none prose-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Style overrides for markdown elements
            p: ({ children }) => (
              <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 list-disc list-inside space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal list-inside space-y-1">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-neutral-700 dark:text-neutral-300">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            code: ({ children }) => (
              <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-sm font-mono text-primary-600 dark:text-primary-400">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg overflow-x-auto mb-3 text-sm">
                {children}
              </pre>
            ),
            h1: ({ children }) => (
              <h1 className="text-xl font-semibold mb-3 text-neutral-900 dark:text-neutral-100">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
                {children}
              </h3>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary-500 pl-4 italic text-neutral-600 dark:text-neutral-400 mb-3">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-primary-600 dark:text-primary-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            hr: () => (
              <hr className="border-neutral-200 dark:border-neutral-700 my-4" />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-3">
                <table className="min-w-full border-collapse">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 text-left font-medium">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-2">
                {children}
              </td>
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
