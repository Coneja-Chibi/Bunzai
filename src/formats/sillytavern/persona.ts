/**
 * SillyTavern persona codec (kind "persona"): the personas BACKUP file - ST's only standalone
 * persona wire (public/scripts/personas.js onBackupPersonas, read 2026-07-12):
 *   { personas: { avatarId: name }, persona_descriptions: { avatarId: descriptor },
 *     default_persona?: avatarId }
 * descriptor = { description, position (persona_description_positions int), depth, role (int),
 * lorebook?, title?, ... } - ints decoded per personas.js's own enums.
 *
 * ONE FILE = MANY PERSONAS, and the adapter contract is one entity per file. The honest design:
 * toCanonical imports the DEFAULT persona (falling back to the first) and seals the ENTIRE
 * backup in `original` - nothing is dropped; export overlays the edited persona back onto the
 * sealed backup so every OTHER persona re-emits byte-true. Splitting a backup into N entities is
 * bundle-layer work on the kill list.
 */
import type { AdapterInput, AdapterOutput, PersonaAdapter } from "../../core/adapter";
import type { CanonicalPersona, PersonaBody } from "../../entities/persona/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonAny } from "../_shared/card-io";
import { isRecord, numOr, presentNum, type Rec } from "../../core/guards";
import { parseRole, roleToNumber } from "../_shared/lore-enums";


/** persona_description_positions (personas.js): int -> canonical position string. */
const POSITION_BY_INT: Record<number, string> = {
  0: "prompt",
  1: "prompt", // AFTER_CHAR is deprecated in ST itself; folds to IN_PROMPT
  2: "author_note_top",
  3: "author_note_bottom",
  4: "in_chat",
  9: "none",
};
const INT_BY_POSITION: Record<string, number> = {
  prompt: 0,
  author_note_top: 2,
  author_note_bottom: 3,
  in_chat: 4,
  none: 9,
};

interface StBackup {
  personas: Record<string, string>;
  descriptions: Record<string, Rec>;
  defaultId?: string;
}

/** Read the backup shape (ST's own restore validation: both maps must be objects). */
function readBackup(input: AdapterInput): StBackup | null {
  const json = readJsonAny(input);
  if (!isRecord(json)) return null;
  if (!isRecord(json.personas) || !isRecord(json.persona_descriptions)) return null;
  const personas: Record<string, string> = {};
  for (const [k, v] of Object.entries(json.personas)) {
    if (typeof v === "string") personas[k] = v;
  }
  if (Object.keys(personas).length === 0) return null;
  const descriptions: Record<string, Rec> = {};
  for (const [k, v] of Object.entries(json.persona_descriptions)) {
    if (isRecord(v)) descriptions[k] = v;
  }
  return {
    personas,
    descriptions,
    defaultId: typeof json.default_persona === "string" ? json.default_persona : undefined,
  };
}

/** The avatar id this backup's canonical persona came from (the default, else the first). */
function pickAvatarId(b: StBackup): string {
  if (b.defaultId && b.personas[b.defaultId] !== undefined) return b.defaultId;
  return Object.keys(b.personas)[0]!;
}

/**
 * The name Bunraku shows for a persona. ST keys personas by avatar file, so several may share one
 * display name ("Chi" x3); the shelf keys on name, so a clash is told apart by the avatar stem.
 * Display only: the sealed backup keeps ST's own names.
 */
function shownName(personas: Rec, avatarId: string): string {
  const name = typeof personas[avatarId] === "string" ? personas[avatarId] : avatarId;
  const clash = Object.entries(personas).some(([k, v]) => k !== avatarId && v === name);
  return clash ? `${name.trim()} (${avatarId.replace(/\.[^.]+$/, "")})` : name;
}

function toBody(b: StBackup, avatarId: string): PersonaBody {
  const d = b.descriptions[avatarId] ?? {};
  const body: PersonaBody = {
    name: shownName(b.personas, avatarId),
    content: typeof d.description === "string" ? d.description : "",
  };
  const title = typeof d.title === "string" && d.title.trim() !== "" ? d.title : undefined;
  if (title) body.identity = { tagline: title };
  const lorebook = typeof d.lorebook === "string" && d.lorebook !== "" ? d.lorebook : undefined;
  if (lorebook) body.knowledgeRefs = [lorebook];
  const posInt = numOr(d.position, 0);
  body.chatInjection = {
    position: POSITION_BY_INT[posInt] ?? "prompt",
    depth: presentNum(d.depth),
    role: typeof d.role === "number" ? parseRole(d.role) : undefined,
  };
  body.attribution = { source: "sillytavern" };
  return body;
}

