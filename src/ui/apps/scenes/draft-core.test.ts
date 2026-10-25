/** The draft strip's words and the polish outcome (draft-core.ts). */
import { describe, expect, test } from "bun:test";
import { polishOutcome, ribbonCopy } from "./draft-core";

describe("copy and outcomes", () => {
  test("the ribbons say RoleCall's words without its glyphs", () => {
    expect(ribbonCopy({ tag: "working", kind: "impersonate" }, "Mira")).toEqual({ eyebrow: "Writing as Mira", helper: "Drafting your message, landing in the input shortly." });
    expect(ribbonCopy({ tag: "working", kind: "polish" }, "Mira")).toEqual({ eyebrow: "Polishing your draft", helper: "Spell + grammar pass, landing in the input shortly." });
    expect(ribbonCopy({ tag: "landed" }, "Mira")!.eyebrow).toBe("Writing as Mira");
    expect(ribbonCopy({ tag: "idle" }, "Mira")).toBeNull();
  });

  test("a polish that changes nothing is a note, a change keeps the original", () => {
    expect(polishOutcome("Hi there.", "Hi there.  ")).toEqual({ tag: "note", text: "Nothing to fix." });
    expect(polishOutcome("hi there", "Hi there.")).toEqual({ tag: "compare", before: "hi there", after: "Hi there." });
  });
});
