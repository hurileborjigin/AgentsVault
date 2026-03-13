import { describe, expect, it, vi } from "vitest";
import { IngestService, DiscoveredFile } from "../src/services/IngestService";
import { DocumentChunk, ParsedAsset, SourceDocument } from "../src/domain/entities";
import { Chunker, DocumentParser, EmbeddingProvider, VectorStore } from "../src/ports/interfaces";

function createMockVectorStore(): VectorStore {
  return {
    upsertDocuments: vi.fn().mockResolvedValue(undefined),
    upsertChunks: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteByProjectAndPath: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue({ documents: 0, chunks: 0 }),
    findByProjectAndPath: vi.fn().mockResolvedValue(null),
    createIngestionJob: vi.fn().mockResolvedValue(undefined),
    finishIngestionJob: vi.fn().mockResolvedValue(undefined),
    getProjectStats: vi.fn().mockResolvedValue({ documents: 0, chunks: 0, lastIngestionAt: null }),
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

function createMockChunker(): Chunker {
  return {
    chunk: vi.fn().mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 0,
        modality: "text",
        content: "test content",
        tokenCount: 2,
        embeddingModel: "text-embedding-3-large",
        embedding: [],
        metadata: { projectId: "test" },
      } satisfies DocumentChunk,
    ]),
  };
}

function createMockParser(): DocumentParser {
  return {
    supports: vi.fn().mockReturnValue(true),
    parse: vi.fn().mockResolvedValue([
      {
        documentId: "doc-1",
        modality: "text",
        content: "parsed content",
        metadata: {},
      } satisfies ParsedAsset,
    ]),
  };
}

function makeFile(overrides?: Partial<DiscoveredFile>): DiscoveredFile {
  return {
    absolutePath: "/src/readme.md",
    relativePath: "readme.md",
    fileType: "md",
    checksum: "abc123",
    ...overrides,
  };
}

describe("IngestService", () => {
  it("ingests files and returns summary with embedding model", async () => {
    const vectorStore = createMockVectorStore();
    const embeddingProvider = createMockEmbeddingProvider();
    const chunker = createMockChunker();
    const parser = createMockParser();

    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => parser },
      chunker,
      embeddingProvider,
      vectorStore,
    });

    const summary = await service.ingest({
      sourcePath: "/src",
      projectId: "test-project",
    });

    expect(summary.projectId).toBe("test-project");
    expect(summary.scanned).toBe(1);
    expect(summary.parsed).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.chunks).toBe(1);
    expect(summary.persisted).toBe(true);
    expect(summary.embeddingModel).toBe("text-embedding-3-large");
    expect(vectorStore.upsertDocuments).toHaveBeenCalledOnce();
    expect(vectorStore.upsertChunks).toHaveBeenCalledOnce();
  });

  it("skips files with unchanged checksum", async () => {
    const vectorStore = createMockVectorStore();
    (vectorStore.findByProjectAndPath as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing",
      projectId: "test",
      path: "readme.md",
      fileType: "md",
      checksum: "abc123",
      metadata: {},
      createdAt: "",
      updatedAt: "",
    } satisfies SourceDocument);

    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => createMockParser() },
      chunker: createMockChunker(),
      embeddingProvider: createMockEmbeddingProvider(),
      vectorStore,
    });

    const summary = await service.ingest({
      sourcePath: "/src",
      projectId: "test",
    });

    expect(summary.skipped).toBe(1);
    expect(summary.parsed).toBe(0);
    expect(vectorStore.upsertDocuments).not.toHaveBeenCalled();
  });

  it("reindexes when --reindex is set even if checksum matches", async () => {
    const vectorStore = createMockVectorStore();
    (vectorStore.findByProjectAndPath as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing",
      projectId: "test",
      path: "readme.md",
      fileType: "md",
      checksum: "abc123",
      metadata: {},
      createdAt: "",
      updatedAt: "",
    } satisfies SourceDocument);

    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => createMockParser() },
      chunker: createMockChunker(),
      embeddingProvider: createMockEmbeddingProvider(),
      vectorStore,
    });

    const summary = await service.ingest({
      sourcePath: "/src",
      projectId: "test",
      reindex: true,
    });

    expect(summary.parsed).toBe(1);
    expect(vectorStore.upsertDocuments).toHaveBeenCalledOnce();
  });

  it("does not persist in dry-run mode", async () => {
    const vectorStore = createMockVectorStore();

    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => createMockParser() },
      chunker: createMockChunker(),
      embeddingProvider: createMockEmbeddingProvider(),
      vectorStore,
    });

    const summary = await service.ingest({
      sourcePath: "/src",
      projectId: "test",
      dryRun: true,
    });

    expect(summary.persisted).toBe(false);
    expect(summary.chunks).toBe(1);
    expect(vectorStore.upsertDocuments).not.toHaveBeenCalled();
    expect(vectorStore.upsertChunks).not.toHaveBeenCalled();
  });

  it("skips files with no parser", async () => {
    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => null },
      chunker: createMockChunker(),
      embeddingProvider: createMockEmbeddingProvider(),
      vectorStore: createMockVectorStore(),
    });

    const summary = await service.ingest({
      sourcePath: "/src",
      projectId: "test",
    });

    expect(summary.skipped).toBe(1);
    expect(summary.parsed).toBe(0);
  });

  it("marks job as failed when an error occurs", async () => {
    const vectorStore = createMockVectorStore();
    const embeddingProvider = createMockEmbeddingProvider();
    (embeddingProvider.embed as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API rate limit"),
    );

    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([makeFile()]),
      parserFactory: { forPath: () => createMockParser() },
      chunker: createMockChunker(),
      embeddingProvider,
      vectorStore,
    });

    await expect(
      service.ingest({ sourcePath: "/src", projectId: "test" }),
    ).rejects.toThrow("API rate limit");

    expect(vectorStore.finishIngestionJob).toHaveBeenCalledWith(
      expect.any(String),
      "failed",
      expect.objectContaining({ error: "API rate limit" }),
    );
  });

  it("calls onProgress callback with correct phases and data", async () => {
    const vectorStore = createMockVectorStore();
    const service = new IngestService({
      discoverFiles: vi.fn().mockResolvedValue([
        makeFile(),
        makeFile({ absolutePath: "/src/notes.md", relativePath: "notes.md", checksum: "def456" }),
      ]),
      parserFactory: { forPath: () => createMockParser() },
      chunker: createMockChunker(),
      embeddingProvider: createMockEmbeddingProvider(),
      vectorStore,
    });

    const events: Array<{ phase: string; current: number; total: number }> = [];
    const onProgress = vi.fn((p: { phase: string; current: number; total: number }) => {
      events.push({ phase: p.phase, current: p.current, total: p.total });
    });

    await service.ingest({
      sourcePath: "/src",
      projectId: "test",
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
    expect(events[0]).toEqual(expect.objectContaining({ phase: "scanning", current: 0, total: 2 }));
    expect(events[1]).toEqual(expect.objectContaining({ phase: "processing", current: 1, total: 2 }));
    expect(events[2]).toEqual(expect.objectContaining({ phase: "processing", current: 2, total: 2 }));
    expect(events[events.length - 1]).toEqual(expect.objectContaining({ phase: "done", current: 2, total: 2 }));
  });
});
