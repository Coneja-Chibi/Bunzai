/** Final Cut's saved-agent API projects the canonical Agent library; legacy records migrate once without overwriting pieces. */
import { randomUUID } from "node:crypto";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { deepEq, isRecord } from "../core/guards";
import { emptyAgentBody, type AgentBody, type CanonicalAgent } from "../entities/agent/schema";
import { agentBodySchema } from "../entities/agent/runtime-schema";
import type { StudioStoreLike } from "./contracts";
import type { StateStore } from "../stage/contracts/state-store";
import { migrateSavedAgents, parseAgent, type AgentRecord } from "./final-cut-library";
import { StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";

type AgentStore = Pick<StudioStoreLike, "list" | "read" | "readVersioned" | "save" | "compareAndSave" | "delete" | "compareAndCreate">;
const LEGACY = "bunzai-finalcut-agent";
async function migrate(store: AgentStore, state: StateStore): Promise<void> {
  await migrateSavedAgents(state, async (agents) => {
    for (const old of agents) {
      if (old.deletedAt !== undefined) continue;
      const existing = await store.read("agent", old.id);
      if (existing) {
        const raw = existing.original?.[LEGACY]?.raw;
        if (!deepEq(raw, old)) throw new StudioConflictError(`A Library Agent already uses the saved Agent id ${old.id}. The older record has been kept for recovery.`);
        continue;
      }
      const { name, instructions, connection, temperature, contextMessages } = parseAgent(old);
      const body = agentBodySchema.parse({ ...emptyAgentBody(name), instructions, ...(connection ? { connection } : {}), ...(temperature !== undefined ? { temperature } : {}), ...(contextMessages !== undefined ? { contextMessages } : {}) });
      const entity: CanonicalAgent = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "agent", id: old.id, body, original: { [LEGACY]: { raw: old } } };
      if (!store.compareAndCreate) throw new StudioConflictError("This host cannot safely migrate saved Agents. Their older records have been kept.");
      await store.compareAndCreate(entity);
      const verified = await store.read("agent", old.id);
      if (verified?.kind !== "agent" || !deepEq(verified.original?.[LEGACY]?.raw, old)) throw new StudioConflictError("A saved Agent could not be verified in the Library. Its older record has been kept.");
    }
  });
}
const record = (entity: CanonicalAgent, revision: string): AgentRecord => ({ id: entity.id, name: entity.body.name, instructions: entity.body.instructions, ...(entity.body.connection ? { connection: entity.body.connection } : {}), ...(entity.body.temperature !== undefined ? { temperature: entity.body.temperature } : {}), ...(entity.body.contextMessages !== undefined ? { contextMessages: entity.body.contextMessages } : {}), revision, createdAt: 0, updatedAt: 0 });
export async function listLibraryAgents(store: AgentStore, state: StateStore): Promise<AgentRecord[]> {
  await migrate(store, state);
  const rows = await store.list("agent");
  const entities = await Promise.all(rows.map((row) => store.readVersioned("agent", row.id)));
  return entities.flatMap((value) => value?.entity.kind === "agent" ? [record(value.entity, value.revision)] : []);
}
export async function saveLibraryAgent(store: AgentStore, state: StateStore, raw: unknown, _now: number): Promise<AgentRecord> {
  await migrate(store, state);
  const fields = parseAgent(raw);
  if (!isRecord(raw)) throw new StudioValidationError("An Agent must be an object.");
  const rows = await listLibraryAgents(store, state);
  const old = typeof raw.id === "string" ? rows.find((a) => a.id === raw.id) : rows.find((a) => a.name.toLowerCase() === fields.name.toLowerCase());
  if (typeof raw.id === "string" && !old) throw new StudioNotFoundError("That Agent is gone.");
  const current = old ? await store.readVersioned("agent", old.id) : null;
  if (old && (typeof raw.revision !== "string" || raw.revision !== current?.revision)) throw new StudioConflictError("This Agent changed elsewhere. Reload the Agent library before saving it.");
  const prior: AgentBody = current?.entity.kind === "agent" ? current.entity.body : emptyAgentBody(fields.name);
  const body = agentBodySchema.parse({ ...prior, name: fields.name, instructions: fields.instructions, connection: fields.connection, temperature: fields.temperature, contextMessages: fields.contextMessages });
  const entity: CanonicalAgent = { ...(current?.entity.kind === "agent" ? current.entity : {}), schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "agent", id: old?.id ?? randomUUID(), body };
  if (current) {
    const saved = await store.compareAndSave(entity, current.revision);
    if (saved.status !== "saved") throw new StudioConflictError("This Agent changed elsewhere. Reload before saving it.");
  } else await store.save(entity);
  const verified = await store.readVersioned("agent", entity.id);
  if (verified?.entity.kind !== "agent") throw new StudioValidationError("The saved Agent could not be verified.");
  return record(verified.entity, verified.revision);
}
export async function deleteLibraryAgent(store: AgentStore, state: StateStore, id: string, revision: string): Promise<boolean> {
  await migrate(store, state);
  if (!revision) throw new StudioValidationError("Reload the Agent library before deleting an Agent.");
  const deleted = await store.delete("agent", id, revision);
  if (!deleted && await store.read("agent", id)) throw new StudioConflictError("This Agent changed elsewhere. Reload before deleting it.");
  return deleted;
}
