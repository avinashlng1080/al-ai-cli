import React, { useState, useCallback, useRef, useEffect } from "react";
import { Text, Box, useInput, useApp } from "ink";
import type { ResolvedConfig, ToolCall } from "./config/types.js";
import { resolveConfig } from "./config/index.js";
import { createProvider } from "./providers/index.js";
import type { BaseProvider } from "./providers/base.js";
import { createToolRegistry, DESTRUCTIVE_TOOLS } from "./tools/index.js";
import type { ToolRegistry } from "./tools/index.js";
import { AgentLoop, type AgentEvents } from "./agent/loop.js";
import { ContextManager } from "./agent/context.js";
import { McpClientManager } from "./mcp/client.js";
import { initializeMcpServers } from "./mcp/registry.js";
import { estimateCost } from "./utils/tokenCount.js";
import { ChatInput } from "./components/ChatInput.js";
import { MessageList, type DisplayMessage } from "./components/MessageList.js";
import { StatusBar } from "./components/StatusBar.js";
import { Spinner } from "./components/Spinner.js";

interface AppProps {
  initialProvider?: string;
  initialModel?: string;
  oneShot?: string;
}

export function App({
  initialProvider,
  initialModel,
  oneShot,
}: AppProps): React.ReactElement {
  const { exit } = useApp();

  // State
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [cost, setCost] = useState(0);
  const [currentProvider, setCurrentProvider] = useState(
    initialProvider ?? "",
  );
  const [currentModel, setCurrentModel] = useState(initialModel ?? "");
  const [streamingText, setStreamingText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [permissionRequest, setPermissionRequest] = useState<{
    toolName: string;
    args: Record<string, unknown>;
    resolve: (allowed: boolean) => void;
  } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Refs
  const providerRef = useRef<BaseProvider | null>(null);
  const toolRegistryRef = useRef<ToolRegistry | null>(null);
  const contextRef = useRef<ContextManager | null>(null);
  const agentLoopRef = useRef<AgentLoop | null>(null);
  const mcpManagerRef = useRef<McpClientManager | null>(null);
  const configRef = useRef<ResolvedConfig | null>(null);
  const alwaysAllowRef = useRef<Set<string>>(new Set());

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        const config = resolveConfig(initialProvider, initialModel);
        configRef.current = config;

        if (!config.apiKey && config.provider !== "ollama") {
          setStatusMessage(
            `No API key configured for ${config.provider}. Set ${config.provider.toUpperCase()}_API_KEY or run 'zen init'.`,
          );
        }

        const provider = createProvider(config);
        providerRef.current = provider;
        setCurrentProvider(config.provider);
        setCurrentModel(config.model);

        const toolRegistry = createToolRegistry();
        toolRegistryRef.current = toolRegistry;

        const context = new ContextManager();
        contextRef.current = context;

        // Initialize MCP
        const mcpManager = new McpClientManager();
        mcpManagerRef.current = mcpManager;

        if (Object.keys(config.mcpServers).length > 0) {
          await initializeMcpServers(
            config.mcpServers,
            toolRegistry,
            mcpManager,
            (msg) =>
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: msg,
                },
              ]),
          );
        }

        setInitialized(true);

        // Handle one-shot mode
        if (oneShot) {
          // Small delay to ensure render
          setTimeout(() => handleUserMessage(oneShot), 100);
        }
      } catch (err) {
        setStatusMessage(
          `Initialization error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    init();

    return () => {
      mcpManagerRef.current?.disconnectAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUserMessage = useCallback(
    async (message: string) => {
      // Handle slash commands
      if (message.startsWith("/")) {
        await handleSlashCommand(message);
        return;
      }

      setHistory((prev) => [...prev, message]);
      setIsProcessing(true);
      setStreamingText("");

      // Add user message to display
      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: message },
      ]);

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ]);

      const events: AgentEvents = {
        onTextDelta: (text: string) => {
          setStreamingText((prev) => {
            const newText = prev + text;
            setMessages((msgs) =>
              msgs.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: newText, isStreaming: true }
                  : m,
              ),
            );
            return newText;
          });
        },

        onToolCallStart: (toolCall: ToolCall) => {
          const toolMsg: DisplayMessage = {
            id: `tool-${toolCall.id}`,
            role: "tool",
            content: "",
            toolCalls: [
              {
                name: toolCall.function.name,
                args: {},
                status: "running",
              },
            ],
          };
          setMessages((prev) => [...prev, toolMsg]);
        },

        onToolCallEnd: (
          toolCall: ToolCall,
          result: string,
          error?: string,
        ) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === `tool-${toolCall.id}`
                ? {
                    ...m,
                    toolCalls: [
                      {
                        name: toolCall.function.name,
                        args: JSON.parse(
                          toolCall.function.arguments || "{}",
                        ),
                        status: error ? "error" : "done",
                        result: result || undefined,
                        error,
                      },
                    ],
                  }
                : m,
            ),
          );
        },

        onTurnComplete: (usage) => {
          if (usage) {
            setTokenCount(
              (prev) =>
                prev + usage.promptTokens + usage.completionTokens,
            );
            setCost((prev) => {
              const config = configRef.current;
              if (!config) return prev;
              return (
                prev +
                estimateCost(
                  usage.promptTokens,
                  usage.completionTokens,
                  config.provider,
                  config.model,
                )
              );
            });
          }
          // Mark streaming complete
          setMessages((msgs) =>
            msgs.map((m) =>
              m.id === assistantMsgId
                ? { ...m, isStreaming: false }
                : m,
            ),
          );
        },

        onError: (error: string) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "system",
              content: `Error: ${error}`,
            },
          ]);
        },

        requestPermission: async (
          toolName: string,
          args: Record<string, unknown>,
        ): Promise<boolean> => {
          // Check always-allow list
          if (alwaysAllowRef.current.has(toolName)) {
            return true;
          }

          return new Promise<boolean>((resolve) => {
            setPermissionRequest({ toolName, args, resolve });
          });
        },
      };

      const provider = providerRef.current;
      const toolRegistry = toolRegistryRef.current;
      const context = contextRef.current;

      if (!provider || !toolRegistry || !context) {
        setIsProcessing(false);
        return;
      }

      // Create and wire up MCP tool execution
      const mcpManager = mcpManagerRef.current;
      const wrappedRegistry: ToolRegistry = {
        tools: toolRegistry.tools,
        async execute(name: string, toolArgs: Record<string, unknown>) {
          if (mcpManager?.isMcpTool(name)) {
            return mcpManager.callTool(name, toolArgs);
          }
          return toolRegistry.execute(name, toolArgs);
        },
      };

      const agentLoop = new AgentLoop(
        provider,
        wrappedRegistry,
        context,
        events,
      );
      agentLoopRef.current = agentLoop;

      await agentLoop.run(message);

      setIsProcessing(false);
      setStreamingText("");

      // Exit after one-shot
      if (oneShot) {
        setTimeout(() => exit(), 100);
      }
    },
    [oneShot, exit],
  );

  const handleSlashCommand = useCallback(
    async (command: string) => {
      const parts = command.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case "clear":
          contextRef.current?.clear();
          setMessages([]);
          setStreamingText("");
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}`,
              role: "system",
              content: "Conversation cleared.",
            },
          ]);
          break;

        case "compact": {
          const context = contextRef.current;
          if (context) {
            context.compact("Previous conversation was summarized.");
            setMessages([
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: "Context compacted.",
              },
            ]);
          }
          break;
        }

        case "cost":
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}`,
              role: "system",
              content: `Tokens: ${tokenCount.toLocaleString()} | Estimated cost: $${cost.toFixed(4)}`,
            },
          ]);
          break;

        case "provider":
          if (args[0]) {
            try {
              const newConfig = resolveConfig(args[0], currentModel);
              const newProvider = createProvider(newConfig);
              providerRef.current = newProvider;
              configRef.current = newConfig;
              setCurrentProvider(newConfig.provider);
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Switched to provider: ${newConfig.provider}`,
                },
              ]);
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              ]);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: `Current provider: ${currentProvider}. Usage: /provider <kimi|glm|deepseek|ollama|custom>`,
              },
            ]);
          }
          break;

        case "model":
          if (args[0]) {
            try {
              const newConfig = resolveConfig(currentProvider, args[0]);
              const newProvider = createProvider(newConfig);
              providerRef.current = newProvider;
              configRef.current = newConfig;
              setCurrentModel(args[0]);
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Switched to model: ${args[0]}`,
                },
              ]);
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              ]);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: `Current model: ${currentModel}`,
              },
            ]);
          }
          break;

        case "ollama": {
          const subCmd = args[0];
          if (subCmd === "list") {
            try {
              const { OllamaProvider, formatSize } = await import("./providers/ollama.js");
              const ollama = new OllamaProvider();
              const running = await ollama.isServerRunning();
              if (!running) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `sys-${Date.now()}`,
                    role: "system",
                    content: `Cannot connect to Ollama at ${ollama.getBaseUrl()}. Is Ollama running? Start it with: ollama serve`,
                  },
                ]);
              } else {
                const models = await ollama.listModels();
                if (models.length === 0) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `sys-${Date.now()}`,
                      role: "system",
                      content: "No models installed. Pull one with: zen ollama pull <model>",
                    },
                  ]);
                } else {
                  const lines = models.map(
                    (m) => `  ${m.name.padEnd(28)} ${formatSize(m.size).padEnd(12)} ${new Date(m.modified_at).toLocaleDateString()}`,
                  );
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `sys-${Date.now()}`,
                      role: "system",
                      content: `Local Ollama models:\n${lines.join("\n")}`,
                    },
                  ]);
                }
              }
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              ]);
            }
          } else if (subCmd === "pull" && args[1]) {
            try {
              const { OllamaProvider } = await import("./providers/ollama.js");
              const ollama = new OllamaProvider();
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Pulling model ${args[1]}... (this may take a while)`,
                },
              ]);
              let lastStatus = "";
              for await (const progress of ollama.pullModel(args[1])) {
                lastStatus = progress.status;
              }
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Model ${args[1]} pulled successfully. Status: ${lastStatus}`,
                },
              ]);
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Error pulling model: ${err instanceof Error ? err.message : String(err)}`,
                },
              ]);
            }
          } else if ((subCmd === "rm" || subCmd === "remove") && args[1]) {
            try {
              const { OllamaProvider } = await import("./providers/ollama.js");
              const ollama = new OllamaProvider();
              await ollama.removeModel(args[1]);
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Removed model: ${args[1]}`,
                },
              ]);
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  role: "system",
                  content: `Error removing model: ${err instanceof Error ? err.message : String(err)}`,
                },
              ]);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: [
                  "Ollama commands:",
                  "  /ollama list          - List local models",
                  "  /ollama pull <model>  - Pull a model",
                  "  /ollama rm <model>    - Remove a model",
                ].join("\n"),
              },
            ]);
          }
          break;
        }

        case "mcp": {
          const subCmd = args[0];
          if (subCmd === "list") {
            const servers =
              mcpManagerRef.current?.getConnectedServers() ?? [];
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: servers.length
                  ? `Connected MCP servers: ${servers.join(", ")}`
                  : "No MCP servers connected.",
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content:
                  "MCP commands: /mcp list",
              },
            ]);
          }
          break;
        }

        case "help":
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}`,
              role: "system",
              content: [
                "Available commands:",
                "  /clear     - Clear conversation",
                "  /compact   - Summarize and compress context",
                "  /cost      - Show token usage and cost",
                "  /provider  - Switch provider (kimi, glm, deepseek, ollama, custom)",
                "  /model     - Switch model",
                "  /ollama    - Ollama model management (list, pull, rm)",
                "  /mcp list  - List connected MCP servers",
                "  /help      - Show this help",
                "",
                "Shortcuts:",
                "  Ctrl+C     - Exit",
                "  Up/Down    - Navigate history",
                "  Shift+Enter- New line",
              ].join("\n"),
            },
          ]);
          break;

        default:
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}`,
              role: "system",
              content: `Unknown command: /${cmd}. Type /help for available commands.`,
            },
          ]);
      }
    },
    [currentProvider, currentModel, tokenCount, cost],
  );

  // Handle permission responses
  useInput(
    (input) => {
      if (!permissionRequest) return;

      switch (input.toLowerCase()) {
        case "y":
          permissionRequest.resolve(true);
          setPermissionRequest(null);
          break;
        case "n":
          permissionRequest.resolve(false);
          setPermissionRequest(null);
          break;
        case "a":
          alwaysAllowRef.current.add(permissionRequest.toolName);
          permissionRequest.resolve(true);
          setPermissionRequest(null);
          break;
      }
    },
    { isActive: !!permissionRequest },
  );

  // Handle Ctrl+C to abort
  useInput((ch, key) => {
    if (key.ctrl && ch === "c") {
      if (isProcessing) {
        agentLoopRef.current?.abort();
        setIsProcessing(false);
      } else {
        exit();
      }
    }
  });

  if (!initialized && !statusMessage) {
    return (
      <Box flexDirection="column">
        <Spinner label="Initializing zen..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* Welcome message */}
      {messages.length === 0 && !oneShot && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            zen v0.1.0
          </Text>
          <Text dimColor>
            AI coding assistant · {currentProvider} · {currentModel}
          </Text>
          {statusMessage && <Text color="yellow">{statusMessage}</Text>}
          <Text dimColor>Type /help for commands, Ctrl+C to exit</Text>
        </Box>
      )}

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Tool call blocks */}
      {messages
        .filter((m) => m.toolCalls && m.toolCalls.length > 0)
        .map((m) =>
          m.toolCalls?.map((tc, i) => (
            <Box key={`${m.id}-tc-${i}`} marginLeft={2}>
              <Text color={tc.status === "error" ? "red" : tc.status === "done" ? "green" : "yellow"}>
                {tc.status === "running" ? "⟳" : tc.status === "done" ? "✓" : "✗"}{" "}
              </Text>
              <Text bold color="blue">{tc.name}</Text>
              {tc.result && (
                <Text dimColor> (done)</Text>
              )}
              {tc.error && (
                <Text color="red"> {tc.error}</Text>
              )}
            </Box>
          )),
        )}

      {/* Processing spinner */}
      {isProcessing && !permissionRequest && (
        <Spinner label="Thinking..." />
      )}

      {/* Permission prompt */}
      {permissionRequest && (
        <Box flexDirection="column" marginY={0}>
          <Text color="yellow" bold>
            ⚠ zen wants to run {permissionRequest.toolName}:
          </Text>
          <Box marginLeft={3}>
            <Text dimColor>
              {formatToolArgs(
                permissionRequest.toolName,
                permissionRequest.args,
              )}
            </Text>
          </Box>
          <Text>
            <Text dimColor>Allow? [</Text>
            <Text color="green" bold>y</Text>
            <Text dimColor>es / </Text>
            <Text color="red" bold>n</Text>
            <Text dimColor>o / </Text>
            <Text color="blue" bold>a</Text>
            <Text dimColor>lways]</Text>
          </Text>
        </Box>
      )}

      {/* Status bar */}
      <StatusBar
        provider={currentProvider}
        model={currentModel}
        tokenCount={tokenCount}
        cost={cost}
      />

      {/* Input */}
      {!oneShot && (
        <ChatInput
          onSubmit={handleUserMessage}
          isProcessing={isProcessing || !!permissionRequest}
          history={history}
        />
      )}
    </Box>
  );
}

function formatToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case "bash":
      return `$ ${String(args.command ?? "")}`;
    case "writeFile":
      return `Write to ${String(args.path ?? "")}`;
    case "editFile":
      return `Edit ${String(args.path ?? "")}`;
    default:
      return JSON.stringify(args, null, 2);
  }
}
