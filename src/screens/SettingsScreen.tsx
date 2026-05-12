import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  LayoutAnimation,
  UIManager,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSettings } from "../hooks/useSettings";
import { getAvailableProviders, getProvider } from "../api";
import { AppSettings, ProviderSettings, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize, shadows } from "../theme";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Constants ─────────────────────────────────────────────────────

const ALL_PROVIDERS: ProviderType[] = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
];

const REFRESH_OPTIONS = [15, 30, 60, 120];

const PROVIDER_BRAND: Record<ProviderType, string> = {
  deepseek: "#1E90FF",
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#4285F4",
};

const PROVIDER_ICONS: Record<ProviderType, string> = {
  deepseek: "DS",
  openai: "AI",
  anthropic: "AN",
  gemini: "GM",
};

// ── Helpers ───────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key[0] + "••••••••";
  return key.slice(0, 3) + "••••••••" + key.slice(-4);
}

// ── Types ─────────────────────────────────────────────────────────

interface ProviderFormData {
  apiKey: string;
  useCustomRefresh: boolean;
  customRefreshIntervalMin: string;
  useCustomThreshold: boolean;
  customLowBalanceThreshold: string;
}

interface TestConnectionState {
  testing: boolean;
  result: { success: boolean; message: string } | null;
}

type SaveStatus = {
  type: "success" | "error";
  message: string;
} | null;

