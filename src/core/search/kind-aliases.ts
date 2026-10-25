/** Searchable labels for each authored deck kind, shared by the UI and the search worker. */
export interface KindLabels { singular: string; plural: string; short: string }

const LABELS: Readonly<Record<string, KindLabels>> = {
  character: { singular: "Character", plural: "Characters", short: "char" },
  lorebook: { singular: "Lorebook", plural: "Lorebooks", short: "lore" },
  persona: { singular: "Persona", plural: "Personas", short: "pers" },
  pack: { singular: "Sprite pack", plural: "Sprite packs", short: "pack" },
  preset: { singular: "Preset", plural: "Presets", short: "set" },
  regex: { singular: "Regex set", plural: "Regex sets", short: "rgx" },
  quickreply: { singular: "Quick reply", plural: "Quick replies", short: "qr" },
  promptformat: { singular: "Prompt format", plural: "Prompt formats", short: "fmt" },
};

export const deckSearchLabels = (kind: string): KindLabels => LABELS[kind] ?? {
  singular: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`,
  plural: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`,
  short: kind.slice(0, 4),
};

export const matchesKindAlias = (kind: string, value: string): boolean => {
  const labels = deckSearchLabels(kind);
  return kind.startsWith(value) || [labels.short, ...labels.plural.toLowerCase().split(/\s+/)].some((word) => word.startsWith(value));
};
