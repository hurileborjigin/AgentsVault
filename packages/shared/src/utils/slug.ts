export function slugifyQuestion(input: string): string {
  const base = input.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim();
  return base.replace(/\s+/g, "-").slice(0, 48) || "query";
}
