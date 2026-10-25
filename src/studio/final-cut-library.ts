/**
 * The person's own Final Cut library (RoleCall's `user_anti_slop_banks` and `user_custom_agents`, rc app/api/post-production): banks they
 * authored for the Anti-Slop pass, and Custom Agents they saved to load onto any scene. One sealed document in the library's state (StateStore
 * key `finalCut`), like the guides, written one change at a time. A document that cannot be read is refused, never read as empty, so a
 * save cannot wipe what it failed to read. Deleting is soft (RoleCall deletes the row): the record stays with a `deletedAt` and shows
 * nowhere. A saved agent is checked against the same bounds as the pass it loads onto (RoleCall allows a temperature of 2 and a context of
 * 0 where its pass takes 1.5 and 1).
 */
import { randomUUID } from "node:crypto";
import { BANK_KINDS, BANK_SCOPES, type Bank, type BankKind, type BankScope } from "../core/final-cut/banks";
import { MAX_CONTEXT_MESSAGES, MAX_TEMPERATURE } from "../core/final-cut/pass";
import { isPlainObject, isRecord } from "../core/guards";
import type { StateStore } from "../stage/contracts/state-store";
import { isWhole } from "../stage/store/scalar-rules";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { serializer } from "./serial";

export interface BankRecord {
  id: string;
  /** `user/<slug>`: the namespace is enforced here, so a person's bank cannot take a built-in id. */
  bankId: string;
  label: string;
  kind: BankKind;
  scope: BankScope;
  pattern: string;
  examples: string[];
  replace: string;
  why?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface AgentRecord {
  id: string;
  name: string;
  instructions: string;
  connection?: { id: string; model: string };
  temperature?: number;
  contextMessages?: number;
  presetId?: string;
  presetName?: string;
  presetPromptStates?: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

interface Library { banks: BankRecord[]; agents: AgentRecord[] }
const enqueue = serializer();
const bad = (message: string): never => { throw new StudioValidationError(message); };
const unreadable = (): never => bad("the library's Final Cut banks and agents could not be read");

async function read(state: Pick<StateStore, "read">): Promise<Library> {
  const text = await state.read("finalCut");
  if (text === null) return { banks: [], agents: [] };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || !Array.isArray(parsed["banks"]) || !Array.isArray(parsed["agents"])) throw new Error("shape");
    return { banks: parsed["banks"] as BankRecord[], agents: parsed["agents"] as AgentRecord[] };
  } catch {
    return unreadable();
  }
}
const write = (state: StateStore, library: Library): Promise<void> => state.write("finalCut", JSON.stringify(library));
const live = <T extends { deletedAt?: number }>(rows: readonly T[]): T[] => rows.filter((r) => r.deletedAt === undefined);

const slugify = (input: string): string => input.toLowerCase().replace(/^user\//, "").replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 64);

function text(v: unknown, what: string, min: number, max: number): string {
  if (typeof v !== "string" || v.trim().length < min || v.length > max || v.includes("\u0000")) bad(`${what} must be ${min === 0 ? "text" : "some text"} of at most ${max} characters`);
  return (v as string).trim();
}

/** A bank the person typed, checked to RoleCall's caps: a label of 1 to 120, a pattern of 1 to 8,000, 1 to 30 examples of at most 1,000 each. */
export function parseBank(raw: unknown): Omit<BankRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> {
  if (!isPlainObject(raw)) return bad("a bank must be a plain object");
  const label = text(raw["label"], "label", 1, 120);
  const kind = BANK_KINDS.find((k) => k === raw["kind"]) ?? bad(`kind must be one of ${BANK_KINDS.join(", ")}`);
  const scope = raw["scope"] === undefined ? "always" : (BANK_SCOPES.find((s) => s === raw["scope"]) ?? bad(`scope must be one of ${BANK_SCOPES.join(", ")}`));
  const examples = raw["examples"];
  if (!Array.isArray(examples) || examples.length < 1 || examples.length > 30 || !examples.every((e) => typeof e === "string" && e.length > 0 && e.length <= 1_000)) bad("examples must be 1 to 30 pieces of text of at most 1,000 characters");
  const slug = slugify(typeof raw["bankId"] === "string" && raw["bankId"] ? raw["bankId"] : label);
  if (!slug) bad("a bank id could not be made from that label: use letters or numbers");
  const why = raw["why"] === undefined || raw["why"] === null || raw["why"] === "" ? undefined : text(raw["why"], "why", 0, 4_000);
  return {
    bankId: `user/${slug}`, label, kind, scope, pattern: text(raw["pattern"], "pattern", 1, 8_000), examples: examples as string[], replace: text(raw["replace"] ?? "", "replace", 0, 4_000),
    ...(why ? { why } : {}), enabled: raw["enabled"] === undefined ? true : raw["enabled"] === true,
  };
}

export function parseAgent(raw: unknown): Omit<AgentRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> {
  if (!isPlainObject(raw)) return bad("an agent must be a plain object");
  const out: Omit<AgentRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> = { name: text(raw["name"], "name", 1, 120), instructions: text(raw["instructions"], "instructions", 1, 12_000) };
  const conn = raw["connection"];
  if (conn !== undefined && conn !== null) {
    const id = isPlainObject(conn) ? conn["id"] : undefined;
    const model = isPlainObject(conn) ? conn["model"] : undefined;
    if (typeof id !== "string" || !id || id.length > 200 || typeof model !== "string" || !model || model.length > 200) bad("connection must be { id, model }");
    out.connection = { id: id as string, model: model as string };
  }
  const t = raw["temperature"];
  if (t !== undefined && t !== null) { if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > MAX_TEMPERATURE) bad(`temperature must be a number from 0 to ${MAX_TEMPERATURE}`); out.temperature = t as number; }
  const c = raw["contextMessages"];
  if (c !== undefined && c !== null) { if (!isWhole(c, 1, MAX_CONTEXT_MESSAGES)) bad(`contextMessages must be a whole number from 1 to ${MAX_CONTEXT_MESSAGES}`); out.contextMessages = c as number; }
  if (raw["presetId"]) out.presetId = text(raw["presetId"], "presetId", 1, 200);
  if (raw["presetName"]) out.presetName = text(raw["presetName"], "presetName", 1, 200);
  const states = raw["presetPromptStates"];
  if (states !== undefined && states !== null) {
    if (!isPlainObject(states) || Object.keys(states).length > 200 || !Object.values(states).every((v) => typeof v === "boolean")) bad("presetPromptStates must map entry ids to true or false");
    out.presetPromptStates = states as Record<string, boolean>;
  }
  return out;
}

