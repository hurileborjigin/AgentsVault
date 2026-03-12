import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MarkdownConversationExporter } from "../src";

describe("MarkdownConversationExporter", () => {
  it("writes markdown log with expected sections", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-vault-test-"));
    const exporter = new MarkdownConversationExporter(root);

    const output = await exporter.export({
      id: "q-1",
      question: "How does retry logic work?",
      answer: "It retries with exponential backoff.",
      citations: [
        {
          documentPath: "docs/retry.md",
          chunkId: "chunk-1",
          excerpt: "retry policy",
          score: 0.93,
        },
      ],
      createdAt: "2026-03-12T16:48:29.000Z",
      outputPath: "",
      provider: "openai",
      model: "gpt-4.1",
      embeddingModel: "text-embedding-3-large",
      project: "payments-api",
      topK: 8,
      retrievedContext: [
        {
          documentPath: "docs/retry.md",
          chunkId: "chunk-1",
          score: 0.93,
          content: "retry policy details",
          metadata: { sourceLineStart: 12, sourceLineEnd: 20 },
        },
      ],
    });

    const file = await fs.readFile(output, "utf-8");
    expect(file).toContain("# Question");
    expect(file).toContain("# Answer");
    expect(file).toContain("# Citations");
    expect(file).toContain("docs/retry.md");
    expect(file).toContain("lines 12-20");
  });
});
