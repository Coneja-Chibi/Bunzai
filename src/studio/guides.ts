/**
 * The guide library (RoleCall's `guided_responses`, see core/guide-record.ts), kept as one sealed document
 * in the library's state (StateStore key `guides`). No piece kind fits a guide, so this is the smallest
 * home that is sealed with the library; moving it to a kind later changes only this module.
 *
 * Writes run one at a time (a read-modify-write over one document). A document that cannot be read is
 * refused, never read as empty, so a save cannot wipe the guides it failed to read. Deleting is soft:
 * the record stays with a `deletedAt` and shows nowhere (RoleCall hard-deletes; Bunraku keeps).
 */
import { toAssemblyGuide, parseGuideInput, type GuideRecord } from "../core/guide-record";
import type { AssemblyGuide } from "../core/assembly/guides";
import { isRecord } from "../core/guards";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { serializer } from "./serial";
import { toErrorMessage } from "../error-message";

const enqueue = serializer();
const unreadable = () => new StudioValidationError("the library's guides could not be read");

async function read(state: Pick<StateStore, "read">): Promise<GuideRecord[]> {
  const text = await state.read("guides");
  if (text === null) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || !Array.isArray(parsed["guides"])) throw unreadable();
    return parsed["guides"].map((raw: unknown) => {
      if (!isRecord(raw) || typeof raw["id"] !== "string" || typeof raw["createdAt"] !== "number" || typeof raw["updatedAt"] !== "number") throw unreadable();
      const { id, createdAt, updatedAt, deletedAt, ...fields } = raw;
      return { ...parseGuideInput(fields), id, createdAt, updatedAt, ...(typeof deletedAt === "number" ? { deletedAt } : {}) };
    });
  } catch {
    throw unreadable();
  }
}

const write = (state: StateStore, guides: GuideRecord[]) => state.write("guides", JSON.stringify({ guides }));

function checked<T>(work: () => T): T {
  try {
    return work();
  } catch (e) {
    throw new StudioValidationError(toErrorMessage(e, "that guide is not valid"));
  }
}

/** Every guide that has not been deleted, most recently changed first (RoleCall lists by updated_at). */
export async function listGuides(state: Pick<StateStore, "read">): Promise<GuideRecord[]> {
  return (await read(state)).filter((g) => g.deletedAt === undefined).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Makes a guide, or replaces the fields of the one named by `raw.id`. */
export function saveGuide(state: StateStore, raw: unknown, now: number, newId: () => string): Promise<GuideRecord> {
  return enqueue(async () => {
    const id = isRecord(raw) ? raw["id"] : undefined;
    if (id !== undefined && typeof id !== "string") throw new StudioValidationError("a guide id must be text");
    const { id: _id, ...rest } = isRecord(raw) ? raw : ({} as Record<string, unknown>);
    const fields = checked(() => parseGuideInput(rest));
    const all = await read(state);
    const old = id === undefined ? undefined : all.find((g) => g.id === id && g.deletedAt === undefined);
    if (id !== undefined && !old) throw new StudioNotFoundError("that guide is gone");
    const saved: GuideRecord = old ? { ...fields, id: old.id, createdAt: old.createdAt, updatedAt: now } : { ...fields, id: newId(), createdAt: now, updatedAt: now };
    await write(state, old ? all.map((g) => (g.id === old.id ? saved : g)) : [...all, saved]);
    return saved;
  });
}

/** Deletes a guide softly; false when it was already gone. */
export function deleteGuide(state: StateStore, id: string, now: number): Promise<boolean> {
  return enqueue(async () => {
    const all = await read(state);
    if (!all.some((g) => g.id === id && g.deletedAt === undefined)) return false;
    await write(state, all.map((g) => (g.id === id ? { ...g, deletedAt: now } : g)));
    return true;
  });
}

/**
 * The guides a scene has switched on, in the order it switched them on, as assembly reads them. One that
 * is gone or deleted is left out, as RoleCall's delete and its load-time reconcile do. One that is hidden is
 * left out too, which RoleCall does not: it keeps injecting a hidden guide in every chat that had it on while
 * its list no longer shows the switch to turn it off (a named deviation, so a hidden guide can never ride unseen).
 */
export async function selectedGuides(state: Pick<StateStore, "read">, ids: readonly string[] | undefined): Promise<AssemblyGuide[]> {
  if (!ids?.length) return [];
  const all = await read(state);
  return ids.flatMap((id) => {
    const g = all.find((r) => r.id === id);
    return g && g.deletedAt === undefined && g.visible ? [toAssemblyGuide(g)] : [];
  });
}
