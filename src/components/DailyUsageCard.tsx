import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { DailyUsage, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize, fonts } from "../theme";

const PROVIDER_DOT_COLORS: Record<ProviderType, string> = {
  deepseek: colors.green,
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#4285F4",
};

interface Props {
  usage: DailyUsage;
  provider?: ProviderType;
  maxCost: number;
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

function formatTokensCompact(count: number): string {
  const rounded = Math.round(count);
  if (rounded >= 1_000_000) {
    return `~${(rounded / 1_000_000).toFixed(1)}M tk`;
  }
  if (rounded >= 1_000) {
    return `~${Math.round(rounded / 1000)}K tk`;
  }
  return `~${rounded} tk`;
}

export default function DailyUsageCard({ usage, provider, maxCost }: Props) {
  const barPct = maxCost > 0 ? (usage.cost / maxCost) * 100 : 0;
  const dotColor = provider ? PROVIDER_DOT_COLORS[provider] : colors.textTertiary;

  return (
    <View style={styles.row}>
      {/* Provider dot */}
      <View style={[styles.dot, { backgroundColor: dotColor }]} />

      {/* Date */}
      <Text style={styles.date}>{formatDate(usage.date)}</Text>

      {/* Bar */}
      <View style={styles.barWrap}>
        <View style={[styles.bar, { width: `${Math.max(barPct, 0.5)}%` }]} />
      </View>

      {/* Cost */}
      <Text style={styles.cost}>{formatCost(usage.cost)}</Text>

      {/* Tokens */}
      <Text style={styles.tokens}>
        {formatTokensCompact(usage.estimatedTokens)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    minWidth: 36,
  },
  barWrap: {
    flex: 1,
    height: 4,
    backgroundColor: colors.bg3,
    borderRadius: 2,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  cost: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md - 1,
    fontWeight: "500",
    color: colors.textPrimary,
    minWidth: 48,
    textAlign: "right",
  },
  tokens: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    color: colors.textTertiary,
    minWidth: 56,
    textAlign: "right",
  },
});
