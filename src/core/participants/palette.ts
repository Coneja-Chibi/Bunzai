/**
 * RoleCall's dialogue palette (`lib/character-colors/palette.ts:20-82`): fourteen muted colours picked to read on a dark page and to
 * stay apart from each other at paragraph length. A participant with no colour of its own takes one by a stable hash of its key
 * (`pickPaletteEntryByHash`, `:105-117`, FNV-1a), so a new NPC is never drawn in the plain text colour and the same NPC gets the same
 * colour every time. The hexes are data a person can change per participant, not theme chrome. RoleCall's per-entry LLM hints belong
 * to its colour picker, which is not ported.
 */
export interface PaletteEntry {
  id: string;
  name: string;
  hex: string;
}

export const DIALOGUE_PALETTE: readonly PaletteEntry[] = [
  { id: "mossy-green", name: "Mossy Green", hex: "#7B9F6B" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "steel-gray", name: "Steel Gray", hex: "#7A8489" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "plum", name: "Plum", hex: "#9B6A85" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "ochre", name: "Ochre", hex: "#C4914F" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "indigo", name: "Indigo", hex: "#6A78C8" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "terracotta", name: "Terracotta", hex: "#C46A55" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "sage", name: "Sage", hex: "#9DB39A" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "mauve", name: "Mauve", hex: "#A78BA0" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "slate-blue", name: "Slate Blue", hex: "#6F88A0" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "burgundy", name: "Burgundy", hex: "#9A4D5E" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "forest", name: "Forest", hex: "#5F8068" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "sandstone", name: "Sandstone", hex: "#C0A47A" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "lavender", name: "Lavender", hex: "#A99BBF" }, // hardcode-ok: RoleCall's dialogue palette, participant data
  { id: "copper", name: "Copper", hex: "#B9714B" }, // hardcode-ok: RoleCall's dialogue palette, participant data
];

/** The palette's hex for a key: a small FNV-1a over the key, so the pick is the same in every process. */
export function pickPaletteHex(key: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return DIALOGUE_PALETTE[h % DIALOGUE_PALETTE.length]!.hex;
}
