// Database types matching the SQLite schema

export interface Document {
  id: string;
  filename: string;
  filepath: string;
  filetype: string;
  hash: string;
  uploaded_at: string;
}

export interface Account {
  id: string;
  name: string;
  account_type: "checking" | "savings" | "credit" | "cash" | "investment" | "mobile_money" | "other";
  institution: string | null;
  currency: string;
  is_default: boolean;
  created_at: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  conversionRate: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  document_id: string | null;
  account_id: string | null;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category_id: string;
  merchant: string | null;
  notes: string | null;
  source: "document" | "image" | "conversation" | "manual" | "scanned-pdf";
  created_at: string;
}

export interface Receipt {
  id: string;
  document_id: string;
  ledger_id: string;
  merchant: string;
  items: ReceiptItem[];
  tax: number | null;
  total: number;
}

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface ParsedReceiptItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
  category: string | null;
  brand: string | null;
}

export interface PurchasedItem {
  id: string;
  receipt_id: string | null;
  ledger_id: string | null;  // Optional - receipts don't create ledger entries
  name: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
  category: string | null;
  brand: string | null;
  purchased_at: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ChatHistoryEntry {
  id: string;
  question: string;
  sql_query: string;
  response: ResponseData;
  card_count: number;
  created_at: string;
}

// LLM Response types

export type CardType = "text" | "chart" | "table" | "mixed";
export type ChartType = "pie" | "bar" | "line" | "area";

export interface TextContent {
  body: string;
  is_error?: boolean;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartContent {
  chart_type: ChartType;
  title: string;
  data: ChartDataPoint[];
  caption?: string;
}

export interface TableContent {
  title: string;
  columns: string[];
  rows: string[][];
  summary?: string;
}

export interface MixedContent {
  body: string;
  chart: ChartContent;
}

export interface TextCard {
  type: "text";
  content: TextContent;
}

export interface ChartCard {
  type: "chart";
  content: ChartContent;
}

export interface TableCard {
  type: "table";
  content: TableContent;
}

export interface MixedCard {
  type: "mixed";
  content: MixedContent;
}

export type ResponseCard = TextCard | ChartCard | TableCard | MixedCard;

export interface ResponseData {
  cards: ResponseCard[];
}

// LLM Provider types

export type LLMProviderType =
  | "ollama"
  | "lmstudio"
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter";

export interface LLMProvider {
  type: LLMProviderType;
  name: string;
  endpoint: string;
  apiKey?: string;
  model: string;
  isLocal: boolean;
}

export interface Settings {
  provider: LLMProvider | null;
  defaultCurrency: string;
  theme: "light" | "dark" | "system";
  soundEnabled: boolean;
}

// Application state types

export interface AppState {
  isAnalyzing: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  currentResponse: ResponseData | null;
  currentCardIndex: number;
  chatHistory: ChatHistoryEntry[];
  historyIndex: number;
}

// Tauri command response types

export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Transaction extraction from LLM

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
}

export interface ExpenseDetectionResult {
  is_transaction: boolean;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  merchant?: string | null;
  confidence?: "high" | "medium" | "low";
}
