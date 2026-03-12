import OpenAI from "openai";
import { EmbeddingProvider } from "@agent-vault/core";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;

  constructor(private readonly embeddingModel: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
