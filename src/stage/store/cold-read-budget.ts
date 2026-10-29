/** The one memory budget for opening a stored piece: what admitting it and decoding it may charge together, on the worker and in process alike. */
import { SANITY_PIECE_BYTES } from "../../entities/_shared/sanity";

/** One fill's hard logical budget, shared by admission, its worker and every in-process read: the snapshot's charge and the decode's together stay under it (no separate count of parts, references or JSON nodes; each is charged against it). This is not an RSS estimate. */
export const COLD_READ_LIMIT = SANITY_PIECE_BYTES;

/** Reserve the retained sealed snapshot and bounded row/reference structures before opening it. */
export const coldReadCharge = (bytes: number, parts: number, refs: number): number =>
  bytes + (parts + refs) * 4096;
