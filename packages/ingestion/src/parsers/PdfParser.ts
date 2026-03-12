import fs from "node:fs/promises";
import path from "node:path";
import pdfParse from "pdf-parse";
import { DocumentParser, ParsedAsset } from "@agent-vault/core";
import { sanitizeTextForStorage } from "@agent-vault/shared";

function detectPrintedPageLabel(pageText: string): number | null {
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const last = lines[lines.length - 1];
  if (last && /^\d{1,4}$/.test(last)) {
    return Number(last);
  }

  const first = lines[0];
  if (first && /^\d{1,4}$/.test(first)) {
    return Number(first);
  }

  return null;
}

export class PdfParser implements DocumentParser {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".pdf";
  }

  async parse(filePath: string, documentId: string): Promise<ParsedAsset[]> {
    const buffer = await fs.readFile(filePath);
    const pageTexts: Array<string | undefined> = [];
    const parsed = await pdfParse(buffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });

        let lastY: number | undefined;
        let text = "";
        for (const item of textContent.items as Array<{ str: string; transform: number[] }>) {
          if (lastY === undefined || lastY === item.transform[5]) {
            text += item.str;
          } else {
            text += `\n${item.str}`;
          }
          lastY = item.transform[5];
        }

        const normalizedPage = sanitizeTextForStorage(text);
        const pageIndex =
          typeof pageData.pageIndex === "number" && Number.isFinite(pageData.pageIndex)
            ? pageData.pageIndex
            : pageTexts.length;
        pageTexts[pageIndex] = normalizedPage;
        return normalizedPage;
      },
    });

    const pageAssets = pageTexts
      .map((content, index) => ({
        documentId,
        modality: "text" as const,
        content: content ?? "",
        metadata: {
          parser: "pdf",
          sourcePath: filePath,
          pageNumber: index + 1,
          printedPage: detectPrintedPageLabel(content ?? ""),
          totalPages: parsed.numpages,
        },
      }))
      .filter((asset) => Boolean(asset.content));

    if (pageAssets.length > 0) {
      return pageAssets;
    }

    const normalized = sanitizeTextForStorage(parsed.text);
    if (!normalized) {
      return [];
    }

    return [
      {
        documentId,
        modality: "text",
        content: normalized,
        metadata: {
          parser: "pdf",
          sourcePath: filePath,
          totalPages: parsed.numpages,
        },
      },
    ];
  }
}
