import type {
  Message,
  Tool,
  ChatOptions,
  StreamChunk,
} from "../config/types.js";
import {
  type BaseProvider,
  toOpenAIMessages,
  toOpenAITools,
  parseOpenAIStream,
} from "./base.js";

const KIMI_BASE_URL = "https://api.moonshot.cn/v1";

const KIMI_MODELS = [
  "moonshot-v1-8k",
  "moonshot-v1-32k",
  "moonshot-v1-128k",
  "moonshot-v1-auto",
];

export class KimiProvider implements BaseProvider {
  name = "kimi";
  models = KIMI_MODELS;
  defaultModel: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model ?? "moonshot-v1-128k";
    this.baseUrl = (baseUrl ?? KIMI_BASE_URL).replace(/\/+$/, "");
  }

  async *chat(
    messages: Message[],
    tools: Tool[],
    options: ChatOptions,
  ): AsyncIterable<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.defaultModel,
      messages: toOpenAIMessages(messages),
      stream: true,
    };

    const openAITools = toOpenAITools(tools);
    if (openAITools) {
      body.tools = openAITools;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    yield* parseOpenAIStream(response);
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Kimi provides a token counting endpoint
    try {
      const response = await fetch(
        `${this.baseUrl}/tokenizers/estimate-token-count`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.defaultModel,
            messages: toOpenAIMessages(messages),
          }),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as {
          data: { total_tokens: number };
        };
        return data.data.total_tokens;
      }
    } catch {
      // Fall back to estimation
    }
    // Rough estimate: ~4 chars per token for Chinese/English mix
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }
}
