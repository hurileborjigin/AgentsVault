import { describe, expect, it } from "vitest";
import {
  slugifyQuestion,
  sha256,
  nowIso,
  dateFolderFromIso,
  timestampSlugFromIso,
  sanitizeTextForStorage,
  validateProviderEnv,
  findProvider,
} from "../src";

describe("slugifyQuestion", () => {
  it("creates deterministic slug", () => {
    expect(slugifyQuestion("How does auth work?")).toBe("how-does-auth-work");
  });

  it("strips special characters", () => {
    expect(slugifyQuestion("What's the API (v2) endpoint?")).toBe("whats-the-api-v2-endpoint");
  });

  it("truncates to 48 characters", () => {
    const long = "a".repeat(100);
    expect(slugifyQuestion(long).length).toBeLessThanOrEqual(48);
  });

  it("returns 'query' for empty input", () => {
    expect(slugifyQuestion("")).toBe("query");
    expect(slugifyQuestion("!!!")).toBe("query");
  });
});

describe("sha256", () => {
  it("returns consistent hex hash for string input", () => {
    const hash = sha256("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256("hello")).toBe(hash);
  });

  it("returns different hash for different input", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });
});

describe("time utilities", () => {
  it("nowIso returns ISO string", () => {
    const iso = nowIso();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("dateFolderFromIso extracts date portion", () => {
    expect(dateFolderFromIso("2026-03-12T16:48:29.000Z")).toBe("2026-03-12");
  });

  it("timestampSlugFromIso replaces colons with dashes", () => {
    const slug = timestampSlugFromIso("2026-03-12T16:48:29.000Z");
    expect(slug).toBe("2026-03-12T16-48-29");
    expect(slug).not.toContain(":");
  });
});

describe("sanitizeTextForStorage", () => {
  it("removes null bytes and control characters", () => {
    expect(sanitizeTextForStorage("hello\u0000world")).toBe("hello\nworld".trim() ? "helloworld" : "helloworld");
    expect(sanitizeTextForStorage("hello\u0000world")).not.toContain("\u0000");
  });

  it("normalizes CRLF to LF", () => {
    expect(sanitizeTextForStorage("line1\r\nline2")).toBe("line1\nline2");
  });

  it("trims whitespace", () => {
    expect(sanitizeTextForStorage("  hello  ")).toBe("hello");
  });
});

describe("validateProviderEnv", () => {
  it("validates openai env", () => {
    const saved = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test";

    const result = validateProviderEnv("openai");
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);

    if (saved) process.env.OPENAI_API_KEY = saved;
    else delete process.env.OPENAI_API_KEY;
  });

  it("reports missing openai key", () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = validateProviderEnv("openai");
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("OPENAI_API_KEY");

    if (saved) process.env.OPENAI_API_KEY = saved;
  });
});

describe("findProvider", () => {
  it("finds openai provider", () => {
    const entry = findProvider("openai");
    expect(entry.provider).toBe("openai");
    expect(entry.answerModels.length).toBeGreaterThan(0);
  });

  it("throws for unknown provider", () => {
    expect(() => findProvider("unknown" as any)).toThrow("Unsupported provider");
  });
});
