import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DailyUsage } from "../types";
import { colors, spacing, borderRadius, fontSize } from "../theme";

interface Props {
  usage: DailyUsage;
}

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
  return `\u00A5${cost.toFixed(4)}`;
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

export default function DailyUsageCard({ usage }: Props) {
  const isZeroCost = usage.cost === 0;

  return (
    <View style={styles.card}>
      <Text style={styles.dateText}>{formatDate(usage.date)}</Text>
      <Text
        style={[
          styles.costText,
          isZeroCost && styles.costMuted,
        ]}
      >
        {formatCost(usage.cost)}
      </Text>
      <Text
        style={[
          styles.tokensText,
          isZeroCost && styles.tokensMuted,
        ]}
      >
        {formatTokens(usage.estimatedTokens)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    width: 52,
    fontVariant: ["tabular-nums"],
  },
  costText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  costMuted: {
    color: colors.textMuted,
  },
  tokensText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: "right",
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  tokensMuted: {
    color: colors.textMuted,
  },
});
