"use client";

import type { TableContent } from "@/types";

interface TableCardContentProps {
  content: TableContent;
}

export function TableCardContent({ content }: TableCardContentProps) {
  const { title, columns, rows, summary } = content;

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
          {title}
        </h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary && (
        <p className="text-sm text-neutral-500 text-right">{summary}</p>
      )}
    </div>
  );
}
