export const colors = {
  background: "#0A1628",
  surface: "#0F1F3A",
  surfaceLight: "#15294A",
  surfaceBorder: "#1E3A5F",
  primary: "#1E90FF",
  primaryLight: "#4DA8FF",
  primaryDark: "#1565C0",
  accent: "#00B4D8",
  success: "#4CAF50",
  warning: "#FF9800",
  danger: "#F44336",
  text: "#E8F0FE",
  textSecondary: "#8899B4",
  textMuted: "#556680",
  chartColors: ["#1E90FF", "#4CAF50", "#FF9800", "#00B4D8", "#7C4DFF", "#E91E63", "#FF5722"],
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
  xl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  hero: 48,
} as const;

export const providerColors: Record<string, string> = {
  deepseek: "#1E90FF",
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
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
