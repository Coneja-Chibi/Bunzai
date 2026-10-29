/**
 * Writes the slot list from the slot files (every src/core/scene-state/slots/<id>.ts is a scene-state slot):
 * src/generated/slots.ts. Run `bun run slots`; `--check` fails when it is stale. A file may also export a list of slots made from a table
 * (slots/tracker.ts: one per tracker module); its slots' ids then start with the file's name and a dot (`tracker.inventory`).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FAMILY_ID, SLOT_ID, slotFile } from "../src/core/scene-state/define-slot";
import { makeSlotOf } from "../src/core/scene-state/slot-lookup";
import type { SlotDef } from "../src/core/scene-state/types";

const ROOT = join(import.meta.dir, "..");
const SLOTS = join(ROOT, "src", "core", "scene-state", "slots");
const OUT = join(ROOT, "src", "generated", "slots.ts");

interface Found { file: string; slots: SlotDef[]; many: boolean }

/** Every slot file, validated, sorted by id; throws naming the file on any problem. */
export async function findSlots(root = SLOTS): Promise<Found[]> {
  const found: Found[] = [];
  const problems: string[] = [];
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    const made = (await import(join(root, name))).default as SlotDef | SlotDef[] | undefined;
    const many = Array.isArray(made);
    const slots = made === undefined ? [] : many ? made : [made];
    const file = name.slice(0, -3);
    if (slots.length === 0 || slots.some((s) => !s?.id)) problems.push(`${name}: must export default defineSlot({...})`);
    for (const slot of slots.filter((s) => s?.id)) {
      if (!(slot.id.endsWith(":*") ? FAMILY_ID : SLOT_ID).test(slot.id)) problems.push(`${name}: id "${slot.id}" must match ${slot.id.endsWith(":*") ? FAMILY_ID : SLOT_ID}`);
      else if (many ? !slot.id.startsWith(`${file}.`) : name !== `${slotFile(slot.id)}.ts`) problems.push(`${name}: the file is named for its slot id "${slot.id}"`);
    }
    if (slots.length > 0 && slots.every((s) => s?.id)) found.push({ file, slots, many });
  }
  const ids = found.flatMap((f) => f.slots.map((s) => s.id));
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) problems.push(`slot id "${id}" is declared twice`);
  if (problems.length > 0) throw new Error(`slots:\n  ${problems.join("\n  ")}`);
  return found.sort((a, b) => a.slots[0]!.id.localeCompare(b.slots[0]!.id));
}

export function renderSlots(found: readonly Found[]): string {
  return `/**
 * Generated scene-state slot list. Run \`bun run slots\` to update it; do not edit it by hand.
 * The truth is src/core/scene-state/slots/<id>.ts. Static imports, so the browser bundle and the single-file builds reach every slot without walking a folder.
 */
import { makeSlotOf } from "../core/scene-state/slot-lookup";
import type { SlotDef } from "../core/scene-state/types";
${found.map((f, i) => `import slot${i} from "../core/scene-state/slots/${f.file}";`).join("\n")}

/** Every scene-state slot, by id. */
export const SLOTS = [${found.map((f, i) => (f.many ? `...slot${i}` : `slot${i}`)).join(", ")}] as const;

/** A slot's declaration, or undefined for an id that is not a slot: an exact id, else the family that covers it (tracker-record:<pieceId>). */
export const slotOf: (id: string) => SlotDef | undefined = makeSlotOf(SLOTS);
`;
}

if (import.meta.main) {
  const found = await findSlots();
  const text = renderSlots(found);
  if ((existsSync(OUT) ? readFileSync(OUT, "utf8") : "") !== text) {
    if (process.argv.includes("--check")) {
      console.error("slots: src/generated/slots.ts is stale, run bun run slots");
      process.exit(1);
    }
    writeFileSync(OUT, text);
  }
  console.log(`slots: ${found.flatMap((f) => f.slots.map((s) => s.id)).join(", ")}`);
}
