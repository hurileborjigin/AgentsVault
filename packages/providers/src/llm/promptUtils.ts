import { Citation, RetrievedChunk } from "@agent-vault/core";

export function buildPrompt(question: string, context: RetrievedChunk[], instructions?: string): string {
  const contextLines = context
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentPath}#${chunk.chunkIndex}\n${chunk.content}`,
    )
    .join("\n\n");

  return `${instructions ?? ""}\n\nQuestion:\n${question}\n\nContext:\n${contextLines}`;
}

export function buildFallbackCitations(context: RetrievedChunk[]): Citation[] {
  return context.map((chunk) => ({
    documentPath: chunk.documentPath,
    chunkId: chunk.chunkId,
    excerpt: chunk.content.slice(0, 240),
    score: chunk.score,
    metadata: chunk.metadata,
  }));
}