// ── Component ─────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { settings, isLoading: settingsLoading, saveSettings } = useSettings();
  const navigation = useNavigation<any>();
  const providers = getAvailableProviders();

  // ── Form state ───────────────────────────────────────────────────

  const [defaultRefreshIntervalMin, setDefaultRefreshIntervalMin] =
    useState("30");
  const [defaultLowBalanceThreshold, setDefaultLowBalanceThreshold] =
    useState("10");
  const [providerForms, setProviderForms] = useState<
    Record<ProviderType, ProviderFormData>
  >(
    () =>
      Object.fromEntries(
        ALL_PROVIDERS.map((p) => [
          p,
          {
            apiKey: "",
            useCustomRefresh: false,
            customRefreshIntervalMin: "30",
            useCustomThreshold: false,
            customLowBalanceThreshold: "10",
          },
        ])
      ) as Record<ProviderType, ProviderFormData>
  );
  const [expandedProvider, setExpandedProvider] =
    useState<ProviderType | null>(null);
  const [visibleApiKeys, setVisibleApiKeys] = useState<
    Record<ProviderType, boolean>
  >(
    () =>
      Object.fromEntries(
        ALL_PROVIDERS.map((p) => [p, false])
      ) as Record<ProviderType, boolean>
  );
  const [biometricAuthed, setBiometricAuthed] = useState<
    Record<ProviderType, boolean>
  >(
    () =>
      Object.fromEntries(
        ALL_PROVIDERS.map((p) => [p, false])
      ) as Record<ProviderType, boolean>
  );
  const [testStates, setTestStates] = useState<
    Record<ProviderType, TestConnectionState>
  >(
    () =>
      Object.fromEntries(
        ALL_PROVIDERS.map((p) => [p, { testing: false, result: null }])
      ) as Record<ProviderType, TestConnectionState>
  );
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<SaveStatus>(null);

  const initialSettingsRef = useRef<AppSettings | null>(null);

  // ── Initialize form from saved settings ─────────────────────────

  useEffect(() => {
    if (!settings) return;
    initialSettingsRef.current = settings;
    setDefaultRefreshIntervalMin(String(settings.defaultRefreshIntervalMin));
    setDefaultLowBalanceThreshold(String(settings.defaultLowBalanceThreshold));

    const initial: Record<string, ProviderFormData> = {};
    for (const p of ALL_PROVIDERS) {
      const saved = settings.providers[p];
      initial[p] = {
        apiKey: saved?.apiKey ?? "",
        useCustomRefresh: saved?.refreshIntervalMin !== null,
        customRefreshIntervalMin: String(
          saved?.refreshIntervalMin ?? settings.defaultRefreshIntervalMin
        ),
        useCustomThreshold: saved?.lowBalanceThreshold !== null,
        customLowBalanceThreshold: String(
          saved?.lowBalanceThreshold ?? settings.defaultLowBalanceThreshold
        ),
      };
    }
    setProviderForms(initial as Record<ProviderType, ProviderFormData>);
  }, [settings]);

  // ── Unsaved changes detection ───────────────────────────────────

  const hasUnsavedChanges = useMemo(() => {
    const s = initialSettingsRef.current;
    if (!s) return false;
    if (defaultRefreshIntervalMin !== String(s.defaultRefreshIntervalMin))
      return true;
    if (defaultLowBalanceThreshold !== String(s.defaultLowBalanceThreshold))
      return true;
    for (const p of ALL_PROVIDERS) {
      const saved = s.providers[p];
      const form = providerForms[p];
      if (form.apiKey !== (saved?.apiKey ?? "")) return true;
      const savedRefresh = saved?.refreshIntervalMin ?? null;
      const formRefresh = form.useCustomRefresh
        ? parseInt(form.customRefreshIntervalMin, 10)
        : null;
      if (formRefresh !== savedRefresh) return true;
      const savedThreshold = saved?.lowBalanceThreshold ?? null;
      const formThreshold = form.useCustomThreshold
        ? parseFloat(form.customLowBalanceThreshold)
        : null;
      if (formThreshold !== savedThreshold) return true;
    }
    return false;
  }, [
    settings,
    defaultRefreshIntervalMin,
    defaultLowBalanceThreshold,
    providerForms,
  ]);

  const hasProviderChanges = useCallback(
    (p: ProviderType): boolean => {
      const s = initialSettingsRef.current;
      if (!s) return false;
      const saved = s.providers[p];
      const form = providerForms[p];
      if (form.apiKey !== (saved?.apiKey ?? "")) return true;
      const savedRefresh = saved?.refreshIntervalMin ?? null;
      const formRefresh = form.useCustomRefresh
        ? parseInt(form.customRefreshIntervalMin, 10)
        : null;
      if (formRefresh !== savedRefresh) return true;
      const savedThreshold = saved?.lowBalanceThreshold ?? null;
      const formThreshold = form.useCustomThreshold
        ? parseFloat(form.customLowBalanceThreshold)
        : null;
      return formThreshold !== savedThreshold;
    },
    [providerForms]
  );

  // ── Navigation guard (unsaved changes warning) ─────────────────

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      Alert.alert(
        "未保存的更改",
        "您有未保存的更改，确定要离开吗？",
        [
          { text: "继续编辑", style: "cancel" },
          {
            text: "放弃更改",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  // ── Biometric availability check ────────────────────────────────

  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return;
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(enrolled);
    })();
  }, []);

  // Reset biometric + visibility on tab blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        setBiometricAuthed(
          Object.fromEntries(
            ALL_PROVIDERS.map((p) => [p, false])
          ) as Record<ProviderType, boolean>
        );
        setVisibleApiKeys(
          Object.fromEntries(
            ALL_PROVIDERS.map((p) => [p, false])
          ) as Record<ProviderType, boolean>
        );
      };
    }, [])
  );

  // ── Handlers ────────────────────────────────────────────────────

  const handleToggleApiKey = useCallback(
    async (provider: ProviderType) => {
      if (visibleApiKeys[provider]) {
        setVisibleApiKeys((prev) => ({ ...prev, [provider]: false }));
        return;
      }

      if (biometricAvailable && !biometricAuthed[provider]) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "验证身份以查看 API Key",
          fallbackLabel: "使用设备密码",
          disableDeviceFallback: false,
        });
        if (!result.success) return;
        setBiometricAuthed((prev) => ({ ...prev, [provider]: true }));
      }

      setVisibleApiKeys((prev) => ({ ...prev, [provider]: true }));
    },
    [visibleApiKeys, biometricAvailable, biometricAuthed]
  );

  const updateProviderField = useCallback(
    (provider: ProviderType, field: keyof ProviderFormData, value: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProviderForms((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], [field]: value },
      }));
      setStatusMessage(null);
    },
    []
  );

  const handleToggleCustomRefresh = useCallback((provider: ProviderType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProviderForms((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        useCustomRefresh: !prev[provider].useCustomRefresh,
      },
    }));
    setStatusMessage(null);
  }, []);

  const handleToggleCustomThreshold = useCallback((provider: ProviderType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProviderForms((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        useCustomThreshold: !prev[provider].useCustomThreshold,
      },
    }));
    setStatusMessage(null);
  }, []);

  const handleExpandProvider = useCallback((provider: ProviderType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedProvider((prev) => (prev === provider ? null : provider));
  }, []);

  const handleTestConnection = useCallback(
    async (provider: ProviderType) => {
      const form = providerForms[provider];
      if (!form.apiKey.trim()) {
        setTestStates((prev) => ({
          ...prev,
          [provider]: {
            testing: false,
            result: { success: false, message: "请先输入 API Key" },
          },
        }));
        return;
      }

      setTestStates((prev) => ({
        ...prev,
        [provider]: { testing: true, result: null },
      }));

      try {
        const providerImpl = getProvider(provider);
        if (!providerImpl) {
          throw new Error("未找到服务提供商实现");
        }
        const result = await providerImpl.getBalance(form.apiKey.trim());
        if (result.isAvailable) {
          const total = result.balanceInfos
            .map((b) => b.totalBalance)
            .reduce((a, b) => a + b, 0);
          setTestStates((prev) => ({
            ...prev,
            [provider]: {
              testing: false,
              result: {
                success: true,
                message: `连接成功，余额: ¥${total.toFixed(2)}`,
              },
            },
          }));
        } else {
          setTestStates((prev) => ({
            ...prev,
            [provider]: {
              testing: false,
              result: { success: false, message: "无法获取余额信息" },
            },
          }));
        }
      } catch (e) {
        setTestStates((prev) => ({
          ...prev,
          [provider]: {
            testing: false,
            result: {
              success: false,
              message: e instanceof Error ? e.message : "连接失败",
            },
          },
        }));
      }
    },
    [providerForms]
  );

  const handleClearApiKey = useCallback((provider: ProviderType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setProviderForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], apiKey: "" },
    }));
    setVisibleApiKeys((prev) => ({ ...prev, [provider]: false }));
    setTestStates((prev) => ({
      ...prev,
      [provider]: { testing: false, result: null },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const globalRefresh = parseInt(defaultRefreshIntervalMin, 10);
    const globalThreshold = parseFloat(defaultLowBalanceThreshold);

    if (isNaN(globalRefresh) || globalRefresh < 1) {
      setStatusMessage({ type: "error", message: "刷新间隔至少为 1 分钟" });
      return;
    }
    if (isNaN(globalThreshold) || globalThreshold < 0) {
      setStatusMessage({ type: "error", message: "阈值必须为有效数字" });
      return;
    }

    const hasAnyKey = ALL_PROVIDERS.some(
      (p) => providerForms[p].apiKey.trim().length > 0
    );
    if (!hasAnyKey) {
      setStatusMessage({ type: "error", message: "请至少配置一个 API Key" });
      return;
    }

    const providersMap: Partial<Record<ProviderType, ProviderSettings>> = {};
    for (const p of ALL_PROVIDERS) {
      const form = providerForms[p];
      if (form.apiKey.trim()) {
        providersMap[p] = {
          apiKey: form.apiKey.trim(),
          refreshIntervalMin: form.useCustomRefresh
            ? parseInt(form.customRefreshIntervalMin, 10)
            : null,
          lowBalanceThreshold: form.useCustomThreshold
            ? parseFloat(form.customLowBalanceThreshold)
            : null,
        };
      }
    }

    const newSettings: AppSettings = {
      defaultRefreshIntervalMin: globalRefresh,
      defaultLowBalanceThreshold: globalThreshold,
      providers: providersMap,
    };

    setSaving(true);
    setStatusMessage(null);
    try {
      await saveSettings(newSettings);
      initialSettingsRef.current = newSettings;
      setStatusMessage({ type: "success", message: "设置已保存" });
    } catch (e) {
      setStatusMessage({
        type: "error",
        message: e instanceof Error ? e.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  }, [
    defaultRefreshIntervalMin,
    defaultLowBalanceThreshold,
    providerForms,
    saveSettings,
  ]);

  // ── Loading state ───────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────

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

          {/* ═══════════════════════════════════════════════════════
              Global Defaults Card
              ═══════════════════════════════════════════════════════ */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{"全局默认"}</Text>
            </View>

            {/* Refresh Interval Picker */}
            <Text style={styles.label}>{"默认刷新间隔"}</Text>
            <View style={styles.pickerRow}>
              {REFRESH_OPTIONS.map((opt) => {
                const isActive = String(opt) === defaultRefreshIntervalMin;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.pickerChip,
                      isActive && styles.pickerChipActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setDefaultRefreshIntervalMin(String(opt));
                      setStatusMessage(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerChipText,
                        isActive && styles.pickerChipTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={styles.pickerUnit}>{"分钟"}</Text>
            </View>

            {/* Low Balance Threshold */}
            <Text style={[styles.label, { marginTop: spacing.md }]}>
              {"默认余额告警阈值"}
            </Text>
            <View style={styles.inputRow}>
              <Text style={styles.currencyPrefix}>{"¥"}</Text>
              <TextInput
                style={styles.thresholdInput}
                value={defaultLowBalanceThreshold}
                onChangeText={(v) => {
                  setDefaultLowBalanceThreshold(v);
                  setStatusMessage(null);
                }}
                placeholder="10"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
              />
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════
              Provider Config List
              ═══════════════════════════════════════════════════════ */}
          <Text style={styles.sectionTitle}>{"服务提供商"}</Text>

          {ALL_PROVIDERS.map((pType) => {
            const provider = providers.find((p) => p.type === pType);
            if (!provider) return null;
            const form = providerForms[pType];
            const isExpanded = expandedProvider === pType;
            const isConfigured = form.apiKey.trim().length > 0;
            const brandColor = PROVIDER_BRAND[pType];
            const changes = hasProviderChanges(pType);

            return (
              <View key={pType} style={styles.providerCard}>
                {/* ── Header (collapsed view) ── */}
                <TouchableOpacity
                  style={styles.providerHeader}
                  activeOpacity={0.7}
                  onPress={() => handleExpandProvider(pType)}
                >
                  <View style={styles.providerHeaderLeft}>
                    <View
                      style={[styles.brandIcon, { backgroundColor: brandColor }]}
                    >
                      <Text style={styles.brandIconText}>
                        {PROVIDER_ICONS[pType]}
                      </Text>
                    </View>
                    <Text style={styles.providerName}>{provider.name}</Text>
                  </View>

                  <View style={styles.providerHeaderRight}>
                    {changes && <View style={styles.unsavedDot} />}
                    <View
                      style={[
                        styles.statusChip,
                        isConfigured
                          ? styles.statusChipConfigured
                          : styles.statusChipUnconfigured,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          {
                            color: isConfigured
                              ? colors.success
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {isConfigured ? "已配置 ✓" : "未配置"}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>
                      {isExpanded ? "▲" : "▼"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* ── Expanded body ── */}
                {isExpanded && (
                  <View style={styles.providerBody}>
                    {/* API Key */}
                    <Text style={styles.label}>{"API Key"}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={
                          visibleApiKeys[pType]
                            ? form.apiKey
                            : maskApiKey(form.apiKey)
                        }
                        onChangeText={(v) =>
                          updateProviderField(pType, "apiKey", v)
                        }
                        placeholder="sk-..."
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={visibleApiKeys[pType]}
                        selectionColor={colors.primary}
                      />
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          biometricAvailable &&
                            !biometricAuthed[pType] &&
                            styles.toggleButtonLocked,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleToggleApiKey(pType)}
                      >
                        <Text style={styles.toggleButtonText}>
                          {visibleApiKeys[pType]
                            ? "隐藏"
                            : biometricAvailable
                              ? "🔒 显示"
                              : "显示"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Custom Refresh Interval Toggle */}
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>
                        {"使用自定义刷新间隔"}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.switch,
                          form.useCustomRefresh && styles.switchActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleToggleCustomRefresh(pType)}
                      >
                        <View
                          style={[
                            styles.switchThumb,
                            form.useCustomRefresh &&
                              styles.switchThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>

                    {form.useCustomRefresh && (
                      <View style={styles.pickerRow}>
                        {REFRESH_OPTIONS.map((opt) => {
                          const isActive =
                            String(opt) === form.customRefreshIntervalMin;
                          return (
                            <TouchableOpacity
                              key={opt}
                              style={[
                                styles.pickerChip,
                                isActive && styles.pickerChipActive,
                              ]}
                              activeOpacity={0.7}
                              onPress={() =>
                                updateProviderField(
                                  pType,
                                  "customRefreshIntervalMin",
                                  String(opt)
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.pickerChipText,
                                  isActive && styles.pickerChipTextActive,
                                ]}
                              >
                                {opt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <Text style={styles.pickerUnit}>{"分钟"}</Text>
                      </View>
                    )}

                    {/* Custom Threshold Toggle */}
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>
                        {"使用自定义告警阈值"}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.switch,
                          form.useCustomThreshold && styles.switchActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleToggleCustomThreshold(pType)}
                      >
                        <View
                          style={[
                            styles.switchThumb,
                            form.useCustomThreshold &&
                              styles.switchThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>

                    {form.useCustomThreshold && (
                      <View style={styles.inputRow}>
                        <Text style={styles.currencyPrefix}>{"¥"}</Text>
                        <TextInput
                          style={styles.thresholdInput}
                          value={form.customLowBalanceThreshold}
                          onChangeText={(v) =>
                            updateProviderField(
                              pType,
                              "customLowBalanceThreshold",
                              v
                            )
                          }
                          placeholder="10"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                          selectionColor={colors.primary}
                        />
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.testButton}
                        activeOpacity={0.7}
                        onPress={() => handleTestConnection(pType)}
                        disabled={testStates[pType].testing}
                      >
                        {testStates[pType].testing ? (
                          <ActivityIndicator
                            color={colors.primary}
                            size="small"
                          />
                        ) : (
                          <Text style={styles.testButtonText}>{"测试连接"}</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.clearButton}
                        activeOpacity={0.7}
                        onPress={() => handleClearApiKey(pType)}
                      >
                        <Text style={styles.clearButtonText}>{"清除"}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Test connection result */}
                    {testStates[pType].result && (
                      <View
                        style={[
                          styles.testResult,
                          testStates[pType].result.success
                            ? styles.testResultSuccess
                            : styles.testResultError,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: testStates[pType].result.success
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.testResultText,
                            {
                              color: testStates[pType].result.success
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        >
                          {testStates[pType].result.message}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* ═══════════════════════════════════════════════════════
              Save Status Message
              ═══════════════════════════════════════════════════════ */}
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

          {/* ═══════════════════════════════════════════════════════
              Save Button
              ═══════════════════════════════════════════════════════ */}
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

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
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

  // Header
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

  // Section
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },

  // Card (global defaults)
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "700",
  },

  // Form elements
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
  currencyPrefix: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: "600",
    marginRight: spacing.sm,
  },
  thresholdInput: {
    flex: 1,
    backgroundColor: colors.background,
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
  toggleButtonLocked: {
    borderColor: colors.warning,
  },
  toggleButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // Picker chips
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pickerChip: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 48,
    alignItems: "center",
  },
  pickerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLight,
  },
  pickerChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  pickerChipTextActive: {
    color: colors.primary,
  },
  pickerUnit: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
  },

  // Provider card
  providerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  providerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  providerHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  brandIconText: {
    color: "#FFFFFF",
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  providerName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  providerBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.md,
  },

  // Status chip
  statusChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
  },
  statusChipConfigured: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  statusChipUnconfigured: {
    backgroundColor: "rgba(85, 102, 128, 0.15)",
  },
  statusChipText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // Unsaved changes dot
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },

  // Chevron
  chevron: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
  },

  // Toggle switch (custom)
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  toggleLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "500",
    flex: 1,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceBorder,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  testButton: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  testButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // Test result
  testResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  testResultSuccess: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
  },
  testResultError: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  testResultText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    flex: 1,
  },

  // Field hint (reused from old code)
  fieldHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    lineHeight: 16,
  },

  // Status message (global save)
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

  // Save button
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
