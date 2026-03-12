export type ProviderId = "openai" | "azure-openai" | "ollama";

export type ProviderRegistryEntry = {
  provider: ProviderId;
  label: string;
  answerModels: string[];
  embeddingModels: string[];
};

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";

export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    provider: "openai",
    label: "OpenAI",
    answerModels: ["gpt-4.1", "gpt-4.1-mini"],
    embeddingModels: [DEFAULT_EMBEDDING_MODEL, "text-embedding-3-small"],
  },
  {
    provider: "azure-openai",
    label: "Azure OpenAI",
    answerModels: ["gpt-4.1-prod", "gpt-4.1-mini-prod"],
    embeddingModels: [DEFAULT_EMBEDDING_MODEL, "text-embedding-3-small"],
  },
  {
    provider: "ollama",
    label: "Ollama (Local)",
    answerModels: ["llama3.2", "mistral", "codellama", "gemma2"],
    embeddingModels: ["nomic-embed-text", "mxbai-embed-large", "all-minilm", "snowflake-arctic-embed"],
  },
];

export function findProvider(provider: ProviderId): ProviderRegistryEntry {
  const result = PROVIDER_REGISTRY.find((entry) => entry.provider === provider);
  if (!result) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  return result;
}