/**
 * The avatar file (no extension) a persona was imported under: the id SillyTavern links a chat's user lines
 * to (`force_avatar`). This codec owns it; it rides in escrow as `unmapped.avatarId`.
 */
export function personaAvatarStem(entity: unknown): string | undefined {
  const id = (entity as CanonicalPersona | null)?.original?.["sillytavern-persona"]?.unmapped?.["avatarId"];
  return typeof id === "string" && id !== "" ? id.replace(/\.[^.]+$/, "") : undefined;
}

const adapter: PersonaAdapter = {
  id: "sillytavern-persona",
  label: "SillyTavern personas backup (default persona; the rest ride sealed)",
  outputExtensions: ["json"],
  kind: "persona",

  detect(input: AdapterInput): number {
    return readBackup(input) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPersona {
    const backup = readBackup(input);
    if (!backup) throw new Error("sillytavern-persona: not a recognizable personas backup");
    const avatarId = pickAvatarId(backup);
    const body = toBody(backup, avatarId);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "persona",
      id: canonicalId(body.name),
      body,
      original: {
        "sillytavern-persona": {
          raw: readJsonAny(input),
          unmapped: { avatarId },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalPersona): AdapterOutput {
    const esc = entity.original?.["sillytavern-persona"];
    const raw = isRecord(esc?.raw) ? structuredClone(esc.raw) : {};
    const avatarId =
      typeof esc?.unmapped?.["avatarId"] === "string"
        ? (esc.unmapped["avatarId"] as string)
        : `${entity.body.name || "persona"}.png`;

    const personas = isRecord(raw.personas) ? (raw.personas as Rec) : {};
    // Twin-diff: write the name back only when the user changed it, never the disambiguated display name.
    if (entity.body.name !== shownName(personas, avatarId)) personas[avatarId] = entity.body.name;
    raw.personas = personas;

    const descriptions = isRecord(raw.persona_descriptions) ? (raw.persona_descriptions as Rec) : {};
    const prior = isRecord(descriptions[avatarId]) ? (descriptions[avatarId] as Rec) : {};
    const inj = entity.body.chatInjection;
    // Twin-diff: the ...prior clone re-emits every descriptor field byte-true; a mapped key is written
    // back only when the canonical value drifts from the twin's own decode, deleted when the user has
    // cleared it, and never materialized as a default for a key neither side carried. Clearing an
    // optional stop deletes it (ST descriptors omit absent stops), which is edit-path only.
    const entry: Rec = { ...prior };

    const twinContent = typeof prior.description === "string" ? prior.description : "";
    if (entity.body.content !== twinContent) entry.description = entity.body.content;

    const twinPosInt = numOr(prior.position, 0);
    const twinPos = POSITION_BY_INT[twinPosInt] ?? "prompt";
    const livePos = inj?.position ?? "prompt";
    if (livePos !== twinPos) entry.position = INT_BY_POSITION[livePos] ?? 0;

    const twinDepth = presentNum(prior.depth);
    if (inj?.depth !== twinDepth) {
      if (inj?.depth !== undefined) entry.depth = inj.depth;
      else delete entry.depth;
    }

    const twinRole = typeof prior.role === "number" ? parseRole(prior.role) : undefined;
    if (inj?.role !== twinRole) {
      if (inj?.role !== undefined) entry.role = roleToNumber(inj.role);
      else delete entry.role;
    }

    const twinLore =
      typeof prior.lorebook === "string" && prior.lorebook !== "" ? prior.lorebook : undefined;
    const liveLore = entity.body.knowledgeRefs?.[0];
    if (liveLore !== twinLore) {
      if (liveLore !== undefined) entry.lorebook = liveLore;
      else delete entry.lorebook;
    }

    // title is optional and clearable: set when present, delete when not (never resurrect a removed one).
    if (entity.body.identity?.tagline) entry.title = entity.body.identity.tagline;
    else delete entry.title;
    descriptions[avatarId] = entry;
    raw.persona_descriptions = descriptions;

    return { text: JSON.stringify(raw, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
