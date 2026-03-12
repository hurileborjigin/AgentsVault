import path from "node:path";
import os from "node:os";

export type ProviderEnvValidation = {
  ok: boolean;
  missing: string[];
};

export function resolveDefaultProject(cwd: string): string {
  return path.basename(cwd);
}

export function resolveOutputDir(cwd: string): string {
  return path.join(cwd, ".conversations");
}

export function resolveDbPath(cwd: string): string {
  return path.join(cwd, ".agent-vault", "agent-vault.sqlite");
}

export function resolveConfigPath(): string {
  return path.join(os.homedir(), ".agent-vault", "agent-vault.json");
}

export function validateProviderEnv(provider: "openai" | "azure-openai" | "ollama"): ProviderEnvValidation {
  if (provider === "ollama") {
    return { ok: true, missing: [] };
  }

  const required =
    provider === "openai"
      ? ["OPENAI_API_KEY"]
      : ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_VERSION"];

  const missing = required.filter((name) => !process.env[name]);
  return { ok: missing.length === 0, missing };
}
