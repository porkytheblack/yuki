import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendQuery, detectExpense } from "./llm";

// Mock __TAURI__ to not be defined (browser mode)
beforeEach(() => {
  vi.stubGlobal("window", { ...window });
  delete (window as unknown as Record<string, unknown>).__TAURI__;
});

describe("llm (browser mode)", () => {
  describe("sendQuery", () => {
    it("returns chart response for category-related questions", async () => {
      const response = await sendQuery("How much did I spend by category?");

      expect(response.cards).toHaveLength(1);
      expect(response.cards[0].type).toBe("chart");
      if (response.cards[0].type === "chart") {
        expect(response.cards[0].content.chart_type).toBe("pie");
        expect(response.cards[0].content.title).toBe("Spending by Category");
      }
    });

    it("returns line chart for trend questions", async () => {
      const response = await sendQuery("Show me my spending trend over time");

      expect(response.cards).toHaveLength(1);
      expect(response.cards[0].type).toBe("mixed");
    });

    it("returns table for transaction list questions", async () => {
      const response = await sendQuery("List my recent transactions");

      expect(response.cards).toHaveLength(1);
      expect(response.cards[0].type).toBe("table");
      if (response.cards[0].type === "table") {
        expect(response.cards[0].content.columns).toEqual([
          "Date",
          "Description",
          "Amount",
        ]);
      }
    });

    it("returns text response for generic questions", async () => {
      const response = await sendQuery("Hello");

      expect(response.cards).toHaveLength(1);
      expect(response.cards[0].type).toBe("text");
    });
  });

  describe("detectExpense", () => {
    it("detects expense from message with amount", async () => {
      const result = await detectExpense("I spent $20 on lunch");

      expect(result.is_transaction).toBe(true);
      expect(result.amount).toBe(-20);
    });

    it("detects expense with paid keyword", async () => {
      const result = await detectExpense("I paid $50 for groceries");

      expect(result.is_transaction).toBe(true);
      expect(result.amount).toBe(-50);
    });

    it("returns false for non-expense messages", async () => {
      const result = await detectExpense("Hello, how are you?");

      expect(result.is_transaction).toBe(false);
    });

    it("returns false for questions about spending", async () => {
      const result = await detectExpense("How much did I spend last month?");

      expect(result.is_transaction).toBe(false);
    });
  });
});
