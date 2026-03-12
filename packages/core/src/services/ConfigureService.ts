import { ConfigRepository } from "../ports/interfaces";
import { ConfigureRequest } from "../types/requests";
import {
  DEFAULT_EMBEDDING_MODEL,
  ModelConfiguration,
  nowIso,
  validateProviderEnv,
  ValidationError,
} from "@agent-vault/shared";

export class ConfigureService {
  constructor(private readonly configRepository: ConfigRepository) {}

  async configure(input: ConfigureRequest): Promise<ModelConfiguration> {
    const validation = validateProviderEnv(input.provider);
    if (!validation.ok) {
      throw new ValidationError(`Missing required environment variables: ${validation.missing.join(", ")}`);
    }

    if (input.provider === "azure-openai" && !input.azureDeployment) {
      throw new ValidationError("Azure OpenAI requires a deployment name.");
    }

    const config: ModelConfiguration = {
      provider: input.provider,
      answerModel: input.answerModel,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      azureDeployment: input.azureDeployment,
      outputDir: input.outputDir,
      dbPath: input.dbPath,
      defaultProject: input.defaultProject,
      updatedAt: nowIso(),
    };

    await this.configRepository.save(config);
    return config;
  }
}
