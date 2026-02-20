import type { BaseProvider } from "../providers/base.js";
import type { ToolRegistry } from "../tools/index.js";
import { DESTRUCTIVE_TOOLS } from "../tools/index.js";
import type { ContextManager } from "./context.js";
import type { StreamChunk, ToolCall, ChatOptions } from "../config/types.js";

export interface AgentEvents {
  onTextDelta: (text: string) => void;
  onToolCallStart: (toolCall: ToolCall) => void;
  onToolCallEnd: (toolCall: ToolCall, result: string, error?: string) => void;
  onTurnComplete: (usage?: { promptTokens: number; completionTokens: number }) => void;
  onError: (error: string) => void;
  requestPermission: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
}

export interface AgentLoopOptions {
  maxToolCalls?: number;
  warnAtToolCalls?: number;
}

export class AgentLoop {
  private provider: BaseProvider;
  private toolRegistry: ToolRegistry;
  private context: ContextManager;
  private events: AgentEvents;
  private options: AgentLoopOptions;
  private abortController: AbortController | null = null;
  private toolCallCount = 0;

  constructor(
    provider: BaseProvider,
    toolRegistry: ToolRegistry,
    context: ContextManager,
    events: AgentEvents,
    options?: AgentLoopOptions,
  ) {
    this.provider = provider;
    this.toolRegistry = toolRegistry;
    this.context = context;
    this.events = events;
    this.options = {
      maxToolCalls: options?.maxToolCalls ?? 50,
      warnAtToolCalls: options?.warnAtToolCalls ?? 40,
    };
  }

  async run(userMessage: string): Promise<void> {
    this.toolCallCount = 0;
    this.abortController = new AbortController();

    this.context.addUserMessage(userMessage);

    try {
      await this.agentLoop();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        this.events.onError("Request cancelled.");
      } else {
        this.events.onError(
          err instanceof Error ? err.message : String(err),
        );
      }
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  private async agentLoop(): Promise<void> {
    const chatOptions: ChatOptions = {
      signal: this.abortController?.signal,
    };

    while (true) {
      // Check tool call limit
      if (this.toolCallCount >= (this.options.maxToolCalls ?? 50)) {
        this.events.onError(
          `Reached maximum tool call limit (${this.options.maxToolCalls}). Stopping.`,
        );
        break;
      }

      let fullText = "";
      const pendingToolCalls: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();
      let hasToolCalls = false;

      const stream = this.provider.chat(
        this.context.getAllMessages(),
        this.toolRegistry.tools,
        chatOptions,
      );

      for await (const chunk of stream) {
        switch (chunk.type) {
          case "text":
            fullText += chunk.text;
            this.events.onTextDelta(chunk.text);
            break;

          case "tool_call_start":
            hasToolCalls = true;
            {
              const index = pendingToolCalls.size;
              pendingToolCalls.set(index, {
                id: chunk.toolCall.id,
                name: chunk.toolCall.function.name,
                arguments: "",
              });
              this.events.onToolCallStart(chunk.toolCall);
            }
            break;

          case "tool_call_delta":
            {
              const tc = pendingToolCalls.get(chunk.index);
              if (tc) {
                tc.arguments += chunk.argumentsDelta;
              }
            }
            break;

          case "tool_call_end":
            // Tool call arguments are now complete
            break;

          case "done":
            if (chunk.usage) {
              this.events.onTurnComplete(chunk.usage);
            }
            break;

          case "error":
            this.events.onError(chunk.error);
            return;
        }
      }

      if (!hasToolCalls) {
        // No tool calls: the turn is complete
        this.context.addAssistantMessage(fullText);
        this.events.onTurnComplete();
        break;
      }

      // Process tool calls
      const toolCalls: ToolCall[] = [];
      for (const [, tc] of pendingToolCalls) {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        });
      }

      // Add assistant message with tool calls
      this.context.addAssistantMessage(fullText, toolCalls);

      // Execute each tool call
      for (const toolCall of toolCalls) {
        this.toolCallCount++;

        // Warn if approaching limit
        if (
          this.toolCallCount === (this.options.warnAtToolCalls ?? 40)
        ) {
          this.events.onError(
            `Warning: ${this.toolCallCount} tool calls used. Limit is ${this.options.maxToolCalls}.`,
          );
        }

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          const errorMsg = "Failed to parse tool arguments as JSON";
          this.context.addToolResult(toolCall.id, errorMsg, toolCall.function.name);
          this.events.onToolCallEnd(toolCall, errorMsg, errorMsg);
          continue;
        }

        // Check permissions for destructive tools
        if (DESTRUCTIVE_TOOLS.has(toolCall.function.name)) {
          const allowed = await this.events.requestPermission(
            toolCall.function.name,
            args,
          );
          if (!allowed) {
            const denied = "Permission denied by user.";
            this.context.addToolResult(toolCall.id, denied, toolCall.function.name);
            this.events.onToolCallEnd(toolCall, denied);
            continue;
          }
        }

        // Execute the tool
        try {
          const result = await this.toolRegistry.execute(
            toolCall.function.name,
            args,
          );
          this.context.addToolResult(toolCall.id, result, toolCall.function.name);
          this.events.onToolCallEnd(toolCall, result);
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : String(err);
          this.context.addToolResult(
            toolCall.id,
            `Error: ${errorMsg}`,
            toolCall.function.name,
          );
          this.events.onToolCallEnd(toolCall, "", errorMsg);
        }
      }

      // Loop back to get the next response from the model
    }
  }
}
