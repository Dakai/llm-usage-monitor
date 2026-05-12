import { useState, useCallback, useEffect, useRef } from "react";
import { BalanceResult, BalanceInfo } from "../types";
import { getProvider } from "../api";
import { loadSettings } from "../storage/settings";
import { recordSnapshot } from "../storage/balanceHistory";

interface UseBalanceReturn {
  balanceResult: BalanceResult | null;
  totalBalance: number;
  isLoading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  refresh: () => Promise<BalanceResult | null>;
}

export function useBalance(): UseBalanceReturn {
  const [balanceResult, setBalanceResult] = useState<BalanceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const isMounted = useRef(true);

  const refresh = useCallback(async (): Promise<BalanceResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await loadSettings();
      if (!settings.apiKey) {
        setError("请先设置 API Key");
        setIsLoading(false);
        return null;
      }

      const provider = getProvider(settings.provider);
      if (!provider) {
        setError(`不支持的提供商: ${settings.provider}`);
        setIsLoading(false);
        return null;
      }

      const result = await provider.getBalance(settings.apiKey);

      // Record snapshots for history
      for (const info of result.balanceInfos) {
        await recordSnapshot(
          info.currency,
          info.totalBalance,
          info.grantedBalance,
          info.toppedUpBalance
        );
      }

      if (isMounted.current) {
        setBalanceResult(result);
        setLastRefreshed(new Date());
      }

      return result;
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "获取余额失败");
      }
      return null;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      isMounted.current = false;
    };
  }, [refresh]);

  const totalBalance =
    balanceResult?.balanceInfos.reduce(
      (sum: number, b: BalanceInfo) => sum + b.totalBalance,
      0
    ) ?? 0;

  return { balanceResult, totalBalance, isLoading, error, lastRefreshed, refresh };
}
