import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Tool } from "../config/types.js";

export const readFileTool: Tool = {
  name: "readFile",
  description:
    "Read the contents of a file at the given path. Returns the file content as a string. Use this to examine source code, configuration files, or any text file.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to read (relative to current directory or absolute)",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from (0-based). Optional.",
      },
      limit: {
        type: "number",
        description: "Maximum number of lines to read. Optional.",
      },
    },
    required: ["path"],
  },
};

export function executeReadFile(args: {
  path: string;
  offset?: number;
  limit?: number;
}): string {
  const fullPath = resolve(process.cwd(), args.path);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  const offset = args.offset ?? 0;
  const limit = args.limit ?? lines.length;
  const selected = lines.slice(offset, offset + limit);

  // Format with line numbers
  return selected
    .map((line, i) => `${String(offset + i + 1).padStart(5)} │ ${line}`)
    .join("\n");
}
