import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
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
  shadows,
  providerColors,
} from "../theme";
import {
  ProviderType,
  ProviderBalanceState,
  DailyUsage,
  BalanceInfo,
} from "../types";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Constants ────────────────────────────────────────────────────

const ALL_PROVIDERS: ProviderType[] = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
];

const PROVIDER_META: Record<
  ProviderType,
  { name: string; color: string; label: string }
> = {
  deepseek: { name: "DeepSeek", color: providerColors.deepseek, label: "DS" },
  openai: { name: "OpenAI", color: providerColors.openai, label: "O" },
  anthropic: {
    name: "Anthropic",
    color: providerColors.anthropic,
    label: "A",
  },
  gemini: { name: "Gemini", color: providerColors.gemini, label: "G" },
};

const STATUS_DOT_COLORS: Record<string, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  none: colors.textMuted,
};

// ── Helpers ──────────────────────────────────────────────────────

function formatCost(cost: number): string {
  return `\u00A5${cost.toFixed(4)}`;
}

function formatCostCompact(cost: number): string {
  if (cost >= 10000) return `\u00A5${(cost / 10000).toFixed(2)}万`;
  if (cost >= 1) return `\u00A5${cost.toFixed(2)}`;
  if (cost >= 0.01) return `\u00A5${cost.toFixed(4)}`;
  return `\u00A5${cost.toFixed(6)}`;
}

