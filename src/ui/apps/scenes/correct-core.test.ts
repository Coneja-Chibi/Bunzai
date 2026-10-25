/** The Correction Tools' pure rules (correct-core.ts): which guides Corrections lists, how a Rewrite replaces only the passage, and what Apply writes. */
import { describe, expect, test } from "bun:test";
import { textRange } from "../../../core/draft-prompts";
import type { GuideRecord } from "../../../core/guide-record";
import { applied, correctionGuides, selectionPreview } from "./correct-core";

const guide = (id: string, over: Partial<GuideRecord> = {}): GuideRecord => ({
  id, title: id, content: id, type: "guide", category: "situational", role: "user", mode: "standard", depth: null, target: null, side: null, visible: true, createdAt: 1, updatedAt: 1, ...over,
});
const LIBRARY = [guide("g1", { type: "correction" }), guide("g2"), guide("g3", { type: "correction", visible: false }), guide("g4", { type: "spellcheck" })];

describe("what the tabs list and write", () => {
  test("Corrections lists visible correction guides only", () => {
    expect(correctionGuides(LIBRARY).map((g) => g.id)).toEqual(["g1"]);
  });

  test("a rewrite replaces only the highlighted passage, and Delete is an empty replacement", () => {
    const range = textRange("She walked quickly home.", 4, 18)!;
    expect(range.text).toBe("walked quickly");
    expect(selectionPreview("She walked quickly home.", range, "strode").corrected).toBe("She strode home.");
    expect(selectionPreview("She walked quickly home.", range, "").corrected).toBe("She  home.");
    expect(textRange("a  b", 1, 3)).toBeNull();
    expect(textRange("hello", 3, 99)!.text).toBe("lo");
  });

  test("Apply writes Spellcheck and Corrections trimmed, and a Rewrite as it is", () => {
    expect(applied({ kind: "spellcheck", original: "a", corrected: "  b \n" })).toBe("b");
    expect(applied({ kind: "rewrite", original: "a", corrected: "b ", selected: "a", replacement: "b" })).toBe("b ");
  });
});
