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

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const DEEPSEEK_MODELS = [
  "deepseek-chat",
  "deepseek-coder",
  "deepseek-reasoner",
];

export class DeepSeekProvider implements BaseProvider {
  name = "deepseek";
  models = DEEPSEEK_MODELS;
  defaultModel: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model ?? "deepseek-chat";
    this.baseUrl = (baseUrl ?? DEEPSEEK_BASE_URL).replace(/\/+$/, "");
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
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }
}
