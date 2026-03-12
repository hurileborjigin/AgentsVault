import { RetrievedChunk } from "@agent-vault/core";

export function buildGroundedPrompt(question: string, context: RetrievedChunk[]): string {
  const contextBlock = context
    .map(
      (chunk, index) =>
        `[${index + 1}] path=${chunk.documentPath} chunk=${chunk.chunkIndex} score=${chunk.score.toFixed(4)}\n${chunk.content}`,
    )
    .join("\n\n");

  return [
    "You are answering from retrieved project context only.",
    "If evidence is insufficient, explicitly say you are uncertain.",
    "Provide concise technical answer and reference context IDs like [1], [2].",
    "",
    `Question: ${question}`,
    "",
    "Retrieved Context:",
    contextBlock,
  ].join("\n");
}
