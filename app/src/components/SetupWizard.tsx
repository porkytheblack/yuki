"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import type { LLMProviderType, LLMProvider } from "@/types";
import { Loader2, Check, AlertCircle, ChevronRight, Cloud, HardDrive } from "lucide-react";
import { getTauriInvoke } from "@/lib/tauri";

interface SetupWizardProps {
  onComplete: () => void;
}

const PROVIDER_OPTIONS: {
  type: LLMProviderType;
  name: string;
  isLocal: boolean;
  defaultEndpoint: string;
  description: string;
}[] = [
  {
    type: "ollama",
    name: "Ollama",
    isLocal: true,
    defaultEndpoint: "http://localhost:11434",
    description: "Run models locally with Ollama",
  },
  {
    type: "lmstudio",
    name: "LM Studio",
    isLocal: true,
    defaultEndpoint: "http://localhost:1234/v1",
    description: "Use LM Studio for local inference",
  },
  {
    type: "anthropic",
    name: "Anthropic (Claude)",
    isLocal: false,
    defaultEndpoint: "https://api.anthropic.com/v1",
    description: "Use Claude models via Anthropic API",
  },
  {
    type: "openai",
    name: "OpenAI",
    isLocal: false,
    defaultEndpoint: "https://api.openai.com/v1",
    description: "Use GPT models via OpenAI API",
  },
  {
    type: "google",
    name: "Google (Gemini)",
    isLocal: false,
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1",
    description: "Use Gemini models via Google API",
  },
  {
    type: "openrouter",
    name: "OpenRouter",
    isLocal: false,
    defaultEndpoint: "https://openrouter.ai/api/v1",
    description: "Access multiple models through OpenRouter",
  },
];

type Step = "type" | "config" | "model";

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { setProvider } = useAppStore();
  const [step, setStep] = useState<Step>("type");
  const [providerType, setProviderType] = useState<LLMProviderType | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = PROVIDER_OPTIONS.find((p) => p.type === providerType);
  const isLocal = selectedProvider?.isLocal || false;

  // Update endpoint when provider is selected
  useEffect(() => {
    if (providerType) {
      const config = PROVIDER_OPTIONS.find((p) => p.type === providerType);
      if (config) {
        setEndpoint(config.defaultEndpoint);
      }
    }
  }, [providerType]);

  const selectProviderType = (type: LLMProviderType) => {
    setProviderType(type);
    setStep("config");
  };

  const fetchModels = async () => {
    if (!providerType) return;

    setIsLoadingModels(true);
    setError(null);

    try {
      const invoke = await getTauriInvoke();
      if (invoke) {
        console.log("[fetchModels] Using Tauri invoke");
        const models = await invoke<string[]>("list_models", {
          providerType,
          endpoint,
          apiKey: isLocal ? undefined : apiKey,
        });
        console.log("[fetchModels] Got models:", models);
        setAvailableModels(models);
        if (models.length > 0) {
          setModel(models[0]);
        }
      } else {
        // Mock models for browser development
        console.log("[fetchModels] Using mock models");
        const mockModels: Record<LLMProviderType, string[]> = {
          ollama: ["llama3.2", "llama3.1", "mistral", "codellama"],
          lmstudio: ["local-model"],
          anthropic: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
          openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
          google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
          openrouter: ["anthropic/claude-sonnet-4", "openai/gpt-4o", "google/gemini-2.0-flash-exp"],
        };
        const models = mockModels[providerType] || [];
        setAvailableModels(models);
        if (models.length > 0) {
          setModel(models[0]);
        }
      }
      setStep("model");
    } catch (err) {
      console.error("[fetchModels] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch models");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleComplete = async () => {
    if (!providerType || !model) return;

    setIsSaving(true);
    setError(null);

    try {
      const provider: LLMProvider = {
        type: providerType,
        name: selectedProvider?.name || providerType,
        endpoint,
        apiKey: isLocal ? undefined : apiKey,
        model,
        isLocal,
      };

      // Save to Tauri backend if available
      const invoke = await getTauriInvoke();
      if (invoke) {
        console.log("[handleComplete] Saving settings to Tauri backend");
        await invoke("save_settings", {
          settings: {
            provider,
            defaultCurrency: "USD",
            theme: "system",
          },
        });
        console.log("[handleComplete] Settings saved successfully");
      }

      // Also save to Zustand store
      setProvider(provider);
      onComplete();
    } catch (err) {
      console.error("[handleComplete] Failed to save settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const canProceedToModel = isLocal || apiKey;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900">
      <div className="w-full max-w-lg bg-neutral-0 dark:bg-neutral-800 rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
            Welcome to Yuki
          </h1>
          <p className="text-neutral-500">
            Your little helper for finances. Let&apos;s get you set up.
          </p>
        </div>

        {/* Step 1: Provider Type */}
        {step === "type" && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-4">
              Choose your LLM provider
            </h2>

            <div className="space-y-2">
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <HardDrive className="w-4 h-4" /> Local
              </p>
              {PROVIDER_OPTIONS.filter((p) => p.isLocal).map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => selectProviderType(provider.type)}
                  className="w-full flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {provider.name}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {provider.description}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </button>
              ))}
            </div>

            <div className="space-y-2 mt-4">
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Cloud
              </p>
              {PROVIDER_OPTIONS.filter((p) => !p.isLocal).map((provider) => (
                <button
                  key={provider.type}
                  onClick={() => selectProviderType(provider.type)}
                  className="w-full flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <div className="text-left">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {provider.name}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {provider.description}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === "config" && selectedProvider && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                Configure {selectedProvider.name}
              </h2>
              <button
                onClick={() => setStep("type")}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Change provider
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                API Endpoint
              </label>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

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
                  className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Stored locally. Never sent to Yuki&apos;s servers.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-error text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={fetchModels}
              disabled={isLoadingModels || !canProceedToModel}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isLoadingModels ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        )}

        {/* Step 3: Model Selection */}
        {step === "model" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
                Select a model
              </h2>
              <button
                onClick={() => setStep("config")}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Back
              </button>
            </div>

            <div className="space-y-2">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`w-full flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    model === m
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-primary-300"
                  }`}
                >
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {m}
                  </span>
                  {model === m && <Check className="w-5 h-5 text-primary-600" />}
                </button>
              ))}
            </div>

            <button
              onClick={handleComplete}
              disabled={!model || isSaving}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up...
                </span>
              ) : (
                "Get Started"
              )}
            </button>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mt-8">
          {["type", "config", "model"].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full ${
                step === s
                  ? "bg-primary-500"
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
