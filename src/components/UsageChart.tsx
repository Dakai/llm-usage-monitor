import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { DailyUsage } from "../types";
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

interface Props {
  dailyUsage: DailyUsage[];
}

const CHART_HEIGHT = 220;
const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - spacing.md * 2;

function formatDate(isoDate: string): string {
  try {
    const parts = isoDate.split("-");
    if (parts.length >= 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    const date = new Date(isoDate);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  } catch {
    return isoDate;
  }
}

function formatCost(cost: number): string {
  return cost.toFixed(4);
}

export default function UsageChart({ dailyUsage }: Props) {
  if (!dailyUsage || dailyUsage.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{"暂无数据"}</Text>
        </View>
      </View>
    );
  }

  const labels = dailyUsage.map((d) => formatDate(d.date));
  const dataValues = dailyUsage.map((d) => d.cost);
  const hasAnyCost = dataValues.some((v) => v > 0);

  const chartData = {
    labels,
    datasets: [
      {
        data: dataValues.length > 0 ? dataValues : [0],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 4,
    color: (opacity = 1) => {
      const hex = colors.primary.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
    labelColor: () => colors.textSecondary,
    barPercentage: 0.6,
    propsForBackgroundLines: {
      strokeWidth: 0,
    },
    propsForLabels: {
      fontSize: 11,
      fontWeight: "500",
    },
  };

  return (
    <View style={[styles.container, shadows.glow]}>
      {!hasAnyCost && (
        <View style={styles.overlayEmpty}>
          <Text style={styles.emptyText}>{"暂无数据"}</Text>
        </View>
      )}
      <BarChart
        data={chartData}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        chartConfig={chartConfig}
        style={styles.chart}
        yAxisLabel={"\u00A5"}
        yAxisSuffix=""
        withInnerLines={false}
        showValuesOnTopOfBars={true}
        fromZero
        segments={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    position: "relative",
  },
  chart: {
    borderRadius: borderRadius.lg,
  },
  emptyContainer: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayEmpty: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: "500",
  },
});
