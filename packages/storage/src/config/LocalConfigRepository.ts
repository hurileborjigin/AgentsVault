import fs from "node:fs/promises";
import path from "node:path";
import { ConfigRepository } from "@agent-vault/core";
import os from "node:os";
import {
  DEFAULT_EMBEDDING_MODEL,
  modelConfigurationSchema,
  ModelConfiguration,
  resolveConfigPath,
  resolveDbPath,
  resolveDefaultProject,
  resolveOutputDir,
} from "@agent-vault/shared";

export class LocalConfigRepository implements ConfigRepository {
  constructor(private readonly configPath: string = resolveConfigPath()) {}

  async load(): Promise<ModelConfiguration | null> {
    const paths = [this.configPath, path.join(os.homedir(), ".agent-vault", "config.json")];

    for (const configPath of paths) {
      try {
        const raw = await fs.readFile(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = modelConfigurationSchema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }

        const legacy = parsed as Partial<ModelConfiguration> & {
          provider?: "openai" | "azure-openai";
          answerModel?: string;
          embeddingModel?: string;
          updatedAt?: string;
          azureDeployment?: string;
        };

        if (legacy.provider && legacy.answerModel && legacy.updatedAt) {
          const migrated: ModelConfiguration = {
            provider: legacy.provider,
            answerModel: legacy.answerModel,
            embeddingModel: legacy.embeddingModel || DEFAULT_EMBEDDING_MODEL,
            azureDeployment: legacy.azureDeployment,
            outputDir: resolveOutputDir(process.cwd()),
            dbPath: resolveDbPath(process.cwd()),
            defaultProject: resolveDefaultProject(process.cwd()),
            updatedAt: legacy.updatedAt,
          };
          await this.save(migrated);
          return migrated;
        }
      } catch {
        // Continue to next candidate path.
      }
    }

    return null;
  }

  async save(config: ModelConfiguration): Promise<void> {
    try {
      await fs.unlink(path.join(os.homedir(), ".agent-vault", "config.json"));
    } catch {
      // ignore
    }
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  getPath(): string {
    return this.configPath;
  }
}
