import * as SecureStore from "expo-secure-store";
import { AppSettings, ProviderSettings, ProviderType } from "../types";

const ALL_PROVIDERS: ProviderType[] = ["deepseek", "openai", "anthropic", "gemini"];

const KEYS = {
  GLOBAL_REFRESH: "llm_monitor_global_refresh",
  GLOBAL_THRESHOLD: "llm_monitor_global_threshold",
  // Legacy keys (migrated on load)
  LEGACY_API_KEY: "llm_monitor_api_key",
  LEGACY_REFRESH: "llm_monitor_refresh_interval",
  LEGACY_THRESHOLD: "llm_monitor_low_balance_threshold",
  LEGACY_PROVIDER: "llm_monitor_provider",
};

function providerKey(provider: ProviderType, field: string): string {
  return `llm_monitor_p_${provider}_${field}`;
}

const DEFAULTS: AppSettings = {
  defaultRefreshIntervalMin: 30,
  defaultLowBalanceThreshold: 1.0,
  providers: {},
};

// ── Load ────────────────────────────────────────────────────────

export async function loadSettings(): Promise<AppSettings> {
  try {
    const [globalRefresh, globalThreshold] = await Promise.all([
      SecureStore.getItemAsync(KEYS.GLOBAL_REFRESH).catch(() => null),
      SecureStore.getItemAsync(KEYS.GLOBAL_THRESHOLD).catch(() => null),
    ]);

    const settings: AppSettings = {
      defaultRefreshIntervalMin: globalRefresh
        ? parseInt(globalRefresh, 10)
        : DEFAULTS.defaultRefreshIntervalMin,
      defaultLowBalanceThreshold: globalThreshold
        ? parseFloat(globalThreshold)
        : DEFAULTS.defaultLowBalanceThreshold,
      providers: {},
    };

    // Load per-provider settings
    for (const p of ALL_PROVIDERS) {
      const apiKey = (await SecureStore.getItemAsync(providerKey(p, "key")).catch(() => null)) ?? "";
      const refreshRaw = await SecureStore.getItemAsync(providerKey(p, "refresh")).catch(() => null);
      const thresholdRaw = await SecureStore.getItemAsync(providerKey(p, "threshold")).catch(() => null);
      if (apiKey || refreshRaw || thresholdRaw) {
        settings.providers[p] = {
          apiKey,
          refreshIntervalMin: refreshRaw ? parseInt(refreshRaw, 10) : null,
          lowBalanceThreshold: thresholdRaw ? parseFloat(thresholdRaw) : null,
        };
      }
    }

    // Migrate legacy settings if present and no new-style config exists
    if (Object.keys(settings.providers).length === 0) {
      const [legacyKey, legacyRefresh, legacyThreshold, legacyProvider] = await Promise.all([
        SecureStore.getItemAsync(KEYS.LEGACY_API_KEY).catch(() => null),
        SecureStore.getItemAsync(KEYS.LEGACY_REFRESH).catch(() => null),
        SecureStore.getItemAsync(KEYS.LEGACY_THRESHOLD).catch(() => null),
        SecureStore.getItemAsync(KEYS.LEGACY_PROVIDER).catch(() => null),
      ]);

      if (legacyKey) {
        const provider = (legacyProvider as ProviderType) || "deepseek";
        settings.providers[provider] = {
          apiKey: legacyKey,
          refreshIntervalMin: legacyRefresh ? parseInt(legacyRefresh, 10) : null,
          lowBalanceThreshold: legacyThreshold ? parseFloat(legacyThreshold) : null,
        };
        if (legacyRefresh) settings.defaultRefreshIntervalMin = parseInt(legacyRefresh, 10);
        if (legacyThreshold) settings.defaultLowBalanceThreshold = parseFloat(legacyThreshold);
        // Save in new format, clear legacy
        await saveSettings(settings);
        for (const k of Object.values(KEYS).filter((k) => k.startsWith("llm_monitor_api_key") || k.startsWith("llm_monitor_refresh_interval") || k.startsWith("llm_monitor_low_balance_threshold") || k.startsWith("llm_monitor_provider"))) {
          await SecureStore.deleteItemAsync(k).catch(() => {});
        }
      }
    }

    return settings;
  } catch {
    return { ...DEFAULTS, providers: {} };
  }
}

// ── Save ────────────────────────────────────────────────────────

export async function saveSettings(settings: AppSettings): Promise<void> {
  const writes: Promise<void>[] = [
    SecureStore.setItemAsync(KEYS.GLOBAL_REFRESH, String(settings.defaultRefreshIntervalMin)),
    SecureStore.setItemAsync(KEYS.GLOBAL_THRESHOLD, String(settings.defaultLowBalanceThreshold)),
  ];

  for (const p of ALL_PROVIDERS) {
    const ps: ProviderSettings | undefined = settings.providers[p];
    if (ps) {
      writes.push(SecureStore.setItemAsync(providerKey(p, "key"), ps.apiKey));
      if (ps.refreshIntervalMin !== null) {
        writes.push(SecureStore.setItemAsync(providerKey(p, "refresh"), String(ps.refreshIntervalMin)));
      } else {
        writes.push(SecureStore.deleteItemAsync(providerKey(p, "refresh")).catch(() => {}));
      }
      if (ps.lowBalanceThreshold !== null) {
        writes.push(SecureStore.setItemAsync(providerKey(p, "threshold"), String(ps.lowBalanceThreshold)));
      } else {
        writes.push(SecureStore.deleteItemAsync(providerKey(p, "threshold")).catch(() => {}));
      }
    } else {
      // Clear all keys for unconfigured provider
      writes.push(SecureStore.deleteItemAsync(providerKey(p, "key")).catch(() => {}));
      writes.push(SecureStore.deleteItemAsync(providerKey(p, "refresh")).catch(() => {}));
      writes.push(SecureStore.deleteItemAsync(providerKey(p, "threshold")).catch(() => {}));
    }
  }

  await Promise.all(writes);
}

// ── Helpers ─────────────────────────────────────────────────────

export async function hasAnyApiKey(): Promise<boolean> {
  for (const p of ALL_PROVIDERS) {
    const key = await SecureStore.getItemAsync(providerKey(p, "key")).catch(() => null);
    if (key) return true;
  }
  // Fallback: check legacy
  const legacy = await SecureStore.getItemAsync(KEYS.LEGACY_API_KEY).catch(() => null);
  return !!legacy;
}

export async function clearSettings(): Promise<void> {
  const keys: string[] = [KEYS.GLOBAL_REFRESH, KEYS.GLOBAL_THRESHOLD];
  for (const p of ALL_PROVIDERS) {
    keys.push(providerKey(p, "key"), providerKey(p, "refresh"), providerKey(p, "threshold"));
  }
  keys.push(KEYS.LEGACY_API_KEY, KEYS.LEGACY_REFRESH, KEYS.LEGACY_THRESHOLD, KEYS.LEGACY_PROVIDER);
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k).catch(() => {})));
}
