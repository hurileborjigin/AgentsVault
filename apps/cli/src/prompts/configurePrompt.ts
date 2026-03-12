import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { confirm, input, password, select } from "@inquirer/prompts";
import { AuthVault } from "@agent-vault/storage";
import { ProviderId, PROVIDER_REGISTRY } from "@agent-vault/shared";

export type ConfigurePromptResult = {
  provider: ProviderId;
  answerModel: string;
  embeddingModel?: string;
  azureDeployment?: string;
  ollamaBaseUrl?: string;
};

const RECENT_ANSWER_MODEL_PRIORITY = ["gpt-5.2", "gpt-5", "gpt-4.1", "gpt-4o", "gpt-4.1-mini", "o4-mini"];
const AZURE_CANDIDATE_DEPLOYMENTS = [
  "gpt-5.2",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "o4-mini",
  "o3-mini",
];
const authVault = new AuthVault();

async function fallbackSelect(label: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log(label);
    options.forEach((option, index) => {
      console.log(`${index + 1}. ${option}`);
    });
    const raw = (await rl.question("Select number: ")).trim();
    const index = Number(raw) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= options.length) {
      throw new Error("Invalid selection");
    }
    return options[index]!;
  } finally {
    rl.close();
  }
}

function requiredProviderKeys(provider: ProviderId): string[] {
  if (provider === "ollama") return [];
  return provider === "openai"
    ? ["OPENAI_API_KEY"]
    : ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_VERSION", "AZURE_OPENAI_API_KEY"];
}

function hasProviderCredentials(provider: ProviderId): boolean {
  return requiredProviderKeys(provider).every((key) => Boolean(process.env[key]?.trim()));
}

async function promptProviderCredentials(provider: ProviderId, forcePrompt: boolean): Promise<void> {
  const requiredKeys = requiredProviderKeys(provider);
  if (requiredKeys.length === 0) return;

  const hasAll = hasProviderCredentials(provider);

  if (!forcePrompt && hasAll) {
    return;
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    const missing = requiredKeys.filter((key) => !process.env[key]?.trim());
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Export them in your shell and retry.`,
    );
  }

  for (const key of requiredKeys) {
    const existing = process.env[key]?.trim() ?? "";
    const message = `Enter ${key}`;

    const value = key.includes("KEY") || key.includes("TOKEN")
      ? await password({ message, validate: (v) => (v.trim() ? true : `${key} is required`) })
      : await input({
          message,
          default: existing || undefined,
          validate: (v) => (v.trim() ? true : `${key} is required`),
        });

    if (!value.trim()) {
      throw new Error(`Missing value for ${key}`);
    }
    const normalized = value.trim();
    process.env[key] = normalized;
    await authVault.upsert({ [key]: normalized });
  }
}

async function ensureProviderCredentials(provider: ProviderId): Promise<void> {
  if (provider === "ollama") return;

  if (!stdin.isTTY || !stdout.isTTY) {
    await promptProviderCredentials(provider, false);
    return;
  }

  const hasAll = hasProviderCredentials(provider);
  if (!hasAll) {
    await promptProviderCredentials(provider, true);
    return;
  }

  const keepCurrent = await confirm({
    message: "Use currently configured environment credentials?",
    default: true,
  });

  if (!keepCurrent) {
    await promptProviderCredentials(provider, true);
  }
}

function normalizeAzureEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/openai(?:\/.*)?$/i, "");
}

function sortByRecentPriority(values: string[], priority: string[]): string[] {
  const score = (value: string) => {
    const lower = value.toLowerCase();
    const index = priority.findIndex((token) => lower.includes(token));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return [...new Set(values)].sort((a, b) => {
    const scoreDiff = score(a) - score(b);
    return scoreDiff !== 0 ? scoreDiff : a.localeCompare(b);
  });
}

async function discoverOpenAIAnswerModels(): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to discover OpenAI models.");
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`OpenAI model discovery failed with status ${response.status}`);
  }

  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = (body.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string")
    .filter((id) => id.startsWith("gpt-") || id.startsWith("o"))
    .filter((id) => !id.includes("embedding"));

  if (ids.length === 0) {
    const fallback = PROVIDER_REGISTRY.find((item) => item.provider === "openai")!;
    return fallback.answerModels;
  }

  return sortByRecentPriority(ids, RECENT_ANSWER_MODEL_PRIORITY);
}

async function discoverAzureAnswerDeployments(): Promise<string[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !apiVersion) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_API_VERSION are required.",
    );
  }

  const endpointBase = normalizeAzureEndpoint(endpoint);
  const discoveryVersions = [...new Set([apiVersion, "2024-10-21", "2024-06-01", "2023-05-15"])];
  let response: Response | null = null;
  let lastStatus: number | null = null;

  for (const version of discoveryVersions) {
    const url = `${endpointBase}/openai/deployments?api-version=${encodeURIComponent(version)}`;
    const current = await fetch(url, { headers: { "api-key": apiKey } });
    if (current.ok) {
      response = current;
      break;
    }
    lastStatus = current.status;
    if (current.status === 401 || current.status === 403) {
      throw new Error(`Azure deployment discovery failed with status ${current.status}`);
    }
  }

  if (!response) {
    throw new Error(`Azure deployment discovery failed with status ${lastStatus ?? "unknown"}`);
  }

  const body = (await response.json()) as {
    data?: Array<{ id?: string; model?: string; capabilities?: Record<string, unknown> }>;
  };

  const answerDeployments = (body.data ?? [])
    .map((item) => ({
      deployment: item.id ?? "",
      model: (item.model ?? "").toLowerCase(),
      capabilities: item.capabilities ?? {},
    }))
    .filter((item) => Boolean(item.deployment))
    .filter((item) => {
      const hasEmbeddingCapability = Boolean(item.capabilities.embeddings);
      const embeddingLike = item.model.includes("embedding") || item.deployment.toLowerCase().includes("embedding");
      return !hasEmbeddingCapability && !embeddingLike;
    })
    .map((item) => item.deployment);

  if (answerDeployments.length === 0) {
    const fallback = PROVIDER_REGISTRY.find((item) => item.provider === "azure-openai")!;
    return fallback.answerModels;
  }

  return sortByRecentPriority(answerDeployments, RECENT_ANSWER_MODEL_PRIORITY);
}

type OllamaTagsResponse = {
  models?: Array<{ name?: string; details?: { family?: string } }>;
};

async function discoverOllamaModels(baseUrl: string): Promise<{ answer: string[]; embedding: string[] }> {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama model discovery failed (status ${response.status}). Is Ollama running?`);
  }

  const body = (await response.json()) as OllamaTagsResponse;
  const models = (body.models ?? [])
    .map((m) => m.name ?? "")
    .filter(Boolean)
    .map((name) => name.replace(/:latest$/, ""));

  const embeddingKeywords = ["embed", "minilm", "snowflake", "bge", "e5-"];
  const embedding = models.filter((name) =>
    embeddingKeywords.some((kw) => name.toLowerCase().includes(kw)),
  );
  const answer = models.filter(
    (name) => !embeddingKeywords.some((kw) => name.toLowerCase().includes(kw)),
  );

  return { answer, embedding };
}

