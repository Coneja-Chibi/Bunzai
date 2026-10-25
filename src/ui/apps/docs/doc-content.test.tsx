/**
 * The reader pane's jump to an anchor: a scroll queued for the next frame is cancelled when the pane goes, so it never runs
 * against a page (or a test document) that is no longer there. The full suite once failed on exactly that queued frame.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { DocRecord } from "../../docs-types";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { DocContent } from "./doc-content";

let installed: InstalledDom;
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://127.0.0.1:8321/",
    globals: {
      requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(nextFrame, callback); return nextFrame++; },
      cancelAnimationFrame: (id: number) => { frames.delete(id); },
    },
  });
});

afterAll(() => installed.teardown());

const doc: DocRecord = { id: "guide/a", path: "docs/guide/a.md", title: "A", audience: "user", summary: "", semanticSummary: "", topics: [], tags: [], related: [], anchors: [] };

test("a jump queued for a pane that unmounts before the next frame is cancelled", () => {
  const root = createRoot(document.getElementById("root")!);
  act(() => root.render(<DocContent doc={doc} docs={[doc]} figures={[]} body={"## Part\n\ntext"} anchor="part" loading={false} onPick={() => undefined} />));
  expect(frames.size).toBe(1);
  act(() => root.unmount());
  expect(frames.size).toBe(0);
});
