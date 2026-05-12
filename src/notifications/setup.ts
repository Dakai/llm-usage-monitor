import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { colors } from "../theme";

export const STATS_NOTIFICATION_ID = "stats-display";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("balance-alerts", {
      name: "余额告警",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.warning,
      sound: "default",
      bypassDnd: true,
    });
    await Notifications.setNotificationChannelAsync("stats-display", {
      name: "使用统计",
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      bypassDnd: false,
    });
  }

  return true;
}

export async function sendBalanceNotification(
  totalBalance: number,
  threshold: number,
  currency: string = "CNY"
): Promise<void> {
  if (totalBalance >= threshold) return;

  const symbol = currency === "CNY" ? "¥" : "$";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⚠️ 余额不足",
      body: `当前余额: ${symbol}${totalBalance.toFixed(2)}，低于阈值 ${symbol}${threshold.toFixed(2)}`,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: "low-balance", balance: totalBalance, threshold },
      ...(Platform.OS === "android" && {
        channelId: "balance-alerts",
      }),
    },
    trigger: null, // immediate
  });
}

export async function sendRefreshNotification(
  totalBalance: number,
  costToday: number,
  currency: string = "CNY"
): Promise<void> {
  const symbol = currency === "CNY" ? "¥" : "$";
  const body =
    costToday > 0
      ? `余额: ${symbol}${totalBalance.toFixed(2)} | 今日花费: ${symbol}${costToday.toFixed(4)}`
      : `余额: ${symbol}${totalBalance.toFixed(2)} | 今日暂无花费`;

  // Cancel previous so this updates in-place
  await Notifications.dismissNotificationAsync(STATS_NOTIFICATION_ID);

  await Notifications.scheduleNotificationAsync({
    identifier: STATS_NOTIFICATION_ID,
    content: {
      title: "LLM Usage Monitor",
      body,
      autoDismiss: false,
      data: { type: "periodic-update", balance: totalBalance, costToday },
      ...(Platform.OS === "android" && {
        channelId: "stats-display",
      }),
    },
    trigger: null,
  });
}
