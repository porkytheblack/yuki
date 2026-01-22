import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnswerCard } from "./AnswerCard";
import { useAppStore } from "@/store/appStore";

// Mock the store
vi.mock("@/store/appStore", () => ({
  useAppStore: vi.fn(),
}));

// Mock Recharts to avoid canvas issues in tests
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}));

const mockUseAppStore = useAppStore as unknown as ReturnType<typeof vi.fn>;

describe("AnswerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no response", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: null,
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: false,
      isAnalyzing: false,
    });

    render(<AnswerCard />);
    expect(
      screen.getByText(/ask yuki a question about your finances/i)
    ).toBeInTheDocument();
  });

  it("shows loading state when isLoading is true", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: null,
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: true,
      isAnalyzing: false,
    });

    render(<AnswerCard />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("shows analyzing state when isAnalyzing is true", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: null,
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: false,
      isAnalyzing: true,
    });

    render(<AnswerCard />);
    expect(screen.getByText(/processing document/i)).toBeInTheDocument();
  });

  it("renders text card content", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: {
        cards: [
          {
            type: "text",
            content: { body: "You spent $500 this month." },
          },
        ],
      },
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: false,
      isAnalyzing: false,
    });

    render(<AnswerCard />);
    expect(screen.getByText("You spent $500 this month.")).toBeInTheDocument();
  });

  it("renders table card content", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: {
        cards: [
          {
            type: "table",
            content: {
              title: "Recent Transactions",
              columns: ["Date", "Description", "Amount"],
              rows: [["2025-01-15", "Coffee", "-$5.00"]],
            },
          },
        ],
      },
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: false,
      isAnalyzing: false,
    });

    render(<AnswerCard />);
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Coffee")).toBeInTheDocument();
  });

  it("shows navigation when multiple cards", () => {
    mockUseAppStore.mockReturnValue({
      currentResponse: {
        cards: [
          { type: "text", content: { body: "Card 1" } },
          { type: "text", content: { body: "Card 2" } },
        ],
      },
      currentCardIndex: 0,
      nextCard: vi.fn(),
      prevCard: vi.fn(),
      chatHistory: [],
      historyIndex: -1,
      navigateHistory: vi.fn(),
      isLoading: false,
      isAnalyzing: false,
    });

    render(<AnswerCard />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });
});
