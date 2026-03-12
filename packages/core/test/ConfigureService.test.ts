import { describe, expect, it, vi } from "vitest";
import { ConfigureService } from "../src/services/ConfigureService";
import { ConfigRepository } from "../src/ports/interfaces";
import { ValidationError } from "@agent-vault/shared";

function createMockConfigRepo(): ConfigRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ConfigureService", () => {
  it("saves valid openai configuration", async () => {
    const repo = createMockConfigRepo();
    const service = new ConfigureService(repo);

    process.env.OPENAI_API_KEY = "test-key";

    const config = await service.configure({
      provider: "openai",
      answerModel: "gpt-4.1",
      outputDir: ".conversations",
      dbPath: ".agent-vault/agent-vault.sqlite",
    });

    expect(config.provider).toBe("openai");
    expect(config.answerModel).toBe("gpt-4.1");
    expect(config.embeddingModel).toBe("text-embedding-3-large");
    expect(repo.save).toHaveBeenCalledOnce();

    delete process.env.OPENAI_API_KEY;
  });

  it("throws ValidationError when env vars are missing", async () => {
    const repo = createMockConfigRepo();
    const service = new ConfigureService(repo);

    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      service.configure({
        provider: "openai",
        answerModel: "gpt-4.1",
        outputDir: ".conversations",
        dbPath: ".agent-vault/agent-vault.sqlite",
      }),
    ).rejects.toThrow(ValidationError);

    if (saved) process.env.OPENAI_API_KEY = saved;
  });

  it("throws ValidationError when azure deployment is missing", async () => {
    const repo = createMockConfigRepo();
    const service = new ConfigureService(repo);

    process.env.AZURE_OPENAI_API_KEY = "test";
    process.env.AZURE_OPENAI_ENDPOINT = "https://test.openai.azure.com";
    process.env.AZURE_OPENAI_API_VERSION = "2024-12-01-preview";

    await expect(
      service.configure({
        provider: "azure-openai",
        answerModel: "gpt-4.1-prod",
        outputDir: ".conversations",
        dbPath: ".agent-vault/agent-vault.sqlite",
      }),
    ).rejects.toThrow("Azure OpenAI requires a deployment name");

    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_VERSION;
  });
});
