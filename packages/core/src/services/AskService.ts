import { randomUUID } from "node:crypto";
import { ModelConfiguration, nowIso, ConfigError, RetrievalError } from "@agent-vault/shared";
import { Citation, QueryLog } from "../domain/entities";
import { AnswerProvider, ConfigRepository, EmbeddingProvider, VectorStore } from "../ports/interfaces";
import { AskRequest, AskSummary } from "../types/requests";
import { ConversationLogService } from "./ConversationLogService";

export class AskService {
  constructor(
    private readonly dependencies: {
      configRepository: ConfigRepository;
      vectorStore: VectorStore;
      conversationLogService: ConversationLogService;
      embeddingProviderFactory: (config: ModelConfiguration) => EmbeddingProvider;
      answerProviderFactory: (config: ModelConfiguration) => AnswerProvider;
      reduceContext: <T extends { score: number }>(items: T[], maxItems: number) => T[];
    },
  ) {}

  async ask(request: AskRequest): Promise<AskSummary> {
    const config = await this.dependencies.configRepository.load();
    if (!config) {
      throw new ConfigError("No configuration found. Run `agent-vault configure` first.");
    }

    const embeddingProvider = this.dependencies.embeddingProviderFactory(config);
    const answerProvider = this.dependencies.answerProviderFactory(config);

    const [queryEmbedding] = await embeddingProvider.embed([request.question]);
    if (!queryEmbedding) {
      throw new RetrievalError("Failed to embed query.");
    }

    const retrievalWindow = Math.max(20, Math.min(40, (request.topK ?? 8) * 4));
    const retrieved = await this.dependencies.vectorStore.search(queryEmbedding, {
      projectId: request.projectId,
      topK: retrievalWindow,
    });

    const reduced = this.dependencies.reduceContext(retrieved, Math.max(1, Math.min(8, request.topK ?? 8)));

    if (reduced.length === 0) {
      throw new RetrievalError(
        "No indexed chunks found for this project. Run `agent-vault ingest` first.",
      );
    }

    const result = await answerProvider.answer({
      question: request.question,
      context: reduced,
      instructions:
        "Answer only from retrieved context. If evidence is insufficient, state uncertainty clearly.",
    });

    const citations: Citation[] =
      result.citations.length > 0
        ? result.citations
        : reduced.map((chunk) => ({
            documentPath: chunk.documentPath,
            chunkId: chunk.chunkId,
            excerpt: chunk.content.slice(0, 240),
            score: chunk.score,
            metadata: chunk.metadata,
          }));

    const record: QueryLog = {
      id: randomUUID(),
      question: request.question,
      answer: result.answer,
      citations,
      createdAt: nowIso(),
      outputPath: "",
      provider: config.provider,
      model: answerProvider.model(),
      embeddingModel: embeddingProvider.model(),
      project: request.projectId,
      topK: Math.max(1, Math.min(8, request.topK ?? 8)),
      retrievedContext: reduced.map((chunk) => ({
        documentPath: chunk.documentPath,
        chunkId: chunk.chunkId,
        score: chunk.score,
        content: chunk.content,
        metadata: chunk.metadata,
      })),
    };

    const outputPath = await this.dependencies.conversationLogService.save(record);

    return {
      answer: result.answer,
      citations: citations.length,
      outputPath,
      retrieved: reduced.length,
      provider: config.provider,
      answerModel: answerProvider.model(),
      embeddingModel: embeddingProvider.model(),
    };
  }
}
