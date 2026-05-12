import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DailyUsage, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize } from "../theme";

const PROVIDER_DOT_COLORS: Record<ProviderType, string> = {
  deepseek: colors.primary,
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#4285F4",
};

interface Props {
  usage: DailyUsage;
  provider?: ProviderType;
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

export default function DailyUsageCard({ usage, provider }: Props) {
  const isZeroCost = usage.cost === 0;

  return (
    <View style={styles.card}>
      <View style={styles.leftSection}>
        {provider && (
          <View
            style={[
              styles.providerDot,
              { backgroundColor: PROVIDER_DOT_COLORS[provider] },
            ]}
          />
        )}
        <Text style={styles.dateText}>{formatDate(usage.date)}</Text>
      </View>
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
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    width: 60,
  },
  providerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
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
