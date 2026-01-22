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
      <div className="w-full min-h-[200px] bg-neutral-0 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary-500 animate-spin" />
          <p className="text-neutral-500">
            {processingMessage || (isAnalyzing ? "Processing document..." : "Thinking...")}
          </p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!currentResponse || currentResponse.cards.length === 0) {
    return (
      <div className="w-full min-h-[200px] bg-neutral-0 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 flex items-center justify-center">
        <p className="text-neutral-400 text-center">
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
    <div className="w-full bg-neutral-0 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Card content */}
      <div className="p-6 min-h-[200px]">
        <CardContent card={currentCard} />
      </div>

      {/* Navigation */}
      {(hasMultipleCards || hasHistory) && (
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          {/* Card navigation (Prev/Next) */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevCard}
              disabled={currentCardIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous card"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            {hasMultipleCards && (
              <span className="text-sm text-neutral-400">
                {currentCardIndex + 1} / {currentResponse.cards.length}
              </span>
            )}
            <button
              onClick={nextCard}
              disabled={currentCardIndex === currentResponse.cards.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next card"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* History navigation (Up/Down) */}
          {hasHistory && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateHistory("up")}
                disabled={!canGoUp}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous question"
              >
                <ChevronUp className="w-4 h-4" />
                Up
              </button>
              <button
                onClick={() => navigateHistory("down")}
                disabled={!canGoDown}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next question"
              >
                Down
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
