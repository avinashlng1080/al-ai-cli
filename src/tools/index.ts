import type { Tool } from "../config/types.js";
import { readFileTool, executeReadFile } from "./readFile.js";
import { writeFileTool, executeWriteFile } from "./writeFile.js";
import { editFileTool, executeEditFile } from "./editFile.js";
import { bashTool, executeBash } from "./bash.js";
import { listFilesTool, executeListFiles } from "./listFiles.js";
import { searchFilesTool, executeSearchFiles } from "./searchFiles.js";
import { webFetchTool, executeWebFetch } from "./webFetch.js";

export interface ToolRegistry {
  tools: Tool[];
  execute(name: string, args: Record<string, unknown>): Promise<string>;
}

type ToolExecutor = (args: Record<string, unknown>) => string | Promise<string>;

const builtinExecutors: Record<string, ToolExecutor> = {
  readFile: (args) =>
    executeReadFile(args as { path: string; offset?: number; limit?: number }),
  writeFile: (args) =>
    executeWriteFile(args as { path: string; content: string }),
  editFile: (args) =>
    executeEditFile(
      args as { path: string; oldString: string; newString: string },
    ),
  bash: (args) =>
    executeBash(args as { command: string; timeout?: number }),
  listFiles: (args) =>
    executeListFiles(args as { path?: string; recursive?: boolean }),
  searchFiles: (args) =>
    executeSearchFiles(
      args as { pattern: string; path?: string; include?: string },
    ),
  webFetch: (args) =>
    executeWebFetch(
      args as {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ),
};

const builtinTools: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  bashTool,
  listFilesTool,
  searchFilesTool,
  webFetchTool,
];

/**
 * Tools that require user permission before execution.
 */
export const DESTRUCTIVE_TOOLS = new Set([
  "bash",
  "writeFile",
  "editFile",
]);

export function createToolRegistry(): ToolRegistry {
  const tools = [...builtinTools];
  const executors = { ...builtinExecutors };

  return {
    get tools() {
      return tools;
    },

    async execute(
      name: string,
      args: Record<string, unknown>,
    ): Promise<string> {
      const executor = executors[name];
      if (!executor) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return executor(args);
    },
  };
}

export function registerMcpTool(
  registry: ToolRegistry,
  tool: Tool,
  executor: ToolExecutor,
): void {
  registry.tools.push(tool);
  (builtinExecutors as Record<string, ToolExecutor>)[tool.name] = executor;
}
