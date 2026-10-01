// Seeded RNG — mulberry32 + string hash
// No external dependencies

/** Hash a string to a 32-bit unsigned integer */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h = h | 0; // convert to 32-bit int
  }
  return h >>> 0;
}

/** Create a seeded PRNG using mulberry32 algorithm */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a seeded RNG from a string seed */
export function createRng(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/** Pick a random element from an array using the RNG */
export function pickRandom<T>(arr: readonly T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Returns true with probability p using the RNG */
export function chance(p: number, rng: () => number): boolean {
  return rng() < p;
}
