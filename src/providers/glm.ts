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

const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const GLM_MODELS = [
  "glm-4-plus",
  "glm-4",
  "glm-4-flash",
  "glm-4-long",
  "glm-4-air",
  "glm-4-airx",
];

export class GLMProvider implements BaseProvider {
  name = "glm";
  models = GLM_MODELS;
  defaultModel: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model ?? "glm-4-plus";
    this.baseUrl = (baseUrl ?? GLM_BASE_URL).replace(/\/+$/, "");
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
    // GLM doesn't expose a public token counting endpoint; estimate.
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }
}
