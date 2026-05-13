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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSettings } from "../hooks/useSettings";
import { getAvailableProviders, getProvider } from "../api";
import { AppSettings, ProviderSettings, ProviderType } from "../types";
import { colors, spacing, borderRadius, fontSize, fonts, providerColors } from "../theme";

// ── Constants ─────────────────────────────────────────────────────

const ALL_PROVIDERS: ProviderType[] = [
  "deepseek",
  "openai",
  "anthropic",
  "gemini",
];

const REFRESH_OPTIONS = [15, 30, 60, 120];

const PROVIDER_ICONS: Record<ProviderType, string> = {
  deepseek: "DS",
  openai: "OA",
  anthropic: "AN",
  gemini: "GM",
};

// ── Helpers ───────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key[0] + "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return key.slice(0, 3) + "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + key.slice(-4);
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

  // ── Navigation guard ────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Leave anyway?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  // ── Biometric check ─────────────────────────────────────────────

  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return;
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(enrolled);
    })();
  }, []);

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
          promptMessage: "Authenticate to view API Key",
          fallbackLabel: "Use device password",
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
            result: { success: false, message: "Enter API key first" },
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
          throw new Error("Provider implementation not found");
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
                message: `Connected. Balance: \u00A5${total.toFixed(2)}`,
              },
            },
          }));
        } else {
          setTestStates((prev) => ({
            ...prev,
            [provider]: {
              testing: false,
              result: { success: false, message: "Could not fetch balance" },
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
              message: e instanceof Error ? e.message : "Connection failed",
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
      setStatusMessage({ type: "error", message: "Refresh interval must be at least 1 min" });
      return;
    }
    if (isNaN(globalThreshold) || globalThreshold < 0) {
      setStatusMessage({ type: "error", message: "Threshold must be a valid number" });
      return;
    }

    const hasAnyKey = ALL_PROVIDERS.some(
      (p) => providerForms[p].apiKey.trim().length > 0
    );
    if (!hasAnyKey) {
      setStatusMessage({ type: "error", message: "Configure at least one API key" });
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
      setStatusMessage({ type: "success", message: "Settings saved" });
    } catch (e) {
      setStatusMessage({
        type: "error",
        message: e instanceof Error ? e.message : "Save failed",
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
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading settings...</Text>
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
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.pageTitle}>Settings</Text>
              <Text style={styles.pageSubtitle}>Preferences</Text>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════
              GLOBAL DEFAULTS
              ═══════════════════════════════════════════════════════ */}
          <Text style={styles.sectionLabel}>GLOBAL DEFAULTS</Text>
          <View style={styles.section}>
            {/* Refresh Interval */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowLeft}>
                <Text style={styles.settingsRowLabel}>Refresh Interval</Text>
                <Text style={styles.settingsRowSub}>Auto-sync frequency</Text>
              </View>
              <View style={styles.intervalGroup}>
                {REFRESH_OPTIONS.map((opt) => {
                  const isActive = String(opt) === defaultRefreshIntervalMin;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.intervalBtn,
                        isActive && styles.intervalBtnSelected,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setDefaultRefreshIntervalMin(String(opt));
                        setStatusMessage(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.intervalBtnText,
                          isActive && styles.intervalBtnTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Balance Alert */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowLeft}>
                <Text style={styles.settingsRowLabel}>Balance Alert</Text>
                <Text style={styles.settingsRowSub}>Warn when below</Text>
              </View>
              <View style={styles.thresholdWrap}>
                <Text style={styles.thresholdCurrency}>{"\u00A5"}</Text>
                <TextInput
                  style={styles.thresholdInput}
                  value={defaultLowBalanceThreshold}
                  onChangeText={(v) => {
                    setDefaultLowBalanceThreshold(v);
                    setStatusMessage(null);
                  }}
                  placeholder="1.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  selectionColor={colors.accent}
                />
              </View>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════
              PROVIDERS
              ═══════════════════════════════════════════════════════ */}
          <Text style={styles.sectionLabel}>PROVIDERS</Text>
          <View style={styles.section}>
            {ALL_PROVIDERS.map((pType) => {
              const provider = providers.find((p) => p.type === pType);
              if (!provider) return null;
              const form = providerForms[pType];
              const isExpanded = expandedProvider === pType;
              const isConfigured = form.apiKey.trim().length > 0;
              const changes = hasProviderChanges(pType);

              return (
                <View key={pType}>
                  {/* ── Row (collapsed) ── */}
                  <TouchableOpacity
                    style={[
                      styles.provRow,
                      ALL_PROVIDERS.indexOf(pType) < ALL_PROVIDERS.length - 1 &&
                        styles.provRowBorder,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleExpandProvider(pType)}
                  >
                    {/* Badge */}
                    <View
                      style={[
                        styles.provBadge,
                        isConfigured
                          ? {
                              backgroundColor: providerColors[pType] + "1A",
                              borderColor: providerColors[pType] + "33",
                            }
                          : {
                              backgroundColor: colors.bg3,
                              borderColor: colors.border,
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.provBadgeText,
                          {
                            color: isConfigured
                              ? providerColors[pType]
                              : colors.textTertiary,
                          },
                        ]}
                      >
                        {PROVIDER_ICONS[pType]}
                      </Text>
                    </View>

                    {/* Name */}
                    <Text style={styles.provName}>{provider.name}</Text>

                    {/* Status tag */}
                    {isConfigured ? (
                      <View style={styles.tagConfigured}>
                        <Text style={styles.tagConfiguredText}>Active</Text>
                      </View>
                    ) : (
                      <View style={styles.tagUnconfigured}>
                        <Text style={styles.tagUnconfiguredText}>Setup</Text>
                      </View>
                    )}

                    {/* Unsaved dot */}
                    {changes && <View style={styles.unsavedDot} />}

                    {/* Chevron */}
                    <Text style={styles.expandIcon}>
                      {isExpanded ? "\u25B2" : "\u203A"}
                    </Text>
                  </TouchableOpacity>

                  {/* ── Expanded body ── */}
                  {isExpanded && (
                    <View style={styles.provBody}>
                      {/* API Key */}
                      <Text style={styles.fieldLabel}>API Key</Text>
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
                          placeholderTextColor={colors.textTertiary}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={visibleApiKeys[pType]}
                          selectionColor={colors.accent}
                        />
                        <TouchableOpacity
                          style={[
                            styles.toggleKeyBtn,
                            biometricAvailable &&
                              !biometricAuthed[pType] &&
                              styles.toggleKeyBtnLocked,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => handleToggleApiKey(pType)}
                        >
                          <Text style={styles.toggleKeyBtnText}>
                            {visibleApiKeys[pType]
                              ? "Hide"
                              : biometricAvailable
                                ? "\uD83D\uDD12 Show"
                                : "Show"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Custom Refresh Toggle */}
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>
                          Custom refresh interval
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
                              form.useCustomRefresh && styles.switchThumbActive,
                            ]}
                          />
                        </TouchableOpacity>
                      </View>

                      {form.useCustomRefresh && (
                        <View style={styles.intervalGroup}>
                          {REFRESH_OPTIONS.map((opt) => {
                            const isActive =
                              String(opt) === form.customRefreshIntervalMin;
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.intervalBtn,
                                  isActive && styles.intervalBtnSelected,
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
                                    styles.intervalBtnText,
                                    isActive && styles.intervalBtnTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {/* Custom Threshold Toggle */}
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>
                          Custom alert threshold
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
                        <View style={styles.thresholdWrap}>
                          <Text style={styles.thresholdCurrency}>
                            {"\u00A5"}
                          </Text>
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
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="decimal-pad"
                            selectionColor={colors.accent}
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
                              color={colors.accent}
                              size="small"
                            />
                          ) : (
                            <Text style={styles.testButtonText}>
                              Test Connection
                            </Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.clearButton}
                          activeOpacity={0.7}
                          onPress={() => handleClearApiKey(pType)}
                        >
                          <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Test result */}
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
                                backgroundColor: testStates[pType].result
                                  .success
                                  ? colors.green
                                  : colors.red,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.testResultText,
                              {
                                color: testStates[pType].result.success
                                  ? colors.green
                                  : colors.red,
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
          </View>

          {/* ── Status Message ── */}
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
                        ? colors.green
                        : colors.red,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      statusMessage.type === "success"
                        ? colors.green
                        : colors.red,
                  },
                ]}
              >
                {statusMessage.message}
              </Text>
            </View>
          )}

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Settings</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

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
    paddingHorizontal: spacing.xl - 4,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // ── Header ──────────────────────────────────────────────────

  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl - 4,
  },
  pageTitle: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  pageSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },

  // ── Section Label ───────────────────────────────────────────

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: spacing.sm + 2,
  },

  // ── Section Card ────────────────────────────────────────────

  section: {
    backgroundColor: colors.bg1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },

  // ── Settings Row ────────────────────────────────────────────

  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  settingsRowLeft: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  settingsRowSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },

  // ── Interval Buttons ────────────────────────────────────────

  intervalGroup: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  intervalBtn: {
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: spacing.xs + 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  intervalBtnSelected: {
    backgroundColor: colors.accentDim,
    borderColor: "rgba(59,125,255,0.35)",
  },
  intervalBtnText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  intervalBtnTextSelected: {
    color: colors.accent,
  },

  // ── Threshold Input ─────────────────────────────────────────

  thresholdWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  thresholdCurrency: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  thresholdInput: {
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.mono,
    fontSize: fontSize.md - 1,
    color: colors.textPrimary,
    width: 80,
    textAlign: "right",
  },

  // ── Provider Row ────────────────────────────────────────────

  provRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md + 2,
  },
  provRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  provBadge: {
    width: 42,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  provBadgeText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  provName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  // Status tags
  tagConfigured: {
    paddingVertical: 3,
    paddingHorizontal: spacing.xs + 5,
    borderRadius: spacing.xs + 1,
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: "rgba(31,200,126,0.2)",
  },
  tagConfiguredText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    color: colors.green,
  },
  tagUnconfigured: {
    paddingVertical: 3,
    paddingHorizontal: spacing.xs + 5,
    borderRadius: spacing.xs + 1,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagUnconfiguredText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xxs + 1,
    color: colors.textTertiary,
  },

  // Unsaved dot
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },

  // Expand icon
  expandIcon: {
    fontFamily: fonts.mono,
    fontSize: fontSize.lg,
    color: colors.textTertiary,
  },

  // ── Provider Expanded Body ──────────────────────────────────

  provBody: {
    paddingHorizontal: spacing.md + 2,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.mono,
    fontWeight: "500",
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.mono,
  },
  toggleKeyBtn: {
    backgroundColor: colors.bg2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  toggleKeyBtnLocked: {
    borderColor: colors.amber,
  },
  toggleKeyBtnText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // Toggle switch
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
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
    backgroundColor: colors.bg3,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: colors.accent,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textSecondary,
  },
  switchThumbActive: {
    alignSelf: "flex-end",
    backgroundColor: "#ffffff",
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  testButton: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  testButtonText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red + "40",
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  clearButtonText: {
    color: colors.red,
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
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: "rgba(31,200,126,0.3)",
  },
  testResultError: {
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: "rgba(240,68,68,0.3)",
  },
  testResultText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.xs,
    fontWeight: "500",
    flex: 1,
  },

  // ── Status Message ──────────────────────────────────────────

  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  statusSuccess: {
    backgroundColor: colors.greenDim,
    borderWidth: 1,
    borderColor: "rgba(31,200,126,0.3)",
  },
  statusError: {
    backgroundColor: colors.redDim,
    borderWidth: 1,
    borderColor: "rgba(240,68,68,0.3)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    fontWeight: "500",
    flex: 1,
  },

  // ── Save Button ─────────────────────────────────────────────

  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: spacing.md - 2,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: fontSize.lg - 1,
    fontWeight: "600",
    letterSpacing: -0.2,
    fontFamily: fonts.sans,
  },
});
