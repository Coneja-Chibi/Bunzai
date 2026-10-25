/**
 * The graveyard document in the library: what it survives, and what it must never lose.
 *
 * The rules themselves are tested in graveyard-shape.test.ts without any storage. The store's
 * tolerance, locking, busy-read and edit-queue behavior is the shared tolerant-store contract.
 */
import { GraveyardStore } from "./graveyard";
import { bury, EMPTY_GRAVEYARD, type Grave } from "./graveyard-shape";
import type { PresetPrompt } from "../entities/preset/schema";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { tolerantStoreContract } from "./state-store.contract";

const block = (id: string): PresetPrompt => ({
  id, name: `Block ${id}`, content: "the words", role: "system", enabled: true,
  systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4,
} as unknown as PresetPrompt);

const grave = (n: number): Grave => ({
  id: `g${n}`, block: block(`g${n}`), at: 1, from: { presetId: "astrolabe", presetName: "Astrolabe" },
});

tolerantStoreContract({
  name: "graveyard",
  newState: memoryStateStore,
  key: "graveyard",
  open: (io) => new GraveyardStore("/studio", io),
  empty: EMPTY_GRAVEYARD,
  add: (current, n) => bury(current, grave(n)),
  held: (doc) => doc.graves.map((g) => Number(g.id.slice(1))),
});
