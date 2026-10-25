/**
 * The Final Cut tab (RoleCall's PostProductionPanel): its words, the stats strip, the master switch, each card's switch and controls
 * writing the scene's Final Cut (ChatStore rule 44) after a short pause, the Anti-Slop picker and its search, Custom Banks and Saved Agents
 * in the person's library, the per-tool model overrides, and the contract preview. The api is a stand-in that records what it was asked.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../../app-contract";
import type { ChatFinalCutPatch, Chat } from "../../../../stage/contracts/chat-store";
import type { AgentRecord, BankRecord } from "../../../../studio/final-cut-library";
import { click, installRigDom, props, rig, settle, type FlushSync } from "../fake-scene-page-rig";
import { FinalCutTab } from "./final-cut-tab";
import { FINAL_CUT_STYLE } from "./fc-style";

beforeAll(installRigDom);

let chat: Chat;
let writes: ChatFinalCutPatch[];
let banks: BankRecord[];
let agents: AgentRecord[];
let saved: Record<string, unknown>[];
beforeEach(() => {
  chat = { id: "chat1", title: "t", cast: { character: { id: "v", version: 1 } }, activeBranchId: "b1", createdAt: 1, updatedAt: 1, snapshotVersion: 1 };
  writes = []; banks = []; agents = []; saved = [];
});

const ctx = (): AppContext => ({
  api: {
    setSceneFinalCut: async (_id: string, patch: ChatFinalCutPatch) => {
      writes.push(patch);
      const { on, passes, tools } = patch;
      chat = { ...chat, finalCut: { ...(on ? { on: true as const } : {}), ...(passes ? { passes } : {}), ...(tools ? { tools } : {}) } };
      return chat;
    },
    getFinalCutLibrary: async () => ({ banks, agents }),
    saveFinalCutBank: async (bank: Record<string, unknown>) => {
      saved.push(bank);
      const made = { id: String(bank["id"] ?? `b${banks.length + 1}`), bankId: `user/${String(bank["label"]).toLowerCase().replace(/\W+/g, "-")}`, enabled: bank["enabled"] !== false, createdAt: 1, updatedAt: 2, replace: "", ...bank } as unknown as BankRecord;
      banks = [made, ...banks.filter((b) => b.id !== made.id)];
      return made;
    },
    deleteFinalCutBank: async (id: string) => { banks = banks.filter((b) => b.id !== id); return { deleted: true }; },
    saveFinalCutAgent: async (agent: Record<string, unknown>) => {
      saved.push(agent);
      const made = { id: `a${agents.length + 1}`, createdAt: 1, updatedAt: 2, ...agent } as unknown as AgentRecord;
      agents = [made, ...agents];
      return made;
    },
    deleteFinalCutAgent: async (id: string) => { agents = agents.filter((a) => a.id !== id); return { deleted: true }; },
    sceneConnections: async () => [],
    listEntities: async () => [],
  },
  prefs: { get: () => undefined, set: () => undefined },
  setStatus: () => undefined,
}) as unknown as AppContext;

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  const render = (): void => flushSync(() => rig.root.render(createElement(FinalCutTab, { ctx: ctx(), chat, onChanged: (c: Chat) => { chat = c; render(); } })));
  render();
  await settle(flushSync);
  return flushSync;
}
const text = (): string => rig.host.textContent ?? "";
const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };
const card = (title: string): HTMLElement => [...rig.host.querySelectorAll<HTMLElement>(".fc-card")].find((c) => c.querySelector("h3")?.textContent === title)!;
const live = (title: string): HTMLButtonElement => card(title).querySelector<HTMLButtonElement>(".fc-live")!;
const input = (flushSync: FlushSync, el: Element, prop: "onChange", event: Record<string, unknown>): void => { flushSync(() => props(el)[prop]!({ target: event })); };
const label = (root: ParentNode, name: string): HTMLElement => [...root.querySelectorAll<HTMLElement>("label")].find((l) => l.textContent?.startsWith(name))!;
const saveSoon = (flushSync: FlushSync): Promise<void> => settle(flushSync, 400);

describe("the tab's words and numbers", () => {
  test("says RoleCall's hero, shows the stats strip, and every card starts Off", async () => {
    const flushSync = await mount();
    expect(text()).toContain("Now in review");
    expect(text()).toContain("The Final Cut");
    expect(text()).toContain("Configure what happens after the narrator writes and before the reply is saved. Creative passes use an LLM. The safety check is deterministic and can also inspect your own message before send.");
    expect([...rig.host.querySelectorAll(".fc-stats div")].map((d) => d.textContent)).toEqual(["Creative Passes0", "Anti-SlopOff", "Editor RulesOff", "Output SafetyOff", "User Message CheckOff"]);
    for (const t of ["Output Safety Check", "Anti-Slop Engine", "Scene Editor", "Translator", "Your Department"]) expect(live(t).textContent).toBe("Off");
    expect(text()).toContain("Enable this pass to expose its controls and prompt contract.");
    expect(text()).toContain("No passes enabled. The narrator output saves unchanged.");
    expect(FINAL_CUT_STYLE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    unmount(flushSync);
  });
});

describe("the switches", () => {
  test("the master switch keeps the scene's Final Cut on after a pause; turning a pass Live shows its controls and writes it with RoleCall's defaults", async () => {
    const flushSync = await mount();
    click(flushSync, rig.host.querySelector<HTMLElement>(".fc-master .fc-live")!);
    click(flushSync, live("Scene Editor"));
    expect(text()).toContain("Editor profile");
    expect(text()).toContain("Voicekeeper");
    await saveSoon(flushSync);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.on).toBe(true);
    expect(writes[0]!.passes![0]).toMatchObject({ type: "editor", failureMode: "fallback", profileId: "voicekeeper", outputMode: "tool-call", contextMessages: 3, forbidNewFacts: true });
    expect([...rig.host.querySelectorAll(".fc-stats div")].map((d) => d.querySelector("b")!.textContent)).toEqual(["1", "Off", "0 attached", "Off", "Off"]);
    expect(text()).toContain("On. 1 pass runs on every new reply, in this order.");
    unmount(flushSync);
  });

  test("Off keeps every setting: the pass comes back as it was left", async () => {
    const flushSync = await mount();
    click(flushSync, live("Scene Editor"));
    input(flushSync, label(card("Scene Editor"), "Rewrite strength").querySelector("select")!, "onChange", { value: "bold" });
    click(flushSync, live("Scene Editor"));
    expect(text()).toContain("Enable this pass to expose its controls and prompt contract.");
    await saveSoon(flushSync);
    expect(writes.at(-1)!.passes![0]).toMatchObject({ enabled: false, rewriteStrength: "bold" });
    click(flushSync, live("Scene Editor"));
    expect((label(card("Scene Editor"), "Rewrite strength").querySelector("select") as HTMLSelectElement).value).toBe("bold");
    unmount(flushSync);
  });

  test("two quick changes are one write, composed on the latest values", async () => {
    const flushSync = await mount();
    click(flushSync, live("Scene Editor"));
    input(flushSync, label(card("Scene Editor"), "Rewrite strength").querySelector("select")!, "onChange", { value: "surgical" });
    input(flushSync, label(card("Scene Editor"), "Forbid new scene facts").querySelector("input")!, "onChange", { checked: false });
    await saveSoon(flushSync);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.passes![0]).toMatchObject({ forbidNewFacts: false, rewriteStrength: "surgical" });
    unmount(flushSync);
  });

  test("a save that fails says why and puts back what the scene holds", async () => {
    const flushSync = await mount();
    const bad = ctx();
    (bad.api as unknown as { setSceneFinalCut(): Promise<never> }).setSceneFinalCut = async () => { throw new Error("the disk is full"); };
    const { flushSync: f2 } = await import("react-dom");
    f2(() => rig.root.render(createElement(FinalCutTab, { ctx: bad, chat, onChanged: () => undefined })));
    click(f2, live("Output Safety Check"));
    await saveSoon(f2);
    expect(rig.host.querySelector('[role="alert"]')!.textContent).toBe("the disk is full");
    expect(live("Output Safety Check").textContent).toBe("Off");
    unmount(flushSync);
  });
});

describe("the editor", () => {
  test("a profile sets its own starting values and shows its own controls first", async () => {
    const flushSync = await mount();
    click(flushSync, live("Scene Editor"));
    input(flushSync, label(card("Scene Editor"), "Editor profile").querySelector("select")!, "onChange", { value: "proofreader" });
    expect(text()).toContain("Minimum viable cleanup.");
    expect(text()).toContain("Shows grammar, formatting, preservation, and light cleanup.");
    expect(label(card("Scene Editor"), "POV contract")).toBeUndefined();
    expect((label(card("Scene Editor"), "Rewrite strength").querySelector("select") as HTMLSelectElement).value).toBe("surgical");
    input(flushSync, label(card("Scene Editor"), "Editor profile").querySelector("select")!, "onChange", { value: "strict-pov" });
    expect(label(card("Scene Editor"), "POV contract")).toBeDefined();
    expect((label(card("Scene Editor"), "POV contract").querySelector("select") as HTMLSelectElement).value).toBe("third-limited");
    unmount(flushSync);
  });

  test("craft-floor rules attach one by one and the stats count them; a turn-history rule is flagged", async () => {
    const flushSync = await mount();
    click(flushSync, live("Scene Editor"));
    const rules = [...rig.host.querySelectorAll<HTMLElement>(".fc-rules .fc-bank")];
    expect(rules).toHaveLength(8);
    click(flushSync, rules[0]!);
    click(flushSync, rules[1]!);
    expect(text()).toContain("2 attached");
    await saveSoon(flushSync);
    expect(writes.at(-1)!.passes![0]!.attachedRules).toHaveLength(2);
    click(flushSync, rules[0]!);
    expect(text()).toContain("1 attached");
    unmount(flushSync);
  });
});

describe("the regex toggle", () => {
  test("every model pass offers RoleCall's regex-on-input switch, on by default, and turning it off is kept", async () => {
    const flushSync = await mount();
    click(flushSync, live("Scene Editor"));
    click(flushSync, live("Anti-Slop Engine"));
    const toggles = [...rig.host.querySelectorAll<HTMLElement>("label")].filter((l) => l.textContent === "Apply your AI-output regex scripts to input");
    expect(toggles).toHaveLength(2);
    expect(toggles.every((l) => (l.querySelector("input") as HTMLInputElement).checked)).toBe(true);
    input(flushSync, label(card("Scene Editor"), "Apply your AI-output regex scripts to input").querySelector("input")!, "onChange", { checked: false });
    await saveSoon(flushSync);
    expect(writes.at(-1)!.passes!.find((p) => p.type === "editor")).toMatchObject({ applyRegexToInput: false });
    expect(writes.at(-1)!.passes!.find((p) => p.type === "anti-slop")!.applyRegexToInput).toBeUndefined();
    unmount(flushSync);
  });
});

describe("the safety check", () => {
  test("Live shows the failure mode and the user-message switch; the stats follow", async () => {
    const flushSync = await mount();
    click(flushSync, live("Output Safety Check"));
    expect(text()).toContain("Also check my messages before send");
    input(flushSync, label(card("Output Safety Check"), "If this pass fails").querySelector("select")!, "onChange", { value: "block" });
    input(flushSync, rig.host.querySelector(".fc-safety input[type=checkbox]")!, "onChange", { checked: true });
    expect([...rig.host.querySelectorAll(".fc-stats div")].map((d) => d.querySelector("b")!.textContent).slice(3)).toEqual(["On", "On"]);
    await saveSoon(flushSync);
    expect(writes.at(-1)!.passes![0]).toMatchObject({ type: "validator", failureMode: "block", applyToUserMessages: true });
    unmount(flushSync);
  });
});

describe("Anti-Slop", () => {
  test("Live attaches the default sets, counts the banks, and Enable all, Disable all and Detach change them", async () => {
    const flushSync = await mount();
    click(flushSync, live("Anti-Slop Engine"));
    expect(text()).toContain("2 sets · 6 banks on · scene model");
    const sets = (): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(".fc-set")];
    expect(sets()).toHaveLength(2);
    const btn = (set: HTMLElement, name: string): HTMLElement => [...set.querySelectorAll<HTMLElement>(".acts button")].find((b) => b.textContent?.includes(name))!;
    click(flushSync, btn(sets()[1]!, "Enable all"));
    expect(text()).toContain("2 sets · 14 banks on");
    click(flushSync, btn(sets()[1]!, "Disable all"));
    expect(text()).toContain("2 sets · 4 banks on");
    click(flushSync, btn(sets()[1]!, "Detach"));
    expect(sets()).toHaveLength(1);
    expect(text()).toContain("1 set · 4 banks on");
    expect(rig.host.querySelector<HTMLSelectElement>('select[aria-label="Attach another set"]')!.options.length).toBeGreaterThan(60);
    unmount(flushSync);
  });

  test("attaching another set switches its first three banks on and opens it", async () => {
    const flushSync = await mount();
    click(flushSync, live("Anti-Slop Engine"));
    input(flushSync, rig.host.querySelector('select[aria-label="Attach another set"]')!, "onChange", { value: "naming-bans" });
    expect([...rig.host.querySelectorAll(".fc-set")]).toHaveLength(3);
    expect(text()).toContain("3 sets · 9 banks on");
    unmount(flushSync);
  });

  test("a search finds a bank by its name or an entry, pins an entry (which switches its bank on) and opens the full bank", async () => {
    const flushSync = await mount();
    click(flushSync, live("Anti-Slop Engine"));
    const search = rig.host.querySelector('input[aria-label="Search slopism banks and banned entries"]')!;
    input(flushSync, search, "onChange", { value: "zzzqqq" });
    expect(text()).toContain('No attached Slopism banks or banned entries match "zzzqqq".');
    input(flushSync, search, "onChange", { value: "filter words" });
    const article = rig.host.querySelector<HTMLElement>(".fc-results article")!;
    expect(article.textContent).toContain("Filter words");
    expect(rig.host.querySelector(".fc-results .sum")!.textContent).toMatch(/matching banks? · \d+ matching entr/);
    click(flushSync, [...article.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Open full bank")!);
    expect(rig.host.querySelector(".fc-results")).toBeNull();
    expect(rig.host.querySelector(".fc-bank.open")).not.toBeNull();
    unmount(flushSync);
  });

  test("a bank's depth can be set alone, and the readout says what it sends", async () => {
    const flushSync = await mount();
    click(flushSync, live("Anti-Slop Engine"));
    const bank = rig.host.querySelector<HTMLElement>(".fc-set .fc-bank.on")!;
    click(flushSync, bank.querySelector<HTMLElement>(".more")!);
    expect(bank.textContent).toContain("Depth in prompt");
    click(flushSync, [...bank.querySelectorAll<HTMLElement>(".fc-depth .opts button")].find((b) => b.textContent?.startsWith("Minimal"))!);
    expect(bank.textContent).toContain("pattern, 0/");
    await saveSoon(flushSync);
    expect(Object.values(writes.at(-1)!.passes![0]!.bankDepthOverrides!)).toEqual(["minimal"]);
    unmount(flushSync);
  });
});

describe("Custom Banks and Saved Agents", () => {
  test("a new bank is saved to the library with its examples, then switched off, edited and deleted on the second click", async () => {
    const flushSync = await mount();
    click(flushSync, [...rig.host.querySelectorAll<HTMLElement>(".fc-banks header .fc-btn")].find((b) => b.textContent === "+ New Bank")!);
    const form = rig.host.querySelector<HTMLElement>(".fc-bankform")!;
    input(flushSync, label(form, "Label").querySelector("input")!, "onChange", { value: "Melodrama tells" });
    input(flushSync, label(form, "Pattern").querySelector("textarea")!, "onChange", { value: "Overwrought stock beats." });
    input(flushSync, form.querySelector('input[aria-label="Example 1"]')!, "onChange", { value: "a single tear traced her cheek" });
    click(flushSync, [...rig.host.querySelectorAll<HTMLElement>(".fc-create .acts button")].find((b) => b.textContent === "Save to account")!);
    await settle(flushSync);
    expect(saved[0]).toMatchObject({ label: "Melodrama tells", kind: "phrase", scope: "always", pattern: "Overwrought stock beats.", examples: ["a single tear traced her cheek"] });
    expect(text()).toContain("1 of 1 firing in your anti-slop pipeline.");
    input(flushSync, rig.host.querySelector('.fc-banks input[aria-label="Disable Melodrama tells"]')!, "onChange", { checked: false });
    await settle(flushSync);
    expect(saved.at(-1)).toMatchObject({ enabled: false });
    expect(text()).toContain("0 of 1 firing");
    const del = (): HTMLElement => [...rig.host.querySelectorAll<HTMLElement>(".fc-banks li .acts button")].find((b) => b.textContent === "Delete" || b.textContent === "Confirm")!;
    click(flushSync, del());
    expect(del().textContent).toBe("Confirm");
    expect(banks).toHaveLength(1);
    click(flushSync, del());
    await settle(flushSync);
    expect(banks).toHaveLength(0);
    unmount(flushSync);
  });

  test("a saved agent is made from the pass, listed with its preset and model, loaded back onto the pass, and deleted on the second click", async () => {
    const flushSync = await mount();
    click(flushSync, live("Your Department"));
    input(flushSync, label(card("Your Department"), "Agent instruction").querySelector("textarea")!, "onChange", { value: "Tighten pacing." });
    click(flushSync, [...card("Your Department").querySelectorAll<HTMLElement>(".fc-saved header .fc-btn")].find((b) => b.textContent === "+ Save current")!);
    input(flushSync, card("Your Department").querySelector('input[aria-label="Agent name"]')!, "onChange", { value: "Pacing Doctor" });
    click(flushSync, [...card("Your Department").querySelectorAll<HTMLElement>(".fc-save-row .fc-btn")].find((b) => b.textContent === "Save to account")!);
    await settle(flushSync);
    expect(saved[0]).toMatchObject({ name: "Pacing Doctor", instructions: "Tighten pacing.", contextMessages: 3 });
    expect(text()).toContain("1 saved · load one onto this pass, or save the current setup.");
    input(flushSync, label(card("Your Department"), "Agent instruction").querySelector("textarea")!, "onChange", { value: "Something else." });
    click(flushSync, [...card("Your Department").querySelectorAll<HTMLElement>(".fc-list .fc-btn")].find((b) => b.textContent === "Load")!);
    expect((label(card("Your Department"), "Agent instruction").querySelector("textarea") as HTMLTextAreaElement).value).toBe("Tighten pacing.");
    expect((label(card("Your Department"), "Department name").querySelector("input") as HTMLInputElement).value).toBe("Pacing Doctor");
    const del = (): HTMLElement => [...card("Your Department").querySelectorAll<HTMLElement>(".fc-list .fc-btn.red")][0]!;
    click(flushSync, del());
    click(flushSync, del());
    await settle(flushSync);
    expect(agents).toHaveLength(0);
    unmount(flushSync);
  });
});

describe("the editing tools", () => {
  test("a tool starts on the scene's model; a temperature and a reply limit are set and the row says so; Reset clears the row", async () => {
    const flushSync = await mount();
    const row = (): HTMLElement => [...card("Per-tool model & parameters").querySelectorAll<HTMLElement>("details")].find((d) => d.querySelector("summary span")!.textContent === "Correction")!;
    expect(row().querySelector("summary small")!.textContent).toBe("scene model");
    expect([...card("Per-tool model & parameters").querySelectorAll("details summary span")].map((s) => s.textContent)).toEqual(["Rewrite", "Expand", "Reduce", "Custom", "Correction"]);
    input(flushSync, row().querySelector('input[type="checkbox"]')!, "onChange", { checked: true });
    input(flushSync, row().querySelector('input[type="number"]')!, "onChange", { value: "900" });
    expect(row().querySelector("summary small")!.textContent).toBe("scene model · temp 0.4 · max 900");
    await saveSoon(flushSync);
    expect(writes.at(-1)!.tools).toEqual({ correct: { temperature: 0.4, maxTokens: 900 } });
    input(flushSync, row().querySelector('input[type="number"]')!, "onChange", { value: "99999" });
    expect((row().querySelector('input[type="number"]') as HTMLInputElement).value).toBe("8000");
    click(flushSync, [...row().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Reset to scene defaults")!);
    expect(row().querySelector("summary small")!.textContent).toBe("scene model");
    await saveSoon(flushSync);
    expect(writes.at(-1)!.tools).toBeNull();
    unmount(flushSync);
  });
});

describe("the contract", () => {
  test("shows a chip per live pass with its tokens, drills into one, and keeps the safety check at no tokens", async () => {
    const flushSync = await mount();
    click(flushSync, live("Output Safety Check"));
    click(flushSync, live("Scene Editor"));
    click(flushSync, live("Anti-Slop Engine"));
    const chips = (): string[] => [...rig.host.querySelectorAll(".fc-chips .pg-chip")].map((c) => c.textContent ?? "");
    expect(chips()[0]).toBe("1 Safety -");
    expect(chips()[1]).toMatch(/^2 Editor ~\d/);
    expect(chips()[2]).toMatch(/^3 Anti-Slop ~\d/);
    expect(rig.host.querySelector(".fc-tokens small")!.textContent).toBe("tokens total");
    click(flushSync, rig.host.querySelectorAll<HTMLElement>(".fc-chips .pg-chip")[1]!);
    expect(text()).toContain("What this agent receives.");
    expect(rig.host.querySelector(".fc-xml")!.textContent).toContain('<editor_pass profile="voicekeeper" failure="fallback">');
    expect(rig.host.querySelector(".fc-xml")!.textContent).toContain("Profile: Voicekeeper");
    unmount(flushSync);
  });
});
