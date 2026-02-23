import type { Message } from "../config/types.js";

/**
 * Estimate token count for a set of messages.
 * This is a rough heuristic: ~4 characters per token for Chinese/English mixed text.
 * For more accurate counting, use the provider's countTokens method.
 */
export function estimateTokens(messages: Message[]): number {
  let total = 0;

  for (const msg of messages) {
    // Message overhead (role, separators)
    total += 4;

    // Content tokens
    total += estimateStringTokens(msg.content);

    // Tool call tokens
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateStringTokens(tc.function.name);
        total += estimateStringTokens(tc.function.arguments);
        total += 3; // overhead
      }
    }
  }

  return total;
}

export function estimateStringTokens(text: string): number {
  if (!text) return 0;

  // Count Chinese characters (each is roughly 1-2 tokens)
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const otherChars = text.length - chineseChars;

  // Chinese: ~1.5 tokens per char, English: ~0.25 tokens per char (4 chars/token)
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * Rough cost estimation in USD.
 * Prices vary by provider and model; these are approximate.
 */
export function estimateCost(
  promptTokens: number,
  completionTokens: number,
  provider: string,
  model: string,
): number {
  // Approximate prices per 1M tokens (input/output)
  const pricing: Record<string, Record<string, [number, number]>> = {
    kimi: {
      "moonshot-v1-8k": [12, 12],
      "moonshot-v1-32k": [24, 24],
      "moonshot-v1-128k": [60, 60],
      default: [24, 24],
    },
    glm: {
      "glm-4-plus": [50, 50],
      "glm-4": [100, 100],
      "glm-4-flash": [1, 1],
      default: [50, 50],
    },
    deepseek: {
      "deepseek-chat": [1, 2],
      "deepseek-coder": [1, 2],
      "deepseek-reasoner": [4, 16],
      default: [1, 2],
    },
  };

  // Ollama is free local inference
  if (provider === "ollama") return 0;

  const providerPricing = pricing[provider] ?? {};
  const [inputPrice, outputPrice] =
    providerPricing[model] ?? providerPricing["default"] ?? [10, 10];

  // Convert RMB to USD approximately (prices above are in RMB per 1M tokens)
  const rmb2usd = 0.14;
  const cost =
    (promptTokens * inputPrice + completionTokens * outputPrice) /
    1_000_000 *
    rmb2usd;

  return Math.round(cost * 10000) / 10000; // Round to 4 decimal places
}
