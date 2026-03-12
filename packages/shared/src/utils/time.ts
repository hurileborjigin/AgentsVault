export function nowIso(): string {
  return new Date().toISOString();
}

export function dateFolderFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export function timestampSlugFromIso(iso: string): string {
  return iso.replace(/[:]/g, "-").replace(/\..+$/, "");
}
