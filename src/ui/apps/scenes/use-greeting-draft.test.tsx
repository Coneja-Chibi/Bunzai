/** The opening message edit: per greeting, an empty save ignored, saved through `keep`, shown from what the scene holds. */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ChatOpening } from "../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { useGreetingDraft, type GreetingDraft } from "./use-greeting-draft";

let installed: InstalledDom;
let tree: Root | null = null;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/", globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterEach(async () => { const t = tree; tree = null; await act(async () => { t?.unmount(); }); });
afterAll(() => installed.teardown());

type Props = { greetings: string[]; index: number; saved: ChatOpening | undefined };
async function mount(initial: Props): Promise<{ now(): GreetingDraft; kept: (ChatOpening | null)[]; rerender(p: Partial<Props>): Promise<void> }> {
  let current!: GreetingDraft;
  let cur = initial;
  const kept: (ChatOpening | null)[] = [];
  const keep = (o: ChatOpening | null): void => { kept.push(o); };
  const Probe = (p: Props) => { current = useGreetingDraft(p.greetings, p.index, p.saved, keep); return null; };
  tree = createRoot(document.createElement("div"));
  await act(async () => { tree!.render(createElement(Probe, cur)); });
  return { now: () => current, kept, rerender: async (p) => { cur = { ...cur, ...p }; await act(async () => { tree!.render(createElement(Probe, cur)); }); } };
}

test("opens on the raw greeting, or on what the scene holds for it after a reload; a save keeps the trimmed edit with the others", async () => {
  const h = await mount({ greetings: ["Hello {{user}}.", "Other."], index: 0, saved: { edits: [{ index: 1, text: "Kept." }] } });
  expect(h.now().raw).toBe("Hello {{user}}.");
  await act(async () => h.now().start());
  expect(h.now().editing).toBe("Hello {{user}}.");
  await act(async () => h.now().change("greeting", "  Mine.  "));
  await act(async () => h.now().save());
  expect(h.kept).toEqual([{ edits: [{ index: 0, text: "Mine." }, { index: 1, text: "Kept." }] }]);
  expect(h.now().editing).toBeUndefined();
  await h.rerender({ index: 1 });
  expect(h.now().raw).toBe("Kept.");
});

test("an empty save is ignored and the box stays open; cancel drops the edit and keeps nothing", async () => {
  const h = await mount({ greetings: ["Hello."], index: 0, saved: undefined });
  await act(async () => h.now().start());
  await act(async () => h.now().change("greeting", "   "));
  await act(async () => h.now().save());
  expect(h.now().editing).toBe("   ");
  expect(h.kept).toEqual([]);
  await act(async () => h.now().cancel());
  expect(h.now().editing).toBeUndefined();
  expect(h.kept).toEqual([]);
});

test("saving the card's own text removes the edit, and the last edit going clears the field", async () => {
  const h = await mount({ greetings: ["Hello."], index: 0, saved: { edits: [{ index: 0, text: "Mine." }] } });
  await act(async () => h.now().start());
  await act(async () => h.now().change("greeting", "Hello."));
  await act(async () => h.now().save());
  expect(h.kept).toEqual([null]);
});
