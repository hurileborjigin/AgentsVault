import { describe, expect, it } from "vitest";
import { DefaultChunker } from "../src";

describe("DefaultChunker", () => {
  it("creates chunks with metadata", async () => {
    const chunker = new DefaultChunker();
    const chunks = await chunker.chunk({
      assets: [
        {
          documentId: "doc-1",
          modality: "text",
          content: "# Intro\nThis is a test document.",
          metadata: { sourcePath: "doc.md" },
        },
      ],
      embeddingModel: "text-embedding-3-large",
      metadata: { projectId: "demo" },
      documentId: "doc-1",
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.metadata.projectId).toBe("demo");
    expect(chunks[0]?.metadata.sourceLineStart).toBeTypeOf("number");
    expect(chunks[0]?.metadata.sourceLineEnd).toBeTypeOf("number");
  });
});
