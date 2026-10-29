/**
 * A guide in the library: RoleCall's `guided_responses` row as Bunzai keeps it (RoleCall
 * `lib/content/types.ts` GuideContent, `app/api/content/guides/route.ts`). The Prompting wing's Guides tab
 * lists, makes and edits them; a scene switches some on (ChatStore rule 37) and assembly places them
 * (assembly/guides.ts). `parseGuideInput` is the one place untrusted guide fields are read.
 *
 * Left out on purpose: `auto_trigger` and `model_preset_id`. RoleCall stores and edits them but nothing
 * in its assembly or worker reads either, so a control for them would claim a behavior no prompt has.
 */
import type { AssemblyGuide, GuideMode, MacroTarget } from "./assembly/guides";
import type { AssembledRole } from "./assembly/types";
import { isRecord } from "./guards";

export const GUIDE_TYPES = ["guide", "correction", "spellcheck", "prefill", "custom"] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];
export const GUIDE_CATEGORIES = ["situational", "thinking", "clothes", "state", "rules", "custom"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];
export const GUIDE_MODES: readonly GuideMode[] = ["standard", "depth", "append", "macro", "chat_start"];
export const MACRO_TARGETS: readonly MacroTarget[] = ["persona", "description", "personality", "scenario", "summary"];
export const GUIDE_TITLE_MAX = 200;
export const GUIDE_CONTENT_MAX = 10_000;
export const GUIDE_DEPTH_MAX = 100;

/** What the person edits. */
export interface GuideInput {
  title: string;
  content: string;
  type: GuideType;
  category: GuideCategory;
  role: AssembledRole;
  mode: GuideMode;
  /** Depth and append only: 0 to 100 messages back; null otherwise. */
  depth: number | null;
  /** Macro only: which value it welds onto, and on which side; null otherwise. */
  target: MacroTarget | null;
  side: "append" | "prepend" | null;
  /** RoleCall's "Visible in Library": a guide switched off here is hidden from the list and left out of every prompt. */
  visible: boolean;
}

/** A stored guide. A deleted one is kept (never hard-deleted) and shown nowhere. */
export interface GuideRecord extends GuideInput {
  id: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown, what: string): T => {
  if (typeof value !== "string" || !(list as readonly string[]).includes(value)) throw new Error(`${what} is not one of ${list.join(", ")}`);
  return value as T;
};

/** The fields of a guide a request may carry, checked once; anything else is refused. Defaults are RoleCall's New Guide: user, situational, standard. */
export function parseGuideInput(raw: unknown): GuideInput {
  if (!isRecord(raw)) throw new Error("a guide must be an object");
  const r = raw;
  const known = ["id", "title", "content", "type", "category", "role", "mode", "depth", "target", "side", "visible"];
  for (const key of Object.keys(r)) if (!known.includes(key)) throw new Error(`a guide has an unknown field: ${key}`);
  if (typeof r["title"] !== "string" || r["title"].trim() === "") throw new Error("Please enter a title for your guide");
  if (r["title"].trim().length > GUIDE_TITLE_MAX) throw new Error(`a guide title is at most ${GUIDE_TITLE_MAX} characters`);
  if (typeof r["content"] !== "string" || r["content"].trim() === "") throw new Error("Please enter the guide content");
  if (r["content"].length > GUIDE_CONTENT_MAX) throw new Error(`guide content is at most ${GUIDE_CONTENT_MAX} characters`);
  const mode = r["mode"] === undefined ? "standard" : oneOf(GUIDE_MODES, r["mode"], "mode");
  const placed = mode === "depth" || mode === "append";
  const depth = r["depth"] ?? 0;
  if (placed && (typeof depth !== "number" || !Number.isInteger(depth) || depth < 0 || depth > GUIDE_DEPTH_MAX)) throw new Error(`depth must be a whole number from 0 to ${GUIDE_DEPTH_MAX}`);
  const macro = mode === "macro";
  if (r["visible"] !== undefined && typeof r["visible"] !== "boolean") throw new Error("visible must be true or false");
  return {
    title: r["title"].trim(),
    content: r["content"],
    type: r["type"] === undefined ? "guide" : oneOf(GUIDE_TYPES, r["type"], "type"),
    category: r["category"] === undefined ? "situational" : oneOf(GUIDE_CATEGORIES, r["category"], "category"),
    role: r["role"] === undefined ? "user" : oneOf(["system", "user", "assistant"] as const, r["role"], "role"),
    mode,
    depth: placed ? (depth as number) : null,
    target: macro ? (r["target"] === undefined ? "persona" : oneOf(MACRO_TARGETS, r["target"], "target")) : null,
    side: macro ? (r["side"] === undefined ? "append" : oneOf(["append", "prepend"] as const, r["side"], "side")) : null,
    visible: r["visible"] ?? true,
  };
}

/** The part of a stored guide assembly reads. */
export const toAssemblyGuide = (g: GuideRecord): AssemblyGuide => ({ id: g.id, content: g.content, role: g.role, mode: g.mode, depth: g.depth, target: g.target, side: g.side });
