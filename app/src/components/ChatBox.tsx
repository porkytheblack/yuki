"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { sendQuery } from "@/lib/llm";

interface ChatBoxProps {
  disabled?: boolean;
}

export function ChatBox({ disabled = false }: ChatBoxProps) {
  const [input, setInput] = useState("");
  const { isLoading, setIsLoading, setCurrentResponse, addToHistory, setError } =
    useAppStore();

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || disabled || isLoading) return;

    const question = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendQuery(question);
      setCurrentResponse(response);
      addToHistory({
        id: crypto.randomUUID(),
        question,
        sql_query: "", // Will be filled by the backend
        response,
        card_count: response.cards.length,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setCurrentResponse({
        cards: [
          {
            type: "text",
            content: {
              body: `Something went wrong: ${errorMessage}. Try rephrasing your question.`,
              is_error: true,
            },
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, disabled, isLoading, setIsLoading, setCurrentResponse, addToHistory, setError]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        placeholder={disabled ? "Processing document..." : "Ask Yuki here..."}
        className={`
          w-full px-4 py-3 pr-12
          bg-neutral-0 dark:bg-neutral-800
          border border-neutral-200 dark:border-neutral-700
          rounded-lg
          text-neutral-800 dark:text-neutral-100
          placeholder:text-neutral-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
        `}
        aria-label="Ask Yuki a question about your finances"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || isLoading || !input.trim()}
        className={`
          absolute right-2 top-1/2 -translate-y-1/2
          p-2 rounded-md
          text-neutral-500 hover:text-primary-600
          hover:bg-primary-50 dark:hover:bg-primary-900/20
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
          transition-colors duration-200
        `}
        aria-label="Send question"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
