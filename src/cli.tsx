#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { runInit } from "./init.js";

function parseArgs(args: string[]): {
  provider?: string;
  model?: string;
  prompt?: string;
  help?: boolean;
  version?: boolean;
  init?: boolean;
  files?: string[];
} {
  const result: ReturnType<typeof parseArgs> = {};
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--provider":
      case "-P":
        result.provider = args[++i];
        break;
      case "--model":
      case "-m":
        result.model = args[++i];
        break;
      case "--prompt":
      case "-p":
        result.prompt = args[++i];
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--version":
      case "-v":
        result.version = true;
        break;
      case "init":
        result.init = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          files.push(arg);
        }
        break;
    }
  }

  if (files.length > 0) {
    result.files = files;
  }

  return result;
}

function printHelp(): void {
  console.log(`
zen - AI coding assistant for Chinese AI providers

Usage:
  zen                           Start interactive session
  zen --provider <name>         Start with specific provider
  zen --model <model>           Start with specific model
  zen -p "prompt" [files...]    One-shot mode
  zen init                      Interactive setup

Providers:
  kimi       Moonshot AI (moonshot-v1-128k)
  glm        Zhipu AI (glm-4-plus)
  deepseek   DeepSeek (deepseek-chat)
  custom     Any OpenAI-compatible API

Options:
  -P, --provider   AI provider to use
  -m, --model      Model name
  -p, --prompt     One-shot prompt (non-interactive)
  -h, --help       Show this help
  -v, --version    Show version

Interactive Commands:
  /clear       Clear conversation
  /compact     Compress context
  /cost        Show token usage
  /provider    Switch provider
  /model       Switch model
  /mcp list    List MCP servers
  /help        Show commands

Environment Variables:
  ZEN_PROVIDER     Default provider
  ZEN_API_KEY      API key (any provider)
  ZEN_MODEL        Default model
  KIMI_API_KEY     Kimi (Moonshot) API key
  GLM_API_KEY      GLM (Zhipu) API key
  DEEPSEEK_API_KEY DeepSeek API key
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log("zen v0.1.0");
    process.exit(0);
  }

  if (args.init) {
    await runInit();
    process.exit(0);
  }

  // Build one-shot prompt from -p flag and optional file args
  let oneShot: string | undefined;
  if (args.prompt) {
    oneShot = args.prompt;
    if (args.files && args.files.length > 0) {
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const fileContents = args.files
        .map((f) => {
          try {
            const content = readFileSync(resolve(process.cwd(), f), "utf-8");
            return `\n--- ${f} ---\n${content}`;
          } catch {
            return `\n--- ${f} ---\n(file not found)`;
          }
        })
        .join("\n");
      oneShot = `${args.prompt}\n\nFiles:\n${fileContents}`;
    }
  }

  render(
    <App
      initialProvider={args.provider}
      initialModel={args.model}
      oneShot={oneShot}
    />,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
