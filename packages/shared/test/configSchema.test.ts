import { describe, expect, it } from "vitest";
import { modelConfigurationSchema } from "../src";

describe("modelConfigurationSchema", () => {
  it("validates provider/model config", () => {
    const value = modelConfigurationSchema.parse({
      provider: "openai",
      answerModel: "gpt-4.1",
      embeddingModel: "text-embedding-3-large",
      outputDir: ".conversations",
      dbPath: ".agent-vault/agent-vault.sqlite",
      defaultProject: "demo",
      updatedAt: "2026-03-12T12:00:00.000Z",
    });

    expect(value.provider).toBe("openai");
  });
});
