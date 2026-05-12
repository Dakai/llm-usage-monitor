import { ProviderType, UsageProvider } from "../types";
import { deepseekProvider } from "./deepseek";

const providers: Map<ProviderType, UsageProvider> = new Map();
providers.set("deepseek", deepseekProvider);

export function getProvider(type: ProviderType): UsageProvider | undefined {
  return providers.get(type);
}

export function getAvailableProviders(): UsageProvider[] {
  return Array.from(providers.values());
}

export { deepseekProvider };
