/**
 * A test stand-in for the Director panel's server (tests only): a panel the fake api keeps, so `getSceneDirector`, `editSceneDirector` and `setSceneDirectorSettings` answer from it and
 * record what the page sent (the edit and the version it carried). `mounted` renders a view into a JSDOM host and gives the clicks the tests use; `unmount` runs before teardown.
 */
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { DirectorActivity, DirectorChapter, DirectorEdit, DirectorSettingsPatch, DirectorState } from "../../../../../stage/contracts/director-types";
import { arcOf, hiddenOf, seedOf, stateOf } from "../../../../../core/director/fixtures";
import { resolveDirector } from "../../../../../core/director/settings";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import type { AppContext } from "../../../../app-contract";

export const CHAT = { id: "chat1", activeBranchId: "b1", updatedAt: 1 } as Chat;

export function panelOf(over: Partial<DirectorPanel> = {}): DirectorPanel {
  return { on: true, settings: resolveDirector({}), state: stateOf(), version: 3, tip: "m9", size: { bytes: 12_400, max: 600_000 }, tools: "native", archived: { notes: [], hidden: [] }, history: [], at: null, trackerUpdates: {}, ...over };
}

export interface FakeDirector {
  ctx: AppContext;
  panel: DirectorPanel;
  prefs: Record<string, unknown>;
  edits: { edit: DirectorEdit; expectedVersion: number | null }[];
  patches: DirectorSettingsPatch[];
  props: string[][];
  /** The tracker writes the page made: module and patch. */
  tracked: { module: string; patch: Record<string, unknown> }[];
  /** The scene as the server holds it now (what a re-read of the scene returns). */
  sceneChat: Chat;
  /** The undos the page asked for: module and reply. */
  undos: { module: string; messageId: string }[];
  /** The story saved on each earlier reply, by message id, for `at` reads; and the `at` of every read the page made. */
  stories: Record<string, DirectorState>;
  reads: (string | undefined)[];
  /** Make the next edit or settings write fail. */
  failNext: boolean;
}

export function fakeDirector(start: DirectorPanel, onEdit?: (panel: DirectorPanel, edit: DirectorEdit) => DirectorPanel): FakeDirector {
  const rig: FakeDirector = { panel: start, prefs: {}, edits: [], patches: [], props: [], tracked: [], undos: [], sceneChat: { ...CHAT, trackers: {} } as Chat, stories: {}, reads: [], failNext: false, ctx: undefined as unknown as AppContext };
  const answer = async (): Promise<DirectorPanel> => structuredClone(rig.panel);
  rig.ctx = {
    api: {
      getSceneDirector: async (_id: string, opts?: { at?: string }) => {
        rig.reads.push(opts?.at);
        const base = structuredClone(rig.panel);
        return opts?.at ? { ...base, state: rig.stories[opts.at] ?? base.state, at: opts.at } : base;
      },
      editSceneDirector: async (_id: string, edit: DirectorEdit, expectedVersion: number | null) => {
        rig.edits.push({ edit, expectedVersion });
        if (rig.failNext) { rig.failNext = false; throw new Error("conflict"); }
        rig.panel = { ...(onEdit ? onEdit(rig.panel, edit) : rig.panel), version: (rig.panel.version ?? 0) + 1 };
        return answer();
      },
      setSceneDirectorSettings: async (_id: string, patch: DirectorSettingsPatch) => {
        rig.patches.push(patch);
        if (rig.failNext) { rig.failNext = false; throw new Error("stale"); }
        const settings = { ...rig.panel.settings };
        for (const [k, v] of Object.entries(patch)) { if (v === null) delete (settings as Record<string, unknown>)[k]; else (settings as Record<string, unknown>)[k] = v; }
        rig.panel = { ...rig.panel, settings: { ...resolveDirector({}), ...settings } };
        return answer();
      },
      undoSceneTrackerUpdate: async (_id: string, module: string, messageId: string) => {
        rig.undos.push({ module, messageId });
        if (rig.failNext) { rig.failNext = false; throw new Error("changed"); }
        const { [module]: _gone, ...rest } = rig.panel.trackerUpdates as Record<string, unknown>;
        rig.panel = { ...rig.panel, trackerUpdates: rest as DirectorPanel["trackerUpdates"] };
        return answer();
      },
      setSceneTracker: async (_id: string, module: string, patch: Record<string, unknown>) => {
        rig.tracked.push({ module, patch });
        if (rig.failNext) { rig.failNext = false; throw new Error("stale"); }
        const trackers = { ...(rig.sceneChat.trackers ?? {}) } as Record<string, Record<string, unknown>>;
        const entry = { ...(trackers[module] ?? {}) };
        if ("auto" in patch) { if (patch["auto"] === null) delete entry["auto"]; else entry["auto"] = patch["auto"]; }
        trackers[module] = entry;
        rig.sceneChat = { ...rig.sceneChat, trackers } as Chat;
        return rig.sceneChat;
      },
      openScene: async () => ({ chat: rig.sceneChat }),
      getSceneProps: async () => ({ on: rig.panel.on ? ["story-director"] : [] }),
      setSceneProps: async (_id: string, on: string[]) => { rig.props.push(on); rig.panel = { ...rig.panel, on: on.includes("story-director") }; return { on }; },
      sceneConnections: async () => [{ id: "c1", kind: "openrouter", label: "OpenRouter", model: "claude" }],
      connectionModels: async () => ({ models: [{ id: "claude" }, { id: "haiku" }], saved: "claude" }),
    },
    prefs: { get: (k: string) => rig.prefs[k], set: (k: string, v: unknown) => { rig.prefs[k] = v; } },
    setStatus: () => undefined,
  } as unknown as AppContext;
  return rig;
}

