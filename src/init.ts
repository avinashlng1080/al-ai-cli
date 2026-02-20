import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

const GLOBAL_CONFIG_DIR = join(homedir(), ".zen");
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, "config.json");

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function runInit(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n🔧 zen setup\n");
  console.log("Configure your AI providers. Press Enter to skip any field.\n");

  // Load existing config
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(GLOBAL_CONFIG_PATH)) {
      existing = JSON.parse(readFileSync(GLOBAL_CONFIG_PATH, "utf-8"));
    }
  } catch {
    // Start fresh
  }

  const providers: Record<string, Record<string, string>> =
    (existing.providers as Record<string, Record<string, string>>) ?? {};

  // Choose default provider
  const defaultProvider = await question(
    rl,
    "Default provider (kimi/glm/deepseek/custom) [deepseek]: ",
  );

  // Configure each provider
  console.log("\n--- Kimi (Moonshot AI) ---");
  const kimiKey = await question(
    rl,
    `API key${providers.kimi?.apiKey ? " (***configured***)" : ""}: `,
  );
  if (kimiKey) {
    providers.kimi = { ...providers.kimi, apiKey: kimiKey };
  }
  const kimiModel = await question(rl, "Model [moonshot-v1-128k]: ");
  if (kimiModel) {
    providers.kimi = { ...providers.kimi, model: kimiModel };
  }

  console.log("\n--- GLM (Zhipu AI) ---");
  const glmKey = await question(
    rl,
    `API key${providers.glm?.apiKey ? " (***configured***)" : ""}: `,
  );
  if (glmKey) {
    providers.glm = { ...providers.glm, apiKey: glmKey };
  }
  const glmModel = await question(rl, "Model [glm-4-plus]: ");
  if (glmModel) {
    providers.glm = { ...providers.glm, model: glmModel };
  }

  console.log("\n--- DeepSeek ---");
  const dsKey = await question(
    rl,
    `API key${providers.deepseek?.apiKey ? " (***configured***)" : ""}: `,
  );
  if (dsKey) {
    providers.deepseek = { ...providers.deepseek, apiKey: dsKey };
  }
  const dsModel = await question(rl, "Model [deepseek-chat]: ");
  if (dsModel) {
    providers.deepseek = { ...providers.deepseek, model: dsModel };
  }

  rl.close();

  // Build config
  const config = {
    defaultProvider: defaultProvider || "deepseek",
    providers,
    mcpServers: (existing.mcpServers as Record<string, unknown>) ?? {},
  };

  // Write config
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

  console.log(`\n✅ Configuration saved to ${GLOBAL_CONFIG_PATH}`);
  console.log("Run 'zen' to start a session.\n");
}
