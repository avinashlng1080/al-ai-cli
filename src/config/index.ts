import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  GlobalConfigSchema,
  ProjectConfigSchema,
  type GlobalConfig,
  type ProjectConfig,
  type ResolvedConfig,
  type ProviderName,
  type McpServerConfig,
} from "./types.js";

const GLOBAL_CONFIG_PATH = join(homedir(), ".zen", "config.json");
const PROJECT_CONFIG_DIR = ".zen";
const PROJECT_CONFIG_FILE = "config.json";

const DEFAULT_PROVIDER_SETTINGS: Record<
  ProviderName,
  { baseUrl: string; defaultModel: string }
> = {
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-128k",
  },
  glm: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    defaultModel: "llama3.2",
  },
  custom: {
    baseUrl: "",
    defaultModel: "",
  },
};

function loadJsonFile(path: string): unknown {
  try {
    if (!existsSync(path)) return {};
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function loadGlobalConfig(): GlobalConfig {
  const raw = loadJsonFile(GLOBAL_CONFIG_PATH);
  return GlobalConfigSchema.parse(raw);
}

export function loadProjectConfig(cwd: string = process.cwd()): ProjectConfig {
  const configPath = join(cwd, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
  const raw = loadJsonFile(configPath);
  return ProjectConfigSchema.parse(raw);
}

function getEnvApiKey(provider: ProviderName): string | undefined {
  // Ollama doesn't require an API key
  if (provider === "ollama") return "ollama";

  const map: Record<ProviderName, string[]> = {
    kimi: ["KIMI_API_KEY", "ZEN_API_KEY"],
    glm: ["GLM_API_KEY", "ZEN_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY", "ZEN_API_KEY"],
    ollama: [], // early return above; listed for Record<ProviderName, …> completeness
    custom: ["ZEN_API_KEY"],
  };
  for (const key of map[provider]) {
    const val = process.env[key];
    if (val) return val;
  }
  return undefined;
}

export function resolveConfig(
  cliProvider?: string,
  cliModel?: string,
): ResolvedConfig {
  const global = loadGlobalConfig();
  const project = loadProjectConfig();

  // Determine provider: CLI > env > project > global
  const providerName: ProviderName =
    (cliProvider as ProviderName) ??
    (process.env.ZEN_PROVIDER as ProviderName) ??
    project.provider ??
    global.defaultProvider;

  const providerConfig = global.providers[providerName] ?? {};
  const defaults = DEFAULT_PROVIDER_SETTINGS[providerName];

  // Resolve API key: env > provider config
  const apiKey = getEnvApiKey(providerName) ?? providerConfig.apiKey ?? "";

  // Resolve model: CLI > env (provider-specific) > env (generic) > project > provider config > default
  const model =
    cliModel ??
    (providerName === "ollama" ? process.env.OLLAMA_MODEL : undefined) ??
    process.env.ZEN_MODEL ??
    project.model ??
    providerConfig.model ??
    defaults.defaultModel;

  // Resolve base URL: env (for ollama) > provider config > default
  const baseUrl =
    providerName === "ollama"
      ? process.env.OLLAMA_HOST ?? providerConfig.baseUrl ?? defaults.baseUrl
      : providerConfig.baseUrl ?? defaults.baseUrl;

  // Merge MCP servers: project overrides global
  const mcpServers: Record<string, McpServerConfig> = {
    ...global.mcpServers,
    ...project.mcpServers,
  };

  return {
    provider: providerName,
    apiKey,
    model,
    baseUrl,
    contextFile: project.contextFile ?? "ZEN.md",
    mcpServers,
  };
}

export function loadContextFile(cwd: string = process.cwd()): string {
  const project = loadProjectConfig(cwd);
  const contextPath = join(cwd, project.contextFile);
  try {
    if (!existsSync(contextPath)) return "";
    let content = readFileSync(contextPath, "utf-8");

    // Process @import directives
    content = content.replace(
      /^@import\s+(.+)$/gm,
      (_match: string, importPath: string) => {
        const fullPath = join(cwd, importPath.trim());
        try {
          return readFileSync(fullPath, "utf-8");
        } catch {
          return `<!-- Failed to import: ${importPath.trim()} -->`;
        }
      },
    );

    return content;
  } catch {
    return "";
  }
}

export { GLOBAL_CONFIG_PATH, PROJECT_CONFIG_DIR };
export type { GlobalConfig, ProjectConfig, ProviderName, ResolvedConfig };
