import React, { useCallback } from "react";
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
import BalanceCard from "../components/BalanceCard";
import DailyUsageCard from "../components/DailyUsageCard";
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

function formatCost(cost: number): string {
  return `\u00A5${cost.toFixed(4)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `~${(count / 1_000_000).toFixed(1)}M tokens`;
  }
  if (count >= 1_000) {
    return `~${Math.round(count / 1000)}K tokens`;
  }
  return `~${count} tokens`;
}

function formatDelta(start: number, end: number): string {
  const diff = start - end;
  const sign = diff >= 0 ? "-" : "+";
  return `${sign}\u00A5${Math.abs(diff).toFixed(4)}`;
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const {
    balanceResult,
    totalBalance,
    isLoading: balanceLoading,
    error: balanceError,
    lastRefreshed,
    refresh: refreshBalance,
  } = useBalance();
  const {
    dailyUsage,
    isLoading: historyLoading,
    error: historyError,
    reload: reloadHistory,
    todayUsage,
    monthlyCost,
  } = useHistory();
  const { settings, isLoading: settingsLoading, reload: reloadSettings } = useSettings();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshBalance(), reloadHistory(7)]);
    setRefreshing(false);
  }, [refreshBalance, reloadHistory]);

  const handleRefreshTap = useCallback(() => {
    refreshBalance();
    reloadHistory(7);
  }, [refreshBalance, reloadHistory]);

  // Re-check settings and refresh balance when tab gains focus
  useFocusEffect(
    useCallback(() => {
      reloadSettings();
      refreshBalance();
    }, [reloadSettings, refreshBalance])
  );

  const isRefreshing = refreshing || balanceLoading || historyLoading;
  const combinedError = balanceError || historyError;

  // No API key configured
  if (!settingsLoading && settings && !settings.apiKey) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIconText}>{"API"}</Text>
          </View>
          <Text style={styles.emptyStateTitle}>{"请先配置 API Key"}</Text>
          <Text style={styles.emptyStateDesc}>
            {"在设置中输入您的 DeepSeek API Key，\n即可开始监控余额使用情况。"}
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.emptyStateButtonText}>{"前往设置"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.title}>{"LLM Usage Monitor"}</Text>
          <View style={styles.accentUnderline} />
        </View>

        {/* Error Card */}
        {combinedError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeaderRow}>
              <View style={styles.errorDot} />
              <Text style={styles.errorTitle}>{"出错了"}</Text>
            </View>
            <Text style={styles.errorMessage}>{combinedError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              activeOpacity={0.8}
              onPress={handleRefreshTap}
            >
              <Text style={styles.retryButtonText}>{"重试"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Balance Card */}
        <BalanceCard
          balanceInfos={balanceResult?.balanceInfos ?? []}
          totalBalance={totalBalance}
          isLoading={balanceLoading}
        />

        {/* Last refreshed */}
        {lastRefreshed && (
          <Text style={styles.refreshedText}>
            {`最后刷新: ${lastRefreshed.toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}`}
          </Text>
        )}

        {/* Today Usage */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{"今日用量"}</Text>
          <View style={styles.sectionAccent} />
        </View>

        {todayUsage ? (
          <View style={styles.todayCard}>
            <View style={styles.todayGrid}>
              <View style={styles.todayItem}>
                <Text style={styles.todayLabel}>{"费用"}</Text>
                <Text style={styles.todayValueLarge}>
                  {formatCost(todayUsage.cost)}
                </Text>
              </View>
              <View style={styles.todayItem}>
                <Text style={styles.todayLabel}>{"预估Tokens"}</Text>
                <Text style={styles.todayValue}>
                  {formatTokens(todayUsage.estimatedTokens)}
                </Text>
              </View>
              <View style={styles.todayItem}>
                <Text style={styles.todayLabel}>{"余额变动"}</Text>
                <Text
                  style={[
                    styles.todayValue,
                    {
                      color:
                        todayUsage.balanceStart - todayUsage.balanceEnd > 0
                          ? colors.danger
                          : colors.success,
                    },
                  ]}
                >
                  {formatDelta(
                    todayUsage.balanceStart,
                    todayUsage.balanceEnd
                  )}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noTodayCard}>
            <Text style={styles.noTodayText}>{"今日暂无数据"}</Text>
          </View>
        )}

        {/* Monthly Total */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{"本月累计"}</Text>
          <View style={styles.sectionAccent} />
        </View>

        <View style={styles.monthlyCard}>
          <Text style={styles.monthlyValue}>
            {`\u00A5${monthlyCost.toFixed(4)}`}
          </Text>
          <Text style={styles.monthlyLabel}>{"本月总费用"}</Text>
        </View>

        {/* Refresh Button */}
        <TouchableOpacity
          style={styles.refreshButton}
          activeOpacity={0.8}
          onPress={handleRefreshTap}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.refreshButtonText}>{"刷新数据"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  refreshedText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "right",
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
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
  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.glow,
  },
  todayGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  todayItem: {
    flex: 1,
    alignItems: "center",
  },
  todayLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  todayValueLarge: {
    color: colors.primary,
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  todayValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  noTodayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  noTodayText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
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
  refreshButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...shadows.glow,
  },
  refreshButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
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
