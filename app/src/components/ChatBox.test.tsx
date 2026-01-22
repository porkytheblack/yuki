import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatBox } from "./ChatBox";

// Mock the store
vi.mock("@/store/appStore", () => ({
  useAppStore: vi.fn(() => ({
    isLoading: false,
    setIsLoading: vi.fn(),
    setCurrentResponse: vi.fn(),
    addToHistory: vi.fn(),
    setError: vi.fn(),
  })),
}));

// Mock the LLM module
vi.mock("@/lib/llm", () => ({
  sendQuery: vi.fn(() =>
    Promise.resolve({
      cards: [{ type: "text", content: { body: "Test response" } }],
    })
  ),
}));

describe("ChatBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the input field", () => {
    render(<ChatBox />);
    const input = screen.getByPlaceholderText("Ask Yuki here...");
    expect(input).toBeInTheDocument();
  });

  it("shows disabled state when disabled prop is true", () => {
    render(<ChatBox disabled={true} />);
    const input = screen.getByPlaceholderText("Processing document...");
    expect(input).toBeDisabled();
  });

  it("updates input value when typing", () => {
    render(<ChatBox />);
    const input = screen.getByPlaceholderText("Ask Yuki here...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test query" } });
    expect(input.value).toBe("test query");
  });

  it("has a send button", () => {
    render(<ChatBox />);
    const button = screen.getByRole("button", { name: /send question/i });
    expect(button).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<ChatBox />);
    const button = screen.getByRole("button", { name: /send question/i });
    expect(button).toBeDisabled();
  });
});
