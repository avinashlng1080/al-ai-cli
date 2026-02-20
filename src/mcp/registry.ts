import type { McpServerConfig, Tool } from "../config/types.js";
import type { ToolRegistry } from "../tools/index.js";
import { McpClientManager } from "./client.js";

/**
 * Initialize MCP servers from config and register their tools.
 */
export async function initializeMcpServers(
  mcpServers: Record<string, McpServerConfig>,
  toolRegistry: ToolRegistry,
  mcpManager: McpClientManager,
  onLog?: (message: string) => void,
): Promise<void> {
  for (const [name, config] of Object.entries(mcpServers)) {
    try {
      onLog?.(`Connecting to MCP server: ${name}...`);
      const tools = await mcpManager.connectServer(name, config);
      onLog?.(`Connected to ${name}: ${tools.length} tools available`);

      // Register each MCP tool with the tool registry
      for (const tool of tools) {
        toolRegistry.tools.push(tool);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog?.(`Failed to connect MCP server ${name}: ${msg}`);
    }
  }
}
