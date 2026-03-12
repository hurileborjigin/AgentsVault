import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type EncryptedBlob = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

type VaultPayload = {
  updatedAt: string;
  values: Record<string, string>;
};

function baseDir(): string {
  return path.join(os.homedir(), ".agent-vault");
}

function authFilePath(): string {
  return path.join(baseDir(), "auth.json");
}

function keyFilePath(): string {
  return path.join(baseDir(), "auth.key");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(baseDir(), { recursive: true, mode: 0o700 });
}

async function getOrCreateKey(): Promise<Buffer> {
  await ensureDir();
  const keyPath = keyFilePath();

  try {
    const existing = await fs.readFile(keyPath);
    if (existing.length === 32) {
      return existing;
    }
  } catch {
    // create below
  }

  const key = crypto.randomBytes(32);
  await fs.writeFile(keyPath, key, { mode: 0o600 });
  return key;
}

function encryptPayload(key: Buffer, payload: VaultPayload): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function decryptPayload(key: Buffer, blob: EncryptedBlob): VaultPayload {
  const iv = Buffer.from(blob.iv, "base64");
  const tag = Buffer.from(blob.tag, "base64");
  const data = Buffer.from(blob.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf-8")) as Partial<VaultPayload>;

  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    values: parsed.values && typeof parsed.values === "object" ? parsed.values as Record<string, string> : {},
  };
}

export class AuthVault {
  async load(): Promise<Record<string, string>> {
    await ensureDir();
    const authPath = authFilePath();

    try {
      const raw = await fs.readFile(authPath, "utf-8");
      const blob = JSON.parse(raw) as EncryptedBlob;
      if (blob.v !== 1) {
        return {};
      }

      const key = await getOrCreateKey();
      const payload = decryptPayload(key, blob);
      return payload.values;
    } catch {
      return {};
    }
  }

  async loadIntoEnv(): Promise<void> {
    const values = await this.load();
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  async save(values: Record<string, string>): Promise<void> {
    await ensureDir();
    const key = await getOrCreateKey();
    const blob = encryptPayload(key, {
      updatedAt: new Date().toISOString(),
      values,
    });

    await fs.writeFile(authFilePath(), JSON.stringify(blob, null, 2), { mode: 0o600 });
  }

  async upsert(values: Record<string, string>): Promise<void> {
    const current = await this.load();
    const merged = { ...current, ...values };
    await this.save(merged);
  }
}
