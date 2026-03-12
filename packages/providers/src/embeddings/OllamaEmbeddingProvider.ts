import OpenAI from "openai";
import { EmbeddingProvider } from "@agent-vault/core";

const KNOWN_DIMENSIONS: Record<string, number> = {
  "nomic-embed-text": 768,
  "embeddinggemma": 768,
  "mxbai-embed-large": 1024,
  "all-minilm": 384,
  "snowflake-arctic-embed": 1024,
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;
  private readonly baseUrl: string;
  private cachedDimensions: number | null = null;

  constructor(
    private readonly embeddingModel: string,
    baseUrl?: string,
  ) {
    this.baseUrl = baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
    this.client = new OpenAI({
      baseURL: `${this.baseUrl}/v1`,
      apiKey: "ollama",
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }

  model(): string {
    return this.embeddingModel;
  }

  dimensions(): number {
    if (this.cachedDimensions) return this.cachedDimensions;

    for (const [key, dims] of Object.entries(KNOWN_DIMENSIONS)) {
      if (this.embeddingModel.includes(key)) {
        this.cachedDimensions = dims;
        return dims;
      }
    }

    // Default fallback — will be corrected after first embed call via probeDimensions()
    return 768;
  }

  async probeDimensions(): Promise<number> {
    if (this.cachedDimensions) return this.cachedDimensions;

    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: "dimension probe",
    });

    const dims = response.data[0]?.embedding.length ?? 768;
    this.cachedDimensions = dims;
    return dims;
  }
}
