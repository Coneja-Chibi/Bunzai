/** `useSceneTurn`'s `committed`: what the turn's own done or stopped event saved (message, swipe, kind). Null before any turn and at the start of each, set by done and by a stopped that carries a message, null for a stopped with no message. */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Message } from "../../../stage/contracts/chat-store";
import type { TurnEvent } from "../../../studio/scene-turn";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import { mounted, type Mounted } from "./props/story-director/fake-director-ui-rig";
import { useSceneTurn, type CommittedTurn } from "./use-scene-turn";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8355/", extraGlobals: ["SVGElement", "Event", "CustomEvent"], pretendToBeVisual: true }); dom = installed.dom; });
afterAll(() => installed.teardown());
beforeEach(() => installed.reinstall());

const saved = (id: string, swipeId: string): Message => ({ id, role: "assistant", swipes: [{ id: "old" }, { id: swipeId }], current: 1 }) as unknown as Message;
let seen: ReturnType<typeof useSceneTurn> | null = null;
let events: ((e: TurnEvent) => void) | null = null;
let finish: (() => void) | null = null;
const ctx = { prefs: { get: () => undefined, set: () => undefined }, setStatus: () => undefined, api: {
  runSceneTurn: (_input: unknown, onEvent: (e: TurnEvent) => void) => new Promise<void>((done) => { events = onEvent; finish = done; }),
} } as unknown as AppContext;
function Probe() { seen = useSceneTurn(ctx, "chat1", () => undefined); return null; }

async function begin(m: Mounted, kind: "reply" | "swipe" | "continue"): Promise<void> {
  m.flush(() => { void seen!.start(kind, 1, "m3"); });
  await m.tick();
}
const emit = async (m: Mounted, e: TurnEvent): Promise<void> => { m.flush(() => events!(e)); await m.tick(); };
const end = async (m: Mounted): Promise<void> => { m.flush(() => finish!()); await m.tick(); await m.tick(); };

describe("committed", () => {
  test("null before any turn and at the start of a turn; a done event sets it from the saved message and the swipe showing; a new start resets it", async () => {
    const m = await mounted(dom, <Probe />);
    expect(seen!.committed).toBeNull();
    await begin(m, "swipe");
    expect(seen!.committed).toBeNull();
    await emit(m, { type: "done", message: saved("m3", "s-new") });
    expect(seen!.committed).toEqual({ kind: "swipe", messageId: "m3", swipeId: "s-new" } satisfies CommittedTurn);
    await end(m);
    await begin(m, "reply");
    expect(seen!.committed).toBeNull();
    await end(m);
    m.unmount();
  });

  test("a stopped event that carries a message sets it too (Stop kept a partial reply); with no message it stays null", async () => {
    const m = await mounted(dom, <Probe />);
    await begin(m, "continue");
    await emit(m, { type: "stopped", message: saved("m3", "s-kept") });
    expect(seen!.committed).toEqual({ kind: "continue", messageId: "m3", swipeId: "s-kept" });
    await end(m);
    await begin(m, "reply");
    await emit(m, { type: "stopped", message: null });
    expect(seen!.committed).toBeNull();
    await end(m);
    m.unmount();
  });

  test("a turn that fails saves nothing and leaves it null", async () => {
    const m = await mounted(dom, <Probe />);
    await begin(m, "reply");
    await emit(m, { type: "failed", category: "x", code: "boom", message: "no", draft: "" });
    expect(seen!.committed).toBeNull();
    await end(m);
    m.unmount();
  });
});
