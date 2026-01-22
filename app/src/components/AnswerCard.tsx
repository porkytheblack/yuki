"use client";

import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { TextCardContent } from "./cards/TextCardContent";
import { ChartCardContent } from "./cards/ChartCardContent";
import { TableCardContent } from "./cards/TableCardContent";
import { MixedCardContent } from "./cards/MixedCardContent";
import type { ResponseCard } from "@/types";

function CardContent({ card }: { card: ResponseCard }) {
  switch (card.type) {
    case "text":
      return <TextCardContent content={card.content} />;
    case "chart":
      return <ChartCardContent content={card.content} />;
    case "table":
      return <TableCardContent content={card.content} />;
    case "mixed":
      return <MixedCardContent content={card.content} />;
    default:
      return null;
  }
}

export function AnswerCard() {
  const {
    currentResponse,
    currentCardIndex,
    nextCard,
    prevCard,
    chatHistory,
    historyIndex,
    navigateHistory,
    isLoading,
    isAnalyzing,
    processingMessage,
  } = useAppStore();

  // Show loading state
  if (isLoading || isAnalyzing) {
    return (
      <div className="w-full min-h-[200px] bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 p-6 flex items-center justify-center shadow-md shadow-neutral-200/50 dark:shadow-neutral-900/50">
        <div className="text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-3 text-neutral-400 animate-spin" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {processingMessage || (isAnalyzing ? "Processing document..." : "Thinking...")}
          </p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!currentResponse || currentResponse.cards.length === 0) {
    return (
      <div className="w-full min-h-[200px] bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 p-6 flex items-center justify-center shadow-md shadow-neutral-200/50 dark:shadow-neutral-900/50">
        <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center max-w-sm">
          Ask Yuki a question about your finances, or drop a document to get started.
        </p>
      </div>
    );
  }

  const currentCard = currentResponse.cards[currentCardIndex];
  const hasMultipleCards = currentResponse.cards.length > 1;
  const hasHistory = chatHistory.length > 1;
  const canGoUp = historyIndex > 0;
  const canGoDown = historyIndex < chatHistory.length - 1;

  return (
    <div className="w-full bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 overflow-hidden shadow-md shadow-neutral-200/50 dark:shadow-neutral-900/50">
      {/* Card content */}
      <div className="p-6 min-h-[200px]">
        <CardContent card={currentCard} />
      </div>

      {/* Navigation */}
      {(hasMultipleCards || hasHistory) && (
        <div className="px-6 py-3 border-t border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-between">
          {/* Card navigation (Prev/Next) */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevCard}
              disabled={currentCardIndex === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous card"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            {hasMultipleCards && (
              <span className="text-xs text-neutral-400">
                {currentCardIndex + 1} / {currentResponse.cards.length}
              </span>
            )}
            <button
              onClick={nextCard}
              disabled={currentCardIndex === currentResponse.cards.length - 1}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next card"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* History navigation (Up/Down) */}
          {hasHistory && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateHistory("up")}
                disabled={!canGoUp}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous question"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigateHistory("down")}
                disabled={!canGoDown}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next question"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
