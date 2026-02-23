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

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const DEFAULT_OLLAMA_TIMEOUT = 300_000; // 5 minutes for local inference

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export class OllamaProvider implements BaseProvider {
  name = "ollama";
  models: string[] = [];
  defaultModel: string;
  private baseUrl: string;
  private timeout: number;

  constructor(model?: string, baseUrl?: string, timeout?: number) {
    this.baseUrl = (
      baseUrl ??
      process.env.OLLAMA_HOST ??
      DEFAULT_OLLAMA_HOST
    ).replace(/\/+$/, "");
    this.defaultModel = model ?? process.env.OLLAMA_MODEL ?? "llama3.2";
    this.timeout = timeout ?? DEFAULT_OLLAMA_TIMEOUT;
  }

  async *chat(
    messages: Message[],
    tools: Tool[],
    options: ChatOptions,
  ): AsyncIterable<StreamChunk> {
    // Use Ollama's OpenAI-compatible endpoint
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Combine external signal with our timeout
    const onExternalAbort = () => controller.abort();
    if (options.signal) {
      options.signal.addEventListener("abort", onExternalAbort);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      yield* parseOpenAIStream(response);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        yield { type: "error", error: "Request timed out or was aborted" };
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
          yield {
            type: "error",
            error:
              `Cannot connect to Ollama at ${this.baseUrl}. ` +
              "Is Ollama running? Start it with: ollama serve",
          };
        } else {
          yield { type: "error", error: `Ollama error: ${msg}` };
        }
      }
    } finally {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Check if the Ollama server is reachable.
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List locally available models.
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = (await response.json()) as { models: OllamaModel[] };
    this.models = data.models.map((m) => m.name);
    return data.models;
  }

  /**
   * Pull a model from the Ollama registry with streaming progress.
   */
  async *pullModel(modelName: string): AsyncIterable<OllamaPullProgress> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to pull model: ${response.status} ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            yield JSON.parse(trimmed) as OllamaPullProgress;
          } catch {
            continue;
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim()) as OllamaPullProgress;
        } catch {
          // Ignore
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Remove a locally stored model.
   */
  async removeModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to remove model: ${response.status} ${body}`);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Format bytes into human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
