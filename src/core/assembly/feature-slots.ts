/**
 * Feature markers in the request (.claude/plans/prompt-placement.md section 3). presetPlan gives each feature marker a
 * placeholder text in place of any text of its own, so the block travels through layout, the macro pass and the budget
 * like any block of its placement (an append marker is made its own message at that depth); before the guides are
 * placed, `fillSlot` swaps the placeholder for the feature's messages with the marker block's role. The placeholder never
 * reaches the model: the assembler checks every message for it.
 *
 * The placeholder carries a random nonce made per plan (`slotNonce`), so no chat message, card or lore text can hold one:
 * matching it by text only ever finds the plan's own marker blocks.
 */
import type { FeatureMarkerSlot } from "../preset/build";
import type { Block } from "./conversation";
import type { BlockSource } from "./types";

export const slotPlaceholder = (slot: FeatureMarkerSlot, nonce: string): string => `\uE000bunzai-slot:${nonce}:${slot}\uE001`;
/** A fresh nonce for one plan, from the platform's random source. */
export function slotNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** A text with this plan's placeholders taken out: what the budget measures, so a random nonce never changes what is cut. */
export const withoutPlaceholders = (text: string, nonce: string): string =>
  nonce === "" ? text : text.replace(new RegExp(`\uE000bunzai-slot:${nonce}:[^\uE001]*\uE001`, "g"), "");
/** Whether a placeholder is still in the request, which the assembler refuses to send. */
export const leftPlaceholder = (blocks: readonly Block[], nonce: string): boolean => blocks.some((b) => b.content.includes(`\uE000bunzai-slot:${nonce}:`));

/**
 * The request with `slot`'s placeholder block swapped for one message per text; with no texts it leaves nothing. A user or
 * assistant marker can have a preset append block glued onto it (conversation.ts appendAtDepth), as any block of that role can:
 * then the texts take the placeholder's place in that one message, ahead of what was glued.
 */
export function fillSlot(blocks: readonly Block[], slot: FeatureMarkerSlot, nonce: string, texts: readonly string[], source: BlockSource): Block[] {
  const mark = slotPlaceholder(slot, nonce);
  return blocks.flatMap((b): Block[] => {
    if (b.content === mark) return texts.map((content) => ({ role: b.role, content, source }));
    if (!b.content.includes(mark)) return [b];
    // A function replacer: the texts are data, and a string one would read "$&" and its kin in them as patterns.
    const content = b.content.replace(mark, () => texts.join("\n")).trim();
    return content ? [{ ...b, content }] : [];
  });
}
