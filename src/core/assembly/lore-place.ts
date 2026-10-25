/**
 * Where a lore hit lands in the assembled prompt (2e-d4 plan step 3, "Placement"). `world` is left to
 * the caller: it joins into the `{{lore}}` legacy macro, not a block. Everything else lands here,
 * mutating the preset's plan and the card's depth-note map before section 10's macro pass, so a lore
 * entry's own macros run exactly like the preset's own blocks do.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { LoreBookInput, LoreHit } from "../lore/engine";
import type { Block } from "./conversation";
import type { PresetPlan } from "./preset";
import type { AssembledRole } from "./types";

export const findLast = (blocks: readonly Block[], ids: readonly string[]): number => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const s = blocks[i]!.source;
    if (s.kind === "prompt" && s.id && ids.includes(s.id)) return i;
  }
  return -1;
};
export const findFirst = (blocks: readonly Block[], ids: readonly string[]): number =>
  blocks.findIndex((b) => b.source.kind === "prompt" && b.source.id && ids.includes(b.source.id));

const toBlock = (hit: LoreHit, role: AssembledRole): Block => ({ role, content: hit.content, source: { kind: "lore", entryKey: hit.entryKey } });

function findEntry(hit: LoreHit, books: readonly LoreBookInput[]): LorebookEntry | undefined {
  return books.find((b) => b.id === hit.bookId)?.body.entries.find((e) => e.id === hit.entryId);
}

/** A lore entry's own role only means something for depth and append (schema comment on `role`); the
 * engine's `LorePosition` keeps it for depth but drops it for append, so append looks it up here. */
const appendRole = (hit: LoreHit, books: readonly LoreBookInput[]): AssembledRole => findEntry(hit, books)?.role ?? "system";

/**
 * Inserts the character, scene, and example hits among the preset's relative blocks, before
 * `buildConversation` runs, so they flow through the same macro pass as every other relative block.
 * Anchors: the last `charDescription`/`charPersonality` block for character, `scenario` for scene,
 * `dialogueExamples` for the example pair. Missing an anchor: character goes to the very start; scene
 * and the examples land right after wherever the character entries ended up (RoleCall's own fallback).
 */
function placeRelative(relative: readonly Block[], byPosition: ReadonlyMap<string, readonly LoreHit[]>): Block[] {
  const out = [...relative];
  const charHits = byPosition.get("character") ?? [];
  const charAnchor = findLast(out, ["charDescription", "charPersonality"]);
  const charAt = charAnchor >= 0 ? charAnchor + 1 : 0;
  if (charHits.length > 0) out.splice(charAt, 0, ...charHits.map((h) => toBlock(h, "system")));
  // Where the next block falls back to, when it has no anchor of its own: right after the character
  // entries. Advances only when a fallback insertion actually lands here, so scene and the examples
  // stack in order instead of leap-frogging each other.
  let fallbackAt = charAt + charHits.length;

  const sceneHits = byPosition.get("scene") ?? [];
  if (sceneHits.length > 0) {
    const anchor = findFirst(out, ["scenario"]);
    const at = anchor >= 0 ? anchor + 1 : fallbackAt;
    out.splice(at, 0, ...sceneHits.map((h) => toBlock(h, "system")));
    if (anchor < 0) fallbackAt = at + sceneHits.length;
  }

  const beforeHits = byPosition.get("before_example") ?? [];
  const afterHits = byPosition.get("after_example") ?? [];
  if (beforeHits.length > 0 || afterHits.length > 0) {
    const anchor = findFirst(out, ["dialogueExamples"]);
    if (anchor >= 0) {
      out.splice(anchor, 0, ...beforeHits.map((h) => toBlock(h, "system")));
      out.splice(anchor + beforeHits.length + 1, 0, ...afterHits.map((h) => toBlock(h, "system")));
    } else {
      out.splice(fallbackAt, 0, ...beforeHits.map((h) => toBlock(h, "system")), ...afterHits.map((h) => toBlock(h, "system")));
    }
  }
  return out;
}

/**
 * Mutates `plan` (relative, append, top, bottom) and `depthNotes` in place with every non-`world`
 * hit. `world` hits are the caller's job: they join into the `{{lore}}` legacy macro.
 */
export function placeLore(plan: PresetPlan, depthNotes: Map<number, Block[]>, injected: readonly LoreHit[], books: readonly LoreBookInput[]): void {
  const byPosition = new Map<string, LoreHit[]>();
  // prepend_top sits before the preset's own top pins, not after: collected here, spliced in front below.
  const topBlocks: Block[] = [];
  for (const hit of injected) {
    const position = hit.position;
    if (position.kind === "world") continue;
    if (position.kind === "depth") {
      const at = depthNotes.get(position.depth) ?? [];
      at.push({ role: position.role, content: hit.content, source: { kind: "lore", entryKey: hit.entryKey } });
      depthNotes.set(position.depth, at);
      continue;
    }
    if (position.kind === "append") {
      const at = plan.append.get(position.depth) ?? [];
      at.push(toBlock(hit, appendRole(hit, books)));
      plan.append.set(position.depth, at);
      continue;
    }
    if (position.kind === "prepend_top") {
      topBlocks.push(toBlock(hit, "system"));
      continue;
    }
    if (position.kind === "append_bottom") {
      plan.bottom.push(toBlock(hit, "system"));
      continue;
    }
    const list = byPosition.get(position.kind) ?? [];
    list.push(hit);
    byPosition.set(position.kind, list);
  }
  if (topBlocks.length > 0) plan.top.splice(0, 0, ...topBlocks);
  plan.relative = placeRelative(plan.relative, byPosition);
}
