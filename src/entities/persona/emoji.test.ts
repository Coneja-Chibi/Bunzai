/** The persona emoji rule: one emoji cluster, short, nothing else. */
import { expect, test } from "bun:test";
import { parseCanonicalEntity } from "../runtime-schema";
import { isPersonaEmoji } from "./emoji";

test("accepts one emoji however many code points it takes", () => {
  for (const ok of ["\u{1F989}", "\u{1F469}\u200D\u{1F4BB}", "\u{1F1EF}\u{1F1F5}", "\u{1F44B}\u{1F3FD}", "\u2764\uFE0F", "1\uFE0F\u20E3"]) expect(isPersonaEmoji(ok), ok).toBe(true);
});

test("rejects text, several emoji, nothing, and anything past 32 units", () => {
  for (const bad of ["", "owl", "a", "\u{1F989}\u{1F989}", "\u{1F989} hi", "<b>", "\u{1F469}\u200D".repeat(20) + "\u{1F4BB}", "x".repeat(200)]) expect(isPersonaEmoji(bad), JSON.stringify(bad)).toBe(false);
});

test("the canonical persona rejects an invalid emoji at the boundary, like any other invalid field", () => {
  const persona = (emoji: string) => ({ schemaVersion: "1", kind: "persona", id: "p", body: { name: "P", content: "", presentation: { emoji } } });
  expect(() => parseCanonicalEntity(persona("\u{1F989}"))).not.toThrow();
  expect(() => parseCanonicalEntity(persona("owl owl owl"))).toThrow();
});
