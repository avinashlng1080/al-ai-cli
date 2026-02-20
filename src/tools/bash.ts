import type { Tool } from "../config/types.js";

export const bashTool: Tool = {
  name: "bash",
  description:
    "Execute a bash command in the current working directory. Returns stdout and stderr. Use this for running tests, git operations, installing packages, and other shell tasks.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The bash command to execute",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default: 120000)",
      },
    },
    required: ["command"],
  },
};

export async function executeBash(args: {
  command: string;
  timeout?: number;
}): Promise<string> {
  const timeout = args.timeout ?? 120_000;

  const proc = Bun.spawn(["bash", "-c", args.command], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  const resultPromise = (async () => {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    let output = "";
    if (stdout) output += stdout;
    if (stderr) output += (output ? "\n" : "") + `[stderr]\n${stderr}`;
    if (exitCode !== 0) {
      output += `\n[exit code: ${exitCode}]`;
    }
    return output || "(no output)";
  })();

  return Promise.race([resultPromise, timeoutPromise]);
}
