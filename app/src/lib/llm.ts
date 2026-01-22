import type {
  ResponseData,
  ExtractedTransaction,
  ExpenseDetectionResult,
  LLMProvider,
  ParsedReceiptItem,
} from "@/types";
import { isTauri, getTauriInvoke } from "./tauri";

/**
 * Send a natural language query to the LLM for processing.
 * The LLM will translate the query to SQL, execute it, and format the response.
 */
export async function sendQuery(question: string): Promise<ResponseData> {
  console.log("[sendQuery] Starting query:", question);
  console.log("[sendQuery] isTauri():", isTauri());

  // Check if we're in Tauri environment
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      console.log("[sendQuery] Using Tauri invoke");
      console.log("[sendQuery] Invoking process_query...");
      const response = await invoke<ResponseData>("process_query", { question });
      console.log("[sendQuery] Got response:", response);
      return response;
    } catch (error) {
      console.error("[sendQuery] Tauri invoke error:", error);
      // Return error as a card
      return {
        cards: [
          {
            type: "text",
            content: {
              body: `Error processing query: ${error instanceof Error ? error.message : String(error)}`,
              is_error: true,
            },
          },
        ],
      };
    }
  }

  console.log("[sendQuery] Using mock response (not in Tauri)");
  // Mock response for browser development
  return mockQueryResponse(question);
}

/**
 * Get the current LLM provider settings
 */
export async function getProvider(): Promise<LLMProvider | null> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      const settings = await invoke<{ provider: LLMProvider | null }>("get_settings");
      return settings.provider;
    } catch {
      return null;
    }
  }

  // Check localStorage for browser mode
  const stored = localStorage.getItem("yuki_settings");
  if (stored) {
    const settings = JSON.parse(stored);
    return settings.provider || null;
  }
  return null;
}

/**
 * Test LLM connection
 */
export async function testConnection(
  providerType: string,
  endpoint: string,
  apiKey: string | undefined,
  model: string
): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      await invoke("test_llm_connection", {
        providerType,
        endpoint,
        apiKey,
        model,
      });
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  // Mock success for browser mode
  return true;
}

/**
 * Parse a document and extract transactions using the LLM.
 */
export async function parseDocument(
  text: string,
  categories: string[]
): Promise<ExtractedTransaction[]> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<ExtractedTransaction[]>("parse_document_text", {
        text,
        categories,
      });
    } catch (error) {
      console.error("Parse document error:", error);
      return [];
    }
  }

  // Mock extraction for browser development
  return mockDocumentParsing(text);
}

/**
 * Parse receipt text with detailed item extraction.
 * Used for text-based receipts (PDF, TXT, CSV).
 * Returns items in kebab-case format.
 */
export async function parseReceiptText(
  text: string,
  categories: string[]
): Promise<{
  merchant: string;
  date: string;
  items: ParsedReceiptItem[];
  tax: number | null;
  total: number;
  category: string;
}> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke("parse_receipt_text", { text, categories });
    } catch (error) {
      console.error("Parse receipt text error:", error);
      return {
        merchant: "Unknown Store",
        date: new Date().toISOString().split("T")[0],
        items: [],
        tax: null,
        total: 0,
        category: "Other",
      };
    }
  }

  // Mock for browser development
  return {
    merchant: "Sample Store",
    date: new Date().toISOString().split("T")[0],
    items: [
      {
        name: "sample-item",
        quantity: 1,
        unit: null,
        unit_price: 5.99,
        total_price: 5.99,
        category: "other",
        brand: null,
      },
    ],
    tax: 0.5,
    total: 6.49,
    category: "Other",
  };
}

/**
 * Parse an image (receipt) using vision model.
 * Returns detailed item information for granular tracking.
 */
export async function parseImage(
  imagePath: string,
  categories: string[]
): Promise<{
  merchant: string;
  date: string;
  items: ParsedReceiptItem[];
  tax: number | null;
  total: number;
  category: string;
}> {
  console.log("[parseImage] Starting vision parsing for:", imagePath);
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      console.log("[parseImage] Calling parse_receipt_image...");
      const result = await invoke("parse_receipt_image", { imagePath, categories });
      console.log("[parseImage] Vision result:", result);
      return result as {
        merchant: string;
        date: string;
        items: ParsedReceiptItem[];
        tax: number | null;
        total: number;
        category: string;
      };
    } catch (error) {
      console.error("[parseImage] Parse receipt error:", error);
      // Re-throw to let caller handle it
      throw error;
    }
  }

  // Mock for browser development with detailed items
  return {
    merchant: "Sample Grocery Store",
    date: new Date().toISOString().split("T")[0],
    items: [
      {
        name: "Organic Apples",
        quantity: 2,
        unit: "lb",
        unit_price: 3.99,
        total_price: 7.98,
        category: "produce",
        brand: null,
      },
      {
        name: "Milk",
        quantity: 1,
        unit: "gal",
        unit_price: 4.29,
        total_price: 4.29,
        category: "dairy",
        brand: "Organic Valley",
      },
    ],
    tax: 0.98,
    total: 13.25,
    category: "Groceries",
  };
}

