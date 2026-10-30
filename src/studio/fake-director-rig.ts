/**
 * The Story Director's turn-loop test rig: a scene on the memory store with a scripted provider that answers the narrator and the planner separately, the planner's answers queued (a completion, an
 * error, "hang" until aborted, or a promise to release), and the helpers the turn tests share. Used by tests only.
 */
import { publishSceneTrackers } from "./scene-events";
import { createTurnRuntime } from "./scene-turn-runtime";
import { DIRECTOR_HEADER } from "../core/assembly/director";
import { typedEntry } from "../core/compendium/fixture-book";
import { DIRECTOR_PROP_ID } from "../core/director/settings";
import { TRACKER_PROP_PREFIX } from "../stage/contracts/chat-tracker-types";
import { trackerDataIn, trackerDeltas } from "../core/trackers";
import { settleTrackerRounds } from "./scene-director-trackers";
import { emptyLorebookBody } from "../core/lore";
import type { ChatCompendiumPatch, ChatTrackerPatch, TrackerModule } from "../stage/contracts/chat-store";
import type { DirectorSettingsPatch } from "../stage/contracts/director-types";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import type { StateStore } from "../stage/contracts/state-store";
import { runTurn, type Connected, type TurnEvent } from "./scene-turn";

export const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["b1"] } };
export const BOOK = { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [typedEntry("e1", "Mira", "character", { name: "Mira", description: "Keeps the second ledger.", relationships: [{ with: "Vera", nature: "rival" }] }), typedEntry("e2", "The Pier", "location", { name: "The Pier", description: "Salt and rope." })] } };
export const isPlanner = (r: ProviderRequest) => r.messages[0]!.content.startsWith("You are the Story Director");
export const ARGS = (over: Record<string, unknown> = {}) => ({
  directive: { mood: "uneasy", pacing: "slow", narrativeGoal: "Let Vera slip once.", arcDirections: [{ arcName: "The Lamp", instruction: "Someone avoids the lamp room.", urgency: "moderate" }] },
  arcUpdates: [{ arcId: "The Lamp", title: "The Lamp", description: "The lamp keeper hides something.", nextBeat: { description: "A servant drops a key" } }],
  seedUpdates: [{ title: "The cracked bell", action: "plant", description: "It rings at the end.", scope: "world", relatedArcId: "" }], invisibleArcUpdates: [],
  analysis: { whatHappened: "A question about storms." }, chapterUpdate: { action: "start_new", title: "Arrival" }, ...over,
});
export const call = (args: unknown, name = "commit_planning_round"): ProviderCompletion => ({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }], finish_reason: "tool_calls", raw: {} });
export const text = (content: string): ProviderCompletion => ({ content, finish_reason: "stop", raw: {} });

