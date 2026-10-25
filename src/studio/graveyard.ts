/**
 * Graveyard store - atomic write; missing file = empty; corrupt file = empty rather than a throw.
 *
 * A SIBLING OF THE COLLECTIONS STORE, and for the same reasons: it holds studio CONTENT rather than
 * preferences, it grows, and hanging it off settings.json would mean rewriting somebody's theme
 * every time they buried a block.
 *
 * ONE DIFFERENCE FROM COLLECTIONS, and it is the important one. A collection is a view - lose it
 * and you have lost an opinion about pieces that still exist. A grave is the ONLY copy of a block
 * that has been taken out of its preset. So the write is serialised like everything else here, and
 * the read is tolerant per grave rather than per file: a single corrupt entry must not take the
 * hundred beside it.
 */
import type { StateStore } from "../stage/contracts/state-store";
import { EMPTY_GRAVEYARD, parseGraveyard, type GraveyardFile } from "./graveyard-shape";
import { stateDocument } from "./state-document-store";

export class GraveyardStore {
  /**
   * The document, including its write queue.
   *
   * THE RACE THAT MATTERS HERE: burying two blocks quickly - which is exactly how somebody clears
   * out a preset - has both reads see the same file and the second write drop the first block. In
   * a store that holds the only copy, that is not a lost edit; it is a lost block.
   */
  private readonly doc;

  constructor(dir: string, stateFor?: () => StateStore | null) {
    this.doc = stateDocument(dir, "graveyard", EMPTY_GRAVEYARD, parseGraveyard, () => EMPTY_GRAVEYARD, stateFor);
  }

  read(): Promise<GraveyardFile> {
    return this.doc.read();
  }

  /** Apply a pure edit from graveyard-shape. The store owns I/O and ordering, never the rules. */
  edit(change: (current: GraveyardFile) => GraveyardFile): Promise<GraveyardFile> {
    return this.doc.enqueue(async () => this.doc.write(change(await this.read())));
  }
}
