import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ConversationExporter, QueryLog } from "@agent-vault/core";
import { dateFolderFromIso, slugifyQuestion, timestampSlugFromIso } from "@agent-vault/shared";

function formatLocation(metadata?: Record<string, unknown>): string {
  if (!metadata) return "";
  const page = typeof metadata.sourcePage === "number" ? metadata.sourcePage : null;
  const printedPage =
    typeof metadata.sourcePrintedPage === "number" ? metadata.sourcePrintedPage : null;
  const lineStart = typeof metadata.sourceLineStart === "number" ? metadata.sourceLineStart : null;
  const lineEnd = typeof metadata.sourceLineEnd === "number" ? metadata.sourceLineEnd : null;

  const parts: string[] = [];
  if (page !== null && printedPage !== null && printedPage !== page) {
    parts.push(`pdf page ${page} (printed ${printedPage})`);
  } else if (page !== null) {
    parts.push(`page ${page}`);
  } else if (printedPage !== null) {
    parts.push(`printed page ${printedPage}`);
  }
  if (lineStart !== null && lineEnd !== null) {
    parts.push(lineStart === lineEnd ? `line ${lineStart}` : `lines ${lineStart}-${lineEnd}`);
  } else if (lineStart !== null) {
    parts.push(`line ${lineStart}`);
  }

  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export class MarkdownConversationExporter implements ConversationExporter {
  constructor(private readonly baseDir: string) {}

  async export(record: QueryLog): Promise<string> {
    const folder = path.join(this.baseDir, dateFolderFromIso(record.createdAt));
    await fs.mkdir(folder, { recursive: true });

    const filename = `${timestampSlugFromIso(record.createdAt)}_${slugifyQuestion(record.question)}.md`;
    const outputPath = path.join(folder, filename);

    const frontmatter = [
      "---",
      `id: ${record.id || randomUUID()}`,
      `created_at: ${record.createdAt}`,
      `question: ${JSON.stringify(record.question)}`,
      `provider: ${JSON.stringify(record.provider)}`,
      `model: ${JSON.stringify(record.model)}`,
      `embedding_model: ${JSON.stringify(record.embeddingModel)}`,
      `project: ${JSON.stringify(record.project)}`,
      `top_k: ${record.topK}`,
      "sources:",
      ...Array.from(new Set(record.citations.map((citation) => citation.documentPath))).map(
        (source) => `  - ${source}`,
      ),
      "---",
    ].join("\n");

    const citations = record.citations
      .map(
        (citation, index) =>
          `${index + 1}. ${citation.documentPath}${formatLocation(citation.metadata)}, chunk ${citation.chunkId}, score ${citation.score.toFixed(4)}`,
      )
      .join("\n");

    const context = record.retrievedContext
      .map(
        (item, index) =>
          `## Source ${index + 1}: ${item.documentPath}${formatLocation(item.metadata)}\nchunk=${item.chunkId}\nscore=${item.score.toFixed(4)}\n\n${item.content}`,
      )
      .join("\n\n");

    const body = [
      frontmatter,
      "",
      "# Question",
      record.question,
      "",
      "# Answer",
      record.answer,
      "",
      "# Citations",
      citations || "No citations generated.",
      "",
      "# Retrieved Context",
      context || "No retrieved context.",
      "",
    ].join("\n");

    await fs.writeFile(outputPath, body, "utf-8");
    return outputPath;
  }
}
