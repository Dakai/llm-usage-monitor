import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { loadSettings } from "../storage/settings";
import { getProvider } from "../api";
import { recordSnapshot, getDailyUsage } from "../storage/balanceHistory";
import { sendBalanceNotification, sendRefreshNotification } from "../notifications/setup";
import { ProviderType } from "../types";

const BACKGROUND_FETCH_TASK = "llm-monitor-background-fetch";

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const settings = await loadSettings();

    const configuredProviders = Object.entries(settings.providers).filter(
      (entry): entry is [ProviderType, NonNullable<(typeof settings.providers)[ProviderType]>] =>
        !!entry[1]?.apiKey
    );

    for (const [providerType, providerSettings] of configuredProviders) {
      try {
        const provider = getProvider(providerType);
        if (!provider) continue;

        const result = await provider.getBalance(providerSettings.apiKey);

        for (const info of result.balanceInfos) {
          await recordSnapshot(
            providerType,
            info.currency,
            info.totalBalance,
            info.grantedBalance,
            info.toppedUpBalance
          );
        }

        const total = result.balanceInfos.reduce((s, b) => s + b.totalBalance, 0);
        const currency = result.balanceInfos[0]?.currency ?? "CNY";

        // Use provider-specific threshold or fall back to global default
        const threshold =
          providerSettings.lowBalanceThreshold ?? settings.defaultLowBalanceThreshold;

        await sendBalanceNotification(total, threshold, currency);

        // Send periodic update
        const dailyUsage = await getDailyUsage(1, currency, providerType);
        const todayCost = dailyUsage.length > 0 ? dailyUsage[0].cost : 0;
        await sendRefreshNotification(total, todayCost, currency);
      } catch {
        // Individual provider failure — skip and continue to next provider
      }
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundFetch(intervalMinutes: number): Promise<void> {
  const minimumInterval = Math.max(intervalMinutes, 15); // Minimum 15 minutes
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval, // minutes (not seconds)
    });
  } catch (e) {
    console.warn("Background fetch registration failed:", e);
  }
}

export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch {
    // Task may not be registered
  }
}
