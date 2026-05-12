import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { colors } from "../theme";

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

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "LLM Usage Monitor",
      body,
      data: { type: "periodic-update", balance: totalBalance, costToday },
    },
    trigger: null,
  });
}
