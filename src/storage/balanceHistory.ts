import AsyncStorage from "@react-native-async-storage/async-storage";
import { BalanceSnapshot, DailyUsage, ProviderType } from "../types";
import { deepseekProvider } from "../api/deepseek";

const SNAPSHOTS_KEY = "llm_monitor_snapshots";

export async function recordSnapshot(
  provider: ProviderType,
  currency: string,
  totalBalance: number,
  grantedBalance: number,
  toppedUpBalance: number
): Promise<void> {
  const snapshot: BalanceSnapshot = {
    provider,
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
  currency: string = "CNY",
  provider?: ProviderType
): Promise<BalanceSnapshot | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) return null;

  const snapshots: BalanceSnapshot[] = JSON.parse(raw);
  const matching = snapshots
    .filter((s) => s.currency === currency)
    .filter((s) => (provider ? s.provider === provider : true))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return matching[0] || null;
}

export async function getDailyUsage(
  days: number = 7,
  currency: string = "CNY",
  provider?: ProviderType
): Promise<DailyUsage[]> {
  const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) return [];

  const allSnapshots: BalanceSnapshot[] = JSON.parse(raw);
  const snapshots = allSnapshots
    .filter((s) => s.currency === currency)
    .filter((s) => (provider ? s.provider === provider : true))
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  if (snapshots.length === 0) return [];

  const pricing = deepseekProvider.pricing;
  const avgPricePerToken = (pricing.inputCacheMiss + pricing.output) / 2;

  const result: DailyUsage[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // balanceStart: latest snapshot on or before dayStart (may be from previous day)
    // If none, fall back to earliest snapshot on or after dayStart
    let startSnapshot: BalanceSnapshot | null = null;
    for (let j = snapshots.length - 1; j >= 0; j--) {
      if (new Date(snapshots[j].timestamp) <= dayStart) {
        startSnapshot = snapshots[j];
        break;
      }
    }
    if (!startSnapshot) {
      // No snapshot at or before midnight — use first snapshot after (today only)
      for (let j = 0; j < snapshots.length; j++) {
        if (new Date(snapshots[j].timestamp) >= dayStart) {
          startSnapshot = snapshots[j];
          break;
        }
      }
    }

    // balanceEnd: latest snapshot on or before dayEnd
    let endSnapshot: BalanceSnapshot | null = null;
    for (let j = snapshots.length - 1; j >= 0; j--) {
      if (new Date(snapshots[j].timestamp) <= dayEnd) {
        endSnapshot = snapshots[j];
        break;
      }
    }

    // Need at least a start and end
    if (!startSnapshot || !endSnapshot) continue;

    // Same snapshot means only one data point covering this period
    const isToday = i === 0;
    const isSame = startSnapshot.timestamp === endSnapshot.timestamp;
    if (isSame && !isToday) continue;

    const cost = isSame
      ? 0
      : Math.max(0, startSnapshot.totalBalance - endSnapshot.totalBalance);
    const estimatedTokens = avgPricePerToken > 0 ? cost / avgPricePerToken : 0;

    result.push({
      date: dayStart.toISOString().split("T")[0],
      provider: provider ?? "deepseek",
      currency,
      balanceStart: startSnapshot.totalBalance,
      balanceEnd: endSnapshot.totalBalance,
      cost,
      estimatedTokens,
    });
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
