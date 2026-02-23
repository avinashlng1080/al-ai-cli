# zen

A Claude Code-style agentic coding CLI that supports Chinese AI providers and local models via Ollama.

## Features

- **Multiple providers**: Kimi (Moonshot AI), GLM (Zhipu AI), DeepSeek, and any OpenAI-compatible API
- **Local models via Ollama**: Run entirely offline with locally hosted LLMs — no API keys needed
- **Agentic loop**: Autonomous tool use with permission controls
- **Built-in tools**: File operations, bash, search, web fetch
- **MCP support**: Connect to Model Context Protocol servers
- **Terminal UI**: Ink-based React components with streaming, syntax highlighting, and diffs
- **Project context**: ZEN.md file support (like CLAUDE.md)

## Quick Start

```bash
# Install
bun install

# Configure (interactive)
bun run src/cli.tsx init

# Or set environment variables
export DEEPSEEK_API_KEY=sk-...

# Start interactive session
bun run src/cli.tsx

# One-shot mode
bun run src/cli.tsx -p "explain this code" src/app.tsx

# Use a specific provider
bun run src/cli.tsx --provider kimi --model moonshot-v1-128k

# Run locally with Ollama (no API key required)
bun run src/cli.tsx --provider ollama --model llama3.2
```

## Build

```bash
# Build standalone executable
bun run build

# Run the executable
./zen
```

## Configuration

### Global config (`~/.zen/config.json`)

```json
{
  "defaultProvider": "deepseek",
  "providers": {
    "kimi": {
      "apiKey": "sk-...",
      "model": "moonshot-v1-128k"
    },
    "glm": {
      "apiKey": "...",
      "model": "glm-4-plus"
    },
    "deepseek": {
      "apiKey": "sk-...",
      "model": "deepseek-chat"
    }
  },
  "mcpServers": {}
}
```

### Project config (`.zen/config.json`)

```json
{
  "provider": "deepseek",
  "model": "deepseek-coder",
  "contextFile": "ZEN.md",
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

### Environment Variables

| Variable | Description |
|---|---|
| `ZEN_PROVIDER` | Default provider |
| `ZEN_API_KEY` | API key (any provider) |
| `ZEN_MODEL` | Default model |
| `KIMI_API_KEY` | Kimi (Moonshot) API key |
| `GLM_API_KEY` | GLM (Zhipu) API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Default Ollama model (default: `llama3.2`) |

Priority: Environment variables > Project config > Global config

## Interactive Commands

| Command | Description |
|---|---|
| `/clear` | Clear conversation |
| `/compact` | Summarize and compress context |
| `/cost` | Show token usage and estimated cost |
| `/provider <name>` | Switch provider |
| `/model <name>` | Switch model |
| `/mcp list` | List connected MCP servers |
| `/help` | Show all commands |

## Providers

| Provider | Base URL | Models |
|---|---|---|
| Ollama | `localhost:11434` (local) | Any model from the Ollama library (llama3.2, codellama, mistral, etc.) |
| Kimi | `api.moonshot.cn/v1` | moonshot-v1-8k, 32k, 128k |
| GLM | `open.bigmodel.cn/api/paas/v4` | glm-4-plus, glm-4, glm-4-flash |
| DeepSeek | `api.deepseek.com/v1` | deepseek-chat, deepseek-coder |
| Custom | Configurable | Any OpenAI-compatible model |

## Running Locally with Ollama

zen can run entirely offline using [Ollama](https://ollama.com) for local model inference — no API keys or cloud services required.

### Setup

```bash
# 1. Install Ollama (https://ollama.com/download)
# 2. Start the Ollama server
ollama serve

# 3. Pull a model
ollama pull llama3.2

# 4. Run zen with Ollama
bun run src/cli.tsx --provider ollama --model llama3.2
```

zen automatically detects locally available models via the Ollama API. You can also pull and manage models through the `zen init` setup flow.

## Built-in Tools

- **readFile** — Read file contents with line numbers
- **writeFile** — Create or overwrite files
- **editFile** — Patch-based file editing (find and replace)
- **bash** — Execute shell commands
- **listFiles** — List directory contents
- **searchFiles** — Search with ripgrep/grep
- **webFetch** — Fetch web content

## ZEN.md

Create a `ZEN.md` file in your project root to provide context to zen.
Supports `@import ./other-file.md` syntax for modular context.

## License

MIT