export type Step = ProviderCompletion | Error | "hang" | Promise<ProviderCompletion>;
/** `trackers` are the tracker Props that are on, with their settings and `state` (the module's data, kept as the person's edit on the opening message); `tracker` queues the answers to the Director's tracker requests (an unscripted one answers `{}`: nothing moved). */
export type SceneOptions = { compendium?: ChatCompendiumPatch; on?: boolean; settings?: DirectorSettingsPatch; tools?: boolean; planner?: Step[]; narrator?: "ok" | Error; trackers?: Partial<Record<TrackerModule, ChatTrackerPatch & { state?: unknown }>>; tracker?: Step[] };
export const isTrackerAsk = (r: ProviderRequest) => r.messages[0]!.content.startsWith("You are a precise JSON generator");
/** The stores come from the caller (a test may name the memory backend; this stand-in may not): `stores(clock)` makes the chat store and the state store. */
export async function buildScene(opts: SceneOptions, stores: (clock: () => number) => { chats: ChatStore; state: StateStore }) {
  let now = 1_000;
  const { chats, state } = stores(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  const trackerOn = Object.keys(opts.trackers ?? {}).map((m) => `${TRACKER_PROP_PREFIX}${m}`);
  if (opts.on !== false || trackerOn.length > 0) await chats.setProps(chat.id, { on: [...(opts.on !== false ? [DIRECTOR_PROP_ID] : []), ...trackerOn] });
  for (const [module, { state: _, ...patch }] of Object.entries(opts.trackers ?? {})) if (Object.keys(patch).length > 0) await chats.setTracker(chat.id, module as TrackerModule, patch);
  if (opts.settings) await chats.setDirectorSettings(chat.id, opts.settings);
  if (opts.compendium) await chats.setCompendium(chat.id, opts.compendium);
  const opening = await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  for (const [module, { state }] of Object.entries(opts.trackers ?? {})) if (state !== undefined) await chats.recordMessageDeltas(chat.activeBranchId, opening![0]!.id, trackerDeltas(module as TrackerModule, undefined, state, now));
  const planner: ProviderRequest[] = [];
  const narrator: ProviderRequest[] = [];
  const aborted: boolean[] = [];
  const tracker: ProviderRequest[] = [];
  const trackerScript = [...(opts.tracker ?? [])];
  const script = [...(opts.planner ?? [call(ARGS())])];
  const provider: Provider = {
    id: "p",
    async send(request, io) {
      if (isTrackerAsk(request)) {
        tracker.push(request);
        const next = trackerScript.shift() ?? text("{}");
        if (next === "hang") await new Promise((_, reject) => io?.signal?.addEventListener("abort", () => { aborted.push(true); reject(io.signal!.reason); }));
        if (next instanceof Error) throw next;
        return await (next as ProviderCompletion | Promise<ProviderCompletion>);
      }
      if (!isPlanner(request)) {
        narrator.push(request);
        if (opts.narrator instanceof Error) throw opts.narrator;
        return text("Colder.");
      }
      planner.push(request);
      const next = script.shift() ?? call(ARGS());
      if (next === "hang") {
        await new Promise((_, reject) => io?.signal?.addEventListener("abort", () => { aborted.push(true); reject(io.signal!.reason); }));
      }
      if (next instanceof Error) throw next;
      return await (next as ProviderCompletion | Promise<ProviderCompletion>);
    },
  };
  const sleeps: number[] = [];
  const deps = { runtime: createTurnRuntime(publishSceneTrackers),
    chats, state,
    connect: async (_c?: { id: string; model: string }): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000, ...(opts.tools === false ? {} : { tools: true }) }),
    readPreset: async () => null, readLorebook: async (id: string) => (id === "b1" ? BOOK : null), now: () => (now += 10), randomSeed: () => 7,
    director: { sleep: async (ms: number) => void sleeps.push(ms), jitter: () => 0.5, timeoutMs: 5_000 },
  };
  const events: TurnEvent[] = [];
  const turn = async (kind: "reply" | "swipe" | "continue" = "reply", guidance?: string) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version, ...(guidance ? { guidance } : {}) }, (e) => events.push(e));
  };
  const tip = async () => (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
  const stored = async () => { const m = await tip(); return chats.getDirector(chat.id, m.id); };
  /** Waits for the Director's background tracker round to have written (or undone) everything. */
  const settle = () => settleTrackerRounds(deps.runtime);
  return { chats, chat, deps, planner, narrator, tracker, settle, aborted, sleeps, events, turn, tip, stored };
}
export const contents = (r: ProviderRequest) => r.messages.map((m) => m.content);
export const directorBlocks = (r: ProviderRequest) => r.messages.filter((m) => m.content.startsWith(DIRECTOR_HEADER));

/** A module's data at a take's tip, as the module's own reader gives it (undefined while nothing was written). */
export const dataAt = async (chats: ChatStore, branchId: string, module: TrackerModule): Promise<unknown> => trackerDataIn(module, (await chats.sceneState(branchId))!);
/** The person's edit of a module: its whole next data, kept on a message (the tip when none is named), judged against what the take shows now. */
export async function personEdit(chats: ChatStore, branchId: string, module: TrackerModule, next: unknown, messageId?: string): Promise<boolean> {
  const at = messageId ?? (await chats.readMessagesBefore(branchId, { limit: 1, liveOnly: true })).messages[0]!.id;
  return chats.recordMessageDeltas(branchId, at, trackerDeltas(module, await dataAt(chats, branchId, module), next, 1));
}
