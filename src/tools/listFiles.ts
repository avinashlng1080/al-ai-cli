import { readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import type { Tool } from "../config/types.js";

export const listFilesTool: Tool = {
  name: "listFiles",
  description:
    "List files and directories at a given path. Returns a tree-like listing with file types and sizes.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The directory path to list (default: current directory)",
      },
      recursive: {
        type: "boolean",
        description: "Whether to list recursively (default: false, max depth: 3)",
      },
    },
    required: [],
  },
};

export function executeListFiles(args: {
  path?: string;
  recursive?: boolean;
}): string {
  const targetPath = resolve(process.cwd(), args.path ?? ".");
  const recursive = args.recursive ?? false;
  const maxDepth = 3;
  const results: string[] = [];

  function listDir(dirPath: string, depth: number, prefix: string): void {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = readdirSync(dirPath);
    } catch (err) {
      results.push(`${prefix}(permission denied)`);
      return;
    }

    // Sort: dirs first, then files
    const sorted = entries
      .filter((e) => !e.startsWith(".") || e === ".zen")
      .sort((a, b) => {
        const aIsDir = statSync(join(dirPath, a)).isDirectory();
        const bIsDir = statSync(join(dirPath, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

    for (const entry of sorted) {
      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        const relPath = relative(process.cwd(), fullPath);
        if (stat.isDirectory()) {
          results.push(`${prefix}${relPath}/`);
          if (recursive && depth < maxDepth) {
            listDir(fullPath, depth + 1, prefix + "  ");
          }
        } else {
          const size = formatSize(stat.size);
          results.push(`${prefix}${relPath}  (${size})`);
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  }

  listDir(targetPath, 0, "");

  if (results.length === 0) {
    return "(empty directory)";
  }

  return results.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
