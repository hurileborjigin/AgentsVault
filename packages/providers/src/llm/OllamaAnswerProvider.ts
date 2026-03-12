import OpenAI from "openai";
import { AnswerProvider, Citation, RetrievedChunk } from "@agent-vault/core";
import { buildPrompt, buildFallbackCitations } from "./promptUtils";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export class OllamaAnswerProvider implements AnswerProvider {
  private readonly client: OpenAI;

  constructor(
    private readonly answerModel: string,
    baseUrl?: string,
  ) {
    const base = baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
    this.client = new OpenAI({
      baseURL: `${base}/v1`,
      apiKey: "ollama",
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
