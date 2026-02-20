import type {
  Message,
  Tool,
  ChatOptions,
  StreamChunk,
  ToolCall,
} from "../config/types.js";

export interface BaseProvider {
  name: string;
  models: string[];
  defaultModel: string;
  chat(
    messages: Message[],
    tools: Tool[],
    options: ChatOptions,
  ): AsyncIterable<StreamChunk>;
  countTokens?(messages: Message[]): Promise<number>;
}

/**
 * Convert our internal Message format to OpenAI-compatible message format.
 */
export function toOpenAIMessages(
  messages: Message[],
): Record<string, unknown>[] {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content,
        tool_call_id: msg.toolCallId,
      };
    }
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

/**
 * Convert our internal Tool format to OpenAI function calling format.
 */
export function toOpenAITools(
  tools: Tool[],
): Record<string, unknown>[] | undefined {
  if (tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * Parse an OpenAI-compatible SSE stream into StreamChunks.
 */
export async function* parseOpenAIStream(
  response: Response,
): AsyncIterable<StreamChunk> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    yield {
      type: "error",
      error: `API error ${response.status}: ${body}`,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const activeToolCalls: Map<
    number,
    { id: string; name: string; arguments: string }
  > = new Map();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          // Finalize any open tool calls
          for (const [index] of activeToolCalls) {
            yield { type: "tool_call_end", index };
          }
          yield { type: "done" };
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const choices = parsed.choices as Array<Record<string, unknown>>;
        if (!choices || choices.length === 0) continue;

        const choice = choices[0];
        const delta = choice.delta as Record<string, unknown> | undefined;
        if (!delta) {
          // Check for usage in the final chunk
          if (parsed.usage) {
            const usage = parsed.usage as Record<string, number>;
            yield {
              type: "done",
              usage: {
                promptTokens: usage.prompt_tokens ?? 0,
                completionTokens: usage.completion_tokens ?? 0,
              },
            };
          }
          continue;
        }

        // Text content
        if (delta.content && typeof delta.content === "string") {
          yield { type: "text", text: delta.content };
        }

        // Tool calls
        const toolCalls = delta.tool_calls as
          | Array<Record<string, unknown>>
          | undefined;
        if (toolCalls) {
          for (const tc of toolCalls) {
            const index = (tc.index as number) ?? 0;
            const fn = tc.function as Record<string, string> | undefined;

            if (!activeToolCalls.has(index)) {
              // New tool call
              const toolCall: ToolCall = {
                id: (tc.id as string) ?? `call_${Date.now()}_${index}`,
                type: "function",
                function: {
                  name: fn?.name ?? "",
                  arguments: "",
                },
              };
              activeToolCalls.set(index, {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: "",
              });
              yield { type: "tool_call_start", toolCall };
            }

            if (fn?.arguments) {
              const current = activeToolCalls.get(index);
              if (current) {
                current.arguments += fn.arguments;
              }
              yield {
                type: "tool_call_delta",
                index,
                argumentsDelta: fn.arguments,
              };
            }
          }
        }

        // finish_reason
        const finishReason = choice.finish_reason as string | null;
        if (finishReason === "tool_calls" || finishReason === "stop") {
          for (const [index] of activeToolCalls) {
            yield { type: "tool_call_end", index };
          }
          if (parsed.usage) {
            const usage = parsed.usage as Record<string, number>;
            yield {
              type: "done",
              usage: {
                promptTokens: usage.prompt_tokens ?? 0,
                completionTokens: usage.completion_tokens ?? 0,
              },
            };
          }
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.usage) {
            const usage = parsed.usage as Record<string, number>;
            yield {
              type: "done",
              usage: {
                promptTokens: usage.prompt_tokens ?? 0,
                completionTokens: usage.completion_tokens ?? 0,
              },
            };
          }
        } catch {
          // Ignore parse errors for final buffer
        }
      }
    }

    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}
