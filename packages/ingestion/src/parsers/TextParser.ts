import fs from "node:fs/promises";
import path from "node:path";
import { DocumentParser, ParsedAsset } from "@agent-vault/core";
import { sanitizeTextForStorage } from "@agent-vault/shared";

export class TextParser implements DocumentParser {
  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".txt" || ext === ".md";
  }

  async parse(filePath: string, documentId: string): Promise<ParsedAsset[]> {
    const content = await fs.readFile(filePath, "utf-8");
    const normalized = sanitizeTextForStorage(content);

    if (!normalized) {
      return [];
    }

    return [
      {
        documentId,
        modality: "text",
        content: normalized,
        metadata: {
          parser: "text",
          sourcePath: filePath,
        },
      },
    ];
  }
}
