import AsyncStorage from "@react-native-async-storage/async-storage";
import { BalanceSnapshot, DailyUsage } from "../types";
import { deepseekProvider } from "../api/deepseek";

const SNAPSHOTS_KEY = "llm_monitor_snapshots";

export async function recordSnapshot(
  currency: string,
  totalBalance: number,
  grantedBalance: number,
  toppedUpBalance: number
): Promise<void> {
  const snapshot: BalanceSnapshot = {
    timestamp: new Date().toISOString(),
    currency,
    totalBalance,
    grantedBalance,
    toppedUpBalance,
  };

  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  const snapshots: BalanceSnapshot[] = raw ? JSON.parse(raw) : [];
  snapshots.push(snapshot);

  // Keep last 90 days of snapshots
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const filtered = snapshots.filter((s) => new Date(s.timestamp) >= cutoff);

  await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
}

export async function getLatestSnapshot(
  currency: string = "CNY"
): Promise<BalanceSnapshot | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) return null;

  const snapshots: BalanceSnapshot[] = JSON.parse(raw);
  const matching = snapshots
    .filter((s) => s.currency === currency)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return matching[0] || null;
}

export async function getDailyUsage(
  days: number = 7,
  currency: string = "CNY"
): Promise<DailyUsage[]> {
  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) return [];

  const snapshots: BalanceSnapshot[] = JSON.parse(raw);
  const pricing = deepseekProvider.pricing;
  const avgPricePerToken = (pricing.inputCacheMiss + pricing.output) / 2;

  const result: DailyUsage[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const target = new Date(today);
    target.setDate(target.getDate() - i);
    target.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);

    const daySnapshots = snapshots
      .filter(
        (s) =>
          s.currency === currency &&
          new Date(s.timestamp) >= target &&
          new Date(s.timestamp) <= dayEnd
      )
      .sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    if (daySnapshots.length >= 2) {
      const first = daySnapshots[0];
      const last = daySnapshots[daySnapshots.length - 1];
      const cost = Math.max(0, first.totalBalance - last.totalBalance);
      const estimatedTokens = avgPricePerToken > 0 ? cost / avgPricePerToken : 0;

      result.push({
        date: target.toISOString().split("T")[0],
        currency,
        balanceStart: first.totalBalance,
        balanceEnd: last.totalBalance,
        cost,
        estimatedTokens,
      });
    } else if (daySnapshots.length === 1) {
      result.push({
        date: target.toISOString().split("T")[0],
        currency,
        balanceStart: daySnapshots[0].totalBalance,
        balanceEnd: daySnapshots[0].totalBalance,
        cost: 0,
        estimatedTokens: 0,
      });
    }
  }

  return result;
}

export async function pruneOldSnapshots(daysToKeep: number = 90): Promise<void> {
  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) return;

  const snapshots: BalanceSnapshot[] = JSON.parse(raw);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const filtered = snapshots.filter((s) => new Date(s.timestamp) >= cutoff);
  await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
}
