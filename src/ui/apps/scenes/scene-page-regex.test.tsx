/**
 * A scene's regex sets on the page (ChatStore rule 42, rc-parity 07 Wardrobe / Final Cut): the display pass dresses what is drawn and
 * never what is stored. The worker is the browser's Worker, stood in by the real worker logic (sandbox/regex/request.ts), so every
 * rule here runs through the same value-only protocol the sandbox does.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { answerRegexRequest } from "../../../sandbox/regex/request";
import { click, installRigDom, mount, msg, resetRig, rig, settle, unmount } from "./fake-scene-page-rig";

class WorkerLike {
  private listener: ((e: { data: unknown }) => void) | undefined;
  addEventListener(type: string, fn: (e: { data: unknown }) => void): void { if (type === "message") this.listener = fn; }
  removeEventListener(): void { /* nothing to undo */ }
  postMessage(data: unknown): void { queueMicrotask(() => this.listener?.({ data: answerRegexRequest(data) })); }
  terminate(): void { /* nothing to stop */ }
}
let priorWorker: unknown;
beforeAll(() => { installRigDom(); priorWorker = (globalThis as Record<string, unknown>)["Worker"]; (globalThis as Record<string, unknown>)["Worker"] = WorkerLike; });
afterAll(() => { (globalThis as Record<string, unknown>)["Worker"] = priorWorker; });
beforeEach(resetRig);

const rule = (id: string, over: Record<string, unknown> = {}) => ({ id, label: id, find: "cat", flags: "g", replace: "dog", phases: ["display"], enabled: true, sortOrder: 0, ...over });
const take = () => [msg("m1", "assistant", "A cat sits.", 1), msg("m2", "user", "Pet the cat.", 2), msg("m3", "assistant", "The cat purrs.", 3)];
const shownText = () => rig.host.textContent ?? "";

describe("ScenePage: display regex", () => {
  test("a set the scene has on dresses every stable message, and a scene with none draws the text as written", async () => {
    let flushSync = await mount(take());
    expect(shownText()).toContain("Pet the cat.");
    unmount(flushSync);
    rig.regex = { s1: { rules: [rule("r1")] } };
    flushSync = await mount(take());
    await settle(flushSync, 40);
    expect(shownText()).toContain("Pet the dog.");
    expect(shownText()).toContain("The dog purrs.");
    expect(shownText()).not.toContain("cat");
    unmount(flushSync);
  });

  test("it never changes what is stored: Edit opens the message as written", async () => {
    rig.regex = { s1: { rules: [rule("r1")] } };
    const flushSync = await mount(take());
    await settle(flushSync, 40);
    const edit = [...rig.host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Edit" || b.title === "Edit");
    expect(edit).toBeDefined();
    click(flushSync, edit!);
    await settle(flushSync);
    const area = [...rig.host.querySelectorAll("textarea")].map((t) => t.value);
    expect(area.some((v) => v.includes("cat") && !v.includes("dog"))).toBe(true);
    unmount(flushSync);
  });

  test("depth limits count from the end of the take: a maxDepth 0 rule dresses only the last message", async () => {
    rig.regex = { s1: { rules: [rule("r1", { maxDepth: 0 })] } };
    const flushSync = await mount(take());
    await settle(flushSync, 40);
    expect(shownText()).toContain("The dog purrs.");
    expect(shownText()).toContain("A cat sits.");
    expect(shownText()).toContain("Pet the cat.");
    unmount(flushSync);
  });

  test("prompt-only rules and off sets change nothing on screen", async () => {
    rig.regex = { s1: { rules: [rule("p", { phases: ["prompt"] })] }, s2: { enabled: false, rules: [rule("r2")] } };
    const flushSync = await mount(take());
    await settle(flushSync, 40);
    expect(shownText()).toContain("The cat purrs.");
    unmount(flushSync);
  });

  test("a worker that cannot run leaves every message as written and says so on the status line", async () => {
    const real = (globalThis as Record<string, unknown>)["Worker"];
    (globalThis as Record<string, unknown>)["Worker"] = class { constructor() { throw new Error("blocked by policy"); } };
    rig.regex = { s1: { rules: [rule("r1")] } };
    const flushSync = await mount(take());
    await settle(flushSync, 40);
    (globalThis as Record<string, unknown>)["Worker"] = real;
    expect(shownText()).toContain("The cat purrs.");
    expect(rig.statuses.join(" ")).toContain("Regex could not run, so messages show as written");
    unmount(flushSync);
  });

  test("a dress (a display rule that opens with a style block) is drawn through the message's own scoped style path, not as raw markup", async () => {
    rig.regex = { dress: { rules: [rule("d", { find: "^", flags: "", replace: "<style>.k{color:#112233}</style><span class=\"k\">dog</span>" })] } };
    const flushSync = await mount(take());
    await settle(flushSync, 40);
    const styles = [...rig.host.querySelectorAll("style")].map((e) => e.textContent ?? "");
    expect(styles.some((css) => css.includes("color:#112233") && css.includes(".msg-"))).toBe(true);
    expect(shownText()).not.toContain("<style>");
    expect(shownText()).toContain("dog");
    unmount(flushSync);
  });
});
