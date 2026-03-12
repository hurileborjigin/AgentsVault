import { AzureOpenAI } from "openai";
import { AnswerProvider, Citation, RetrievedChunk } from "@agent-vault/core";
import { buildPrompt, buildFallbackCitations } from "./promptUtils";

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
