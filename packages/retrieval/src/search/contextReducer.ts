export function reduceContextByScore<T extends { score: number }>(items: T[], maxItems: number): T[] {
  return [...items].sort((a, b) => b.score - a.score).slice(0, maxItems);
}
