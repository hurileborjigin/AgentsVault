import { describe, expect, it } from "vitest";
import { buildGroundedPrompt } from "../src/prompts/groundedPrompt";
import { RetrievedChunk } from "@agent-vault/core";

function makeChunk(overrides?: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    documentPath: "docs/readme.md",
    chunkIndex: 0,
    modality: "text",
    content: "Some retrieved content.",
    score: 0.92,
    metadata: {},
    ...overrides,
  };
}

describe("buildGroundedPrompt", () => {
  it("includes question and context in prompt", () => {
    const prompt = buildGroundedPrompt("How does auth work?", [makeChunk()]);

    expect(prompt).toContain("Question: How does auth work?");
    expect(prompt).toContain("Some retrieved content.");
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("docs/readme.md");
    expect(prompt).toContain("0.9200");
  });

  it("numbers multiple chunks sequentially", () => {
    const prompt = buildGroundedPrompt("test", [
      makeChunk({ chunkIndex: 0 }),
      makeChunk({ chunkIndex: 1, documentPath: "docs/other.md" }),
    ]);

    expect(prompt).toContain("[1]");
    expect(prompt).toContain("[2]");
  });

  it("handles empty context", () => {
    const prompt = buildGroundedPrompt("test", []);
    expect(prompt).toContain("Question: test");
    expect(prompt).toContain("Retrieved Context:");
  });
});
