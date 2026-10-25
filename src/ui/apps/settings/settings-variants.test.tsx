/**
 * settings.shape: every registered variant has its stylesheet, every rule sits under its own root attribute and
 * stays square, colorless and complete, and the parts the variants restyle (a row with its label and hint, the
 * segmented control with its pressed state) carry their hooks, so a variant reaches them and cannot hide one.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SURFACES } from "../../../extensions/surface-registry";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { variantCssProblems } from "../../_shared/variant-css-check";
import { SegControl, SettingsRow } from "./section-contract";
import { SETTINGS_VARIANTS_STYLE } from "./variants-style";

const dir = new URL("./variants/settings.shape/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("settings.shape stylesheets", () => {
  test("every registered variant has its stylesheet", () => {
    for (const variant of SURFACES["settings.shape"]) expect(existsSync(`${dir}${variant}.ts`), variant).toBe(true);
  });

  test("every rule is scoped to its variant root, square, colorless, focus-safe, and hides no control", () => {
    expect(variantCssProblems(SETTINGS_VARIANTS_STYLE, /^html\[data-surface-settings-shape="[a-z-]+"\] \[data-sx=/, /\[data-sx="(tabs|tab|body|row|seg)"\]$/)).toEqual([]);
  });
});

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", extraGlobals: ["SVGElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

test("a row and a segmented control carry the hooks the variants select", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  const picked: string[] = [];
  await act(async () => {
    tree.render(<SettingsRow label="Density" hint="How tight."><SegControl options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} current="b" onPick={(v) => picked.push(v)} /></SettingsRow>);
  });
  for (const part of ["row", "label", "hint", "seg"]) expect(host.querySelector(`[data-sx="${part}"]`), part).not.toBeNull();
  expect(host.querySelector('[data-sx="label"]')?.textContent).toBe("Density");
  expect(host.querySelector('[data-sx="hint"]')?.textContent).toBe("How tight.");
  const buttons = [...host.querySelectorAll('[data-sx="seg"] button')] as HTMLElement[];
  expect(buttons.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([["A", "false"], ["B", "true"]]);
  await act(async () => { buttons[0]!.click(); });
  expect(picked).toEqual(["a"]);
  await act(async () => { tree.unmount(); });
  host.remove();
});
