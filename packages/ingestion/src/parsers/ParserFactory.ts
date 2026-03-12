import { DocumentParser } from "@agent-vault/core";

export class ParserFactory {
  constructor(private readonly parsers: DocumentParser[]) {}

  forPath(filePath: string): DocumentParser | null {
    return this.parsers.find((parser) => parser.supports(filePath)) ?? null;
  }
}
