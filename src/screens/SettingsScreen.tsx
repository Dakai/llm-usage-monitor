import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "../hooks/useSettings";
import { getAvailableProviders } from "../api";
import { AppSettings, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

interface FormState {
  apiKey: string;
  refreshIntervalMin: string;
  lowBalanceThreshold: string;
  provider: ProviderType;
}

type SaveStatus = {
  type: "success" | "error";
  message: string;
} | null;

export default function SettingsScreen() {
  const { settings, isLoading: settingsLoading, saveSettings } = useSettings();
  const providers = getAvailableProviders();

  const [form, setForm] = useState<FormState>({
    apiKey: "",
    refreshIntervalMin: "60",
    lowBalanceThreshold: "10",
    provider: "deepseek",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<SaveStatus>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        apiKey: settings.apiKey,
        refreshIntervalMin: String(settings.refreshIntervalMin),
        lowBalanceThreshold: String(settings.lowBalanceThreshold),
        provider: settings.provider,
      });
    }
  }, [settings]);

  const updateField = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setStatusMessage(null);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const refreshInterval = parseInt(form.refreshIntervalMin, 10);
    const lowBalanceThreshold = parseFloat(form.lowBalanceThreshold);

    if (!form.apiKey.trim()) {
      setStatusMessage({
        type: "error",
        message: "请输入 API Key",
      });
      return;
    }

    if (isNaN(refreshInterval) || refreshInterval < 1) {
      setStatusMessage({
        type: "error",
        message: "刷新间隔至少为 1 分钟",
      });
      return;
    }

    if (isNaN(lowBalanceThreshold) || lowBalanceThreshold < 0) {
      setStatusMessage({
        type: "error",
        message: "阈值必须为有效数字",
      });
      return;
    }

    const newSettings: AppSettings = {
      apiKey: form.apiKey.trim(),
      refreshIntervalMin: refreshInterval,
      lowBalanceThreshold,
      provider: form.provider,
    };

    setSaving(true);
    setStatusMessage(null);

    try {
      await saveSettings(newSettings);
      setStatusMessage({
        type: "success",
        message: "设置已保存",
      });
    } catch (e) {
      setStatusMessage({
        type: "error",
        message: e instanceof Error ? e.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  }, [form, saveSettings]);

  if (settingsLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>{"加载设置中..."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{"设置"}</Text>
            <View style={styles.accentUnderline} />
          </View>

          {/* API Key Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{"API Key"}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={form.apiKey}
                onChangeText={(v) => updateField("apiKey", v)}
                placeholder="sk-..."
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.primary}
              />
              <TouchableOpacity
                style={styles.toggleButton}
                activeOpacity={0.7}
                onPress={() => setShowApiKey((prev) => !prev)}
              >
                <Text style={styles.toggleButtonText}>
                  {showApiKey ? "隐藏" : "显示"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Provider Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{"服务提供商"}</Text>
            <View style={styles.providerRow}>
              {providers.map((p) => {
                const isActive = form.provider === p.type;
                return (
                  <TouchableOpacity
                    key={p.type}
                    style={[
                      styles.providerCard,
                      isActive && styles.providerCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => updateField("provider", p.type)}
                  >
                    <View
                      style={[
                        styles.providerRadio,
                        isActive && styles.providerRadioActive,
                      ]}
                    >
                      {isActive && <View style={styles.providerRadioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.providerName,
                        isActive && styles.providerNameActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Refresh Interval */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{"刷新间隔 (分钟)"}</Text>
            <TextInput
              style={styles.input}
              value={form.refreshIntervalMin}
              onChangeText={(v) => updateField("refreshIntervalMin", v)}
              placeholder="60"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              selectionColor={colors.primary}
            />
            <Text style={styles.fieldHint}>
              {"后台自动拉取余额数据的时间间隔，最小 1 分钟"}
            </Text>
          </View>

          {/* Low Balance Threshold */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{"低余额告警阈值 (元)"}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={form.lowBalanceThreshold}
                onChangeText={(v) => updateField("lowBalanceThreshold", v)}
                placeholder="10"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
              />
            </View>
            <Text style={styles.fieldHint}>
              {"余额低于此值时，系统将发送推送通知提醒"}
            </Text>
          </View>

          {/* Status Message */}
          {statusMessage && (
            <View
              style={[
                styles.statusContainer,
                statusMessage.type === "success"
                  ? styles.statusSuccess
                  : styles.statusError,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      statusMessage.type === "success"
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      statusMessage.type === "success"
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              >
                {statusMessage.message}
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{"保存设置"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
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
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: fontSize.md,
    fontVariant: ["tabular-nums"],
  },
  toggleButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  toggleButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  providerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  providerCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  providerCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLight,
  },
  providerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    marginRight: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  providerRadioActive: {
    borderColor: colors.primary,
  },
  providerRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  providerName: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  providerNameActive: {
    color: colors.text,
  },
  fieldHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  statusSuccess: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
  },
  statusError: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...shadows.glow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
