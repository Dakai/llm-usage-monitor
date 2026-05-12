import { ProviderType, UsageProvider } from "../types";
import { anthropicProvider } from "./anthropic";
import { deepseekProvider } from "./deepseek";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";

const providers: Map<ProviderType, UsageProvider> = new Map();
providers.set("deepseek", deepseekProvider);
providers.set("gemini", geminiProvider);
providers.set("anthropic", anthropicProvider);
providers.set("openai", openaiProvider);

export function getProvider(type: ProviderType): UsageProvider | undefined {
  return providers.get(type);
}

export function getAvailableProviders(): UsageProvider[] {
  return Array.from(providers.values());
}

export { deepseekProvider, openaiProvider, anthropicProvider, geminiProvider };
