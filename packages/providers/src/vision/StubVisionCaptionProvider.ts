export class StubVisionCaptionProvider {
  async describeImage(filePath: string): Promise<string> {
    return `IMAGE_CAPTION_STUB: Caption generation not implemented for ${filePath}.`;
  }
}
