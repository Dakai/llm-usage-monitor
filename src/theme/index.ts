import { Platform } from "react-native";

export const colors = {
  background: "#090e1a",
  bg1: "#0d1526",
  bg2: "#111d35",
  bg3: "#162240",
  border: "rgba(255,255,255,0.06)",
  borderHi: "rgba(255,255,255,0.12)",
  textPrimary: "#f0f4ff",
  textSecondary: "#7d8fb3",
  textTertiary: "#4a5a7a",
  accent: "#3b7dff",
  accentDim: "rgba(59,125,255,0.12)",
  accentGlow: "rgba(59,125,255,0.08)",
  green: "#1fc87e",
  greenDim: "rgba(31,200,126,0.1)",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.1)",
  red: "#f04444",
  redDim: "rgba(240,68,68,0.1)",
  chartColors: [
    "#3b7dff",
    "#1fc87e",
    "#f59e0b",
    "#f04444",
    "#7c4dff",
    "#e91e63",
    "#ff5722",
  ],
} as const;

export const fonts = {
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xxs: 9,
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  hero: 42,
} as const;

export const providerColors: Record<string, string> = {
  deepseek: "#1fc87e",
  openai: "#10A37F",
  anthropic: "#D97757",
  gemini: "#4285F4",
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