/**
 * Detect if a conversational message contains expense information.
 */
export async function detectExpense(
  message: string
): Promise<ExpenseDetectionResult> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke<ExpenseDetectionResult>("detect_expense", { message });
    } catch (error) {
      console.error("Detect expense error:", error);
      return { is_transaction: false };
    }
  }

  // Simple mock detection for browser development
  const expensePattern =
    /(?:spent|paid|bought|cost)\s*\$?(\d+(?:\.\d{2})?)/i;
  const match = message.match(expensePattern);

  if (match) {
    return {
      is_transaction: true,
      date: new Date().toISOString().split("T")[0],
      description: message,
      amount: -parseFloat(match[1]),
      category: "Other",
      merchant: null,
      confidence: "medium",
    };
  }

  return { is_transaction: false };
}

// Mock functions for browser development

function mockQueryResponse(question: string): ResponseData {
  const lowerQuestion = question.toLowerCase().trim();

  // Handle conversational greetings
  const greetings = ["hi", "hello", "hey", "howdy", "hola", "greetings", "yo", "sup", "what's up", "whats up"];
  if (greetings.some(g => lowerQuestion === g || lowerQuestion.startsWith(g + " ") || lowerQuestion.startsWith(g + "!"))) {
    return {
      cards: [
        {
          type: "text",
          content: {
            body: "Hey there! I'm Yuki, your personal finance helper. I can help you track expenses, analyze spending patterns, and make sense of your financial data. What would you like to know about your finances?",
          },
        },
      ],
    };
  }

  // Handle thanks/gratitude
  if (lowerQuestion.includes("thank") || lowerQuestion.includes("thanks")) {
    return {
      cards: [
        {
          type: "text",
          content: {
            body: "You're welcome! Let me know if you need anything else with your finances.",
          },
        },
      ],
    };
  }

  // Handle help requests
  if (lowerQuestion === "help" || lowerQuestion.includes("what can you do") || lowerQuestion.includes("how do you work")) {
    return {
      cards: [
        {
          type: "text",
          content: {
            body: "I can help you with:\n\n• **Track expenses** - Tell me about purchases or upload receipts\n• **Analyze spending** - Ask about spending by category, time period, or merchant\n• **View transactions** - See your recent activity\n• **Understand trends** - Spot patterns in your financial habits\n\nJust ask me anything about your finances!",
          },
        },
      ],
    };
  }

  // Simple keyword matching for demo purposes
  if (lowerQuestion.includes("spend") && lowerQuestion.includes("category")) {
    return {
      cards: [
        {
          type: "chart",
          content: {
            chart_type: "pie",
            title: "Spending by Category",
            data: [
              { label: "Dining", value: 847 },
              { label: "Groceries", value: 623 },
              { label: "Transportation", value: 234 },
              { label: "Entertainment", value: 156 },
              { label: "Shopping", value: 312 },
            ],
            caption: "This month",
          },
        },
      ],
    };
  }

  if (lowerQuestion.includes("trend") || lowerQuestion.includes("over time")) {
    return {
      cards: [
        {
          type: "mixed",
          content: {
            body: "Your spending has increased by 15% compared to last month. Here's how it's changed over the past few months.",
            chart: {
              chart_type: "line",
              title: "Monthly Spending Trend",
              data: [
                { label: "Oct", value: 2100 },
                { label: "Nov", value: 2350 },
                { label: "Dec", value: 2800 },
                { label: "Jan", value: 2420 },
              ],
            },
          },
        },
      ],
    };
  }

  if (lowerQuestion.includes("transactions") || lowerQuestion.includes("list")) {
    return {
      cards: [
        {
          type: "table",
          content: {
            title: "Recent Transactions",
            columns: ["Date", "Description", "Amount"],
            rows: [
              ["2025-01-15", "Coffee at Starbucks", "-$5.75"],
              ["2025-01-14", "Grocery shopping", "-$127.43"],
              ["2025-01-12", "Gas station", "-$45.00"],
              ["2025-01-10", "Restaurant dinner", "-$67.50"],
            ],
            summary: "Showing 4 most recent transactions",
          },
        },
      ],
    };
  }

  // Default text response
  return {
    cards: [
      {
        type: "text",
        content: {
          body: `Based on your ledger, I can help you understand your finances. Try asking things like:\n\n- "How much did I spend on dining this month?"\n- "Show me my spending by category"\n- "What are my recent transactions?"\n- "How has my spending changed over time?"`,
        },
      },
    ],
  };
}

function mockDocumentParsing(_text: string): ExtractedTransaction[] {
  // Return mock transactions for demo
  return [
    {
      date: "2025-01-15",
      description: "Sample transaction from document",
      amount: -50.0,
      currency: "USD",
      category: "Shopping",
      merchant: "Sample Store",
    },
    {
      date: "2025-01-14",
      description: "Another sample transaction",
      amount: -25.0,
      currency: "USD",
      category: "Dining",
      merchant: "Sample Restaurant",
    },
  ];
}
