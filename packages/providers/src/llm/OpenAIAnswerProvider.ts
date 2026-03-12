import OpenAI from "openai";
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

export class OpenAIAnswerProvider implements AnswerProvider {
  private readonly client: OpenAI;

  constructor(private readonly answerModel: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async answer(input: {
    question: string;
    context: RetrievedChunk[];
    instructions?: string;
  }): Promise<{ answer: string; citations: Citation[] }> {
    const prompt = buildPrompt(input.question, input.context, input.instructions);
    const response = await this.client.responses.create({
      model: this.answerModel,
      input: prompt,
      temperature: 0,
    });

    const answer = response.output_text?.trim() || "Insufficient evidence from retrieved context.";
    return { answer, citations: buildFallbackCitations(input.context) };
  }

  model(): string {
    return this.answerModel;
  }
}
