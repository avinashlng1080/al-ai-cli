import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "../config/types.js";
import type { Tool } from "../config/types.js";

interface McpConnection {
  client: Client;
  transport: StdioClientTransport;
  serverName: string;
  tools: Tool[];
}

export class McpClientManager {
  private connections: Map<string, McpConnection> = new Map();

  async connectServer(
    name: string,
    config: McpServerConfig,
  ): Promise<Tool[]> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!.tools;
    }

    if (config.transport === "sse" || config.url) {
      // SSE transport not implemented in this version
      throw new Error(
        `SSE transport not yet supported for MCP server: ${name}`,
      );
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env as Record<string, string>,
    });

    const client = new Client(
      { name: "zen", version: "0.1.0" },
      { capabilities: {} },
    );

    await client.connect(transport);

    // List available tools
    const toolsResult = await client.listTools();
    const tools: Tool[] = (toolsResult.tools ?? []).map((t) => ({
      name: `mcp_${name}_${t.name}`,
      description: `[MCP: ${name}] ${t.description ?? t.name}`,
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    }));

    this.connections.set(name, {
      client,
      transport,
      serverName: name,
      tools,
    });

    return tools;
  }

  async callTool(
    qualifiedName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // Parse mcp_<serverName>_<toolName>
    const parts = qualifiedName.split("_");
    if (parts.length < 3 || parts[0] !== "mcp") {
      throw new Error(`Invalid MCP tool name: ${qualifiedName}`);
    }

    const serverName = parts[1];
    const toolName = parts.slice(2).join("_");

    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    const result = await conn.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Extract text content from result
    if (Array.isArray(result.content)) {
      return result.content
        .map((c) => {
          if (c.type === "text") return c.text;
          return JSON.stringify(c);
        })
        .join("\n");
    }

    return JSON.stringify(result);
  }

  isMcpTool(name: string): boolean {
    return name.startsWith("mcp_");
  }

  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const conn of this.connections.values()) {
      tools.push(...conn.tools);
    }
    return tools;
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  async disconnectAll(): Promise<void> {
    for (const [name, conn] of this.connections) {
      try {
        await conn.client.close();
      } catch {
        // Ignore disconnect errors
      }
      this.connections.delete(name);
    }
  }

  async disconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (conn) {
      try {
        await conn.client.close();
      } catch {
        // Ignore
      }
      this.connections.delete(name);
    }
  }
}
