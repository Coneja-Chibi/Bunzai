/**
 * The guide editor's Type select (plan F15): Advanced holds RoleCall's five types, a pick lands in the guide
 * that Save sends, and a guide typed "correction" is what Correct's Corrections tab lists. Without it nothing
 * in a scene could ever make one.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { GUIDE_TYPES } from "../../../core/guide-record";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { correctionGuides } from "./correct-core";
import { draftOf } from "./guides-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/", pretendToBeVisual: true });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

test("Advanced offers every guide type, and picking Correction puts it in the guide being saved", async () => {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { GuideEditor } = await import("./scene-guide-editor");
  const changes: ReturnType<typeof draftOf>[] = [];
  const draft = { ...draftOf(), title: "Tense", content: "Use past tense." };
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(
    <GuideEditor draft={draft} creating on={false} busy={false} error={null} onChange={(d) => void changes.push(d)} onToggleOn={() => undefined} onDuplicate={() => undefined} onDelete={async () => undefined} onCancel={() => undefined} onSave={() => undefined} />,
  ));
  expect(host.querySelector("select[aria-label='Guide type']")).toBeNull();
  flushSync(() => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Advanced"))!.click());
  const select = host.querySelector<HTMLSelectElement>("select[aria-label='Guide type']")!;
  expect([...select.options].map((o) => o.value)).toEqual([...GUIDE_TYPES]);
  expect(select.value).toBe("guide");
  const key = Object.keys(select).find((k) => k.startsWith("__reactProps$"))!;
  flushSync(() => (select as unknown as Record<string, { onChange(e: { target: { value: string } }): void }>)[key]!.onChange({ target: { value: "correction" } }));
  expect(changes.at(-1)).toMatchObject({ title: "Tense", type: "correction" });
  expect(host.textContent).toContain("General purpose guided response");
});

test("a guide made a correction shows up in Corrections, and an existing guide keeps its type when edited", () => {
  const base = { ...draftOf(), title: "Tense", content: "Use past tense." };
  expect(draftOf({ ...base, id: "g", createdAt: 1, updatedAt: 1, type: "correction" }).type).toBe("correction");
  const record = (type: (typeof GUIDE_TYPES)[number]) => ({ ...base, type, id: type, createdAt: 1, updatedAt: 1 });
  expect(correctionGuides(GUIDE_TYPES.map(record)).map((g) => g.id)).toEqual(["correction"]);
});
