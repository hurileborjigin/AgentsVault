export class StubOcrProvider {
  async extractText(filePath: string): Promise<string> {
    return `OCR_STUB: Text extraction not implemented for ${filePath}.`;
  }
}
