import { describe, expect, it } from "vitest";
import { citationsFromRetrievedChunks } from "../src/answering/citationBuilder";
import { RetrievedChunk } from "@agent-vault/core";

function makeChunk(overrides?: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    documentPath: "docs/readme.md",
    chunkIndex: 0,
    modality: "text",
    content: "A".repeat(300),
    score: 0.92,
    metadata: { projectId: "test" },
    ...overrides,
  };
}

describe("citationsFromRetrievedChunks", () => {
  it("maps chunks to citations", () => {
    const citations = citationsFromRetrievedChunks([
      makeChunk({ chunkId: "c-1", score: 0.95 }),
      makeChunk({ chunkId: "c-2", score: 0.80 }),
    ]);

    expect(citations).toHaveLength(2);
    expect(citations[0]!.chunkId).toBe("c-1");
    expect(citations[0]!.score).toBe(0.95);
    expect(citations[1]!.chunkId).toBe("c-2");
  });

  it("truncates excerpt to 240 characters", () => {
    const citations = citationsFromRetrievedChunks([makeChunk()]);
    expect(citations[0]!.excerpt.length).toBe(240);
  });

  it("returns empty array for empty input", () => {
    expect(citationsFromRetrievedChunks([])).toEqual([]);
  });
});
