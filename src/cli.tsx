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
  ollama?: string;
  ollamaModel?: string;
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
      case "ollama": {
        const subCmd = args[i + 1];
        if (subCmd && !subCmd.startsWith("-")) {
          result.ollama = subCmd;
          i++;
          // Capture model name for pull/rm
          const modelArg = args[i + 1];
          if (modelArg && !modelArg.startsWith("-")) {
            result.ollamaModel = modelArg;
            i++;
          }
        } else {
          result.ollama = "help";
        }
        break;
      }
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
  zen ollama <command>          Manage local Ollama models

Providers:
  kimi       Moonshot AI (moonshot-v1-128k)
  glm        Zhipu AI (glm-4-plus)
  deepseek   DeepSeek (deepseek-chat)
  ollama     Local Ollama (llama3.2)
  custom     Any OpenAI-compatible API

Ollama Commands:
  zen ollama list              List locally available models
  zen ollama pull <model>      Download a model
  zen ollama rm <model>        Remove a local model
  zen ollama serve             Show how to start Ollama server

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
  /ollama      Ollama model management
  /mcp list    List MCP servers
  /help        Show commands

Environment Variables:
  ZEN_PROVIDER     Default provider
  ZEN_API_KEY      API key (any provider)
  ZEN_MODEL        Default model
  KIMI_API_KEY     Kimi (Moonshot) API key
  GLM_API_KEY      GLM (Zhipu) API key
  DEEPSEEK_API_KEY DeepSeek API key
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Default Ollama model
`);
}

async function runOllamaCommand(
  subCmd: string,
  modelName?: string,
): Promise<void> {
  const { OllamaProvider, formatSize } = await import("./providers/ollama.js");
  const ollama = new OllamaProvider();

  switch (subCmd) {
    case "list": {
      const running = await ollama.isServerRunning();
      if (!running) {
        console.error(
          `Cannot connect to Ollama at ${ollama.getBaseUrl()}.\nIs Ollama running? Start it with: ollama serve`,
        );
        process.exit(1);
      }
      const models = await ollama.listModels();
      if (models.length === 0) {
        console.log("No models installed. Pull one with: zen ollama pull <model>");
        console.log("Popular models: llama3.2, qwen2.5, deepseek-r1, codellama");
      } else {
        console.log("NAME\t\t\t\tSIZE\t\tMODIFIED");
        for (const m of models) {
          const name = m.name.padEnd(32);
          const size = formatSize(m.size).padEnd(16);
          const modified = new Date(m.modified_at).toLocaleDateString();
          console.log(`${name}${size}${modified}`);
        }
      }
      break;
    }
    case "pull": {
      if (!modelName) {
        console.error("Usage: zen ollama pull <model>");
        console.error("Example: zen ollama pull llama3.2");
        process.exit(1);
      }
      const running = await ollama.isServerRunning();
      if (!running) {
        console.error(
          `Cannot connect to Ollama at ${ollama.getBaseUrl()}.\nIs Ollama running? Start it with: ollama serve`,
        );
        process.exit(1);
      }
      console.log(`Pulling ${modelName}...`);
      for await (const progress of ollama.pullModel(modelName)) {
        if (progress.total && progress.completed) {
          const pct = Math.round((progress.completed / progress.total) * 100);
          process.stdout.write(
            `\r${progress.status}: ${pct}% (${formatSize(progress.completed)}/${formatSize(progress.total)})`,
          );
        } else {
          process.stdout.write(`\r${progress.status}`);
        }
      }
      console.log(`\nDone! Model ${modelName} is ready.`);
      break;
    }
    case "rm":
    case "remove": {
      if (!modelName) {
        console.error("Usage: zen ollama rm <model>");
        process.exit(1);
      }
      const running = await ollama.isServerRunning();
      if (!running) {
        console.error(
          `Cannot connect to Ollama at ${ollama.getBaseUrl()}.\nIs Ollama running? Start it with: ollama serve`,
        );
        process.exit(1);
      }
      await ollama.removeModel(modelName);
      console.log(`Removed model: ${modelName}`);
      break;
    }
    case "serve":
      console.log("To start the Ollama server, run:\n");
      console.log("  ollama serve\n");
      console.log("Then use zen with Ollama:\n");
      console.log("  zen --provider ollama");
      console.log("  zen --provider ollama --model llama3.2\n");
      console.log("Or set environment variables:");
      console.log("  export OLLAMA_HOST=http://localhost:11434");
      console.log("  export OLLAMA_MODEL=llama3.2");
      break;
    default:
      console.log("Ollama commands:");
      console.log("  zen ollama list              List local models");
      console.log("  zen ollama pull <model>      Download a model");
      console.log("  zen ollama rm <model>        Remove a model");
      console.log("  zen ollama serve             Show server setup");
  }
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

  if (args.ollama) {
    await runOllamaCommand(args.ollama, args.ollamaModel);
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
