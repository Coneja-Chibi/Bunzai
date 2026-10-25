/** One fill's hard logical budget, shared by admission and its worker. This is not an RSS estimate. */
export const COLD_READ_LIMIT = 256 * 1024 * 1024;

/** Reserve the retained sealed snapshot and bounded row/reference structures before opening it. */
export const coldReadCharge = (bytes: number, parts: number, refs: number): number =>
  bytes + (parts + refs) * 4096;
