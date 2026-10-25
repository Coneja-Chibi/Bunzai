/** This turn (rc-parity 08): RoleCall's OutboundCallsPanel over what a reply's trace recorded: pager, totals, calls by phase, request and raw views. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom, flushTasks } from "../../../_shared/test-dom";
import type { SceneTrace } from "../../../app-contract-scenes";
import type { TraceState } from "./use-reply-trace";
import { FOLD_OVER_CHARS } from "./this-turn-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const LONG = "w".repeat(FOLD_OVER_CHARS + 50);
const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m3", swipeId: "s3", number: 6, model: "vera-1", take: "Director's Cut" },
  blocks: [
    { kind: "prompt", label: "Main Prompt", role: "system", tokens: 40, category: "preset", text: "You are Vera." },
    { kind: "history", label: "Message 5", role: "user", tokens: 300, category: "history", text: LONG },
  ],
  window: { context: 8000, reply: 1000, stated: true },
  trimmed: 0,
  lore: null,
  rawAvailable: true,
  replies: [{ messageId: "m3", swipeId: "s3", number: 6 }, { messageId: "m2", swipeId: "s2", number: 4 }],
  turn: { sent: 1200, back: 300, exact: true, estimate: 1100, ms: 4200, at: Date.UTC(2026, 9, 12, 12, 0) },
  ...over,
});

async function mount(state: TraceState, extra: { onPick?(id: string): void; onRefresh?(): void } = {}): Promise<{ host: HTMLElement; done(): void }> {
  const [{ flushSync }, { createRoot }, { ThisTurn }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./this-turn")]);
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(<ThisTurn state={state} onPick={extra.onPick ?? (() => undefined)} onRefresh={extra.onRefresh ?? (() => undefined)} />));
  return { host: el, done: () => flushSync(() => root.unmount()) };
}
const ready = (t: SceneTrace | null): TraceState => ({ state: "ready", trace: t });
const click = async (el: Element): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => (el as HTMLElement).click()); };
const button = (host: HTMLElement, text: string): HTMLButtonElement | undefined => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

describe("This turn", () => {
  test("loading, failed and no-reply states carry RoleCall's words", async () => {
    let m = await mount({ state: "loading" });
    expect(m.host.textContent).toContain("Loading this turn");
    m.done();
    m = await mount({ state: "failed", why: "gone" });
    expect(m.host.querySelector('[role="alert"]')?.textContent).toBe("gone");
    m.done();
    m = await mount(ready(null));
    expect(m.host.textContent).toContain("No recorded calls yet");
    expect(m.host.textContent).toContain("Send a message. Every call the turn makes, before, during and after the reply, shows up here.");
    m.done();
  });
  test("the pager names the turn, the totals tiles read the recorded call, and the group is 'The reply'", async () => {
    const m = await mount(ready(trace()));
    const text = m.host.textContent ?? "";
    expect(text).toMatch(/Latest turn.*Oct 12/);
    const tiles = [...m.host.querySelectorAll(".tt-tot > div")].map((d) => d.textContent);
    expect(tiles).toEqual(["Calls1", "Sent1,200", "Received300", "Turn time4.2 s"]);
    expect(m.host.querySelector(".tt-grp")?.textContent).toBe("The reply");
    expect(text).toContain("Narrator");
    expect(text).toContain("vera-1");
    expect(text).toContain("Done");
    expect(text).toContain("user turn");
    expect(text).toContain("1,200 sent · 300 back");
    expect(text).toContain("Exact tokens");
    expect(text).toContain("Estimated tokens");
    m.done();
  });
  test("a recall call shows under 'Before the reply', and its missing token report is said once", async () => {
    const m = await mount(ready(trace({ recall: { status: "recalled", calls: 1, cached: false, model: "recall-m", injected: [], cut: [], alreadyPlaced: 0 } })));
    expect([...m.host.querySelectorAll(".tt-grp")].map((g) => g.textContent)).toEqual(["Before the reply", "The reply"]);
    expect(m.host.textContent).toContain("Compendium Retrieval");
    expect(m.host.textContent).toContain("1 call has no token report and is not in these totals.");
    m.done();
  });
  test("an estimated reply wears the tilde and says Received was not reported", async () => {
    const m = await mount(ready(trace({ turn: { exact: false, estimate: 1100, ms: 900, at: 1 } })));
    expect(m.host.textContent).toContain("~1,100 sent · not reported back");
    expect(m.host.querySelector(".tt-call.estimated")).not.toBeNull();
    m.done();
  });
  test("opening the reply shows its request, long blocks folded until opened, and Copy request copies the raw JSON", async () => {
    const copied: string[] = [];
    Object.defineProperty(dom.window.navigator, "clipboard", { value: { writeText: async (t: string) => { copied.push(t); } }, configurable: true });
    const m = await mount(ready(trace()));
    await click(m.host.querySelector(".tt-call > button")!);
    expect(m.host.textContent).toContain("You are Vera.");
    const long = [...m.host.querySelectorAll(".tt-msg")].find((b) => b.textContent?.includes("Message 5"))!;
    expect(long.querySelector("pre")!.className).toContain("folded");
    expect(long.textContent).toContain("~300 tokens · open");
    await click(long.querySelector("button")!);
    expect(long.querySelector("pre")!.className).not.toContain("folded");
    expect(long.textContent).toContain("~300 tokens · fold");
    await click(button(m.host, "Copy request")!);
    await flushTasks();
    expect(JSON.parse(copied[0]!).messages[0]).toEqual({ role: "system", content: "You are Vera." });
    m.done();
  });
  test("Raw JSON shows the messages as sent; a reply whose text was not kept says so and offers no copy", async () => {
    let m = await mount(ready(trace()));
    await click(m.host.querySelector(".tt-call > button")!);
    await click(button(m.host, "Raw JSON")!);
    expect(m.host.querySelector("pre.tt-raw")?.textContent).toContain('"model": "vera-1"');
    m.done();
    m = await mount(ready(trace({ rawAvailable: false, blocks: [{ kind: "prompt", label: "Main Prompt", role: "system", tokens: 40, category: "preset" }] })));
    await click(m.host.querySelector(".tt-call > button")!);
    expect(m.host.textContent).toContain("Raw text is kept for each take's latest reply; this one shows sizes only.");
    expect(m.host.textContent).toContain("Main Prompt");
    expect(button(m.host, "Copy request")).toBeUndefined();
    m.done();
  });
  test("Earlier turn goes to the older reply, Later turn is off on the newest, and Refresh asks again", async () => {
    const picked: string[] = [];
    let refreshed = 0;
    const m = await mount(ready(trace()), { onPick: (id) => picked.push(id), onRefresh: () => { refreshed++; } });
    expect((m.host.querySelector('[aria-label="Later turn"]') as HTMLButtonElement).disabled).toBe(true);
    await click(m.host.querySelector('[aria-label="Earlier turn"]')!);
    await click(m.host.querySelector('[aria-label="Refresh"]')!);
    expect(picked).toEqual(["m2"]);
    expect(refreshed).toBe(1);
    m.done();
  });
  test("a failed recall says why, in the left-ruled line RoleCall draws", async () => {
    const m = await mount(ready(trace({ recall: { status: "failed", calls: 1, cached: false, reason: "provider said no", injected: [], cut: [], alreadyPlaced: 0 } })));
    await click(m.host.querySelector(".tt-call > button")!);
    expect(m.host.querySelector(".tt-fail")?.textContent).toBe("provider said no");
    m.done();
  });
  test("the Route view lists every attempt, the one that failed with its reason and the one that answered; no route recorded, no Route view", async () => {
    let m = await mount(ready(trace({ route: { attempts: [
      { connectionId: "main", kind: "openrouter", model: "vera-1", outcome: "failed", status: 503, code: "service_unavailable", message: "overloaded" },
      { connectionId: "backup", kind: "openrouter", model: "vera-lite", outcome: "answered" },
    ] } })));
    await click(m.host.querySelector(".tt-call > button")!);
    await click(button(m.host, "Route")!);
    const rows = [...m.host.querySelectorAll(".tt-attempt")].map((r) => r.textContent);
    expect(rows[0]).toContain("Attempt 1");
    expect(rows[0]).toContain("vera-1");
    expect(rows[0]).toContain("Failed");
    expect(rows[0]).toContain("503 service_unavailable: overloaded");
    expect(rows[1]).toContain("Attempt 2");
    expect(rows[1]).toContain("vera-lite");
    expect(rows[1]).toContain("Answered");
    expect(m.host.textContent).toContain("The Fallback Model answered after the scene's model failed.");
    m.done();
    m = await mount(ready(trace()));
    await click(m.host.querySelector(".tt-call > button")!);
    expect(button(m.host, "Route")).toBeUndefined();
    m.done();
  });
  test("the Time view draws a lane per timed part with its length, and says it shows durations, not start times", async () => {
    const m = await mount(ready(trace({ turn: { sent: 1, back: 1, exact: true, ms: 4000, reasoningMs: 1000, at: 1 } })));
    await click(m.host.querySelector(".tt-call > button")!);
    await click(button(m.host, "Time")!);
    const lanes = [...m.host.querySelectorAll(".tt-lane")].map((l) => l.textContent);
    expect(lanes).toEqual(["Reply4.0 s", "Reasoning1.0 s"]);
    expect((m.host.querySelectorAll(".tt-lane i")[1] as HTMLElement).style.width).toBe("25%");
    expect(m.host.textContent).toContain("how long each part took, not when it started");
    m.done();
  });
});
