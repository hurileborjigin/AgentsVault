import { ConversationExporter } from "../ports/interfaces";
import { QueryLog } from "../domain/entities";

export class ConversationLogService {
  constructor(private readonly exporter: ConversationExporter) {}

  async save(log: QueryLog): Promise<string> {
    return this.exporter.export(log);
  }
}
