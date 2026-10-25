/**
 * The loadout library and its receipts, kept as one sealed document in the library's
 * state (StateStore key `loadouts`), the way guides are (studio/guides.ts). Not a piece kind: a loadout names
 * install-local connection ids and has no Library deck, so moving it later changes only this module.
 *
 * Writes run one at a time (a read-modify-write over one document). A document that cannot be read is refused,
 * never read as empty, so a save cannot wipe what it failed to read. Deleting is soft and can be restored; a full
 * library refuses the next save and never evicts. Receipts are a log beside the loadouts: the store sets their
 * times from its own clock, and on each new receipt it drops closed ones older than a day and keeps at most 20
 * (an open receipt is never dropped).
 */
import { isRecord } from "../core/guards";
import { LOADOUT_CAP, UNDO_MS } from "../core/loadout-panels";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { parseLoadoutInput, parseReceipt, type LoadoutReceipt, type LoadoutRecord } from "./loadout-record";
import { serializer } from "./serial";

const enqueue = serializer();
const unreadable = () => new StudioValidationError("the library's loadouts could not be read");
const DAY = 24 * 60 * 60 * 1000;
const RECEIPTS_KEPT = 20;

interface Doc {
  loadouts: LoadoutRecord[];
  receipts: LoadoutReceipt[];
}

async function read(state: StateStore): Promise<Doc> {
  const text = await state.read("loadouts");
  if (text === null) return { loadouts: [], receipts: [] };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || parsed["version"] !== 1 || !Array.isArray(parsed["loadouts"]) || !Array.isArray(parsed["receipts"])) throw unreadable();
    return {
      loadouts: parsed["loadouts"].map((raw: unknown) => {
        if (!isRecord(raw) || typeof raw["id"] !== "string" || typeof raw["createdAt"] !== "number" || typeof raw["updatedAt"] !== "number") throw unreadable();
        const { id, createdAt, updatedAt, deletedAt, name, values } = raw;
        const { panels, ...fields } = parseLoadoutInput({ name, values });
        return { ...fields, id, createdAt, updatedAt, panels, ...(typeof deletedAt === "number" ? { deletedAt } : {}) };
      }),
      receipts: parsed["receipts"].map(parseReceipt),
    };
  } catch {
    throw unreadable();
  }
}

const write = (state: StateStore, doc: Doc) => state.write("loadouts", JSON.stringify({ version: 1, ...doc }));
const liveCount = (doc: Doc) => doc.loadouts.filter((l) => l.deletedAt === undefined).length;
const full = () => new StudioConflictError(`You have ${LOADOUT_CAP} loadouts. Delete one first.`);

