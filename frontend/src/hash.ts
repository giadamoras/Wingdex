// Small string hash (FNV-1a): the same text always gives the same number.
// Used for picks that must look random but stay stable, like today's fact.
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
