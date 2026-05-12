import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { loadSettings } from "../storage/settings";
import { getProvider } from "../api";
import { recordSnapshot, getDailyUsage } from "../storage/balanceHistory";
import { sendBalanceNotification, sendRefreshNotification } from "../notifications/setup";

const BACKGROUND_FETCH_TASK = "llm-monitor-background-fetch";

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const settings = await loadSettings();
    if (!settings.apiKey) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const provider = getProvider(settings.provider);
    if (!provider) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const result = await provider.getBalance(settings.apiKey);

    for (const info of result.balanceInfos) {
      await recordSnapshot(
        info.currency,
        info.totalBalance,
        info.grantedBalance,
        info.toppedUpBalance
      );
    }

    const total = result.balanceInfos.reduce((s, b) => s + b.totalBalance, 0);
    const currency = result.balanceInfos[0]?.currency ?? "CNY";

    // Check threshold and notify
    await sendBalanceNotification(total, settings.lowBalanceThreshold, currency);

    // Send periodic update
    const dailyUsage = await getDailyUsage(1, currency);
    const todayCost = dailyUsage.length > 0 ? dailyUsage[0].cost : 0;
    await sendRefreshNotification(total, todayCost, currency);

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
