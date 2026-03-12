import fs from "node:fs/promises";
import { modelConfigurationSchema, resolveOutputDir, validateProviderEnv } from "@agent-vault/shared";
import { ConfigRepository, VectorStore } from "../ports/interfaces";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  message: string;
};

export class DoctorService {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly vectorStore: VectorStore,
  ) {}

  async run() {
    const checks: DoctorCheck[] = [];

    const config = await this.configRepository.load();
    if (!config) {
      checks.push({
        name: "config",
        ok: false,
        message: "No config found. Run `agent-vault configure`.",
      });
    } else {
      const parse = modelConfigurationSchema.safeParse(config);
      checks.push({
        name: "config",
        ok: parse.success,
        message: parse.success ? "Config file is valid" : "Config file schema is invalid",
      });

      const providerEnv = validateProviderEnv(config.provider);
      checks.push({
        name: "provider-env",
        ok: providerEnv.ok,
        message: providerEnv.ok
          ? `Provider environment for ${config.provider} is valid`
          : `Missing: ${providerEnv.missing.join(", ")}`,
      });
    }

    const outputDir = config?.outputDir ?? resolveOutputDir(process.cwd());
    try {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.access(outputDir);
      checks.push({
        name: "output-dir",
        ok: true,
        message: `Output directory is writable (${outputDir})`,
      });
    } catch (error) {
      checks.push({
        name: "output-dir",
        ok: false,
        message: error instanceof Error ? error.message : "Output directory is not writable",
      });
    }

    const health = await this.vectorStore.healthCheck();
    checks.push({
      name: "storage-connection",
      ok: health.ok,
      message: health.detail,
    });

    return checks;
  }
}
