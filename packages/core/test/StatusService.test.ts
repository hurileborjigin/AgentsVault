import { describe, expect, it, vi } from "vitest";
import { StatusService } from "../src/services/StatusService";
import { ConfigRepository, VectorStore } from "../src/ports/interfaces";
import { ModelConfiguration } from "@agents-vault/shared";

const MOCK_CONFIG: ModelConfiguration = {
  provider: "openai",
  answerModel: "gpt-4.1",
  embeddingModel: "text-embedding-3-large",
  outputDir: ".conversations",
  dbPath: ".agents-vault/agents-vault.sqlite",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createMockConfigRepo(config: ModelConfiguration | null = MOCK_CONFIG): ConfigRepository {
  return {
    load: vi.fn().mockResolvedValue(config),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockVectorStore(): VectorStore {
  return {
    upsertDocuments: vi.fn(),
    upsertChunks: vi.fn(),
    search: vi.fn(),
    deleteByProjectAndPath: vi.fn(),
    deleteProject: vi.fn(),
    findByProjectAndPath: vi.fn(),
    createIngestionJob: vi.fn(),
    finishIngestionJob: vi.fn(),
    getProjectStats: vi.fn().mockResolvedValue({ documents: 5, chunks: 42, lastIngestionAt: "2026-03-01T00:00:00.000Z" }),
    healthCheck: vi.fn().mockResolvedValue({ ok: true, detail: "SQLite OK" }),
    listProjects: vi.fn().mockResolvedValue([]),
  };
}

describe("StatusService", () => {
  it("returns full status when configured", async () => {
    const service = new StatusService(createMockConfigRepo(), createMockVectorStore());
    const status = await service.getStatus("my-project");

    expect(status.configured).toBe(true);
    expect(status.provider).toBe("openai");
    expect(status.answerModel).toBe("gpt-4.1");
    expect(status.embeddingModel).toBe("text-embedding-3-large");
    expect(status.project).toBe("my-project");
    expect(status.documents).toBe(5);
    expect(status.chunks).toBe(42);
    expect(status.storageOk).toBe(true);
  });

  it("returns unconfigured status when no config", async () => {
    const service = new StatusService(createMockConfigRepo(null), createMockVectorStore());
    const status = await service.getStatus();

    expect(status.configured).toBe(false);
    expect(status.provider).toBeNull();
    expect(status.answerModel).toBeNull();
  });

  it("reports storage failure when stats query throws", async () => {
    const vectorStore = createMockVectorStore();
    (vectorStore.getProjectStats as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB locked"),
    );

    const service = new StatusService(createMockConfigRepo(), vectorStore);
    const status = await service.getStatus();

    expect(status.storageOk).toBe(false);
    expect(status.storageDetail).toContain("DB locked");
  });
});
