import * as SecureStore from "expo-secure-store";
import { AppSettings, ProviderType } from "../types";

const KEYS = {
  API_KEY: "llm_monitor_api_key",
  REFRESH_INTERVAL: "llm_monitor_refresh_interval",
  LOW_BALANCE_THRESHOLD: "llm_monitor_low_balance_threshold",
  PROVIDER: "llm_monitor_provider",
};

const DEFAULTS: AppSettings = {
  apiKey: "",
  refreshIntervalMin: 30,
  lowBalanceThreshold: 1.0,
  provider: "deepseek",
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const [apiKey, refreshStr, thresholdStr, provider] = await Promise.all([
      SecureStore.getItemAsync(KEYS.API_KEY).catch(() => null),
      SecureStore.getItemAsync(KEYS.REFRESH_INTERVAL).catch(() => null),
      SecureStore.getItemAsync(KEYS.LOW_BALANCE_THRESHOLD).catch(() => null),
      SecureStore.getItemAsync(KEYS.PROVIDER).catch(() => null),
    ]);

    return {
      apiKey: apiKey || DEFAULTS.apiKey,
      refreshIntervalMin: refreshStr ? parseInt(refreshStr, 10) : DEFAULTS.refreshIntervalMin,
      lowBalanceThreshold: thresholdStr
        ? parseFloat(thresholdStr)
        : DEFAULTS.lowBalanceThreshold,
      provider: (provider as ProviderType) || DEFAULTS.provider,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.API_KEY, settings.apiKey),
    SecureStore.setItemAsync(KEYS.REFRESH_INTERVAL, String(settings.refreshIntervalMin)),
    SecureStore.setItemAsync(KEYS.LOW_BALANCE_THRESHOLD, String(settings.lowBalanceThreshold)),
    SecureStore.setItemAsync(KEYS.PROVIDER, settings.provider),
  ]);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await SecureStore.getItemAsync(KEYS.API_KEY).catch(() => null);
  return !!key;
}

export async function clearSettings(): Promise<void> {
  await Promise.all(
    Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k).catch(() => {}))
  );
}
