import { useState, useCallback, useEffect, useRef } from "react";
import { DailyUsage } from "../types";
import { getDailyUsage } from "../storage/balanceHistory";

interface UseHistoryReturn {
  dailyUsage: DailyUsage[];
  isLoading: boolean;
  error: string | null;
  reload: (days?: number) => Promise<DailyUsage[]>;
  todayUsage: DailyUsage | null;
  monthlyCost: number;
}

export function useHistory(): UseHistoryReturn {
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const reload = useCallback(async (days: number = 7): Promise<DailyUsage[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getDailyUsage(days);
      if (isMounted.current) {
        setDailyUsage(data);
      }
      return data;
    } catch (e) {
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "获取历史数据失败");
      }
      return [];
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    reload(7);
    return () => {
      isMounted.current = false;
    };
  }, [reload]);

  const todayUsage = dailyUsage.length > 0 ? dailyUsage[dailyUsage.length - 1] : null;

  // Calculate cost for current month (last 30 days roughly)
  const monthlyCost = dailyUsage.reduce((sum, d) => sum + d.cost, 0);

  return { dailyUsage, isLoading, error, reload, todayUsage, monthlyCost };
}
