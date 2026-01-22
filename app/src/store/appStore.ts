import { create } from "zustand";
import type {
  ResponseData,
  ChatHistoryEntry,
  LLMProvider,
  Settings,
} from "@/types";
import { getTauriInvoke } from "@/lib/tauri";

interface AppStore {
  // Analysis state
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  processingMessage: string | null;
  setProcessingMessage: (message: string | null) => void;

  // Loading state for queries
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Setup state
  needsSetup: boolean;
  checkSetup: () => Promise<void>;

  // Current response
  currentResponse: ResponseData | null;
  setCurrentResponse: (response: ResponseData | null) => void;

  // Card navigation within current response
  currentCardIndex: number;
  setCurrentCardIndex: (index: number) => void;
  nextCard: () => void;
  prevCard: () => void;

  // Chat history navigation
  chatHistory: ChatHistoryEntry[];
  historyIndex: number;
  addToHistory: (entry: ChatHistoryEntry) => void;
  navigateHistory: (direction: "up" | "down") => void;

  // Settings
  settings: Settings;
  setSettings: (settings: Settings) => void;
  setProvider: (provider: LLMProvider) => void;
  setSoundEnabled: (enabled: boolean) => void;

  // Yuki status
  showThankYou: boolean;
  triggerThankYou: () => void;
  clearThankYou: () => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const defaultSettings: Settings = {
  provider: null,
  defaultCurrency: "USD",
  theme: "system",
  soundEnabled: true,
};

export const useAppStore = create<AppStore>((set, get) => ({
  // Analysis state
  isAnalyzing: false,
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  processingMessage: null,
  setProcessingMessage: (message) => set({ processingMessage: message }),

  // Loading state
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Setup state
  needsSetup: true,
  checkSetup: async () => {
    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        console.log("[checkSetup] Using Tauri invoke");
        const hasProvider = await invoke<boolean>("has_llm_provider");
        console.log("[checkSetup] hasProvider:", hasProvider);
        set({ needsSetup: !hasProvider });
      } else {
        // In browser environment (dev mode without Tauri)
        // Check localStorage for settings
        console.log("[checkSetup] Using localStorage");
        const storedSettings = localStorage.getItem("yuki_settings");
        if (storedSettings) {
          const settings = JSON.parse(storedSettings) as Settings;
          set({ needsSetup: !settings.provider, settings });
        }
      }
    } catch (err) {
      console.error("[checkSetup] Error:", err);
      // Default to needing setup
      set({ needsSetup: true });
    }
  },

  // Current response
  currentResponse: null,
  setCurrentResponse: (response) =>
    set({ currentResponse: response, currentCardIndex: 0 }),

  // Card navigation
  currentCardIndex: 0,
  setCurrentCardIndex: (index) => set({ currentCardIndex: index }),
  nextCard: () => {
    const { currentResponse, currentCardIndex } = get();
    if (currentResponse && currentCardIndex < currentResponse.cards.length - 1) {
      set({ currentCardIndex: currentCardIndex + 1 });
    }
  },
  prevCard: () => {
    const { currentCardIndex } = get();
    if (currentCardIndex > 0) {
      set({ currentCardIndex: currentCardIndex - 1 });
    }
  },

  // Chat history
  chatHistory: [],
  historyIndex: -1,
  addToHistory: (entry) => {
    const { chatHistory } = get();
    set({
      chatHistory: [...chatHistory, entry],
      historyIndex: chatHistory.length,
    });
  },
  navigateHistory: (direction) => {
    const { chatHistory, historyIndex } = get();
    if (direction === "up" && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        historyIndex: newIndex,
        currentResponse: chatHistory[newIndex].response,
        currentCardIndex: 0,
      });
    } else if (
      direction === "down" &&
      historyIndex < chatHistory.length - 1
    ) {
      const newIndex = historyIndex + 1;
      set({
        historyIndex: newIndex,
        currentResponse: chatHistory[newIndex].response,
        currentCardIndex: 0,
      });
    }
  },

  // Settings
  settings: defaultSettings,
  setSettings: (settings) => {
    set({ settings });
    // Persist to localStorage for browser mode
    if (typeof window !== "undefined") {
      localStorage.setItem("yuki_settings", JSON.stringify(settings));
    }
  },
  setProvider: (provider) => {
    const { settings, setSettings } = get();
    setSettings({ ...settings, provider });
    set({ needsSetup: false });
  },
  setSoundEnabled: (enabled) => {
    const { settings, setSettings } = get();
    setSettings({ ...settings, soundEnabled: enabled });
  },

  // Yuki status
  showThankYou: false,
  triggerThankYou: () => set({ showThankYou: true }),
  clearThankYou: () => set({ showThankYou: false }),

  // Error handling
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
