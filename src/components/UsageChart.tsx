import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { DailyUsage } from "../types";
import { colors, spacing, borderRadius, fontSize, fonts } from "../theme";

interface Props {
  dailyUsage: DailyUsage[];
}

const CHART_HEIGHT = 200;
const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - spacing.lg * 2;

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

export default function UsageChart({ dailyUsage }: Props) {
  if (!dailyUsage || dailyUsage.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No data yet</Text>
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
    backgroundColor: colors.bg1,
    backgroundGradientFrom: colors.bg1,
    backgroundGradientTo: colors.bg1,
    decimalPlaces: 4,
    formatYLabel: (value: string) => parseFloat(value).toFixed(2),
    formatTopBarValue: (value: number) => value.toFixed(4),
    color: (opacity = 1) => `rgba(59, 125, 255, ${opacity})`,
    labelColor: () => colors.textSecondary,
    barPercentage: 0.6,
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: "rgba(255,255,255,0.04)",
    },
    propsForLabels: {
      fontSize: 10,
      fontFamily: fonts.mono,
      fontWeight: "500",
    },
  };

  return (
    <View style={styles.container}>
      {!hasAnyCost && (
        <View style={styles.overlayEmpty}>
          <Text style={styles.emptyText}>No data yet</Text>
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
        withInnerLines={true}
        showValuesOnTopOfBars={true}
        fromZero
        segments={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md + 4,
    marginHorizontal: spacing.lg - 4,
    height: CHART_HEIGHT + spacing.md * 2 + 8,
    position: "relative",
    justifyContent: "center",
  },
  chart: {
    borderRadius: borderRadius.md,
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
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
});
