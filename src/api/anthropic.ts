import { BalanceInfo, BalanceResult, RateLimitInfo, UsageProvider } from "../types";

const MODELS_URL = "https://api.anthropic.com/v1/models";
const API_VERSION = "2023-06-01";

const PRICING_PER_TOKEN_USD = {
  inputCacheHit: 1.5 / 1_000_000,
  inputCacheMiss: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
};

const COMMON_HEADERS = {
  "anthropic-version": API_VERSION,
  "Content-Type": "application/json",
} as const;

/**
 * Verify the API key via a lightweight GET to /v1/models.
 * Anthropic has no public balance API, so this returns a zeroed-out
 * BalanceResult with a note in `raw`.
 */
export async function fetchAnthropicBalance(apiKey: string): Promise<BalanceResult> {
  const response = await fetch(MODELS_URL, {
    method: "GET",
    headers: {
      ...COMMON_HEADERS,
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AnthropicAPIError(`请求失败 (${response.status}): ${text}`);
  }

  const balanceInfos: BalanceInfo[] = [
    {
      currency: "USD",
      totalBalance: 0,
      grantedBalance: 0,
      toppedUpBalance: 0,
    },
  ];

  return {
    isAvailable: true,
    balanceInfos,
    raw: { note: "Anthropic does not expose a public balance API" },
  };
}

/**
 * Read rate-limit headers from a GET /v1/models response.
 * Returns null when any of the expected headers are missing.
 */
export async function fetchAnthropicRateLimits(apiKey: string): Promise<RateLimitInfo | null> {
  const response = await fetch(MODELS_URL, {
    method: "GET",
    headers: {
      ...COMMON_HEADERS,
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AnthropicAPIError(`请求失败 (${response.status}): ${text}`);
  }

  const requestsLimit = response.headers.get("anthropic-ratelimit-requests-limit");
  const requestsRemaining = response.headers.get("anthropic-ratelimit-requests-remaining");
  const tokensLimit = response.headers.get("anthropic-ratelimit-tokens-limit");
  const tokensRemaining = response.headers.get("anthropic-ratelimit-tokens-remaining");

  if (!requestsLimit || !requestsRemaining || !tokensLimit || !tokensRemaining) {
    return null;
  }

  const rl = Number(requestsLimit);
  const rr = Number(requestsRemaining);
  const tl = Number(tokensLimit);
  const tr = Number(tokensRemaining);

  return {
    rpm: { limit: rl, used: rl - rr },
    tpm: { limit: tl, used: tl - tr },
  };
}

export class AnthropicAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicAPIError";
  }
}

export const anthropicProvider: UsageProvider = {
  type: "anthropic",
  name: "Anthropic",
  getBalance: fetchAnthropicBalance,
  getRateLimits: fetchAnthropicRateLimits,
  pricing: PRICING_PER_TOKEN_USD,
};
