import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { BalanceInfo } from "../types";
import { colors, spacing, borderRadius, fontSize } from "../theme";

interface Props {
  balanceInfos: BalanceInfo[];
  totalBalance: number;
  isLoading: boolean;
}

function getCurrencySymbol(currency: string): string {
  return currency === "CNY" ? "\u00A5" : "$";
}

function getStatusColor(value: number): string {
  if (value <= 0) return colors.red;
  if (value < 1) return colors.amber;
  return colors.green;
}

function formatBalance(value: number): string {
  return value.toFixed(4);
}

function LoadingPlaceholder() {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.card}>
      <Animated.View
        style={[
          styles.placeholderLarge,
          { opacity: pulseAnim },
        ]}
      />
      <View style={styles.breakdownRow}>
        <Animated.View
          style={[
            styles.placeholderSmall,
            { opacity: pulseAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.placeholderSmall,
            { opacity: pulseAnim },
          ]}
        />
      </View>
    </View>
  );
}

export default function BalanceCard({
  balanceInfos,
  totalBalance,
  isLoading,
}: Props) {
  if (isLoading) {
    return <LoadingPlaceholder />;
  }

  const primaryInfo = balanceInfos.length > 0 ? balanceInfos[0] : null;
  const currencySymbol = primaryInfo
    ? getCurrencySymbol(primaryInfo.currency)
    : getCurrencySymbol("CNY");
  const statusColor = getStatusColor(totalBalance);

  const grantedTotal = balanceInfos.reduce((sum, b) => sum + b.grantedBalance, 0);
  const toppedUpTotal = balanceInfos.reduce((sum, b) => sum + b.toppedUpBalance, 0);

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusLabel}>
          {totalBalance <= 0
            ? "\u4F59\u989D\u4E0D\u8DB3"
            : totalBalance < 1
              ? "\u4F59\u989D\u8F83\u4F4E"
              : "\u4F59\u989D\u6B63\u5E38"}
        </Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.currencySymbol}>{currencySymbol}</Text>
        <Text style={styles.totalValue}>{formatBalance(totalBalance)}</Text>
      </View>
      <Text style={styles.totalLabel}>{"总余额"}</Text>

      {(grantedTotal > 0 || toppedUpTotal > 0) && (
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>
              {`${currencySymbol}${formatBalance(grantedTotal)}`}
            </Text>
            <Text style={styles.breakdownLabel}>{"赠金"}</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>
              {`${currencySymbol}${formatBalance(toppedUpTotal)}`}
            </Text>
            <Text style={styles.breakdownLabel}>{"充值"}</Text>
          </View>
        </View>
      )}

      {balanceInfos.length === 0 && !totalBalance && (
        <Text style={styles.noDataText}>{"暂无余额数据"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.xs,
  },
  currencySymbol: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontWeight: "600",
    marginRight: spacing.xs,
    marginBottom: 4,
  },
  totalValue: {
    color: colors.accent,
    fontSize: fontSize.hero,
    fontWeight: "700",
    lineHeight: 56,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
  },
  breakdownValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  breakdownLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
  },
  breakdownDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  placeholderLarge: {
    width: "60%",
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg2,
    marginBottom: spacing.md,
  },
  placeholderSmall: {
    width: "40%",
    height: 20,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg2,
  },
  noDataText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
