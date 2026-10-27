/** Reading and writing a piece's name where its kind keeps it. */
import { expect, test } from "bun:test";
import { pieceName, withPieceName } from "./piece-name";

test("a character's name is identity.name; every other kind's is name", () => {
  expect(pieceName("character", { identity: { name: "Vera" }, name: "wrong" })).toBe("Vera");
  expect(pieceName("lorebook", { name: "Harbor", identity: { name: "wrong" } })).toBe("Harbor");
  expect(pieceName("preset", null)).toBe("");
  expect(pieceName("unknown-kind", { name: "X" })).toBe("X");
});

test("renaming writes the same field and keeps the rest of the body", () => {
  const card = { identity: { name: "Vera", tagline: "t" }, persona: {} };
  expect(withPieceName("character", card, "Nox")).toEqual({ identity: { name: "Nox", tagline: "t" }, persona: {} });
  expect(card.identity.name).toBe("Vera");
  expect(withPieceName("regex", { name: "a", rules: [] }, "b")).toEqual({ name: "b", rules: [] });
});