/** Live loadouts, most recently changed first; with `removed`, the soft-deleted ones, most recently removed first. */
export async function listLoadouts(state: StateStore, removed = false): Promise<LoadoutRecord[]> {
  const all = (await read(state)).loadouts;
  return removed
    ? all.filter((l) => l.deletedAt !== undefined).sort((a, b) => b.deletedAt! - a.deletedAt!)
    : all.filter((l) => l.deletedAt === undefined).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Makes a loadout, or replaces the name and values of the live one named by `raw.id`. Refused at the cap; never evicts. */
export function saveLoadout(state: StateStore, raw: unknown, now: number, newId: () => string): Promise<LoadoutRecord> {
  return enqueue(async () => {
    const { id, ...rest } = isRecord(raw) ? raw : ({} as Record<string, unknown>);
    if (id !== undefined && typeof id !== "string") throw new StudioValidationError("a loadout id must be text");
    const fields = parseLoadoutInput(rest);
    const doc = await read(state);
    const old = id === undefined ? undefined : doc.loadouts.find((l) => l.id === id && l.deletedAt === undefined);
    if (id !== undefined && !old) throw new StudioNotFoundError("that loadout is gone");
    if (!old && liveCount(doc) >= LOADOUT_CAP) throw full();
    const saved: LoadoutRecord = old ? { ...fields, id: old.id, createdAt: old.createdAt, updatedAt: now } : { ...fields, id: newId(), createdAt: now, updatedAt: now };
    await write(state, { ...doc, loadouts: old ? doc.loadouts.map((l) => (l.id === old.id ? saved : l)) : [...doc.loadouts, saved] });
    return saved;
  });
}

/** Deletes a loadout softly; false when it was already gone. */
export function deleteLoadout(state: StateStore, id: string, now: number): Promise<boolean> {
  return enqueue(async () => {
    const doc = await read(state);
    if (!doc.loadouts.some((l) => l.id === id && l.deletedAt === undefined)) return false;
    await write(state, { ...doc, loadouts: doc.loadouts.map((l) => (l.id === id ? { ...l, deletedAt: now } : l)) });
    return true;
  });
}

/** Brings a soft-deleted loadout back unchanged; refused when the library is full. */
export function restoreLoadout(state: StateStore, id: string): Promise<LoadoutRecord> {
  return enqueue(async () => {
    const doc = await read(state);
    const gone = doc.loadouts.find((l) => l.id === id && l.deletedAt !== undefined);
    if (!gone) throw new StudioNotFoundError("that loadout was not removed");
    if (liveCount(doc) >= LOADOUT_CAP) throw full();
    const { deletedAt: _deletedAt, ...back } = gone;
    await write(state, { ...doc, loadouts: doc.loadouts.map((l) => (l.id === id ? back : l)) });
    return back;
  });
}

const isClosed = (r: LoadoutReceipt, now: number) => r.undoneAt !== undefined || now >= r.undoUntil;

/** Stores a receipt before its apply writes anything. The times are the store's: applied now, undo 15 minutes later. */
export function saveReceipt(state: StateStore, raw: unknown, now: number): Promise<LoadoutReceipt> {
  return enqueue(async () => {
    const { undoneAt: _undoneAt, ...sent } = parseReceipt(raw);
    const saved: LoadoutReceipt = { ...sent, appliedAt: now, undoUntil: now + UNDO_MS };
    const doc = await read(state);
    if (doc.receipts.some((r) => r.code === saved.code)) throw new StudioConflictError("that receipt code is already used");
    let kept = [...doc.receipts, saved].filter((r) => !isClosed(r, now) || now - r.appliedAt < DAY);
    const drop = new Set(kept.filter((r) => isClosed(r, now)).sort((a, b) => a.appliedAt - b.appliedAt).slice(0, Math.max(0, kept.length - RECEIPTS_KEPT)));
    kept = kept.filter((r) => !drop.has(r));
    await write(state, { ...doc, receipts: kept });
    return saved;
  });
}

function change(state: StateStore, code: string, edit: (old: LoadoutReceipt) => LoadoutReceipt): Promise<LoadoutReceipt> {
  return enqueue(async () => {
    const doc = await read(state);
    const old = doc.receipts.find((r) => r.code === code);
    if (!old) throw new StudioNotFoundError("that receipt is gone");
    const next = edit(old);
    await write(state, { ...doc, receipts: doc.receipts.map((r) => (r === old ? next : r)) });
    return next;
  });
}

/** Replaces the rows of a receipt once the apply has run (the before and after values stay as saved). */
export const finishReceipt = (state: StateStore, code: string, rows: unknown): Promise<LoadoutReceipt> => change(state, code, (old) => parseReceipt({ ...old, rows }));

/** Closes a receipt after Undo. Refused after its 15 minutes, or when it was already undone. */
export const markUndone = (state: StateStore, code: string, now: number): Promise<LoadoutReceipt> =>
  change(state, code, (old) => {
    if (old.undoneAt !== undefined) throw new StudioConflictError("That loadout was already undone.");
    if (now >= old.undoUntil) throw new StudioConflictError("That loadout undo window has expired.");
    return { ...old, undoneAt: now };
  });

/** The scene's newest receipt that is neither undone nor past its window, or null. */
export async function latestOpenReceipt(state: StateStore, chatId: string, now: number): Promise<LoadoutReceipt | null> {
  const open = (await read(state)).receipts.filter((r) => r.chatId === chatId && !isClosed(r, now));
  return open.reduce<LoadoutReceipt | null>((best, r) => (best && best.appliedAt > r.appliedAt ? best : r), null);
}
