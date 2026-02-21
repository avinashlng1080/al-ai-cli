import { z } from "zod";

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const McpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  transport: z.enum(["stdio", "sse"]).default("stdio"),
  url: z.string().url().optional(),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const GlobalConfigSchema = z.object({
  defaultProvider: z
    .enum(["kimi", "glm", "deepseek", "ollama", "custom"])
    .default("deepseek"),
  providers: z
    .record(z.enum(["kimi", "glm", "deepseek", "ollama", "custom"]), ProviderConfigSchema)
    .default({}),
  mcpServers: z.record(z.string(), McpServerConfigSchema).default({}),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const ProjectConfigSchema = z.object({
  provider: z.enum(["kimi", "glm", "deepseek", "ollama", "custom"]).optional(),
  model: z.string().optional(),
  contextFile: z.string().default("ZEN.md"),
  mcpServers: z.record(z.string(), McpServerConfigSchema).default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export type ProviderName = "kimi" | "glm" | "deepseek" | "ollama" | "custom";

export interface ResolvedConfig {
  provider: ProviderName;
  apiKey: string;
  model: string;
  baseUrl: string;
  contextFile: string;
  mcpServers: Record<string, McpServerConfig>;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_delta"; index: number; argumentsDelta: string }
  | { type: "tool_call_end"; index: number }
  | { type: "done"; usage?: { promptTokens: number; completionTokens: number } }
  | { type: "error"; error: string };
