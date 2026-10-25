/** Regression coverage for the pack.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import {
  applyPackToMedia,
  emotionAssetsFromPack,
  labelFromFilename,
  normalizeLabel,
  normalizePack,
  packFromMedia,
  resolvePackFace,
} from "./pack";

describe("pack", () => {
  test("normalizeLabel strips ext and expr_ prefix", () => {
    expect(normalizeLabel("Happy.PNG")).toBe("happy");
    expect(normalizeLabel("expr_angry")).toBe("angry");
    expect(normalizeLabel("full_idle")).toBe("idle");
  });

  test("labelFromFilename keeps stem", () => {
    expect(labelFromFilename("path/to/Neutral.png")).toBe("Neutral");
    expect(labelFromFilename("expr_joy.webp")).toBe("joy");
  });

  test("normalizePack drops items with no label or no picture, and nothing else", () => {
    const p = normalizePack({
      items: [
        { id: "1", label: "happy", ref: "data:a" },
        { id: "3", label: "", ref: "data:c" },
        { id: "4", label: "sad", ref: "" },
      ],
    });
    expect(p.items.map((i) => i.ref)).toEqual(["data:a"]);
  });

  test("two pictures sharing a label are both kept; the later one gets a free numbered label", () => {
    const p = normalizePack({
      items: [
        { id: "1", label: "happy", ref: "data:a" },
        { id: "2", label: "Happy", ref: "data:b" },
        { id: "3", label: "happy", ref: "data:c" },
      ],
    });
    expect(p.items.map((i) => i.ref)).toEqual(["data:a", "data:b", "data:c"]);
    expect(p.items.map((i) => i.label)).toEqual(["happy", "Happy (2)", "happy (3)"]);
  });

  test("a numbered label steps past labels the pack already uses, wherever they sit", () => {
    const p = normalizePack({
      items: [
        { id: "1", label: "wallpaper", ref: "a" },
        { id: "2", label: "wallpaper", ref: "b" },
        { id: "3", label: "wallpaper (2)", ref: "c" },
      ],
    });
    expect(p.items.map((i) => i.label)).toEqual(["wallpaper", "wallpaper (3)", "wallpaper (2)"]);
  });

  test("normalizing a normalized pack changes nothing (it runs on every edit)", () => {
    const once = normalizePack({
      items: [
        { id: "1", label: "x", ref: "a" },
        { id: "2", label: "x", ref: "b" },
        { id: "3", label: "x (2)", ref: "c" },
        { id: "3", label: "y", ref: "d" },
      ],
    });
    expect(normalizePack(once)).toEqual(once);
    expect(new Set(once.items.map((i) => i.id)).size).toBe(4);
  });

  test("reordering a pack with repeated labels keeps every picture", () => {
    const { reorderPackItems } = require("./pack") as typeof import("./pack");
    const pack = normalizePack({ items: [{ id: "a", label: "x", ref: "1" }, { id: "b", label: "x", ref: "2" }] });
    expect(reorderPackItems(pack, ["b", "a"]).items.map((i) => i.ref)).toEqual(["2", "1"]);
  });

  test("packFromMedia / emotionAssetsFromPack round-trip emotions", () => {
    const pack = packFromMedia({
      portrait: { role: "portrait", ref: "face", primary: true },
      assets: [
        { role: "emotion", label: "happy", ref: "h" },
        { role: "background", label: "bg", ref: "b" },
      ],
    });
    expect(pack.items.map((i) => i.label)).toEqual(["happy"]);
    const emotions = emotionAssetsFromPack(pack);
    expect(emotions).toEqual([{ role: "emotion", label: "happy", ref: "h" }]);
    const next = applyPackToMedia(
      {
        portrait: { role: "portrait", ref: "face", primary: true },
        assets: [
          { role: "emotion", label: "old", ref: "o" },
          { role: "background", label: "bg", ref: "b" },
        ],
      },
      { items: [{ id: "1", label: "sad", ref: "s" }] },
    );
    expect(next.portrait?.ref).toBe("face");
    expect(next.assets?.filter((a) => a.role === "emotion")).toEqual([
      { role: "emotion", label: "sad", ref: "s" },
    ]);
    expect(next.assets?.some((a) => a.role === "background")).toBe(true);
  });

  test("reorderPackItems by id", () => {
    const { reorderPackItems } = require("./pack") as typeof import("./pack");
    const pack = normalizePack({
      items: [
        { id: "a", label: "a", ref: "1" },
        { id: "b", label: "b", ref: "2" },
        { id: "c", label: "c", ref: "3" },
      ],
    });
    const next = reorderPackItems(pack, ["c", "a", "b"]);
    expect(next.items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  test("resolvePackFace fallback chain", () => {
    const pack = normalizePack({
      defaultLabel: "happy",
      items: [
        { id: "1", label: "angry", ref: "a" },
        { id: "2", label: "happy", ref: "h" },
        { id: "3", label: "neutral", ref: "n" },
      ],
    });
    expect(resolvePackFace(pack, "angry")?.ref).toBe("a");
    expect(resolvePackFace(pack, null)?.ref).toBe("h");
    const noDef = normalizePack({
      items: [
        { id: "1", label: "angry", ref: "a" },
        { id: "2", label: "neutral", ref: "n" },
      ],
    });
    expect(resolvePackFace(noDef, "missing")?.ref).toBe("n");
  });
});