async function discoverAnswerModels(provider: ProviderId, ollamaBaseUrl?: string): Promise<string[]> {
  if (provider === "openai") {
    return discoverOpenAIAnswerModels();
  }
  if (provider === "ollama") {
    const { answer } = await discoverOllamaModels(ollamaBaseUrl ?? "http://localhost:11434");
    if (answer.length === 0) {
      const fallback = PROVIDER_REGISTRY.find((item) => item.provider === "ollama")!;
      return fallback.answerModels;
    }
    return answer;
  }
  return discoverAzureAnswerDeployments();
}

async function discoverOllamaEmbeddingModels(baseUrl: string): Promise<string[]> {
  const { embedding } = await discoverOllamaModels(baseUrl);
  if (embedding.length === 0) {
    const fallback = PROVIDER_REGISTRY.find((item) => item.provider === "ollama")!;
    return fallback.embeddingModels;
  }
  return embedding;
}

async function probeAzureDeploymentCandidates(): Promise<string[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !apiVersion) {
    return [];
  }

  const endpointBase = normalizeAzureEndpoint(endpoint);
  const versions = [...new Set([apiVersion, "2024-10-21", "2024-06-01", "2023-05-15"])];
  const confirmed: string[] = [];

  for (const candidate of AZURE_CANDIDATE_DEPLOYMENTS) {
    let matched = false;

    for (const version of versions) {
      const url = `${endpointBase}/openai/deployments/${encodeURIComponent(candidate)}?api-version=${encodeURIComponent(version)}`;
      const response = await fetch(url, { headers: { "api-key": apiKey } });

      if (response.status === 200) {
        matched = true;
        break;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Azure deployment probe failed with status ${response.status}`);
      }
    }

    if (matched) {
      confirmed.push(candidate);
    }
  }

  return sortByRecentPriority(confirmed, RECENT_ANSWER_MODEL_PRIORITY);
}

async function promptAzureAnswerDeploymentManually(): Promise<string[]> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Azure deployment discovery failed in non-interactive mode. " +
        "Set AZURE_OPENAI_DEPLOYMENT_NAME and rerun configure.",
    );
  }

  const answerDeployment = (await input({
    message: "Enter Azure answer deployment name (e.g. your GPT deployment)",
  })).trim();

  if (!answerDeployment) {
    throw new Error("Answer deployment name is required.");
  }

  return [answerDeployment];
}

function azureDeploymentEnvFallback(): string[] {
  const candidates = [
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    process.env.AZURE_OPENAI_ANSWER_DEPLOYMENT,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  return [...new Set(candidates)];
}

function likelyAzureDeploymentFallback(): string[] {
  return sortByRecentPriority(AZURE_CANDIDATE_DEPLOYMENTS, RECENT_ANSWER_MODEL_PRIORITY);
}

async function promptOllamaBaseUrl(): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) {
    return "http://localhost:11434";
  }

  return (await input({
    message: "Ollama base URL",
    default: "http://localhost:11434",
  })).trim();
}

export async function runConfigurePrompt(): Promise<ConfigurePromptResult> {
  if (!stdin.isTTY || !stdout.isTTY) {
    const providerLabel = await fallbackSelect("Select provider:", PROVIDER_REGISTRY.map((item) => item.label));
    const providerEntry = PROVIDER_REGISTRY.find((item) => item.label === providerLabel)!;
    await ensureProviderCredentials(providerEntry.provider);

    let ollamaBaseUrl: string | undefined;
    if (providerEntry.provider === "ollama") {
      ollamaBaseUrl = "http://localhost:11434";
    }

    let answerModels: string[];
    try {
      answerModels = await discoverAnswerModels(providerEntry.provider, ollamaBaseUrl);
    } catch (error) {
      if (providerEntry.provider !== "azure-openai") {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown model discovery error";
      const probed = await probeAzureDeploymentCandidates();
      const envFallback = azureDeploymentEnvFallback();
      if (probed.length > 0) {
        console.warn(`${message}. Using deployments verified by direct probe.`);
        answerModels = probed;
      } else if (envFallback.length > 0) {
        console.warn(`${message}. Using deployment from environment fallback.`);
        answerModels = envFallback;
      } else {
        console.warn(`${message}. Showing likely recent Azure deployment names.`);
        answerModels = likelyAzureDeploymentFallback();
      }
    }

    const answerModel = await fallbackSelect("Select answer model:", answerModels);

    let embeddingModel: string | undefined;
    if (providerEntry.provider === "ollama") {
      const embeddingModels = await discoverOllamaEmbeddingModels(ollamaBaseUrl!);
      embeddingModel = await fallbackSelect("Select embedding model:", embeddingModels);
    }

    return {
      provider: providerEntry.provider,
      answerModel,
      embeddingModel,
      azureDeployment: providerEntry.provider === "azure-openai" ? answerModel : undefined,
      ollamaBaseUrl,
    };
  }

  const provider = await select<ProviderId>({
    message: "Select LLM provider",
    choices: PROVIDER_REGISTRY.map((item) => ({ name: item.label, value: item.provider })),
  });

  await ensureProviderCredentials(provider);

  let ollamaBaseUrl: string | undefined;
  if (provider === "ollama") {
    ollamaBaseUrl = await promptOllamaBaseUrl();
    console.log("Discovering local models...");
  }

  let answerModels: string[];
  try {
    answerModels = await discoverAnswerModels(provider, ollamaBaseUrl);
  } catch (error) {
    if (provider !== "azure-openai") {
      throw error;
    }
    const message = error instanceof Error ? error.message : "unknown model discovery error";
    const probed = await probeAzureDeploymentCandidates();
    const envFallback = azureDeploymentEnvFallback();
    if (probed.length > 0) {
      console.warn(`${message}. Using deployments verified by direct probe.`);
      answerModels = probed;
    } else if (envFallback.length > 0) {
      console.warn(`${message}. Using deployment from environment fallback.`);
      answerModels = envFallback;
    } else {
      console.warn(`${message}. Showing likely recent Azure deployment names.`);
      answerModels = likelyAzureDeploymentFallback();
    }
  }

  const answerModel = await select<string>({
    message: "Select answer model",
    choices: answerModels.map((model) => ({ name: model, value: model })),
  });

  let embeddingModel: string | undefined;
  if (provider === "ollama") {
    const embeddingModels = await discoverOllamaEmbeddingModels(ollamaBaseUrl!);
    embeddingModel = await select<string>({
      message: "Select embedding model",
      choices: embeddingModels.map((model) => ({ name: model, value: model })),
    });
  }

  const accepted = await confirm({ message: "Confirm selection", default: true });
  if (!accepted) {
    throw new Error("Configuration cancelled");
  }

  return {
    provider,
    answerModel,
    embeddingModel,
    azureDeployment: provider === "azure-openai" ? answerModel : undefined,
    ollamaBaseUrl,
  };
}
