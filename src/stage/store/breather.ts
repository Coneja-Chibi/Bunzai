/**
 * The speed budget inside long loops (Performance): nothing may hold the
 * main thread past 100 ms. A loop over a whole library calls the returned function once per item;
 * whenever a slice of work has run for `sliceMs`, it hands control back to the app for one turn, so
 * the loop's total time grows with the library but no single pause does.
 */
export function breather(sliceMs = 20): () => Promise<void> {
  let since = performance.now();
  return async () => {
    if (performance.now() - since < sliceMs) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
    since = performance.now();
  };
}
