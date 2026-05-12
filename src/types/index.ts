export interface BalanceInfo {
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
}

export interface BalanceResult {
  isAvailable: boolean;
  balanceInfos: BalanceInfo[];
  raw: Record<string, unknown>;
}

export interface BalanceSnapshot {
  id?: number;
  provider: ProviderType;
  timestamp: string;
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
}

export interface DailyUsage {
  date: string;
  provider: ProviderType;
  currency: string;
  balanceStart: number;
  balanceEnd: number;
  cost: number;
  estimatedTokens: number;
}

export interface RateLimitInfo {
  rpm: { used: number; limit: number };
  tpm: { used: number; limit: number };
}

// ── Provider types ──────────────────────────────────────────────

export type ProviderType = "deepseek" | "openai" | "anthropic" | "gemini";

export interface UsageProvider {
  type: ProviderType;
  name: string;
  getBalance(apiKey: string): Promise<BalanceResult>;
  getRateLimits?: (apiKey: string) => Promise<RateLimitInfo | null>;
  pricing: {
    inputCacheHit: number;
    inputCacheMiss: number;
    output: number;
  };
}

// ── Settings ────────────────────────────────────────────────────

export interface ProviderSettings {
  apiKey: string;
  refreshIntervalMin: number | null; // null = inherit global default
  lowBalanceThreshold: number | null; // null = inherit global default
}

export interface AppSettings {
  defaultRefreshIntervalMin: number;
  defaultLowBalanceThreshold: number;
  providers: Partial<Record<ProviderType, ProviderSettings>>;
}

// ── Runtime state ───────────────────────────────────────────────

export interface ProviderBalanceState {
  provider: ProviderType;
  balance: BalanceResult | null;
  rateLimits: RateLimitInfo | null;
  isLoading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
}

export interface ProviderError {
  type: ProviderType;
  message: string;
  timestamp: string;
}
