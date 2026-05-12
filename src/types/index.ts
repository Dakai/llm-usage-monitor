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
  timestamp: string;
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
}

export interface DailyUsage {
  date: string;
  currency: string;
  balanceStart: number;
  balanceEnd: number;
  cost: number;
  estimatedTokens: number;
}

export interface AppSettings {
  apiKey: string;
  refreshIntervalMin: number;
  lowBalanceThreshold: number;
  provider: ProviderType;
}

export type ProviderType = "deepseek";

export interface UsageProvider {
  type: ProviderType;
  name: string;
  getBalance(apiKey: string): Promise<BalanceResult>;
  pricing: {
    inputCacheHit: number;
    inputCacheMiss: number;
    output: number;
  };
}

export interface ProviderError {
  type: ProviderType;
  message: string;
  timestamp: string;
}
