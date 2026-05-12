import { BalanceInfo, BalanceResult, UsageProvider } from "../types";

const BALANCE_URL = "https://api.deepseek.com/user/balance";

const PRICING_PER_TOKEN_CNY = {
  inputCacheHit: 0.028 / 1_000_000,
  inputCacheMiss: 0.28 / 1_000_000,
  output: 0.42 / 1_000_000,
};

export async function fetchDeepSeekBalance(apiKey: string): Promise<BalanceResult> {
  const response = await fetch(BALANCE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new DeepSeekAPIError(`请求失败 (${response.status}): ${text}`);
  }

  const data = await response.json();

  const balanceInfos: BalanceInfo[] = (data.balance_infos || []).map(
    (info: Record<string, unknown>) => ({
      currency: (info.currency as string) || "CNY",
      totalBalance: Number(info.total_balance || 0),
      grantedBalance: Number(info.granted_balance || 0),
      toppedUpBalance: Number(info.topped_up_balance || 0),
    })
  );

  return {
    isAvailable: Boolean(data.is_available),
    balanceInfos,
    raw: data,
  };
}

export class DeepSeekAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekAPIError";
  }
}

export const deepseekProvider: UsageProvider = {
  type: "deepseek",
  name: "DeepSeek",
  getBalance: fetchDeepSeekBalance,
  pricing: PRICING_PER_TOKEN_CNY,
};
