/**
 * The fixed list of named slots a theme package may fill, and the one parser for what goes in them. A slot item
 * is data only: an image of a package asset, or plain text (never markup) with an optional class the package's
 * own styles define. The host draws every item; interactive content waits for the extension runtime.
 */
import { isRecord } from "../core/guards";

export const SLOT_IDS = [
  "shell.nav.start", "shell.nav.end", "shell.title.below", "shell.status.end", "scene.director",
  "library.header", "library.empty", "scenes.header", "scene.backdrop", "scene.composer.above",
  "editor.header.end", "settings.header",
  // The scene's wings: the wing's own body, then one for each tab it opens (ADR-013).
  "scene.wing.booth", "scene.wing.cast", "scene.wing.prompting", "scene.wing.world", "scene.wing.finalcut", "scene.wing.props", "scene.wing.ai", "scene.wing.stage", "scene.wing.context",
  "scene.wing.cast.character", "scene.wing.cast.persona", "scene.wing.cast.participants",
  "scene.wing.prompting.preset", "scene.wing.prompting.guides", "scene.wing.prompting.note", "scene.wing.prompting.tools",
  "scene.wing.world.lorebook", "scene.wing.world.compendium", "scene.wing.finalcut.cut", "scene.wing.finalcut.regex", "scene.wing.ai.model", "scene.wing.ai.generation",
  "scene.wing.stage.appearance", "scene.wing.stage.gallery", "scene.wing.stage.music", "scene.wing.stage.spotify", "scene.wing.stage.wardrobe",
  "scene.wing.context.inspector", "scene.wing.context.memory",
] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export type SlotItem = { kind: "image"; asset: string; alt: string } | { kind: "text"; text: string; class?: string };
export type ThemeSlots = Partial<Record<SlotId, SlotItem[]>>;

export const MAX_SLOT_ITEMS = 4;
export const MAX_SLOT_ITEMS_TOTAL = 24;
export const MAX_SLOT_TEXT = 280;
export const MAX_SLOT_ALT = 160;
/** Slot classes live in a `mod-` namespace the host never uses, so a slot item cannot borrow a host class (`.gate-card`) even when the styles also mention it. */
const CLASS_NAME = /^mod-[a-z0-9][a-z0-9-]{0,35}$/;
/** C0 and C1 controls, and the bidirectional overrides that make text read as something it is not. */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

export const isSlotId = (v: unknown): v is SlotId => typeof v === "string" && (SLOT_IDS as readonly string[]).includes(v);
export const slotItemCount = (slots: ThemeSlots): number => Object.values(slots).reduce((n, items) => n + (items?.length ?? 0), 0);

const fail = (why: string): never => { throw new Error("invalid theme package: slots " + why); };
const exact = (v: Record<string, unknown>, required: readonly string[], optional: readonly string[]): boolean =>
  Object.keys(v).every((k) => required.includes(k) || optional.includes(k)) && required.every((k) => k in v);

/** Parse one slots object; `imageIds` are the package's declared images, `classes` the class names its styles define. */
export function parseSlots(v: unknown, imageIds: ReadonlySet<string>, classes: ReadonlySet<string>): ThemeSlots {
  if (!isRecord(v)) return fail("must be an object");
  const out: ThemeSlots = {};
  let total = 0;
  for (const [id, raw] of Object.entries(v)) {
    if (!isSlotId(id)) fail("unknown slot " + id.slice(0, 40));
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SLOT_ITEMS) fail(`${id} needs 1 to ${MAX_SLOT_ITEMS} items`);
    total += (raw as unknown[]).length;
    if (total > MAX_SLOT_ITEMS_TOTAL) fail(`allow at most ${MAX_SLOT_ITEMS_TOTAL} items in all`);
    out[id as SlotId] = (raw as unknown[]).map((item): SlotItem => {
      if (!isRecord(item)) return fail(id + " item must be an object");
      if (item.kind === "image") {
        if (!exact(item, ["kind", "asset", "alt"], []) || typeof item.asset !== "string" || !imageIds.has(item.asset)) return fail(id + " image must name a declared image asset");
        if (typeof item.alt !== "string" || item.alt.length > MAX_SLOT_ALT || UNSAFE_TEXT.test(item.alt)) return fail(id + " image alt must be plain text of at most " + MAX_SLOT_ALT);
        return { kind: "image", asset: item.asset, alt: item.alt };
      }
      if (item.kind !== "text" || !exact(item, ["kind", "text"], ["class"])) return fail(id + " item must be an image or text item");
      if (typeof item.text !== "string" || item.text.length === 0 || item.text.length > MAX_SLOT_TEXT || UNSAFE_TEXT.test(item.text)) return fail(id + ` text must be plain text of 1 to ${MAX_SLOT_TEXT}`);
      if (item.class === undefined) return { kind: "text", text: item.text };
      if (typeof item.class !== "string" || !CLASS_NAME.test(item.class) || !classes.has(item.class)) return fail(id + " class must be defined in the package styles");
      return { kind: "text", text: item.text, class: item.class };
    });
  }
  return out;
}
