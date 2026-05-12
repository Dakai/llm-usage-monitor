import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHistory } from "../hooks/useHistory";
import UsageChart from "../components/UsageChart";
import DailyUsageCard from "../components/DailyUsageCard";
import { DailyUsage } from "../types";
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

function keyExtractor(item: DailyUsage) {
  return item.date;
}

function renderItem({ item }: { item: DailyUsage }) {
  return <DailyUsageCard usage={item} />;
}

function ListEmptyComponent() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{"暂无历史数据"}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { dailyUsage, isLoading, error, reload } = useHistory();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload(7);
    setRefreshing(false);
  }, [reload]);

  const chartData = dailyUsage.slice(-7);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{"用量历史"}</Text>
        <View style={styles.accentUnderline} />
      </View>

      <FlatList
        data={dailyUsage}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <UsageChart dailyUsage={chartData} />
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{"按日明细"}</Text>
              <View style={styles.sectionAccent} />
            </View>
          </View>
        }
        ListEmptyComponent={ListEmptyComponent}
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
