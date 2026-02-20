import type { Tool } from "../config/types.js";

export const searchFilesTool: Tool = {
  name: "searchFiles",
  description:
    "Search for a pattern in files using ripgrep (rg). Returns matching lines with file paths and line numbers. Falls back to grep if rg is not installed.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "The regex pattern to search for",
      },
      path: {
        type: "string",
        description: "The directory to search in (default: current directory)",
      },
      include: {
        type: "string",
        description: "Glob pattern to filter files (e.g. '*.ts', '*.py')",
      },
    },
    required: ["pattern"],
  },
};

export async function executeSearchFiles(args: {
  pattern: string;
  path?: string;
  include?: string;
}): Promise<string> {
  const searchPath = args.path ?? ".";
  const cmdParts: string[] = [];

  // Try ripgrep first, fall back to grep
  const rgArgs = ["rg", "--line-number", "--no-heading", "--color=never"];
  if (args.include) {
    rgArgs.push("--glob", args.include);
  }
  rgArgs.push("--max-count=100"); // Limit output
  rgArgs.push(args.pattern, searchPath);

  const grepArgs = [
    "grep",
    "-rn",
    "--color=never",
  ];
  if (args.include) {
    grepArgs.push(`--include=${args.include}`);
  }
  grepArgs.push(args.pattern, searchPath);

  // Try rg first
  const command = `${rgArgs.map(escapeShell).join(" ")} 2>/dev/null || ${grepArgs.map(escapeShell).join(" ")} 2>/dev/null`;

  const proc = Bun.spawn(["bash", "-c", command], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  if (!stdout.trim()) {
    return "No matches found.";
  }

  // Limit to first 50 results to avoid flooding
  const lines = stdout.trim().split("\n");
  if (lines.length > 50) {
    return lines.slice(0, 50).join("\n") + `\n... (${lines.length - 50} more matches)`;
  }

  return stdout.trim();
}

function escapeShell(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
