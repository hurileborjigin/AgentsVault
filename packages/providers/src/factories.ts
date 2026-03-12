import { EmbeddingProvider, AnswerProvider } from "@agent-vault/core";
import { ModelConfiguration } from "@agent-vault/shared";
import { OpenAIEmbeddingProvider } from "./embeddings/OpenAIEmbeddingProvider";
import { AzureOpenAIEmbeddingProvider } from "./embeddings/AzureOpenAIEmbeddingProvider";
import { OllamaEmbeddingProvider } from "./embeddings/OllamaEmbeddingProvider";
import { OpenAIAnswerProvider } from "./llm/OpenAIAnswerProvider";
import { AzureOpenAIAnswerProvider } from "./llm/AzureOpenAIAnswerProvider";
import { OllamaAnswerProvider } from "./llm/OllamaAnswerProvider";

export function createEmbeddingProvider(config: ModelConfiguration): EmbeddingProvider {
  if (config.provider === "openai") {
    return new OpenAIEmbeddingProvider(config.embeddingModel);
  }
  if (config.provider === "ollama") {
    return new OllamaEmbeddingProvider(config.embeddingModel, config.ollamaBaseUrl);
  }
  return new AzureOpenAIEmbeddingProvider(config.embeddingModel);
}

export function createAnswerProvider(config: ModelConfiguration): AnswerProvider {
  if (config.provider === "openai") {
    return new OpenAIAnswerProvider(config.answerModel);
  }
  if (config.provider === "ollama") {
    return new OllamaAnswerProvider(config.answerModel, config.ollamaBaseUrl);
  }
  return new AzureOpenAIAnswerProvider(config.azureDeployment ?? config.answerModel);
}
