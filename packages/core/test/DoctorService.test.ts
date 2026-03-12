import { describe, expect, it, vi } from "vitest";
import { DoctorService } from "../src/services/DoctorService";
import { ConfigRepository, VectorStore } from "../src/ports/interfaces";
import { ModelConfiguration } from "@agent-vault/shared";

const MOCK_CONFIG: ModelConfiguration = {
  provider: "openai",
  answerModel: "gpt-4.1",
  embeddingModel: "text-embedding-3-large",
  outputDir: "/tmp/agent-vault-test-doctor",
  dbPath: ".agent-vault/agent-vault.sqlite",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createMockConfigRepo(config: ModelConfiguration | null = MOCK_CONFIG): ConfigRepository {
  return {
    load: vi.fn().mockResolvedValue(config),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockVectorStore(healthy = true): VectorStore {
  return {
    upsertDocuments: vi.fn(),
    upsertChunks: vi.fn(),
    search: vi.fn(),
    deleteByProjectAndPath: vi.fn(),
    findByProjectAndPath: vi.fn(),
    createIngestionJob: vi.fn(),
    finishIngestionJob: vi.fn(),
    getProjectStats: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(
      healthy ? { ok: true, detail: "SQLite OK" } : { ok: false, detail: "DB missing" },
    ),
  };
}

describe("DoctorService", () => {
  it("returns all-ok checks when everything is configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const service = new DoctorService(createMockConfigRepo(), createMockVectorStore());
    const checks = await service.run();

    expect(checks.length).toBeGreaterThanOrEqual(3);
    expect(checks.find((c) => c.name === "config")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "provider-env")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "storage-connection")?.ok).toBe(true);

    delete process.env.OPENAI_API_KEY;
  });

  it("reports config failure when no config exists", async () => {
    const service = new DoctorService(createMockConfigRepo(null), createMockVectorStore());
    const checks = await service.run();

    const configCheck = checks.find((c) => c.name === "config");
    expect(configCheck?.ok).toBe(false);
    expect(configCheck?.message).toContain("No config found");
  });

  it("reports storage failure", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const service = new DoctorService(createMockConfigRepo(), createMockVectorStore(false));
    const checks = await service.run();

    expect(checks.find((c) => c.name === "storage-connection")?.ok).toBe(false);

    delete process.env.OPENAI_API_KEY;
  });
});