export interface Mounted {
  host: HTMLElement;
  tick(): Promise<void>;
  /** Runs `fn` and applies what it caused. */
  flush(fn: () => void): void;
  click(el: Element | null | undefined): Promise<void>;
  type(el: Element | null, value: string): Promise<void>;
  button(text: string): HTMLButtonElement | undefined;
  rerender(ui: JSX.Element): Promise<void>;
  unmount(): void;
}

/** Renders `ui` into a fresh host in `dom`. The caller unmounts before teardown. */
export async function mounted(dom: JSDOM, ui: JSX.Element): Promise<Mounted> {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root: Root = createRoot(host);
  const tick = async (): Promise<void> => { await new Promise((r) => setTimeout(r, 15)); flushSync(() => undefined); };
  flushSync(() => root.render(ui));
  await tick();
  return {
    host, tick, flush: (fn) => flushSync(fn),
    click: async (el) => { flushSync(() => (el as HTMLElement).click()); await tick(); },
    type: async (el, value) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const proto = input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
      flushSync(() => input.dispatchEvent(new dom.window.Event("input", { bubbles: true })));
      await tick();
    },
    button: (text) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text || b.getAttribute("title") === text),
    rerender: async (next) => { flushSync(() => root.render(next)); await tick(); },
    unmount: () => { flushSync(() => root.unmount()); host.remove(); },
  };
}

/** A story with a chapter, two arcs (one with a pending next beat), a seed, a hidden arc, a note, an analysis and three feed lines, for the panel's tabs. */
export const chapter: DirectorChapter = { id: "c1", number: 1, title: "The Keeper's Ledger", premise: "A ledger lists every ship the lighthouse saved.", status: "active", themes: ["inheritance", "guilt"], tone: "slow dread", majorGoal: "Learn what the names share; Reach the causeway", estimatedTurns: { minimum: 5, target: 10, maximum: 20 }, turnsElapsed: 3, createdAtTurn: 5 };
export const line = (id: string, type: DirectorActivity["type"], at: number, over: Partial<DirectorActivity> = {}): DirectorActivity => ({ id, at, turn: 14, type, result: "success", description: `line ${id}`, ...over });
export const story = (over: Partial<DirectorState> = {}): DirectorState => stateOf({
  turn: 14, chapters: [chapter], currentChapterId: "c1",
  arcs: [
    arcOf({ id: "arc-1", title: "The lantern that burns blue", chapterId: "c1", horizon: "short", status: "building", description: "It has burned blue since the third ship.", involvedCharacters: ["Marguerite"], turnsActive: 7,
      stages: [{ title: "Seeding", description: "The glass is the wrong color", turn: 6 }, { title: "Now", turn: 13 }], nextBeat: { description: "Marguerite finds the torn ledger page.", plannedAtTurn: 14, targetTurn: 16, status: "pending" } }),
    arcOf({ id: "arc-2", title: "Who lit the lantern", status: "complete", horizon: "immediate" }),
  ],
  seeds: [seedOf({ id: "seed-1", hint: "Salt in a dry room", relatedArcId: "arc-1", payoffHorizon: "long", turnsActive: 2 })],
  invisibleArcs: [hiddenOf({ id: "hid-1", title: "The harbormaster sold the salvage", horizon: "short", turnsActive: 3, userAuthored: true, surfaceCondition: "When the receipt is found", expectedSurfaceTurn: 20 })],
  notes: [{ id: "note-1", content: "Keep the lantern color a surprise.", createdAt: 1 }],
  pacing: { ...stateOf().pacing, currentMood: "Tense and watchful" }, suggestedActions: ["Ask about the third name."], nextIntentions: [{ type: "reveal", description: "Let her find the torn page.", priority: "must", targetTurn: "next" }],
  recentAnalysis: [{ turn: 14, userAction: "opened the ledger", whatHappened: "She read the crossed-out names.", seedsPlanted: ["Salt in a dry room"], seedsPaidOff: [], unexpected: [], pacingAnalysis: "Four quiet turns; give her one discovery.", playerEnergy: "curious" }],
  activity: [line("a1", "turn_start", Date.now() - 20_000, { description: "Planning before the reply." }), line("a2", "arc", Date.now() - 12_000), line("a3", "turn_error", Date.now() - 5_000, { result: "error", description: "No directive for this reply.", details: "gateway timeout", model: "m1" })],
  lastDirective: { mood: "hushed", pacing: "slow" }, ...over,
});
