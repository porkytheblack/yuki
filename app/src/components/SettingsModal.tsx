"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "@/store/appStore";
import { ThemeToggle } from "./ThemeToggle";
import type { LLMProviderType, LLMProvider } from "@/types";
import { Loader2, Check, AlertCircle, Volume2, VolumeX } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
}

const PROVIDER_OPTIONS: {
  type: LLMProviderType;
  name: string;
  isLocal: boolean;
  defaultEndpoint: string;
}[] = [
  {
    type: "ollama",
    name: "Ollama",
    isLocal: true,
    defaultEndpoint: "http://localhost:11434",
  },
  {
    type: "lmstudio",
    name: "LM Studio",
    isLocal: true,
    defaultEndpoint: "http://localhost:1234/v1",
  },
  {
    type: "anthropic",
    name: "Anthropic (Claude)",
    isLocal: false,
    defaultEndpoint: "https://api.anthropic.com/v1",
  },
  {
    type: "openai",
    name: "OpenAI",
    isLocal: false,
    defaultEndpoint: "https://api.openai.com/v1",
  },
  {
    type: "google",
    name: "Google (Gemini)",
    isLocal: false,
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1",
  },
  {
    type: "openrouter",
    name: "OpenRouter",
    isLocal: false,
    defaultEndpoint: "https://openrouter.ai/api/v1",
  },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, setProvider, setSoundEnabled } = useAppStore();

  const [providerType, setProviderType] = useState<LLMProviderType>(
    settings.provider?.type || "anthropic"
  );
  const [endpoint, setEndpoint] = useState(
    settings.provider?.endpoint || PROVIDER_OPTIONS[2].defaultEndpoint
  );
  const [apiKey, setApiKey] = useState(settings.provider?.apiKey || "");
  const [model, setModel] = useState(settings.provider?.model || "");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const selectedProviderConfig = PROVIDER_OPTIONS.find(
    (p) => p.type === providerType
  );
  const isLocal = selectedProviderConfig?.isLocal || false;

  // Update endpoint when provider changes
  useEffect(() => {
    const config = PROVIDER_OPTIONS.find((p) => p.type === providerType);
    if (config) {
      setEndpoint(config.defaultEndpoint);
    }
    setAvailableModels([]);
    setModel("");
    setTestResult(null);
  }, [providerType]);

  // Fetch available models
  const fetchModels = async () => {
    setIsLoadingModels(true);
    setError(null);

    try {
      // In browser mode, we'll use mock models
      // In Tauri mode, this would call the backend
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        const models = await invoke<string[]>("list_models", {
          providerType,
          endpoint,
          apiKey: isLocal ? undefined : apiKey,
        });
        setAvailableModels(models);
        if (models.length > 0 && !model) {
          setModel(models[0]);
        }
      } else {
        // Mock models for browser development
        const mockModels: Record<LLMProviderType, string[]> = {
          ollama: ["llama3.2", "llama3.1", "mistral", "codellama"],
          lmstudio: ["local-model"],
          anthropic: [
            "claude-sonnet-4-20250514",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
          ],
          openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
          google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
          openrouter: [
            "anthropic/claude-sonnet-4",
            "openai/gpt-4o",
            "google/gemini-2.0-flash-exp",
          ],
        };
        const models = mockModels[providerType] || [];
        setAvailableModels(models);
        if (models.length > 0 && !model) {
          setModel(models[0]);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch models"
      );
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Test connection
  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("test_llm_connection", {
          providerType,
          endpoint,
          apiKey: isLocal ? undefined : apiKey,
          model,
        });
      }
      // If no error thrown, connection is successful
      setTestResult("success");
    } catch {
      setTestResult("error");
    } finally {
      setIsTesting(false);
    }
  };

  // Save settings
  const handleSave = () => {
    const provider: LLMProvider = {
      type: providerType,
      name: selectedProviderConfig?.name || providerType,
      endpoint,
      apiKey: isLocal ? undefined : apiKey,
      model,
      isLocal,
    };
    setProvider(provider);
    onClose();
  };

  const canSave = model && (isLocal || apiKey);

  return (
    <Modal isOpen={true} onClose={onClose} title="Settings" size="md">
      <div className="space-y-6">
        {/* Theme Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Appearance
          </label>
          <ThemeToggle />
        </div>

        {/* Sound Toggle */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Sound
          </label>
          <button
            onClick={() => setSoundEnabled(!settings.soundEnabled)}
            className={`
              flex items-center gap-3 w-full px-4 py-3 rounded-lg border transition-colors
              ${settings.soundEnabled
                ? "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800"
                : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              }
            `}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-neutral-400" />
            )}
            <div className="text-left">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {settings.soundEnabled ? "Sound enabled" : "Sound disabled"}
              </div>
              <div className="text-xs text-neutral-500">
                Yuki says "thank you" when processing documents
              </div>
            </div>
          </button>
        </div>

        <hr className="border-neutral-200 dark:border-neutral-700" />

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            LLM Provider
          </label>
          <select
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as LLMProviderType)}
            className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <optgroup label="Local">
              {PROVIDER_OPTIONS.filter((p) => p.isLocal).map((p) => (
                <option key={p.type} value={p.type}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cloud">
              {PROVIDER_OPTIONS.filter((p) => !p.isLocal).map((p) => (
                <option key={p.type} value={p.type}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* API Endpoint */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            API Endpoint
          </label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* API Key (for cloud providers) */}
        {!isLocal && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Your API key is stored locally and never sent to Yuki&apos;s servers.
            </p>
          </div>
        )}

        {/* Fetch Models Button */}
        <div>
          <button
            onClick={fetchModels}
            disabled={isLoadingModels || (!isLocal && !apiKey)}
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingModels ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading models...
              </span>
            ) : (
              "Fetch Available Models"
            )}
          </button>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Model
          </label>
          {availableModels.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter model name"
              className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-error text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Test Connection */}
        <div className="flex items-center gap-4">
          <button
            onClick={testConnection}
            disabled={isTesting || !model}
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </span>
            ) : (
              "Test Connection"
            )}
          </button>
          {testResult === "success" && (
            <span className="flex items-center gap-1 text-success text-sm">
              <Check className="w-4 h-4" />
              Connection successful
            </span>
          )}
          {testResult === "error" && (
            <span className="flex items-center gap-1 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              Connection failed
            </span>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
}
