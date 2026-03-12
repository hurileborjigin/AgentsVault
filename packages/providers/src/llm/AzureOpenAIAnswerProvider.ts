import { AzureOpenAI } from "openai";
import { AnswerProvider, Citation, RetrievedChunk } from "@agent-vault/core";

function buildPrompt(question: string, context: RetrievedChunk[], instructions?: string): string {
  const contextLines = context
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentPath}#${chunk.chunkIndex}\n${chunk.content}`,
    )
    .join("\n\n");

  return `${instructions ?? ""}\n\nQuestion:\n${question}\n\nContext:\n${contextLines}`;
}

function buildFallbackCitations(context: RetrievedChunk[]): Citation[] {
  return context.map((chunk) => ({
    documentPath: chunk.documentPath,
    chunkId: chunk.chunkId,
    excerpt: chunk.content.slice(0, 240),
    score: chunk.score,
    metadata: chunk.metadata,
  }));
}

export class AzureOpenAIAnswerProvider implements AnswerProvider {
  private readonly client: AzureOpenAI;

  constructor(private readonly answerModel: string) {
    this.client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      deployment: answerModel,
    });
  }

  async answer(input: {
    question: string;
    context: RetrievedChunk[];
    instructions?: string;
  }): Promise<{ answer: string; citations: Citation[] }> {
    const prompt = buildPrompt(input.question, input.context, input.instructions);
    const response = await this.client.chat.completions.create({
      model: this.answerModel,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const answer =
      response.choices[0]?.message?.content?.trim() || "Insufficient evidence from retrieved context.";
    return { answer, citations: buildFallbackCitations(input.context) };
  }

  model(): string {
    return this.answerModel;
  }
}
