/** @jsxImportSource @opentui/react */
/** Public block-editor regressions for typed replacement across grapheme-joining boundaries. */
import { describe, expect, spyOn, test } from "bun:test";
import type { ReactNode } from "react";
import { BlockEditor } from "./block-editor";
import { textOf } from "./text-buffer";
import { useBlockEditor } from "./use-block-editor";
import { settleRender, testRender } from "../test-render";
import * as clipboard from "../clipboard-read";

describe("BlockEditor typed input", () => {
  test("a deferred paste replaces the captured selection before clearing it", async () => {
    let editor: ReturnType<typeof useBlockEditor> | null = null;
    let release!: (text: string) => void;
    const reader = spyOn(clipboard, "readClipboardText").mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    function Harness(): ReactNode {
      const session = useBlockEditor(() => {}, () => {});
      editor = session;
      return <BlockEditor session={session} width={80} height={16} />;
    }
    const rendered = await testRender(<Harness />, { width: 80, height: 16 });
    try {
      await settleRender();
      editor!.open({ blockId: "b1", title: "Greeting" }, "abcd");
      await settleRender();
      editor!.placeCursor(0, 1);
      editor!.placeCursor(0, 3, true);
      await settleRender();
      editor!.handleKey({ name: "v", ctrl: true });
      const pending = settleRender();
      editor!.placeCursor(0, 3, true);
      release("X");
      await pending;
      expect(textOf(editor!.buffer)).toBe("aXd");
      expect(editor!.anchor).toBeNull();
    } finally {
      reader.mockRestore();
      await rendered.renderer.destroy();
    }
  });
  test("typing over a newline selection composes at the original seam before moving the caret", async () => {
    let editor: ReturnType<typeof useBlockEditor> | null = null;
    function Harness(): ReactNode {
      const session = useBlockEditor(() => {}, () => {});
      editor = session;
      return <BlockEditor session={session} width={80} height={16} />;
    }

    const rendered = await testRender(<Harness />, { width: 80, height: 16 });
    try {
      await settleRender();
      editor!.open({ blockId: "b1", title: "Greeting" }, "a\n\u0301b");
      await settleRender();
      editor!.placeCursor(0, 1);
      editor!.placeCursor(1, 0, true);
      await settleRender();
      await rendered.mockInput.typeText("x");
      await settleRender();

      expect(textOf(editor!.buffer)).toBe("ax\u0301b");
      expect([editor!.buffer.row, editor!.buffer.col]).toEqual([0, 3]);
      expect(rendered.captureCharFrame()).toContain("ax\u0301b");
    } finally {
      await rendered.renderer.destroy();
    }
  });

  test("typing before multiple combining marks keeps subsequent input after the grapheme", async () => {
    let editor: ReturnType<typeof useBlockEditor> | null = null;
    function Harness(): ReactNode {
      const session = useBlockEditor(() => {}, () => {});
      editor = session;
      return <BlockEditor session={session} width={80} height={16} />;
    }

    const rendered = await testRender(<Harness />, { width: 80, height: 16 });
    try {
      await settleRender();
      editor!.open({ blockId: "b1", title: "Greeting" }, "\u0301\u0302b");
      await settleRender();
      editor!.placeCursor(0, 0);
      await settleRender();
      await rendered.mockInput.typeText("ax");
      await settleRender();

      expect(textOf(editor!.buffer)).toBe("a\u0301\u0302xb");
      expect([editor!.buffer.row, editor!.buffer.col]).toEqual([0, 4]);
    } finally {
      await rendered.renderer.destroy();
    }
  });
});
