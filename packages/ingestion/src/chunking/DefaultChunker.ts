import { randomUUID } from "node:crypto";
import { Chunker, DocumentChunk, ParsedAsset } from "@agent-vault/core";
import { sanitizeTextForStorage } from "@agent-vault/shared";

const DEFAULT_WINDOW = 800;
const DEFAULT_OVERLAP = 120;

type ContentSpan = {
  content: string;
  startOffset: number;
  endOffset: number;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trimSpan(content: string, startOffset: number, endOffset: number): ContentSpan | null {
  let start = startOffset;
  let end = endOffset;

  while (start < end && /\s/.test(content[start] ?? "")) {
    start += 1;
  }
  while (end > start && /\s/.test(content[end - 1] ?? "")) {
    end -= 1;
  }

  if (end <= start) {
    return null;
  }

  return {
    content: content.slice(start, end),
    startOffset: start,
    endOffset: end,
  };
}

function splitByTokenWindow(
  content: string,
  targetTokens = DEFAULT_WINDOW,
  overlap = DEFAULT_OVERLAP,
): ContentSpan[] {
  const words = Array.from(content.matchAll(/\S+/g));
  if (words.length === 0) {
    return [];
  }

  const targetWords = Math.max(120, targetTokens);
  const overlapWords = Math.max(20, overlap);

  const chunks: ContentSpan[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + targetWords);
    const startOffset = words[start]?.index ?? 0;
    const lastWord = words[end - 1];
    if (!lastWord) {
      break;
    }
    const endOffset = (lastWord.index ?? 0) + lastWord[0].length;
    const span = trimSpan(content, startOffset, endOffset);
    if (span) {
      chunks.push(span);
    }
    if (end === words.length) {
      break;
    }
    start = Math.max(0, end - overlapWords);
  }
  return chunks;
}

function lineStarts(content: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

function lineAtOffset(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((starts[mid] ?? 0) <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return Math.max(1, low);
}

function splitHeadingAware(content: string): ContentSpan[] {
  const lines = content.split("\n");
  if (lines.length === 0) {
    return [];
  }

  const offsets: number[] = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets.push(cursor);
    cursor += (lines[i] ?? "").length;
    if (i < lines.length - 1) {
      cursor += 1;
    }
  }

  const headingLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i] ?? "")) {
      headingLines.push(i);
    }
  }

  if (headingLines.length === 0) {
    const span = trimSpan(content, 0, content.length);
    return span ? [span] : [];
  }

  if (headingLines[0] !== 0) {
    headingLines.unshift(0);
  }

  const sections: ContentSpan[] = [];
  for (let i = 0; i < headingLines.length; i++) {
    const startLine = headingLines[i] ?? 0;
    const nextStartLine = headingLines[i + 1];
    const endLine = nextStartLine === undefined ? lines.length - 1 : nextStartLine - 1;

    const startOffset = offsets[startLine] ?? 0;
    const endOffset = (offsets[endLine] ?? 0) + (lines[endLine] ?? "").length;
    const span = trimSpan(content, startOffset, endOffset);
    if (span) {
      sections.push(span);
    }
  }

  return sections;
}

export class DefaultChunker implements Chunker {
  async chunk(input: {
    assets: ParsedAsset[];
    embeddingModel: string;
    metadata: Record<string, unknown>;
    documentId: string;
  }): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    for (const asset of input.assets) {
      const cleanAssetContent = sanitizeTextForStorage(asset.content);
      if (!cleanAssetContent) {
        continue;
      }
      const headingAware =
        asset.modality === "text"
          ? splitHeadingAware(cleanAssetContent)
          : [
              {
                content: cleanAssetContent,
                startOffset: 0,
                endOffset: cleanAssetContent.length,
              } satisfies ContentSpan,
            ];
      const lines = lineStarts(cleanAssetContent);

      let chunkIndex = 0;
      for (const section of headingAware) {
        const tokenEstimate = estimateTokens(section.content);
        const windows =
          tokenEstimate > DEFAULT_WINDOW
            ? splitByTokenWindow(section.content, DEFAULT_WINDOW, DEFAULT_OVERLAP)
            : [
                {
                  content: section.content,
                  startOffset: 0,
                  endOffset: section.content.length,
                } satisfies ContentSpan,
              ];

        for (const window of windows) {
          const normalized = sanitizeTextForStorage(window.content);
          if (!normalized) continue;
          const absoluteStart = section.startOffset + window.startOffset;
          const absoluteEnd = section.startOffset + window.endOffset;
          const sourceLineStart = lineAtOffset(lines, absoluteStart);
          const sourceLineEnd = lineAtOffset(lines, Math.max(absoluteStart, absoluteEnd - 1));
          const pageNumber =
            typeof asset.metadata.pageNumber === "number" ? asset.metadata.pageNumber : undefined;
          const printedPage =
            typeof asset.metadata.printedPage === "number" ? asset.metadata.printedPage : undefined;

          chunks.push({
            id: randomUUID(),
            documentId: input.documentId,
            chunkIndex,
            modality: asset.modality,
            content: normalized,
            tokenCount: estimateTokens(normalized),
            embeddingModel: input.embeddingModel,
            embedding: [],
            metadata: {
              ...input.metadata,
              ...asset.metadata,
              chunkIndex,
              modality: asset.modality,
              sourceLineStart,
              sourceLineEnd,
              sourcePage: pageNumber,
              sourcePrintedPage: printedPage,
            },
          });
          chunkIndex += 1;
        }
      }
    }

    return chunks;
  }
}
