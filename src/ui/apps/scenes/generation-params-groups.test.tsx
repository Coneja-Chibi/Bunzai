/**
 * The Generation tab's parameter groups (RoleCall's SamplerPanel): the four groups and their "N/M enabled" counts, a
 * switch written through the scene's one preset writer, the "Not sent to <provider>" marker, and the Custom Request
 * Parameters boxes refusing what the request cannot carry.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { useState, type JSX } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { ChatPreset } from "../../../stage/contracts/chat-store";
import type { ScenePresetOwn } from "./use-scene-preset-own";
import type { ProviderInfo } from "./generation-params-card";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true, extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const openai: ProviderInfo = { label: "OpenAI", accepts: new Set(["frequency_penalty", "seed"]) };

async function mount(initial: ChatPreset | null, provider: ProviderInfo | null = null, presetSamplers = {}, model?: string) {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { GenerationParamGroups } = await import("./generation-params-groups");
  const saves: ChatPreset[] = [];
  function Harness(): JSX.Element {
    const [own, setOwn] = useState<ChatPreset | null>(initial);
    const writer = { own, save: (next: ChatPreset) => { saves.push(next); setOwn(next); }, edit: (change: (p: ChatPreset) => ChatPreset) => { if (own) { const next = change(own); saves.push(next); setOwn(next); } }, setSamplerValue: () => undefined, saver: {} } as unknown as ScenePresetOwn;
    return <GenerationParamGroups own={writer} presetSamplers={presetSamplers} provider={provider} {...(model ? { model } : {})} />;
  }
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(<Harness />));
  const GROUP_IDS: Record<string, string> = { "Nucleus Sampling": "nucleus", "Repetition Penalties": "penalties", "Output Constraints": "constraints", Advanced: "advanced" };
  const click = (el: Element | null | undefined): void => flushSync(() => (el as HTMLElement).click());
  const group = (title: string) => host.querySelector(`[data-part="scene.generation.group.${GROUP_IDS[title]}"]`) as HTMLElement;
  const open = (title: string): void => { if (group(title).querySelector("[aria-expanded=false]")) click(group(title).querySelector("[data-control='disclosure']")); };
  const type = (el: HTMLTextAreaElement, value: string): void => {
    flushSync(() => {
      const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(el, value);
      el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  return { host, saves, click, group, open, type };
}
const own = (samplers: ChatPreset["samplers"] = {}): ChatPreset => ({ kind: "preset", id: "p", toggles: {}, samplers });
const counts = (host: HTMLElement) => [...host.querySelectorAll(".gp-group:not(.gp-custom) > [data-control='disclosure'] small")].map((e) => e.textContent);

describe("the groups", () => {
  test("four groups with RoleCall's counts and purposes, Nucleus open and the rest closed", async () => {
    const { host, group } = await mount(own());
    expect(counts(host)).toEqual(["0/6 enabled", "0/10 enabled", "0/7 enabled", "0/26 enabled"]);
    expect(host.textContent).toContain("Fine-grained word choice filters: Min P, Typical P, TFS, Top A.");
    expect(host.textContent).toContain("Beam search, behavioral, miscellaneous and experimental settings.");
    expect(group("Nucleus Sampling").querySelectorAll(".gp-card")).toHaveLength(6);
    expect(group("Advanced").querySelectorAll(".gp-card")).toHaveLength(0);
    expect(host.textContent).toContain("Custom Request Parameters");
    expect(host.textContent).toContain("Enable parameters to send them to your AI provider. Unsupported parameters are ignored.");
  });

  test("a card shows its key line, and its value control only while it is on", async () => {
    const { group, click } = await mount(own());
    const tfs = () => group("Nucleus Sampling").querySelector('[data-param="tfs"]')!;
    expect(tfs().querySelector(".gp-key")?.textContent).toBe("tfs_z · tail_free_sampling");
    expect(tfs().querySelector("input[type=range]")).toBeNull();
    click(tfs().querySelector("[role=switch]"));
    const range = tfs().querySelector<HTMLInputElement>("input[type=range]")!;
    expect([range.min, range.max, range.step, range.value]).toEqual(["0", "2", "0.01", "1"]);
  });

  test("a switch is one write through the scene's writer, and the count follows it", async () => {
    const { host, group, click, saves } = await mount(own());
    click(group("Nucleus Sampling").querySelector('[data-param="min_p"] [role=switch]'));
    expect(saves).toHaveLength(1);
    expect(saves[0]!.samplers.params).toEqual({ min_p: { on: true } });
    expect(counts(host)[0]).toBe("1/6 enabled");
    click(group("Nucleus Sampling").querySelector('[data-param="min_p"] [role=switch]'));
    expect(saves.at(-1)!.samplers.params).toEqual({});
    expect(counts(host)[0]).toBe("0/6 enabled");
  });

  test("a preset's own Min P shows as on, and switching it off is an explicit off for this scene", async () => {
    const { host, group, click, saves } = await mount(own(), null, { minP: 0.2 });
    expect(counts(host)[0]).toBe("1/6 enabled");
    click(group("Nucleus Sampling").querySelector('[data-param="min_p"] [role=switch]'));
    expect(saves[0]!.samplers.params).toEqual({ min_p: { on: false } });
  });

  test("the other groups open and count their own", async () => {
    const { host, open, group } = await mount(own({ params: { seed: { on: true, value: 4 }, early_stopping: { on: true, value: true } } }));
    expect(counts(host)[3]).toBe("2/26 enabled");
    open("Advanced");
    expect(group("Advanced").querySelector('[data-param="early_stopping"]')?.textContent).toContain("Send as: true");
  });

  test("a sub-toggle is greyed while its parent is off", async () => {
    const { open, group } = await mount(own());
    open("Advanced");
    expect(group("Advanced").querySelector('[data-param="clear_thinking"]')?.classList.contains("greyed")).toBe(true);
  });
});

describe("the provider marker", () => {
  test("a parameter the provider does not accept says it is not sent to it", async () => {
    const { group } = await mount(own(), openai);
    const note = (id: string) => group("Nucleus Sampling").querySelector(`[data-param="${id}"] [data-part="scene.generation.not-sent"]`)?.textContent;
    expect(note("min_p")).toBe("Not sent to OpenAI");
    expect(note("tfs")).toBe("Not sent to OpenAI");
  });
  test("one it accepts carries no marker, and with no provider known nothing is claimed", async () => {
    const a = await mount(own(), openai);
    a.open("Repetition Penalties");
    expect(a.group("Repetition Penalties").querySelector('[data-param="frequency_penalty"] [data-part="scene.generation.not-sent"]')).toBeNull();
    const b = await mount(own(), null);
    expect(b.host.querySelector('[data-part="scene.generation.not-sent"]')).toBeNull();
  });
});

describe("a scene with no preset", () => {
  test("says where the settings belong and writes nothing", async () => {
    const { host } = await mount(null);
    expect(host.textContent).toContain("Choose one in Prompting.");
    expect(host.querySelector(".gp-group")).toBeNull();
  });
});

describe("Custom Request Parameters", () => {
  test("valid JSON saves, and blank text clears the field", async () => {
    const { host, click, type, saves } = await mount(own());
    click(host.querySelector(".gp-custom [data-control='disclosure']"));
    const body = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Include Body Parameters"]')!;
    type(body, '{"top_k": 40}');
    expect(saves.at(-1)!.samplers.customBody).toBe('{"top_k": 40}');
    type(body, "");
    expect(saves.at(-1)!.samplers.customBody).toBeUndefined();
  });

  test("text that is not JSON, or sets a protected field, is said and not saved", async () => {
    const { host, click, type, saves } = await mount(own());
    click(host.querySelector(".gp-custom [data-control='disclosure']"));
    const body = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Include Body Parameters"]')!;
    type(body, "top_k: 40");
    expect(host.querySelector(".gp-custom .gp-hint.bad")?.textContent).toContain("not valid JSON");
    type(body, '{"stream": true}');
    expect(host.querySelector(".gp-custom .gp-hint.bad")?.textContent).toContain("stream is a protected request field");
    expect(saves).toHaveLength(0);
  });

  test("an exclusion of a protected field is refused too", async () => {
    const { host, click, type, saves } = await mount(own());
    click(host.querySelector(".gp-custom [data-control='disclosure']"));
    type(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Exclude Body Parameters"]')!, "temperature\nmodel");
    expect(host.querySelector(".gp-custom .gp-hint.bad")?.textContent).toContain("model is a protected request field");
    expect(saves).toHaveLength(0);
  });
});

describe("the Logit Bias manager", () => {
  const entry = (text: string, value = -50) => ({ id: "e1", text, value });
  const withBias = (entries: unknown[]) => own({ params: { logit_bias: { on: true, value: { entries } as never } } });
  const typeInput = (host: HTMLElement, el: HTMLInputElement, value: string): void => {
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    set.call(el, value);
    el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    void host;
  };

  test("Add Entry, typing a word and a bias, and Remove write through the one writer", async () => {
    const { host, open, click, saves } = await mount(own({ params: { logit_bias: { on: true } } }), null, {}, "gpt-4o");
    open("Output Constraints");
    expect(host.textContent).toContain("No logit bias entries");
    click([...host.querySelectorAll<HTMLButtonElement>(".gp-bias-btns button")].find((b) => b.textContent === "Add Entry"));
    const entries = () => (saves.at(-1)!.samplers.params!["logit_bias"]!.value as { entries: { text: string; value: number }[] }).entries;
    expect(entries()).toHaveLength(1);
    const { flushSync } = await import("react-dom");
    flushSync(() => typeInput(host, host.querySelector<HTMLInputElement>('input[aria-label="Logit bias text"]')!, "cat"));
    flushSync(() => typeInput(host, host.querySelector<HTMLInputElement>('input[aria-label="Bias"]')!, "-50"));
    expect(entries()[0]).toMatchObject({ text: "cat", value: -50 });
    expect(host.querySelector(".gp-bias-prev")?.textContent).toMatch(/^\[\d+/);
    expect(host.textContent).toMatch(/1 entry → \d+ tokens? biased/);
    click(host.querySelector('button[aria-label="Remove entry"]'));
    expect(entries()).toHaveLength(0);
  });

  test("a model with no exact tokenizer says so for words, and token ids need no tokenizer", async () => {
    const words = await mount(withBias([entry("cat")]), null, {}, "claude-opus-4-8");
    words.open("Output Constraints");
    expect(words.host.querySelector('[data-part="scene.generation.bias-note"]')?.textContent).toContain("none of these entries is sent");
    expect(words.host.querySelector(".gp-bias-prev")?.textContent).toBe("no exact tokenizer for this model");
    const ids = await mount(withBias([entry("[1234]")]), null, {}, "claude-opus-4-8");
    ids.open("Output Constraints");
    expect(ids.host.querySelector('[data-part="scene.generation.bias-note"]')).toBeNull();
    expect(ids.host.querySelector(".gp-bias-prev")?.textContent).toBe("[1234]");
  });

  test("the raw JSON path replaces the entries with raw-id entries and refuses a bad bias", async () => {
    const { host, open, click, type, saves } = await mount(withBias([entry("[7]", 5)]), null, {}, "gpt-4o");
    open("Output Constraints");
    click([...host.querySelectorAll<HTMLButtonElement>(".gp-bias button")].find((b) => b.textContent?.startsWith("Raw JSON")));
    const box = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Logit bias raw JSON"]')!;
    expect(JSON.parse(box.value)).toEqual({ "7": 5 });
    type(box, '{"1234": 900}');
    expect(host.querySelector(".gp-bias .gp-hint.bad")?.textContent).toContain("-100 to 100");
    expect(saves).toHaveLength(0);
    type(box, '{"1234": -50}');
    expect((saves.at(-1)!.samplers.params!["logit_bias"]!.value as { entries: { text: string; value: number }[] }).entries.map((e) => [e.text, e.value])).toEqual([["[1234]", -50]]);
  });
});
