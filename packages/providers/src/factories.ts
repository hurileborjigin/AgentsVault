import { EmbeddingProvider, AnswerProvider } from "@agent-vault/core";
import { ModelConfiguration } from "@agent-vault/shared";
import { OpenAIEmbeddingProvider } from "./embeddings/OpenAIEmbeddingProvider";
import { AzureOpenAIEmbeddingProvider } from "./embeddings/AzureOpenAIEmbeddingProvider";
import { OpenAIAnswerProvider } from "./llm/OpenAIAnswerProvider";
import { AzureOpenAIAnswerProvider } from "./llm/AzureOpenAIAnswerProvider";

export function createEmbeddingProvider(config: ModelConfiguration): EmbeddingProvider {
  if (config.provider === "openai") {
    return new OpenAIEmbeddingProvider(config.embeddingModel);
  }
  return new AzureOpenAIEmbeddingProvider(config.embeddingModel);
}

export function createAnswerProvider(config: ModelConfiguration): AnswerProvider {
  if (config.provider === "openai") {
    return new OpenAIAnswerProvider(config.answerModel);
  }
  return new AzureOpenAIAnswerProvider(config.azureDeployment ?? config.answerModel);
}
