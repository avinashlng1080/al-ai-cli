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

export interface OpenAICompatConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  headers?: Record<string, string>;
}

export class OpenAICompatProvider implements BaseProvider {
  name: string;
  models: string[];
  defaultModel: string;
  private baseUrl: string;
  private apiKey: string;
  private extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.models = config.models;
    this.defaultModel = config.defaultModel;
    this.extraHeaders = config.headers ?? {};
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
      stream_options: { include_usage: true },
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
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    yield* parseOpenAIStream(response);
  }
}
