/**
 * The one renderer of an entry's `content` (04b R7, F8): the structured data is the authority and the prose the lorebook engine
 * injects is always derived from it, here, on every write. Field order is the type's own (`entry-types.ts`), then unknown fields
 * by name, so the text never depends on the order the JSON happened to be stored in and a render is never compared to stored
 * text (RoleCall's guard that did, VVS-811, doubled 85 entries). Pure.
 */
import { isRecord, type Rec } from "../guards";
import { knownFields } from "./entry-types";
import type { EntryType } from "./types";

const TITLE_FIELDS = ["name", "title", "topic"];
const HEAD_FIELDS = ["tagline", "description", "summary"];
/** The original text Standardize kept when it typed a classic entry: a reversibility copy that stays in the data, never in the prose the engine, recall or a pass sends. */
export const PRESERVED_PROSE = "preserved_prose";

const label = (field: string): string => field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function lines(value: unknown, depth: number): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => (isRecord(v) || Array.isArray(v) ? [`- ${lines(v, depth + 1).join("; ")}`] : [`- ${String(v)}`]));
  if (isRecord(value)) {
    return Object.keys(value).sort().filter((k) => value[k] !== null && value[k] !== undefined && value[k] !== "").map((k) => {
      const inner = lines(value[k], depth + 1);
      return isRecord(value[k]) || Array.isArray(value[k]) ? `${label(k)}: ${inner.join(" ")}` : `${label(k)}: ${inner[0]}`;
    });
  }
  return [String(value)];
}

/** The markdown a typed entry reads as. */
export function renderContent(type: EntryType, data: Rec): string {
  const title = TITLE_FIELDS.map((f) => data[f]).find((v) => typeof v === "string" && v.trim() !== "");
  const out: string[] = [`# ${title ?? label(type)}`];
  const known = knownFields(type);
  const rest = [...known.filter((f) => !TITLE_FIELDS.includes(f) && !HEAD_FIELDS.includes(f) && f !== "aliases"), ...Object.keys(data).filter((f) => !known.includes(f) && f !== PRESERVED_PROSE).sort()];
  for (const field of [...HEAD_FIELDS, ...rest]) {
    const value = data[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (HEAD_FIELDS.includes(field) && typeof value === "string") out.push(value);
    else out.push([`## ${label(field)}`, ...lines(value, 0)].join("\n"));
  }
  return out.join("\n\n");
}
