import { z } from "zod";

export const modelConfigurationSchema = z.object({
  provider: z.enum(["openai", "azure-openai"]),
  answerModel: z.string().min(1),
  embeddingModel: z.string().min(1),
  azureDeployment: z.string().min(1).optional(),
  outputDir: z.string().min(1),
  dbPath: z.string().min(1),
  defaultProject: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
});

export type ModelConfiguration = z.infer<typeof modelConfigurationSchema>;
