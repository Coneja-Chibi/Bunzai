/** Theme reveal samples a host-owned preview token without painting an unverified theme. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { canvasColorFor } from "./overlay-reveal";

let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html data-theme='paper'><head><style>:root{--preview-paper-canvas:#f8f2f5;--preview-theater-canvas:#0a0a0b}</style></head><body></body></html>", {
    url: "http://127.0.0.1:8324/",
    extraGlobals: ["getComputedStyle"],
    boundGlobals: ["getComputedStyle"],
  });
});
afterAll(() => installed.teardown());

test("reads the built-in preview canvas without changing the active theme", () => {
  const root = document.documentElement;
  expect(canvasColorFor("theater", root)).toBe("#0a0a0b");
  expect(root.dataset.theme).toBe("paper");
});
