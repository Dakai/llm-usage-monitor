import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useHistory } from "../hooks/useHistory";
import UsageChart from "../components/UsageChart";
import DailyUsageCard from "../components/DailyUsageCard";
import { DailyUsage, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize, fonts } from "../theme";

// ── Types ────────────────────────────────────────────────────────

type FilterValue = "all" | ProviderType;

interface ProviderFilter {
  key: FilterValue;
  label: string;
}

const FILTERS: ProviderFilter[] = [
  { key: "all", label: "All" },
  { key: "deepseek", label: "DeepSeek" },
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "gemini", label: "Gemini" },
];

// ── Helpers ──────────────────────────────────────────────────────

function getCurrentWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + mondayOffset + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${dayStr}`);
  }
  return dates;
}

function getCurrentMonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatCost(cost: number): string {
  return `\u00A5${cost.toFixed(2)}`;
}

function aggregateByDate(usage: DailyUsage[]): DailyUsage[] {
  const map = new Map<string, DailyUsage>();
  for (const item of usage) {
    const existing = map.get(item.date);
    if (existing) {
      existing.cost += item.cost;
      existing.estimatedTokens += item.estimatedTokens;
      existing.balanceStart = Math.min(existing.balanceStart, item.balanceStart);
      existing.balanceEnd = Math.max(existing.balanceEnd, item.balanceEnd);
    } else {
      map.set(item.date, { ...item, provider: "deepseek" });
    }
  }
  return Array.from(map.values());
}

function keyExtractor(item: DailyUsage) {
  return `${item.date}-${item.provider}`;
}

// ── Screen ───────────────────────────────────────────────────────

export default function HistoryScreen() {
  const route = useRoute<any>();
  const initialFilter: FilterValue = route.params?.provider ?? "all";
  const [selectedFilter, setSelectedFilter] =
    useState<FilterValue>(initialFilter);

  const { dailyUsage, isLoading, error, reload } = useHistory();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload(7);
    setRefreshing(false);
  }, [reload]);

  // ── Derived data ──────────────────────────────────────────────

  const filteredUsage = useMemo(() => {
    if (selectedFilter === "all") {
      return dailyUsage;
    }
    return dailyUsage.filter((d) => d.provider === selectedFilter);
  }, [dailyUsage, selectedFilter]);

  const weekDates = useMemo(getCurrentWeekDates, []);
  const monthPrefix = useMemo(getCurrentMonthPrefix, []);

  const weekCost = useMemo(
    () =>
      filteredUsage
        .filter((d) => weekDates.includes(d.date))
        .reduce((sum, d) => sum + d.cost, 0),
    [filteredUsage, weekDates]
  );

  const monthCost = useMemo(
    () =>
      filteredUsage
        .filter((d) => d.date.startsWith(monthPrefix))
        .reduce((sum, d) => sum + d.cost, 0),
    [filteredUsage, monthPrefix]
  );

  const uniqueDays = useMemo(
    () => new Set(filteredUsage.map((d) => d.date)).size,
    [filteredUsage]
  );

  const avgDailyCost = useMemo(
    () =>
      uniqueDays > 0
        ? filteredUsage.reduce((sum, d) => sum + d.cost, 0) / uniqueDays
        : 0,
    [filteredUsage, uniqueDays]
  );

  const maxCost = useMemo(
    () => filteredUsage.reduce((max, d) => Math.max(max, d.cost), 0),
    [filteredUsage]
  );

  // Chart data
  const chartData = useMemo(() => {
    const raw = filteredUsage.slice(-7);
    if (selectedFilter === "all") {
      return aggregateByDate(raw);
    }
    return raw;
  }, [filteredUsage, selectedFilter]);

  const showProviderDot = selectedFilter === "all";

  // ── Render ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={filteredUsage}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <DailyUsageCard
            usage={item}
            provider={showProviderDot ? item.provider : undefined}
            maxCost={maxCost}
          />
        )}
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View style={styles.header}>
              <View>
                <Text style={styles.pageTitle}>History</Text>
                <Text style={styles.pageSubtitle}>Usage breakdown</Text>
              </View>
            </View>

            {/* ── Filter Pills ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map((f) => {
                const isActive = selectedFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterPill,
                      isActive && styles.filterPillActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedFilter(f.key)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Stats Strip ── */}
            <View style={styles.statsStrip}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>This Week</Text>
                <Text style={styles.statValue}>
                  {formatCost(weekCost)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>This Month</Text>
                <Text style={styles.statValue}>
                  {formatCost(monthCost)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Daily Avg</Text>
                <Text style={styles.statValue}>
                  {formatCost(avgDailyCost)}
                </Text>
              </View>
            </View>

            {/* ── Chart ── */}
            <UsageChart dailyUsage={chartData} />

            {/* ── Error Banner ── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Section Label ── */}
            <Text style={styles.sectionLabel}>DAILY BREAKDOWN</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedFilter === "all"
                ? "No history data yet"
                : "No data for this provider"}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.bg1}
          />
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl - 4,
    paddingBottom: spacing.xxl,
  },

  // ── Header ──────────────────────────────────────────────────

  header: {
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

  // ── Filter Pills ────────────────────────────────────────────

  filterScroll: {
    marginBottom: spacing.xl - 4,
  },
  filterContent: {
    gap: spacing.xs + 2,
    paddingRight: spacing.md,
  },
  filterPill: {
    flexShrink: 0,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md - 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterPillText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: "#ffffff",
  },

  // ── Stats Strip ─────────────────────────────────────────────

  statsStrip: {
    flexDirection: "row",
    backgroundColor: colors.bg1,
    borderRadius: spacing.md - 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md + 4,
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
    marginBottom: spacing.xs + 1,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.textPrimary,
  },

  // ── Section Label ───────────────────────────────────────────

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: spacing.sm + 2,
  },

  // ── Error Banner ────────────────────────────────────────────

  errorBanner: {
    backgroundColor: colors.bg1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red + "40",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontFamily: fonts.mono,
  },

  // ── Empty State ─────────────────────────────────────────────

  emptyContainer: {
    paddingVertical: spacing.xxl * 2,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
});
