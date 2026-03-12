import { describe, expect, it, vi } from "vitest";
import { AskService } from "../src/services/AskService";
import { ConversationLogService } from "../src/services/ConversationLogService";
import { ConfigError, RetrievalError } from "@agents-vault/shared";
import { AnswerProvider, ConfigRepository, EmbeddingProvider, VectorStore, RetrievedChunk } from "../src/ports/interfaces";
import { ModelConfiguration } from "@agents-vault/shared";

const MOCK_CONFIG: ModelConfiguration = {
  provider: "openai",
  answerModel: "gpt-4.1",
  embeddingModel: "text-embedding-3-large",
  outputDir: ".conversations",
  dbPath: ".agents-vault/agents-vault.sqlite",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeChunk(overrides?: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    documentPath: "docs/readme.md",
    chunkIndex: 0,
    modality: "text",
    content: "This is the retrieved content for testing.",
    score: 0.92,
    metadata: {},
    ...overrides,
  };
}

function createMockConfigRepo(config: ModelConfiguration | null = MOCK_CONFIG): ConfigRepository {
  return {
    load: vi.fn().mockResolvedValue(config),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockVectorStore(chunks: RetrievedChunk[] = [makeChunk()]): VectorStore {
  return {
    upsertDocuments: vi.fn().mockResolvedValue(undefined),
    upsertChunks: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue(chunks),
    deleteByProjectAndPath: vi.fn().mockResolvedValue(undefined),
    findByProjectAndPath: vi.fn().mockResolvedValue(null),
    createIngestionJob: vi.fn().mockResolvedValue(undefined),
    finishIngestionJob: vi.fn().mockResolvedValue(undefined),
    getProjectStats: vi.fn().mockResolvedValue({ documents: 1, chunks: 1, lastIngestionAt: null }),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, detail: "ok" }),
    listProjects: vi.fn().mockResolvedValue([]),
  };
}

function createMockEmbeddingProvider(): EmbeddingProvider {
  return {
    embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    model: vi.fn().mockReturnValue("text-embedding-3-large"),
    dimensions: vi.fn().mockReturnValue(3072),
  };
}

function createMockAnswerProvider(): AnswerProvider {
  return {
    answer: vi.fn().mockResolvedValue({
      answer: "The answer based on context.",
      citations: [],
    }),
    model: vi.fn().mockReturnValue("gpt-4.1"),
  };
}

function createMockConversationLogService(): ConversationLogService {
  return {
    save: vi.fn().mockResolvedValue("/output/log.md"),
  } as unknown as ConversationLogService;
}

function createService(overrides?: {
  configRepo?: ConfigRepository;
  vectorStore?: VectorStore;
  embeddingProvider?: EmbeddingProvider;
  answerProvider?: AnswerProvider;
  logService?: ConversationLogService;
  rerank?: <T extends { score: number; metadata: Record<string, unknown> }>(items: T[]) => T[];
}) {
  const embeddingProvider = overrides?.embeddingProvider ?? createMockEmbeddingProvider();
  const answerProvider = overrides?.answerProvider ?? createMockAnswerProvider();

  return new AskService({
    configRepository: overrides?.configRepo ?? createMockConfigRepo(),
    vectorStore: overrides?.vectorStore ?? createMockVectorStore(),
    conversationLogService: overrides?.logService ?? createMockConversationLogService(),
    embeddingProviderFactory: () => embeddingProvider,
    answerProviderFactory: () => answerProvider,
    reduceContext: (items, max) => [...items].sort((a, b) => b.score - a.score).slice(0, max),
    rerank: overrides?.rerank ?? ((items) => items),
  });
}

describe("AskService", () => {
  it("returns answer with model metadata", async () => {
    const service = createService();

    const result = await service.ask({
      question: "How does auth work?",
      projectId: "test",
    });

    expect(result.answer).toBe("The answer based on context.");
    expect(result.provider).toBe("openai");
    expect(result.answerModel).toBe("gpt-4.1");
    expect(result.embeddingModel).toBe("text-embedding-3-large");
    expect(result.citations).toBe(1);
    expect(result.retrieved).toBe(1);
    expect(result.outputPath).toBe("/output/log.md");
  });

  it("throws ConfigError when no config exists", async () => {
    const service = createService({
      configRepo: createMockConfigRepo(null),
    });

    await expect(
      service.ask({ question: "test", projectId: "test" }),
    ).rejects.toThrow(ConfigError);
  });

  it("throws RetrievalError when embedding fails", async () => {
    const embeddingProvider = createMockEmbeddingProvider();
    (embeddingProvider.embed as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const service = createService({ embeddingProvider });

    await expect(
      service.ask({ question: "test", projectId: "test" }),
    ).rejects.toThrow(RetrievalError);
  });

  it("throws RetrievalError when no chunks are retrieved", async () => {
    const service = createService({
      vectorStore: createMockVectorStore([]),
    });

    await expect(
      service.ask({ question: "test", projectId: "test" }),
    ).rejects.toThrow("No indexed chunks found");
  });

  it("uses provider citations when available", async () => {
    const answerProvider = createMockAnswerProvider();
    (answerProvider.answer as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: "answer",
      citations: [
        {
          documentPath: "docs/auth.md",
          chunkId: "c-1",
          excerpt: "auth excerpt",
          score: 0.95,
        },
        {
          documentPath: "docs/login.md",
          chunkId: "c-2",
          excerpt: "login excerpt",
          score: 0.88,
        },
      ],
    });

    const service = createService({ answerProvider });
    const result = await service.ask({ question: "test", projectId: "test" });

    expect(result.citations).toBe(2);
  });

  it("clamps topK between 1 and 8", async () => {
    const vectorStore = createMockVectorStore([makeChunk()]);
    const service = createService({ vectorStore });

    await service.ask({ question: "test", projectId: "test", topK: 100 });

    expect(vectorStore.search).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ topK: 40 }),
    );
  });

  it("calls rerank with search results before reducing context", async () => {
    const chunks = [makeChunk({ chunkId: "c-1", score: 0.9 }), makeChunk({ chunkId: "c-2", score: 0.8 })];
    const vectorStore = createMockVectorStore(chunks);
    const rerank = vi.fn((items) => items);

    const service = createService({ vectorStore, rerank });
    await service.ask({ question: "test", projectId: "test" });

    expect(rerank).toHaveBeenCalledTimes(1);
    expect(rerank).toHaveBeenCalledWith(chunks);
  });
});
