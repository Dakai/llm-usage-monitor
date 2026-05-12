import { useState, useCallback, useEffect, useRef } from "react";
import { ProviderBalanceState, ProviderType, RateLimitInfo } from "../types";
import { getProvider } from "../api";
import { loadSettings } from "../storage/settings";
import { recordSnapshot } from "../storage/balanceHistory";

const ALL_PROVIDERS: ProviderType[] = ["deepseek", "openai", "anthropic", "gemini"];

function emptyState(provider: ProviderType): ProviderBalanceState {
  return {
    provider,
    balance: null,
    rateLimits: null,
    isLoading: false,
    error: null,
    lastRefreshed: null,
  };
}

interface UseBalanceReturn {
  states: ProviderBalanceState[];
  refreshAll: () => Promise<void>;
  refreshOne: (provider: ProviderType) => Promise<void>;
  isAnyLoading: boolean;
}

export function useBalance(): UseBalanceReturn {
  const [states, setStates] = useState<ProviderBalanceState[]>(
    ALL_PROVIDERS.map(emptyState)
  );
  const isMounted = useRef(true);

  const refreshOne = useCallback(async (provider: ProviderType) => {
    setStates((prev) =>
      prev.map((s) =>
        s.provider === provider ? { ...s, isLoading: true, error: null } : s
      )
    );

    try {
      const settings = await loadSettings();
      const ps = settings.providers[provider];
      if (!ps?.apiKey) {
        setStates((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? { ...s, isLoading: false, error: "未配置 API Key" }
              : s
          )
        );
        return;
      }

      const api = getProvider(provider);
      if (!api) {
        setStates((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? { ...s, isLoading: false, error: `不支持的提供商: ${provider}` }
              : s
          )
        );
        return;
      }

      const [balance, rateLimits] = await Promise.all([
        api.getBalance(ps.apiKey),
        api.getRateLimits ? api.getRateLimits(ps.apiKey).catch(() => null) : null,
      ]);

      // Record snapshots
      for (const info of balance.balanceInfos) {
        await recordSnapshot(
          provider,
          info.currency,
          info.totalBalance,
          info.grantedBalance,
          info.toppedUpBalance
        );
      }

      if (isMounted.current) {
        setStates((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? {
                  ...s,
                  balance,
                  rateLimits,
                  isLoading: false,
                  error: null,
                  lastRefreshed: new Date(),
                }
              : s
          )
        );
      }
    } catch (e) {
      if (isMounted.current) {
        setStates((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? {
                  ...s,
                  isLoading: false,
                  error: e instanceof Error ? e.message : "获取数据失败",
                }
              : s
          )
        );
      }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const settings = await loadSettings();
    const configured = ALL_PROVIDERS.filter((p) => settings.providers[p]?.apiKey);
    await Promise.all(configured.map((p) => refreshOne(p)));
  }, [refreshOne]);

  // Initial refresh
  useEffect(() => {
    refreshAll();
    return () => {
      isMounted.current = false;
    };
  }, [refreshAll]);

  const isAnyLoading = states.some((s) => s.isLoading);

  return { states, refreshAll, refreshOne, isAnyLoading };
}
