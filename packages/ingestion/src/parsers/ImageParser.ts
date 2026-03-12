import path from "node:path";
import { DocumentParser, ParsedAsset } from "@agent-vault/core";

export interface OcrAdapter {
  extractText(filePath: string): Promise<string>;
}

export interface VisionCaptionAdapter {
  describeImage(filePath: string): Promise<string>;
}

export class ImageParser implements DocumentParser {
  constructor(
    private readonly ocrAdapter: OcrAdapter,
    private readonly captionAdapter: VisionCaptionAdapter,
  ) {}

  supports(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
  }

  async parse(filePath: string, documentId: string): Promise<ParsedAsset[]> {
    const [ocrText, caption] = await Promise.all([
      this.ocrAdapter.extractText(filePath),
      this.captionAdapter.describeImage(filePath),
    ]);

    return [
      {
        documentId,
        modality: "ocr-text",
        content: ocrText,
        metadata: { parser: "image", sourcePath: filePath, strategy: "stub" },
      },
      {
        documentId,
        modality: "image-caption",
        content: caption,
        metadata: { parser: "image", sourcePath: filePath, strategy: "stub" },
      },
    ];
  }
}
