import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useBalance } from "../hooks/useBalance";
import { useHistory } from "../hooks/useHistory";
import { useSettings } from "../hooks/useSettings";
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fonts,
  providerColors,
} from "../theme";
import {
  ProviderType,
  ProviderBalanceState,
  BalanceInfo,
} from "../types";

// ── Constants ────────────────────────────────────────────────────

const ALL_PROVIDERS: ProviderType[] = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
];

const PROVIDER_META: Record<
  ProviderType,
  { name: string; label: string }
> = {
  deepseek: { name: "DeepSeek", label: "DS" },
  openai: { name: "OpenAI", label: "OA" },
  anthropic: { name: "Anthropic", label: "AN" },
  gemini: { name: "Gemini", label: "GM" },
};

// ── Helpers ──────────────────────────────────────────────────────

function formatCost(cost: number): string {
  return `\u00A5${cost.toFixed(4)}`;
}

function formatBalanceCompact(balance: number): string {
  if (balance >= 10000) return `\u00A5${(balance / 10000).toFixed(2)}万`;
  if (balance >= 1) return `\u00A5${balance.toFixed(2)}`;
  return `\u00A5${balance.toFixed(4)}`;
}

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── DashboardScreen ──────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { states, refreshAll, isAnyLoading } = useBalance();
  const {
    dailyUsage,
    isLoading: historyLoading,
    error: historyError,
    reload: reloadHistory,
  } = useHistory();
  const {
    settings,
    isLoading: settingsLoading,
    reload: reloadSettings,
  } = useSettings();

  const [refreshing, setRefreshing] = useState(false);

  // ── Derived data ──────────────────────────────────────────────

  const todayStr = useMemo(() => getTodayDateString(), []);

  const hasAnyApiKey = useMemo(() => {
    if (!settings?.providers) return false;
    return ALL_PROVIDERS.some((p) => Boolean(settings.providers[p]?.apiKey));
  }, [settings]);

  const hasApiKey = useCallback(
    (provider: ProviderType): boolean => {
      return Boolean(settings?.providers[provider]?.apiKey);
    },
    [settings]
  );

  // Total balance across all configured providers
  const totalBalance = useMemo(() => {
    let sum = 0;
    for (const s of states) {
      if (hasApiKey(s.provider) && s.balance) {
        for (const info of s.balance.balanceInfos) {
          sum += info.totalBalance;
        }
      }
    }
    return sum;
  }, [states, hasApiKey]);

  // Today's total cost
  const todayTotalCost = useMemo(() => {
    return dailyUsage
      .filter((d) => d.date === todayStr)
      .reduce((sum, d) => sum + d.cost, 0);
  }, [dailyUsage, todayStr]);

  // This week's cost
  const weekCost = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    return dailyUsage
      .filter((d) => d.date >= mondayStr)
      .reduce((sum, d) => sum + d.cost, 0);
  }, [dailyUsage]);

  // Daily average
  const uniqueDays = useMemo(
    () => new Set(dailyUsage.map((d) => d.date)).size,
    [dailyUsage]
  );
  const avgDailyCost = useMemo(
    () =>
      uniqueDays > 0
        ? dailyUsage.reduce((sum, d) => sum + d.cost, 0) / uniqueDays
        : 0,
    [dailyUsage, uniqueDays]
  );

  // Provider-specific balance map
  const providerBalanceMap = useMemo(() => {
    const map = new Map<ProviderType, BalanceInfo | null>();
    for (const s of states) {
      map.set(
        s.provider,
        s.balance?.balanceInfos?.[0] ?? null
      );
    }
    return map;
  }, [states]);

  // ── Handlers ──────────────────────────────────────────────────

  const refreshAllData = useCallback(async () => {
    await refreshAll();
    await reloadHistory(7);
  }, [refreshAll, reloadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllData]);

  const handleProviderTap = useCallback(
    (provider: ProviderType) => {
      if (hasApiKey(provider)) {
        navigation.navigate("History", { provider });
      } else {
        navigation.navigate("Settings");
      }
    },
    [hasApiKey, navigation]
  );

  // Re-check settings and refresh when tab gains focus
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        await reloadSettings();
        await refreshAllData();
      };
      load();
    }, [reloadSettings, refreshAllData])
  );

  const isRefreshing = refreshing || isAnyLoading || historyLoading;

  // ── Loading state ─────────────────────────────────────────────

  if (settingsLoading && !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state: no API key at all ────────────────────────────

  if (!hasAnyApiKey) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIconText}>API</Text>
          </View>
          <Text style={styles.emptyStateTitle}>Configure API Key</Text>
          <Text style={styles.emptyStateDesc}>
            Enter your API key in Settings{"\n"}to start monitoring usage.
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.emptyStateButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.bg1}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Overview</Text>
            <Text style={styles.pageSubtitle}>LLM Usage Monitor</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Live</Text>
          </View>
        </View>

        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <View style={styles.balanceAmountRow}>
            <Text style={styles.balanceCurrency}>{"\u00A5"}</Text>
            <Text style={styles.balanceAmount}>
              {isAnyLoading && totalBalance === 0
                ? "..."
                : totalBalance.toFixed(2)}
            </Text>
          </View>
          <View style={styles.balanceMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Today</Text>
              <Text
                style={[
                  styles.metaValue,
                  todayTotalCost === 0 && styles.metaValueOk,
                ]}
              >
                {formatCost(todayTotalCost)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>This Week</Text>
              <Text style={styles.metaValue}>{formatCost(weekCost)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Daily Avg</Text>
              <Text style={styles.metaValue}>{formatCost(avgDailyCost)}</Text>
            </View>
          </View>
        </View>

        {/* ── Error Card ── */}
        {historyError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeaderRow}>
              <View style={styles.errorDot} />
              <Text style={styles.errorTitle}>Error</Text>
            </View>
            <Text style={styles.errorMessage}>{historyError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.8}
              onPress={refreshAllData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Providers Section ── */}
        <Text style={styles.sectionLabel}>PROVIDERS</Text>
        <View style={styles.providerList}>
          {states.map((state) => {
            const meta = PROVIDER_META[state.provider];
            const configured = hasApiKey(state.provider);
            const info = providerBalanceMap.get(state.provider);
            const totalBal = info?.totalBalance ?? null;

            return (
              <TouchableOpacity
                key={state.provider}
                style={[
                  styles.providerCard,
                  configured && styles.providerCardActive,
                ]}
                activeOpacity={0.7}
                onPress={() => handleProviderTap(state.provider)}
              >
                {/* Icon */}
                <View
                  style={[
                    styles.providerIcon,
                    configured
                      ? {
                          backgroundColor: providerColors[state.provider] + "1A",
                          borderColor: providerColors[state.provider] + "33",
                        }
                      : {
                          backgroundColor: "rgba(255,255,255,0.05)",
                          borderColor: colors.border,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.providerIconText,
                      {
                        color: configured
                          ? providerColors[state.provider]
                          : colors.textTertiary,
                      },
                    ]}
                  >
                    {meta.label}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{meta.name}</Text>
                  <Text
                    style={[
                      styles.providerStatus,
                      configured && styles.providerStatusConfigured,
                    ]}
                  >
                    {configured
                      ? "\u25CF Configured"
                      : "No API key"}
                  </Text>
                </View>

                {/* Right side */}
                <View style={styles.providerRight}>
                  {state.isLoading && totalBal === null ? (
                    <ActivityIndicator
                      color={colors.accent}
                      size="small"
                    />
                  ) : state.error ? (
                    <Text style={styles.providerError}>ERR</Text>
                  ) : configured && totalBal !== null ? (
                    <Text style={styles.providerBalance}>
                      {formatBalanceCompact(totalBal)}
                    </Text>
                  ) : configured ? (
                    <Text style={styles.providerBalanceNA}>---</Text>
                  ) : (
                    <Text style={styles.configCta}>Setup {"\u2192"}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },

  // ── Header ──────────────────────────────────────────────────

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl - 4,
  },
  pageTitle: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  pageSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  headerBadge: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: "rgba(59,125,255,0.2)",
  },
  headerBadgeText: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    letterSpacing: 0.5,
  },

  // ── Balance Card ────────────────────────────────────────────

  balanceCard: {
    marginHorizontal: spacing.xl - 4,
    marginBottom: spacing.md,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    position: "relative",
    overflow: "hidden",
  },
  balanceLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: spacing.xs + 2,
  },
  balanceAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  balanceCurrency: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xl,
    color: colors.textSecondary,
    marginRight: 2,
  },
  balanceAmount: {
    fontFamily: fonts.mono,
    fontSize: fontSize.hero,
    fontWeight: "500",
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: fontSize.hero * 1.1,
  },
  balanceMeta: {
    flexDirection: "row",
    gap: spacing.xl - 4,
    marginTop: spacing.xl - 4,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  metaValueOk: {
    color: colors.green,
  },

  // ── Section Label ───────────────────────────────────────────

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm + 2,
    marginTop: spacing.xl - 4,
  },

  // ── Provider List ───────────────────────────────────────────

  providerList: {
    paddingHorizontal: spacing.xl - 4,
    gap: spacing.sm,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md - 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    marginBottom: spacing.xs,
  },
  providerCardActive: {
    borderColor: "rgba(59,125,255,0.3)",
    backgroundColor: "rgba(59,125,255,0.04)",
  },

  // Provider icon
  providerIcon: {
    width: 36,
    height: 36,
    borderRadius: spacing.sm + 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  providerIconText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Provider info
  providerInfo: {
    flex: 1,
    minWidth: 0,
  },
  providerName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  providerStatus: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    color: colors.textTertiary,
    marginTop: 2,
  },
  providerStatusConfigured: {
    color: colors.green,
  },

  // Right side
  providerRight: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  providerBalance: {
    fontFamily: fonts.mono,
    fontSize: fontSize.lg - 1,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  providerBalanceNA: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  providerError: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    fontWeight: "700",
    color: colors.red,
    backgroundColor: colors.redDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: "hidden",
  },
  configCta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    color: colors.accent,
    letterSpacing: 0.5,
  },

  // ── Error Card ──────────────────────────────────────────────

  errorCard: {
    marginHorizontal: spacing.xl - 4,
    marginBottom: spacing.md,
    backgroundColor: colors.bg1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.red + "40",
    padding: spacing.lg,
  },
  errorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginRight: spacing.sm,
  },
  errorTitle: {
    color: colors.red,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  errorMessage: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.bg3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryButtonText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // ── Empty State ─────────────────────────────────────────────

  emptyStateContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyIconText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: "800",
    fontFamily: fonts.mono,
    letterSpacing: 2,
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginBottom: spacing.sm,
    fontFamily: fonts.sans,
  },
  emptyStateDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
    fontFamily: fonts.mono,
  },
  emptyStateButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyStateButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
