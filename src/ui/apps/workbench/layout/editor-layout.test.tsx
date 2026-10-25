/**
 * EditorLayout and EditorField render tests, per frame and per fields variant: every section and every field
 * stays in the document in all five frames, the menu frames move with the keyboard and keep the closed sections
 * mounted (local state survives), and the stat-sheet meter appears only in stat-sheet.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act, useState, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { SURFACES } from "../../../../extensions/surface-registry";
import { installDom, setSurfacePicks, type InstalledDom } from "../../../_shared/test-dom";
import { EditorField } from "./editor-field";
import { EditorLayout } from "./editor-layout";
import type { EditorSection } from "./editor-layout-core";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8328/", extraGlobals: ["SVGElement", "KeyboardEvent", "MutationObserver"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

function Counter(): JSX.Element {
  const [n, setN] = useState(0);
  return <button type="button" onClick={() => setN(n + 1)}>{`clicks ${n}`}</button>;
}

const sections: EditorSection[] = [
  { id: "id", title: "Identity", filled: true, node: <EditorField label="Tagline" htmlFor="tag"><input id="tag" /></EditorField> },
  { id: "body", title: "Body", dim: true, node: <><EditorField label="Age" meter={{ value: 30, min: 0, max: 100 }}><Counter /></EditorField></> },
  { id: "more", title: "More", column: 2, node: <EditorField label="Notes" wide><textarea aria-label="Notes" /></EditorField> },
];

async function mount(frame: string, fields: string): Promise<{ host: HTMLElement; unmount(): Promise<void> }> {
  setSurfacePicks(frame === "core" ? {} : { "editor.frame": frame, "editor.fields": fields });
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  await act(async () => { tree.render(<EditorLayout label="Persona sections" sections={sections} rail={<div>portrait rail</div>} />); });
  return { host, unmount: async () => { await act(async () => { tree.unmount(); }); host.remove(); setSurfacePicks({}); } };
}

const frames = ["core", ...SURFACES["editor.frame"]];

describe("every frame keeps every section, field and the rail in the document", () => {
  for (const frame of frames) {
    test(frame, async () => {
      const { host, unmount } = await mount(frame, "labeled-rows");
      for (const text of ["Identity", "Body", "More", "Tagline", "Age", "Notes", "portrait rail"]) expect(host.textContent, `${frame}: ${text}`).toContain(text);
      expect(host.querySelector("#tag")).not.toBeNull();
      expect(host.querySelector('textarea[aria-label="Notes"]')).not.toBeNull();
      await unmount();
    });
  }
});

describe("menu frames", () => {
  for (const frame of ["two-pane", "tabbed-menu"]) {
    test(`${frame}: one section open, arrows move and focus the tab, closed sections stay mounted`, async () => {
      const { host, unmount } = await mount(frame, "labeled-rows");
      const tabs = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
      expect(tabs.map((t) => t.textContent)).toEqual(["1Identity", "2Body", "3More"]);
      const open = (): string[] => [...host.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.querySelector("h3")!.textContent!);
      expect(open()).toEqual(["Identity"]);
      expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
      await act(async () => { tabs[0]!.focus(); tabs[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); });
      expect(open()).toEqual(["Body"]);
      expect(document.activeElement === tabs[1]).toBe(true);
      await act(async () => { tabs[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })); });
      expect(open()).toEqual(["More"]);
      await act(async () => { tabs[1]!.click(); });
      const counter = [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("clicks"))!;
      await act(async () => { counter.click(); });
      await act(async () => { tabs[0]!.click(); });
      await act(async () => { tabs[1]!.click(); });
      expect([...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("clicks"))!.textContent).toBe("clicks 1");
      await unmount();
    });
  }
});

test("card-stack shows every section at once, each its own card with a heading", async () => {
  const { host, unmount } = await mount("card-stack", "cards");
  expect([...host.querySelectorAll("section h3")].map((h) => h.textContent)).toEqual(["Identity", "Body", "More"]);
  expect(host.querySelectorAll("[hidden]").length).toBe(0);
  await unmount();
});

test("long-form lists a contents margin whose buttons focus their section", async () => {
  const { host, unmount } = await mount("long-form", "form-on-paper");
  const entries = [...host.querySelectorAll<HTMLElement>("nav button")];
  expect(entries.length).toBe(3);
  await act(async () => { entries[2]!.click(); });
  expect(document.activeElement?.tagName).toBe("SECTION");
  expect(document.activeElement?.textContent).toContain("More");
  await unmount();
});

describe("fields", () => {
  for (const fields of SURFACES["editor.fields"]) {
    test(`${fields}: label, control and hint present; meter only in stat-sheet`, async () => {
      const { host, unmount } = await mount("card-stack", fields);
      expect(host.querySelector('label[for="tag"]')?.textContent).toBe("Tagline");
      expect(host.querySelector('[role="group"][aria-labelledby]')).not.toBeNull();
      expect(host.querySelector('[role="meter"]') !== null).toBe(fields === "stat-sheet");
      if (fields === "stat-sheet") expect((host.querySelector('[data-ef="meter"] i') as HTMLElement).style.width).toBe("30%");
      await unmount();
    });
  }
});

test("the core frame is the bento of titled cards", async () => {
  const { host, unmount } = await mount("core", "labeled-rows");
  expect(host.querySelector('[data-frame="core"]')).not.toBeNull();
  expect(host.querySelectorAll('[role="tab"]').length).toBe(0);
  await unmount();
});

describe("controlled active section and rail width", () => {
  async function mountWith(props: { active?: string | null; onActiveChange?: (id: string) => void; railWidth?: "narrow" | "wide" }): Promise<{ host: HTMLElement; rerender(p: typeof props): Promise<void>; unmount(): Promise<void> }> {
    setSurfacePicks({ "editor.frame": "tabbed-menu", "editor.fields": "labeled-rows" });
    const host = document.createElement("div");
    document.body.append(host);
    const tree = createRoot(host);
    const draw = async (p: typeof props): Promise<void> => { await act(async () => { tree.render(<EditorLayout label="Persona sections" sections={sections} rail={<div>rail</div>} {...p} />); }); };
    await draw(props);
    return { host, rerender: draw, unmount: async () => { await act(async () => { tree.unmount(); }); host.remove(); setSurfacePicks({}); } };
  }
  const openTitles = (host: HTMLElement): string[] => [...host.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.querySelector("h3")!.textContent!);

  test("the caller's active wins, a pick is reported but does not move it, and a new active moves it", async () => {
    const picked: string[] = [];
    const m = await mountWith({ active: "body", onActiveChange: (id) => picked.push(id) });
    expect(openTitles(m.host)).toEqual(["Body"]);
    await act(async () => { m.host.querySelectorAll<HTMLElement>('[role="tab"]')[2]!.click(); });
    expect(picked).toEqual(["more"]);
    expect(openTitles(m.host)).toEqual(["Body"]);
    await m.rerender({ active: "more", onActiveChange: (id) => picked.push(id) });
    expect(openTitles(m.host)).toEqual(["More"]);
    await m.unmount();
  });

  test("an unknown controlled id falls back to the first section", async () => {
    const m = await mountWith({ active: "gone" });
    expect(openTitles(m.host)).toEqual(["Identity"]);
    await m.unmount();
  });

  test("uncontrolled still works and reports picks", async () => {
    const picked: string[] = [];
    const m = await mountWith({ onActiveChange: (id) => picked.push(id) });
    await act(async () => { m.host.querySelectorAll<HTMLElement>('[role="tab"]')[1]!.click(); });
    expect(openTitles(m.host)).toEqual(["Body"]);
    expect(picked).toEqual(["body"]);
    await m.unmount();
  });

  test("railWidth reaches the layout, narrow by default", async () => {
    const wide = await mountWith({ railWidth: "wide" });
    expect(wide.host.querySelector('[data-ef="layout"]')!.getAttribute("data-rail")).toBe("wide");
    await wide.unmount();
    const plain = await mountWith({});
    expect(plain.host.querySelector('[data-ef="layout"]')!.getAttribute("data-rail")).toBe("narrow");
    await plain.unmount();
  });

  test("a layout with no rail says so, so the menu frames do not reserve an empty column", async () => {
    setSurfacePicks({ "editor.frame": "tabbed-menu" });
    const host = document.createElement("div");
    document.body.append(host);
    const tree = createRoot(host);
    await act(async () => { tree.render(<EditorLayout label="x" sections={sections} />); });
    expect(host.querySelector('[data-ef="layout"]')!.getAttribute("data-rail")).toBe("none");
    await act(async () => { tree.unmount(); });
    host.remove();
    setSurfacePicks({});
  });
});
