/**
 * A test stand-in for the Trackers panel's library trackers (tests only): two library trackers (a record with every field type, a list), the scene's chat linking them, and a fake api that
 * answers the read and the edit and records what the page sent (the edit, the link list, what the Workbench was asked to open), over the Director's fake server the panel also reads.
 */
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { SceneTracker, SceneTrackers } from "../../../../../../studio/scene-trackers";
import type { TrackerEditInput } from "../../../../../../studio/tracker-edit";
import type { TrackerBody } from "../../../../../../entities/tracker/schema";
import type { StudioEntitySummary } from "../../../../../app-contract";
import { fakeDirector, panelOf, story } from "../../../props/story-director/fake-director-ui-rig";

export const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "", icon: "lucide:heart", changes: "chips",
  fields: [
    { name: "hp", description: "", type: "number", min: 0, maxField: "hp_max", default: 20, icon: "lucide:activity" },
    { name: "hp_max", description: "", type: "number", min: 1, default: 20 },
    { name: "gold", description: "", type: "number", default: 0 },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense", "hurt"], default: "calm", icon: "lucide:heart" },
    { name: "lit", description: "", type: "boolean", default: false },
    { name: "vow", description: "", type: "text", default: "" },
  ],
};
export const satchel: TrackerBody = { name: "Satchel", description: "", layout: "list", note: "", icon: "lucide:star", fields: [{ name: "qty", description: "", type: "number", min: 0, default: 1 }] };

export const trackersAt = (hp = 7): SceneTrackers => ({
  branchId: "b1", branchVersion: 4, tipId: "m9",
  trackers: [
    { id: "health", body: health, value: { hp, hp_max: 20, gold: 212, mood: "hurt", lit: true, vow: "Owes Mara a favour" }, last: { messageId: "m9", number: 42 } },
    { id: "satchel", body: satchel, value: [{ name: "rope", qty: 1 }, { name: "salt", qty: 3 }], last: { messageId: "m8", number: 41 } },
  ] satisfies SceneTracker[],
});

export const chat = (linked: string[], updatedAt = 1): Chat => ({ id: "chat1", activeBranchId: "b1", updatedAt, props: { on: [] }, prompting: { trackers: linked } }) as unknown as Chat;
export const library: StudioEntitySummary[] = [{ id: "health", kind: "tracker", name: "Health" }, { id: "satchel", kind: "tracker", name: "Satchel" }, { id: "hull", kind: "tracker", name: "Ship's hull" }];

export interface Rig {
  rig: ReturnType<typeof fakeDirector>;
  reads: number;
  edits: TrackerEditInput[];
  changed: string[];
  prompting: unknown[];
  opened: unknown[];
  apps: string[];
  saved: unknown[];
  /** What the next edit answers; an Error refuses it. */
  answer: SceneTrackers | Error;
}

export function setup(): Rig {
  const rig = fakeDirector(panelOf({ state: story() }));
  const r: Rig = { rig, reads: 0, edits: [], changed: [], prompting: [], opened: [], apps: [], saved: [], answer: trackersAt() };
  Object.assign(rig.ctx.api, {
    getSceneTrackers: async () => { r.reads++; return trackersAt(); },
    editSceneTracker: async (input: TrackerEditInput) => { r.edits.push(input); if (r.answer instanceof Error) throw r.answer; return r.answer; },
    getTrackerChanges: async (_branch: string, from: string) => ({ messages: [{ messageId: from, trackers: [{ trackerId: "health", name: "Health", style: "chips", changes: [{ field: "hp", before: 10, after: 7 }, { field: "mood", before: "calm", after: "hurt" }] }] }] }),
    setScenePrompting: async (_id: string, patch: unknown) => { r.prompting.push(patch); return chat((patch as { trackers: string[] | null }).trackers ?? []); },
    listEntities: async () => library,
    getEntity: async (query: string) => ({ body: query.includes("health") ? health : query.includes("satchel") ? satchel : { layout: "record", fields: [{}, {}] } }),
    saveEntity: async (e: { id: string }) => { r.saved.push(e); return { id: "new-tracker", name: "My tracker" }; },
  });
  Object.assign(rig.ctx, { workbench: { open: (s: unknown) => { r.opened.push(s); } }, openApp: (id: string) => { r.apps.push(id); } });
  return r;
}
