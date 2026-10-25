/**
 * editor.frame and editor.fields: every registered variant has its stylesheet, every rule sits under its own root
 * attribute and stays square, colorless and complete, and the shared editor header carries the hook the frame
 * variants select while keeping its name, Save and the pane's top-right slot.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SURFACES } from "../../../extensions/surface-registry";
import { EditorEhead } from "../../components/editor-ehead";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { variantCssProblems } from "../../_shared/variant-css-check";
import { EDITOR_VARIANTS_STYLE } from "./variants-style";

const base = new URL("./variants/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("editor variant stylesheets", () => {
  test("every registered variant of both surfaces has its stylesheet", () => {
    for (const surface of ["editor.frame", "editor.fields"] as const) for (const variant of SURFACES[surface]) expect(existsSync(`${base}${surface}/${variant}.ts`), `${surface}/${variant}`).toBe(true);
  });

  test("every rule is scoped to its variant root and the editor frame, square, colorless, focus-safe, hiding nothing", () => {
    expect(variantCssProblems(EDITOR_VARIANTS_STYLE, /^html\[data-surface-editor-(frame|fields)="[a-z-]+"\] \[data-editor="[a-z]+"\]/, /(button|input|textarea|select|label)$/)).toEqual([]);
  });

  test("no field variant styles the header's own controls (the name input stamped over the meta line under GirliePop)", () => {
    const fieldRules = EDITOR_VARIANTS_STYLE.split(String.fromCharCode(10)).filter((rule) => rule.includes(":is(input"));
    expect(fieldRules.length).toBe(4);
    for (const rule of fieldRules) expect(rule).toContain(':not([data-editor="head"] *)');
  });

  test("labeled-rows fields shrink with their grid cell and carry their own surface (a three-up row overlapped its labels on a white box)", () => {
    const rule = EDITOR_VARIANTS_STYLE.split(String.fromCharCode(10)).find((r) => r.includes("labeled-rows") && r.includes(":is(input")) ?? "";
    expect(rule).toContain("min-width:0");
    expect(rule).toContain("max-width:100%");
    expect(rule).toContain("background:var(--bk-surface-ink)");
    const grid = EDITOR_VARIANTS_STYLE.split(String.fromCharCode(10)).find((r) => r.includes("labeled-rows") && r.includes("[data-ef=\"field\"]{display:grid")) ?? "";
    expect(grid, "label column scales down in a narrow cell").toContain("clamp(");
  });

  test("the variants only select inside an editor frame or its header", () => {
    expect(EDITOR_VARIANTS_STYLE).not.toMatch(/data-surface-editor-[a-z]+="[a-z-]+"\] (?!\[data-editor)/);
  });
});

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8328/", extraGlobals: ["SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

test("the shared editor header carries the head hook and keeps name, Save and the top-right slot", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  let saved = 0;
  await act(async () => {
    tree.render(<EditorEhead mark="R" name="Rules" meta="3 rules" dirty saving={false} onSave={() => { saved++; }} topRight={<button type="button">Close</button>} />);
  });
  const head = host.querySelector('[data-editor="head"]');
  expect(head?.tagName).toBe("HEADER");
  expect(head?.textContent).toContain("Rules");
  expect(head?.textContent).toContain("Close");
  await act(async () => { (head!.querySelector("button[title^='Save']") as HTMLElement).click(); });
  expect(saved).toBe(1);
  await act(async () => { tree.unmount(); });
  host.remove();
});
