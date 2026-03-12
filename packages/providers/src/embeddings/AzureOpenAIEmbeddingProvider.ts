import { AzureOpenAI } from "openai";
import { EmbeddingProvider } from "@agent-vault/core";

export class AzureOpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly client: AzureOpenAI;

  constructor(private readonly embeddingModel: string) {
    this.client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      deployment: this.embeddingModel,
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
    if (this.embeddingModel.includes("small")) return 1536;
    return 3072;
  }
}
