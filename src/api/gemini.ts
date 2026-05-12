import { BalanceInfo, BalanceResult, RateLimitInfo, UsageProvider } from "../types";

const MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const PRICING_PER_TOKEN_USD = {
  inputCacheHit: 0.625 / 1_000_000,
  inputCacheMiss: 1.25 / 1_000_000,
  output: 5.0 / 1_000_000,
};

export class GeminiAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiAPIError";
  }
}

export async function fetchGeminiBalance(apiKey: string): Promise<BalanceResult> {
  const url = `${MODELS_URL}?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new GeminiAPIError(
        `Gemini API 认证失败 (${response.status}): 请检查 API Key 是否正确。${text}`
      );
    }
    throw new GeminiAPIError(`请求失败 (${response.status}): ${text}`);
  }

  await response.json();

  const balanceInfo: BalanceInfo = {
    currency: "USD",
    totalBalance: 0,
    grantedBalance: 0,
    toppedUpBalance: 0,
  };

  return {
    isAvailable: true,
    balanceInfos: [balanceInfo],
    raw: {
      note: "Gemini does not expose a balance API. Check console.cloud.google.com for billing.",
    },
  };
}

export async function fetchGeminiRateLimits(apiKey: string): Promise<RateLimitInfo | null> {
  const url = `${MODELS_URL}?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  await response.json();

  const limit = response.headers.get("x-ratelimit-limit");
  const remaining = response.headers.get("x-ratelimit-remaining");

  if (!limit || !remaining) {
    return null;
  }

  return {
    rpm: {
      used: Number(limit) - Number(remaining),
      limit: Number(limit),
    },
    tpm: {
      used: 0,
      limit: 0,
    },
  };
}

export const geminiProvider: UsageProvider = {
  type: "gemini",
  name: "Gemini",
  getBalance: fetchGeminiBalance,
  getRateLimits: fetchGeminiRateLimits,
  pricing: PRICING_PER_TOKEN_USD,
};
