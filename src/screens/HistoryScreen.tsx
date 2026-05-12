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
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

// ── Provider config ───────────────────────────────────────────────

type FilterValue = "all" | ProviderType;

interface ProviderFilter {
  key: FilterValue;
  label: string;
  color: string;
}

const PROVIDER_BRAND_COLORS: Record<ProviderType, string> = {
  deepseek: colors.primary,
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#4285F4",
};

const FILTERS: ProviderFilter[] = [
  { key: "all", label: "全部", color: colors.primary },
  { key: "deepseek", label: "DeepSeek", color: PROVIDER_BRAND_COLORS.deepseek },
  { key: "openai", label: "OpenAI", color: PROVIDER_BRAND_COLORS.openai },
  { key: "anthropic", label: "Anthropic", color: PROVIDER_BRAND_COLORS.anthropic },
  { key: "gemini", label: "Gemini", color: PROVIDER_BRAND_COLORS.gemini },
];

// ── Helpers ───────────────────────────────────────────────────────

function getCurrentWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
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
  return `\u00A5${cost.toFixed(4)}`;
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

// ── Filter Pill ──────────────────────────────────────────────────

interface PillProps {
  filter: ProviderFilter;
  isActive: boolean;
  onPress: () => void;
}

function FilterPill({ filter, isActive, onPress }: PillProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: isActive ? filter.color : colors.surfaceBorder },
        isActive && { backgroundColor: filter.color },
      ]}
    >
      <Text
        style={[
          styles.pillDot,
          { color: isActive ? colors.text : filter.color },
        ]}
      >
        {"●"}
      </Text>
      <Text
        style={[
          styles.pillLabel,
          { color: isActive ? colors.text : colors.textSecondary },
        ]}
      >
        {filter.label}
      </Text>
    </TouchableOpacity>
  );
}

// ── List Item ────────────────────────────────────────────────────

function keyExtractor(item: DailyUsage) {
  return `${item.date}-${item.provider}`;
}

interface RenderItemProps {
  item: DailyUsage;
  showProviderDot: boolean;
}

function ListItem({ item, showProviderDot }: RenderItemProps) {
  return (
    <DailyUsageCard
      usage={item}
      provider={showProviderDot ? item.provider : undefined}
    />
  );
}

// ── Empty State ──────────────────────────────────────────────────

interface EmptyProps {
  isAllFilter: boolean;
}

function ListEmptyComponent({ isAllFilter }: EmptyProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {isAllFilter ? "暂无历史数据" : "该提供商暂无历史数据"}
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────

export default function HistoryScreen() {
  const route = useRoute<any>();
  const initialFilter: FilterValue = route.params?.provider ?? "all";
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>(initialFilter);

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
    [filteredUsage, weekDates],
  );

  const monthCost = useMemo(
    () =>
      filteredUsage
        .filter((d) => d.date.startsWith(monthPrefix))
        .reduce((sum, d) => sum + d.cost, 0),
    [filteredUsage, monthPrefix],
  );

  const uniqueDays = useMemo(
    () => new Set(filteredUsage.map((d) => d.date)).size,
    [filteredUsage],
  );

  const avgDailyCost = useMemo(
    () => (uniqueDays > 0 ? filteredUsage.reduce((sum, d) => sum + d.cost, 0) / uniqueDays : 0),
    [filteredUsage, uniqueDays],
  );

  // Chart data: when "all" selected, aggregate by date; otherwise use as-is
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
      <View style={styles.header}>
        <Text style={styles.title}>{"用量历史"}</Text>
        <View style={styles.accentUnderline} />
      </View>

      <FlatList
        data={filteredUsage}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <ListItem item={item} showProviderDot={showProviderDot} />
        )}
        ListHeaderComponent={
          <View>
            {/* Provider filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillsContainer}
              contentContainerStyle={styles.pillsContent}
            >
              {FILTERS.map((f) => (
                <FilterPill
                  key={f.key}
                  filter={f}
                  isActive={selectedFilter === f.key}
                  onPress={() => setSelectedFilter(f.key)}
                />
              ))}
            </ScrollView>

            {/* Summary stats row */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{"本周"}</Text>
                <Text style={styles.summaryValue}>
                  {formatCost(weekCost)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{"本月"}</Text>
                <Text style={styles.summaryValue}>
                  {formatCost(monthCost)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{"日均"}</Text>
                <Text style={styles.summaryValue}>
                  {formatCost(avgDailyCost)}
                </Text>
              </View>
            </View>

            {/* Chart */}
            <UsageChart dailyUsage={chartData} />

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{"按日明细"}</Text>
              <View style={styles.sectionAccent} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <ListEmptyComponent isAllFilter={selectedFilter === "all"} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
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
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ── Filter pills ────────────────────────────────────────────────
  pillsContainer: {
    marginBottom: spacing.md,
  },
  pillsContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    backgroundColor: colors.surfaceLight,
  },
  pillDot: {
    fontSize: 10,
    marginRight: spacing.xs,
  },
  pillLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // ── Summary stats row ───────────────────────────────────────────
  summaryRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.xs,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  summaryValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // ── Section header ──────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
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

  // ── Error banner ────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },

  // ── Empty state ─────────────────────────────────────────────────
  emptyContainer: {
    paddingVertical: spacing.xxl * 2,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: "500",
  },
});
