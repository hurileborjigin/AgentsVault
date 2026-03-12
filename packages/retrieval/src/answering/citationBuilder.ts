import { Citation, RetrievedChunk } from "@agent-vault/core";

export function citationsFromRetrievedChunks(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    documentPath: chunk.documentPath,
    chunkId: chunk.chunkId,
    excerpt: chunk.content.slice(0, 240),
    score: chunk.score,
    metadata: chunk.metadata,
  }));
}
