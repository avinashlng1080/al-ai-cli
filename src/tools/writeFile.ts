import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import type { Tool } from "../config/types.js";

export const writeFileTool: Tool = {
  name: "writeFile",
  description:
    "Write content to a file at the given path. Creates parent directories if needed. This will overwrite the file if it already exists.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to write to (relative or absolute)",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["path", "content"],
  },
};

export function executeWriteFile(args: {
  path: string;
  content: string;
}): string {
  const fullPath = resolve(process.cwd(), args.path);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(fullPath, args.content, "utf-8");
  return `Successfully wrote ${args.content.length} bytes to ${fullPath}`;
}
