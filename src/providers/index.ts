import type { ResolvedConfig, ProviderName } from "../config/types.js";
import type { BaseProvider } from "./base.js";
import { KimiProvider } from "./kimi.js";
import { GLMProvider } from "./glm.js";
import { DeepSeekProvider } from "./deepseek.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAICompatProvider } from "./openai-compat.js";

export function createProvider(config: ResolvedConfig): BaseProvider {
  switch (config.provider) {
    case "kimi":
      return new KimiProvider(config.apiKey, config.model, config.baseUrl);
    case "glm":
      return new GLMProvider(config.apiKey, config.model, config.baseUrl);
    case "deepseek":
      return new DeepSeekProvider(config.apiKey, config.model, config.baseUrl);
    case "ollama":
      return new OllamaProvider(config.model, config.baseUrl);
    case "custom":
      return new OpenAICompatProvider({
        name: "custom",
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        models: [config.model],
        defaultModel: config.model,
      });
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

export function getAvailableProviders(): ProviderName[] {
  return ["kimi", "glm", "deepseek", "ollama", "custom"];
}

export type { BaseProvider } from "./base.js";
