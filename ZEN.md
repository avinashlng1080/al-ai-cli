# Project: zen

> AI coding assistant CLI for Chinese AI providers

## Overview

This project is a terminal-based agentic AI assistant, similar in UX to Claude Code,
but designed to work with Chinese AI platforms: Kimi (Moonshot AI), GLM (Zhipu AI),
and DeepSeek.

## Tech Stack

- Runtime: Bun
- Language: TypeScript (strict)
- UI: Ink v4 (React terminal UI)
- MCP: @modelcontextprotocol/sdk

## Project Structure

- `src/config/` — Configuration loading and validation
- `src/providers/` — AI provider implementations (Kimi, GLM, DeepSeek, custom)
- `src/tools/` — Built-in tool implementations (readFile, writeFile, bash, etc.)
- `src/agent/` — Agentic loop and context management
- `src/components/` — Ink UI components
- `src/mcp/` — MCP client integration
- `src/utils/` — Utilities (syntax highlighting, diff, token counting)

## Key Patterns

- All providers implement the `BaseProvider` interface and use OpenAI-compatible streaming
- Tools are registered in a `ToolRegistry` and executed through a uniform interface
- The agentic loop runs tool calls in sequence with permission checks for destructive operations
- Configuration follows priority: env vars > project config > global config

## Commands

- `bun run dev` — Run in development mode
- `bun run build` — Build standalone executable
- `bun run typecheck` — Type check without emitting
