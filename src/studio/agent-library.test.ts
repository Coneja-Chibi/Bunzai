/** The canonical Agent authority preserves legacy records, rejects stale writes, and stays visible to every seat. */
import { expect, test } from "bun:test";
import { StudioStore } from "./store";
import { tempDirSync } from "./test-temp-dir";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { deleteLibraryAgent, listLibraryAgents, saveLibraryAgent } from "./agent-library";
import { emptyAgentBody } from "../entities/agent/schema";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { StudioConflictError } from "./errors";

test("legacy Agents migrate once with their original settings retained, without changing banks or deleted records", async () => {
  const store = new StudioStore(tempDirSync("bunzai-agent-migrate-"));
  const state = memoryStateStore();
  const old = { id: "planner", name: "Planner", instructions: "Plan carefully.", presetId: "old-rulebook", createdAt: 1, updatedAt: 2 };
  const deleted = { ...old, id: "deleted", deletedAt: 3 };
  const banks = [{ id: "bank-kept", label: "Kept" }];
  await state.write("finalCut", JSON.stringify({ banks, agents: [old, deleted] }));
  const agents = await listLibraryAgents(store, state);
  expect(agents.map((a) => a.id)).toEqual(["planner"]);
  const piece = await store.read("agent", "planner");
  expect(piece?.body).toMatchObject({ name: "Planner", instructions: "Plan carefully.", tools: [], skills: [] });
  expect(piece?.original?.["bunzai-finalcut-agent"]?.raw).toEqual(old);
  expect(JSON.parse((await state.read("finalCut"))!)).toEqual({ banks, agents: [deleted] });
  expect(await listLibraryAgents(store, state)).toEqual(agents);
  expect(await store.list("agent")).toHaveLength(1);
});
test("a colliding canonical id never overwrites either Agent or clears the legacy source", async () => {
  const store = new StudioStore(tempDirSync("bunzai-agent-collision-"));
  const state = memoryStateStore();
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "agent", id: "planner", body: { ...emptyAgentBody("New Planner"), instructions: "New instructions." }, original: { "bunzai-finalcut-agent": { raw: { id: "planner" } } } });
  const source = JSON.stringify({ banks: [], agents: [{ id: "planner", name: "Old Planner", instructions: "Old instructions.", createdAt: 1, updatedAt: 2 }] });
  await state.write("finalCut", source);
  const error = await listLibraryAgents(store, state).then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(StudioConflictError);
  expect((await store.read("agent", "planner"))?.body).toMatchObject({ instructions: "New instructions." });
  expect(await state.read("finalCut")).toBe(source);
});
test("Final Cut cannot overwrite an Agent edited from the Workbench since it was listed", async () => {
  const store = new StudioStore(tempDirSync("bunzai-agent-conflict-"));
  const state = memoryStateStore();
  const one = await saveLibraryAgent(store, state, { name: "Planner", instructions: "One." }, 1);
  const fresh = (await store.readVersioned("agent", one.id))!;
  if (fresh.entity.kind !== "agent") throw new Error("Wrong fixture kind");
  await store.compareAndSave({ ...fresh.entity, body: { ...fresh.entity.body, instructions: "Workbench edit.", tools: ["roll"] } }, fresh.revision);
  const error = await saveLibraryAgent(store, state, { id: one.id, revision: one.revision, name: "Planner", instructions: "Stale edit." }, 2).then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(StudioConflictError);
  expect((await store.read("agent", one.id))?.body).toMatchObject({ instructions: "Workbench edit.", tools: ["roll"] });
  const staleDelete = await deleteLibraryAgent(store, state, one.id, one.revision!).then(() => null, (e: unknown) => e);
  expect(staleDelete).toBeInstanceOf(StudioConflictError);
  expect((await store.read("agent", one.id))?.body).toMatchObject({ instructions: "Workbench edit." });
});
