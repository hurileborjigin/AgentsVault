import fs from "node:fs/promises";
import path from "node:path";
import { sha256 } from "@agent-vault/shared";
import { DiscoveredFile } from "@agent-vault/core";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".pdf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function classifyExtension(ext: string): DiscoveredFile["fileType"] | null {
  if (ext === ".pdf") return "pdf";
  if (ext === ".txt") return "txt";
  if (ext === ".md") return "md";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return null;
}

async function scanDir(root: string, current: string, includeImages: boolean, out: DiscoveredFile[]) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await scanDir(root, absolutePath, includeImages, out);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext) && !(includeImages && IMAGE_EXTENSIONS.has(ext))) {
      continue;
    }

    const fileType = classifyExtension(ext);
    if (!fileType) {
      continue;
    }

    const content = await fs.readFile(absolutePath);
    out.push({
      absolutePath,
      relativePath: path.relative(root, absolutePath),
      fileType,
      checksum: sha256(content),
    });
  }
}

export async function discoverSourceFiles(
  sourcePath: string,
  includeImages: boolean,
): Promise<DiscoveredFile[]> {
  const absoluteSource = path.resolve(sourcePath);
  const discovered: DiscoveredFile[] = [];
  await scanDir(absoluteSource, absoluteSource, includeImages, discovered);
  return discovered;
}