export const listBanks = async (state: Pick<StateStore, "read">): Promise<BankRecord[]> => live((await read(state)).banks).sort((a, b) => b.updatedAt - a.updatedAt);
export const listAgents = async (state: Pick<StateStore, "read">): Promise<AgentRecord[]> => live((await read(state)).agents).sort((a, b) => b.updatedAt - a.updatedAt);

/** Makes a bank, or replaces the one named by `raw.id`; two live banks never share an id. */
export function saveBank(state: StateStore, raw: unknown, now: number, newId: () => string = randomUUID): Promise<BankRecord> {
  return enqueue(async () => {
    const id = isRecord(raw) && typeof raw["id"] === "string" ? raw["id"] : undefined;
    const fields = parseBank(raw);
    const library = await read(state);
    const old = id === undefined ? undefined : live(library.banks).find((b) => b.id === id);
    if (id !== undefined && !old) throw new StudioNotFoundError("that bank is gone");
    if (live(library.banks).some((b) => b.bankId === fields.bankId && b.id !== old?.id)) bad(`a bank called ${fields.bankId} already exists`);
    const saved: BankRecord = old ? { ...fields, id: old.id, createdAt: old.createdAt, updatedAt: now } : { ...fields, id: newId(), createdAt: now, updatedAt: now };
    await write(state, { ...library, banks: old ? library.banks.map((b) => (b.id === old.id ? saved : b)) : [...library.banks, saved] });
    return saved;
  });
}

/** Makes an agent, or overwrites the one with the same name (RoleCall's save is idempotent on the name) or the one named by `raw.id`. */
export function saveAgent(state: StateStore, raw: unknown, now: number, newId: () => string = randomUUID): Promise<AgentRecord> {
  return enqueue(async () => {
    const id = isRecord(raw) && typeof raw["id"] === "string" ? raw["id"] : undefined;
    const fields = parseAgent(raw);
    const library = await read(state);
    const rows = live(library.agents);
    const old = id === undefined ? rows.find((a) => a.name.toLowerCase() === fields.name.toLowerCase()) : rows.find((a) => a.id === id);
    if (id !== undefined && !old) throw new StudioNotFoundError("that agent is gone");
    const saved: AgentRecord = old ? { ...fields, id: old.id, createdAt: old.createdAt, updatedAt: now } : { ...fields, id: newId(), createdAt: now, updatedAt: now };
    await write(state, { ...library, agents: old ? library.agents.map((a) => (a.id === old.id ? saved : a)) : [...library.agents, saved] });
    return saved;
  });
}

const remove = (kind: "banks" | "agents") => (state: StateStore, id: string, now: number): Promise<boolean> => enqueue(async () => {
  const library = await read(state);
  if (!live(library[kind] as { id: string; deletedAt?: number }[]).some((r) => r.id === id)) return false;
  await write(state, { ...library, [kind]: (library[kind] as { id: string }[]).map((r) => (r.id === id ? { ...r, deletedAt: now } : r)) });
  return true;
});
export const deleteBank = remove("banks");
export const deleteAgent = remove("agents");

/** The enabled banks as the Anti-Slop prompt reads them, by their `user/...` id. */
export async function finalCutBanksOf(state: Pick<StateStore, "read">): Promise<Record<string, Bank>> {
  return Object.fromEntries(live((await read(state)).banks).filter((b) => b.enabled).map((b) => [b.bankId, { label: b.label, kind: b.kind, scope: b.scope, pattern: b.pattern, examples: b.examples, replace: b.replace, ...(b.why ? { why: b.why } : {}) } satisfies Bank]));
}
