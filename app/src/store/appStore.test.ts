import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./appStore";

describe("appStore", () => {
  beforeEach(() => {
    // Reset the store to initial state
    useAppStore.setState({
      isAnalyzing: false,
      isLoading: false,
      needsSetup: true,
      currentResponse: null,
      currentCardIndex: 0,
      chatHistory: [],
      historyIndex: -1,
      settings: {
        provider: null,
        defaultCurrency: "USD",
        theme: "system",
      },
      error: null,
    });
  });

  it("should have initial state", () => {
    const state = useAppStore.getState();
    expect(state.isAnalyzing).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.needsSetup).toBe(true);
    expect(state.currentResponse).toBeNull();
    expect(state.currentCardIndex).toBe(0);
    expect(state.chatHistory).toEqual([]);
    expect(state.error).toBeNull();
  });

  it("should set isAnalyzing", () => {
    useAppStore.getState().setIsAnalyzing(true);
    expect(useAppStore.getState().isAnalyzing).toBe(true);
  });

  it("should set isLoading", () => {
    useAppStore.getState().setIsLoading(true);
    expect(useAppStore.getState().isLoading).toBe(true);
  });

  it("should set current response and reset card index", () => {
    const response = {
      cards: [
        { type: "text" as const, content: { body: "Test" } },
        { type: "text" as const, content: { body: "Test 2" } },
      ],
    };

    // Set card index to something other than 0
    useAppStore.setState({ currentCardIndex: 5 });

    useAppStore.getState().setCurrentResponse(response);

    expect(useAppStore.getState().currentResponse).toEqual(response);
    expect(useAppStore.getState().currentCardIndex).toBe(0);
  });

  it("should navigate to next card", () => {
    const response = {
      cards: [
        { type: "text" as const, content: { body: "Card 1" } },
        { type: "text" as const, content: { body: "Card 2" } },
      ],
    };
    useAppStore.setState({ currentResponse: response, currentCardIndex: 0 });

    useAppStore.getState().nextCard();
    expect(useAppStore.getState().currentCardIndex).toBe(1);

    // Should not go beyond last card
    useAppStore.getState().nextCard();
    expect(useAppStore.getState().currentCardIndex).toBe(1);
  });

  it("should navigate to previous card", () => {
    const response = {
      cards: [
        { type: "text" as const, content: { body: "Card 1" } },
        { type: "text" as const, content: { body: "Card 2" } },
      ],
    };
    useAppStore.setState({ currentResponse: response, currentCardIndex: 1 });

    useAppStore.getState().prevCard();
    expect(useAppStore.getState().currentCardIndex).toBe(0);

    // Should not go below 0
    useAppStore.getState().prevCard();
    expect(useAppStore.getState().currentCardIndex).toBe(0);
  });

  it("should add to chat history", () => {
    const entry = {
      id: "test-1",
      question: "Test question",
      sql_query: "SELECT * FROM ledger",
      response: { cards: [] },
      card_count: 0,
      created_at: new Date().toISOString(),
    };

    useAppStore.getState().addToHistory(entry);

    const state = useAppStore.getState();
    expect(state.chatHistory).toHaveLength(1);
    expect(state.chatHistory[0]).toEqual(entry);
    expect(state.historyIndex).toBe(0);
  });

  it("should navigate through history", () => {
    const entry1 = {
      id: "test-1",
      question: "Question 1",
      sql_query: "",
      response: { cards: [{ type: "text" as const, content: { body: "Response 1" } }] },
      card_count: 1,
      created_at: new Date().toISOString(),
    };
    const entry2 = {
      id: "test-2",
      question: "Question 2",
      sql_query: "",
      response: { cards: [{ type: "text" as const, content: { body: "Response 2" } }] },
      card_count: 1,
      created_at: new Date().toISOString(),
    };

    useAppStore.getState().addToHistory(entry1);
    useAppStore.getState().addToHistory(entry2);

    // Should be at index 1 (latest entry)
    expect(useAppStore.getState().historyIndex).toBe(1);

    // Navigate up (older)
    useAppStore.getState().navigateHistory("up");
    expect(useAppStore.getState().historyIndex).toBe(0);
    expect(useAppStore.getState().currentResponse).toEqual(entry1.response);

    // Navigate down (newer)
    useAppStore.getState().navigateHistory("down");
    expect(useAppStore.getState().historyIndex).toBe(1);
    expect(useAppStore.getState().currentResponse).toEqual(entry2.response);
  });

  it("should set and clear error", () => {
    useAppStore.getState().setError("Test error");
    expect(useAppStore.getState().error).toBe("Test error");

    useAppStore.getState().clearError();
    expect(useAppStore.getState().error).toBeNull();
  });

  it("should set provider and update needsSetup", () => {
    const provider = {
      type: "anthropic" as const,
      name: "Anthropic",
      endpoint: "https://api.anthropic.com/v1",
      apiKey: "test-key",
      model: "claude-3-opus",
      isLocal: false,
    };

    useAppStore.getState().setProvider(provider);

    const state = useAppStore.getState();
    expect(state.settings.provider).toEqual(provider);
    expect(state.needsSetup).toBe(false);
  });
});
