/** Deterministic one-draw-per-word sampling shared by scale fixtures and performance gates. */
export function sampleWords(rng: () => number, vocabulary: readonly string[], count: number): string[] {
  const words: string[] = [];
  for (let i = 0; i < count; i++) words.push(vocabulary[Math.floor(rng() * vocabulary.length)]!);
  return words;
}
