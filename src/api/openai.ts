import { BalanceInfo, BalanceResult, RateLimitInfo, UsageProvider } from "../types";

const SUBSCRIPTION_URL = "https://api.openai.com/v1/dashboard/billing/subscription";
const MODELS_URL = "https://api.openai.com/v1/models";

const PRICING_PER_TOKEN_USD = {
  inputCacheHit: 1.25 / 1_000_000,
  inputCacheMiss: 2.50 / 1_000_000,
  output: 10.00 / 1_000_000,
};

export class OpenAIAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIAPIError";
  }
}

export async function fetchOpenAIBalance(apiKey: string): Promise<BalanceResult> {
  const response = await fetch(SUBSCRIPTION_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new OpenAIAPIError(
        `OpenAI API 认证失败 (${response.status}): 请检查 API Key 是否正确。${text}`
      );
    }
    throw new OpenAIAPIError(`请求失败 (${response.status}): ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const hardLimitUsd = Number(data.hard_limit_usd ?? 0);
  const systemHardLimitUsd = Number(data.system_hard_limit_usd ?? 0);
  const totalBalance = systemHardLimitUsd > 0 ? systemHardLimitUsd : hardLimitUsd;

  const balanceInfo: BalanceInfo = {
    currency: "USD",
    totalBalance,
    grantedBalance: 0,
    toppedUpBalance: totalBalance,
  };

  return {
    isAvailable: true,
    balanceInfos: [balanceInfo],
    raw: data,
  };
}

export async function fetchOpenAIRateLimits(apiKey: string): Promise<RateLimitInfo | null> {
  const response = await fetch(MODELS_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const limitRequests = response.headers.get("x-ratelimit-limit-requests");
  const remainingRequests = response.headers.get("x-ratelimit-remaining-requests");
  const limitTokens = response.headers.get("x-ratelimit-limit-tokens");
  const remainingTokens = response.headers.get("x-ratelimit-remaining-tokens");

  if (!limitRequests || !remainingRequests || !limitTokens || !remainingTokens) {
    return null;
  }

  return {
    rpm: {
      used: Number(limitRequests) - Number(remainingRequests),
      limit: Number(limitRequests),
    },
    tpm: {
      used: Number(limitTokens) - Number(remainingTokens),
      limit: Number(limitTokens),
    },
  };
}

export const openaiProvider: UsageProvider = {
  type: "openai",
  name: "OpenAI",
  getBalance: fetchOpenAIBalance,
  getRateLimits: fetchOpenAIRateLimits,
  pricing: PRICING_PER_TOKEN_USD,
};