function formatTokens(count: number): string {
  const rounded = Math.round(count);
  if (rounded >= 1_000_000) {
    return `~${(rounded / 1_000_000).toFixed(1)}M tokens`;
  }
  if (rounded >= 1_000) {
    return `~${Math.round(rounded / 1000)}K tokens`;
  }
  return `~${rounded} tokens`;
}

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getBalanceStatus(totalBalance: number | null):
  | "success"
  | "warning"
  | "danger"
  | "none" {
  if (totalBalance === null || totalBalance === undefined) return "none";
  if (totalBalance > 5) return "success";
  if (totalBalance >= 1) return "warning";
  return "danger";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ── DashboardScreen ──────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { states, refreshAll, refreshOne, isAnyLoading } = useBalance();
  const {
    dailyUsage,
    isLoading: historyLoading,
    error: historyError,
    reload: reloadHistory,
    monthlyCost,
  } = useHistory();
  const {
    settings,
    isLoading: settingsLoading,
    reload: reloadSettings,
  } = useSettings();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedProvider, setExpandedProvider] =
    useState<ProviderType | null>(null);

  // ── Computed values ──────────────────────────────────────────

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

  // Total balance across all providers
  const totalBalance = useMemo(() => {
    let sum = 0;
    for (const s of states) {
      if (s.balance) {
        for (const info of s.balance.balanceInfos) {
          sum += info.totalBalance;
        }
      }
    }
    return sum;
  }, [states]);

  // Today's total cost aggregated from dailyUsage
  const todayTotalCost = useMemo(() => {
    return dailyUsage
      .filter((d) => d.date === todayStr)
      .reduce((sum, d) => sum + d.cost, 0);
  }, [dailyUsage, todayStr]);

  // Provider-specific today data
  const providerTodayMap = useMemo(() => {
    const map = new Map<
      ProviderType,
      { cost: number; tokens: number }
    >();
    for (const d of dailyUsage) {
      if (d.date === todayStr) {
        const prev = map.get(d.provider) ?? { cost: 0, tokens: 0 };
        prev.cost += d.cost;
        prev.tokens += d.estimatedTokens;
        map.set(d.provider, prev);
      }
    }
    return map;
  }, [dailyUsage, todayStr]);

  // ── Handlers ─────────────────────────────────────────────────

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

  const toggleExpand = useCallback((provider: ProviderType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedProvider((prev) => (prev === provider ? null : provider));
  }, []);

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

  // ── Sub-renderers ────────────────────────────────────────────

  const renderSummaryStrip = () => (
    <View style={styles.summaryStrip}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>总余额</Text>
        <Text style={styles.summaryValue}>
          {isAnyLoading && totalBalance === 0 ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            formatCostCompact(totalBalance)
          )}
        </Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>今日费用</Text>
        <Text style={styles.summaryValueCost}>
          {formatCost(todayTotalCost)}
        </Text>
      </View>
    </View>
  );

  const renderStatusDot = (
    status: "success" | "warning" | "danger" | "none"
  ) => (
    <View
      style={[
        styles.statusDot,
        { backgroundColor: STATUS_DOT_COLORS[status] },
      ]}
    />
  );

  const renderRateLimitBar = (
    label: string,
    used: number,
    limit: number
  ) => {
    const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
    const barColor =
      pct > 0.8
        ? colors.danger
        : pct > 0.5
          ? colors.warning
          : colors.success;
    return (
      <View key={label} style={styles.rateLimitRow}>
        <Text style={styles.rateLimitLabel}>{label}</Text>
        <View style={styles.rateLimitBarBg}>
          <View
            style={[
              styles.rateLimitBarFill,
              {
                width: `${Math.round(pct * 100)}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
        <Text style={styles.rateLimitText}>
          {formatNumber(used)}/{formatNumber(limit)}
        </Text>
      </View>
    );
  };

  const renderExpandedContent = (state: ProviderBalanceState) => {
    const info: BalanceInfo | undefined =
      state.balance?.balanceInfos?.[0];
    const todayData = providerTodayMap.get(state.provider);

    return (
      <View style={styles.expandedContent}>
        {/* Separator */}
        <View style={styles.expandedSeparator} />

        {/* Balance Breakdown */}
        {info && (
          <>
            <Text style={styles.expandedSectionLabel}>余额明细</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>总余额</Text>
              <Text style={styles.breakdownValue}>
                {formatCost(info.totalBalance)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>赠送余额</Text>
              <Text style={styles.breakdownValue}>
                {formatCost(info.grantedBalance)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>充值余额</Text>
              <Text style={styles.breakdownValue}>
                {formatCost(info.toppedUpBalance)}
              </Text>
            </View>
          </>
        )}

        {/* Rate Limits */}
        {state.rateLimits && (
          <>
            <View style={styles.expandedSectionSpacer} />
            <Text style={styles.expandedSectionLabel}>速率限制</Text>
            {renderRateLimitBar(
              "RPM",
              state.rateLimits.rpm.used,
              state.rateLimits.rpm.limit
            )}
            {renderRateLimitBar(
              "TPM",
              state.rateLimits.tpm.used,
              state.rateLimits.tpm.limit
            )}
          </>
        )}

        {/* Token Estimates & Last Refreshed */}
        <View style={styles.expandedSectionSpacer} />
        <View style={styles.expandedMetaRow}>
          <Text style={styles.expandedMetaLabel}>今日估算</Text>
          <Text style={styles.expandedMetaValue}>
            {todayData && todayData.tokens > 0
              ? formatTokens(todayData.tokens)
              : "暂无数据"}
          </Text>
        </View>

        {state.lastRefreshed && (
          <View style={styles.expandedMetaRow}>
            <Text style={styles.expandedMetaLabel}>最后刷新</Text>
            <Text style={styles.expandedMetaValue}>
              {formatTime(state.lastRefreshed)}
            </Text>
          </View>
        )}

        {/* Detail Link */}
        <TouchableOpacity
          style={styles.detailLink}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("History")
          }
        >
          <Text style={styles.detailLinkText}>查看详情 →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderProviderCard = (state: ProviderBalanceState) => {
    const meta = PROVIDER_META[state.provider];
    const isExpanded = expandedProvider === state.provider;
    const info: BalanceInfo | undefined =
      state.balance?.balanceInfos?.[0];
    const totalBal = info?.totalBalance ?? null;
    const status = getBalanceStatus(totalBal);
    const todayData = providerTodayMap.get(state.provider);

    return (
      <TouchableOpacity
        key={state.provider}
        style={[
          styles.providerCard,
          isExpanded && styles.providerCardExpanded,
        ]}
        activeOpacity={0.85}
        onPress={() => toggleExpand(state.provider)}
      >
        {/* Collapsed Content */}
        <View style={styles.providerCardRow}>
          {/* Icon */}
          <View
            style={[
              styles.providerIcon,
              { backgroundColor: meta.color + "20" },
            ]}
          >
            <Text style={[styles.providerIconText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>

          {/* Name + Status */}
          <View style={styles.providerInfo}>
            <View style={styles.providerNameRow}>
              <Text style={styles.providerName}>{meta.name}</Text>
              {renderStatusDot(status)}
            </View>
            {todayData !== undefined && todayData.cost > 0 && (
              <Text style={styles.providerTodayCost}>
                今日: {formatCostCompact(todayData.cost)}
              </Text>
            )}
          </View>

          {/* Balance + Chevron */}
          <View style={styles.providerBalanceSection}>
            {state.isLoading && totalBal === null ? (
              <ActivityIndicator
                color={meta.color}
                size="small"
                style={styles.providerLoadingSpinner}
              />
            ) : state.error ? (
              <View style={styles.providerErrorBadge}>
                <Text style={styles.providerErrorBadgeText}>ERR</Text>
              </View>
            ) : totalBal !== null ? (
              <Text
                style={[
                  styles.providerBalanceHero,
                  { color: meta.color },
                ]}
              >
                {formatCostCompact(totalBal)}
              </Text>
            ) : (
              <Text style={styles.providerBalanceNA}>---</Text>
            )}
            <Text style={styles.providerChevron}>
              {isExpanded ? "▲" : "▼"}
            </Text>
          </View>
        </View>

        {/* Expanded Content */}
        {isExpanded && renderExpandedContent(state)}
      </TouchableOpacity>
    );
  };

  const renderEmptyProviderCard = (provider: ProviderType) => {
    const meta = PROVIDER_META[provider];

    return (
      <TouchableOpacity
        key={provider}
        style={styles.emptyProviderCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("Settings")}
      >
        <View
          style={[
            styles.providerIcon,
            { backgroundColor: meta.color + "10" },
          ]}
        >
          <Text
            style={[
              styles.providerIconText,
              { color: meta.color + "60" },
            ]}
          >
            {meta.label}
          </Text>
        </View>
        <View style={styles.emptyProviderInfo}>
          <Text style={styles.emptyProviderName}>{meta.name}</Text>
          <Text style={styles.emptyProviderAction}>点击配置</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Loading state (settings not loaded yet) ──────────────────

  if (settingsLoading && !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state: no API key at all ───────────────────────────

  if (!hasAnyApiKey) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIconText}>API</Text>
          </View>
          <Text style={styles.emptyStateTitle}>请先配置 API Key</Text>
          <Text style={styles.emptyStateDesc}>
            在设置中输入您的 API Key，{"\n"}即可开始监控余额使用情况。
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.emptyStateButtonText}>前往设置</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Dashboard ───────────────────────────────────────────

  const configuredProviders = states.filter((s) => hasApiKey(s.provider));
  const unconfiguredProviders = states.filter((s) => !hasApiKey(s.provider));

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
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>LLM Usage Monitor</Text>
          <View style={styles.accentUnderline} />
        </View>

        {/* Aggregated Summary Strip */}
        {renderSummaryStrip()}

        {/* Error Card (history errors only) */}
        {historyError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeaderRow}>
              <View style={styles.errorDot} />
              <Text style={styles.errorTitle}>出错了</Text>
            </View>
            <Text style={styles.errorMessage}>{historyError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.8}
              onPress={refreshAllData}
            >
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Provider Cards */}
        <View style={styles.providersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>服务商余额</Text>
            <View style={styles.sectionAccent} />
          </View>

          {/* Configured providers */}
          {configuredProviders.map((s) => renderProviderCard(s))}

          {/* Unconfigured providers */}
          {unconfiguredProviders.length > 0 && (
            <>
              <Text style={styles.unconfiguredHint}>
                以下服务商尚未配置 API Key
              </Text>
              {unconfiguredProviders.map((s) =>
                renderEmptyProviderCard(s.provider)
              )}
            </>
          )}
        </View>

        {/* Monthly Total */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>本月累计</Text>
          <View style={styles.sectionAccent} />
        </View>

        <View style={styles.monthlyCard}>
          <Text style={styles.monthlyValue}>
            {formatCost(monthlyCost)}
          </Text>
          <Text style={styles.monthlyLabel}>本月总费用</Text>
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
    padding: spacing.md,
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
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  accentUnderline: {
    marginTop: spacing.sm,
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },

  // ── Summary Strip ───────────────────────────────────────────

  summaryStrip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.glow,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    color: colors.primary,
    fontSize: fontSize.xxl,
    fontWeight: "700",
  },
  summaryValueCost: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.surfaceBorder,
    marginHorizontal: spacing.md,
  },

  // ── Section Header ──────────────────────────────────────────

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  sectionAccent: {
    marginLeft: spacing.sm,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },

  // ── Provider Cards Section ──────────────────────────────────

  providersSection: {
    marginBottom: spacing.sm,
  },
  unconfiguredHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // ── Provider Card ───────────────────────────────────────────

  providerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  providerCardExpanded: {
    borderColor: colors.primary + "40",
  },
  providerCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Icon
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  providerIconText: {
    fontSize: fontSize.md,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Info
  providerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  providerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
    marginRight: spacing.sm,
  },
  providerTodayCost: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Status Dot
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Balance Section
  providerBalanceSection: {
    alignItems: "flex-end",
    marginLeft: spacing.sm,
  },
  providerBalanceHero: {
    fontSize: fontSize.hero,
    fontWeight: "700",
    lineHeight: fontSize.hero * 1.0,
    marginBottom: -spacing.xs,
  },
  providerBalanceNA: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  providerChevron: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  providerLoadingSpinner: {
    marginBottom: spacing.xs,
  },
  providerErrorBadge: {
    backgroundColor: colors.danger + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  providerErrorBadgeText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },

  // ── Expanded Content ────────────────────────────────────────

  expandedContent: {
    marginTop: spacing.md,
  },
  expandedSeparator: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginBottom: spacing.md,
  },
  expandedSectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  expandedSectionSpacer: {
    height: spacing.md,
  },

  // Balance Breakdown
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  breakdownLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  breakdownValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // Rate Limit Bars
  rateLimitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  rateLimitLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    width: 36,
    fontWeight: "600",
  },
  rateLimitBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: "hidden",
    marginHorizontal: spacing.sm,
  },
  rateLimitBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  rateLimitText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    width: 60,
    textAlign: "right",
  },

  // Meta rows (token estimates, last refreshed)
  expandedMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  expandedMetaLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  expandedMetaValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },

  // Detail Link
  detailLink: {
    marginTop: spacing.md,
    alignSelf: "flex-end",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  detailLinkText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // ── Empty Provider Card (no API key) ────────────────────────

  emptyProviderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyProviderInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  emptyProviderName: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  emptyProviderAction: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  // ── Error Card ──────────────────────────────────────────────

  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
    backgroundColor: colors.danger,
    marginRight: spacing.sm,
  },
  errorTitle: {
    color: colors.danger,
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
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // ── Monthly Card ────────────────────────────────────────────

  monthlyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
    ...shadows.glow,
  },
  monthlyValue: {
    color: colors.accent,
    fontSize: fontSize.xxxl,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  monthlyLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },

  // ── Empty State (no API keys) ───────────────────────────────

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
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  emptyIconText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: "800",
    letterSpacing: 2,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  emptyStateDesc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.glow,
  },
  emptyStateButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
});
