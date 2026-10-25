/** The recovery words, key and proof flows in Settings > Security are protected prompts: a modal in the top layer, not a block in the page. */
import { afterAll, afterEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { installDom, flushTasks } from "../../../_shared/test-dom";
import security from "./security";

const installed = installDom('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, extraGlobals: ["Event", "HTMLDialogElement", "HTMLButtonElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
afterAll(() => installed.teardown());
const realFetch = globalThis.fetch;
let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; globalThis.fetch = realFetch; });

const status = { phase: "unlocked", hasPassword: true, hasWords: true, wordsWrittenAt: 1 };
const answer = (url: string): unknown => (url.includes("/computers") ? [] : status);

test("a security flow opens as a protected dialog on the body, and the section itself stays inline", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => new Response(JSON.stringify(answer(String(input))), { headers: { "content-type": "application/json" } })) as typeof fetch;
  const host = document.getElementById("root")!;
  root = createRoot(host);
  await act(async () => { root!.render(createElement(security.Component)); });
  await act(async () => { await flushTasks(); });
  expect(host.querySelector(".host-protected")).not.toBeNull();
  expect(document.querySelector("dialog")).toBeNull();
  const open = [...host.querySelectorAll("button")].find((b) => /lines/i.test(b.textContent ?? ""));
  expect(open, "a button that opens a lines flow").toBeDefined();
  await act(async () => { open!.click(); });
  const dialog = document.querySelector("dialog.host-protected") as (HTMLDialogElement & { modal?: boolean }) | null;
  expect(dialog).not.toBeNull();
  expect(dialog!.open && dialog!.modal).toBe(true);
  expect(dialog!.parentElement).toBe(document.body);
  expect(host.querySelector("dialog")).toBeNull();
});
