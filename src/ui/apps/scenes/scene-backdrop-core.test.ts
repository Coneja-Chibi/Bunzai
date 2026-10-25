/** The scene backdrop's pure rules: RoleCall's default and range of the overlay, and which pack item a pick names. */
import { expect, test } from "bun:test";
import { DEFAULT_DIM, MAX_DIM, backdropPack, dimOf, isVideoRef, itemOf, refSha, veilOf } from "./scene-backdrop-core";

const entity = { kind: "pack", id: "st", body: { name: " Harbor ", pack: { items: [{ id: "a", label: "Dusk", ref: "r1" }, { id: "b", label: "Night", ref: "r2" }] } } };

test("an unset dim is RoleCall's 0.6 and a set one is kept, 0 included", () => {
  expect(DEFAULT_DIM).toBe(0.6);
  expect(MAX_DIM).toBe(0.95);
  expect(dimOf({})).toBe(0.6);
  expect(dimOf({ dim: 0 })).toBe(0);
  expect(dimOf({ dim: 0.35 })).toBe(0.35);
});

test("the overlay is the theme's well color at the dim strength, never a fixed black", () => {
  expect(veilOf(0.6)).toBe("color-mix(in srgb, var(--stage-well) 60%, transparent)");
  expect(veilOf(0.95)).toContain("var(--stage-well) 95%");
  expect(veilOf(0.6)).not.toMatch(/#|rgb\(|black/);
});

test("a pack entity gives its name and items, and a pick finds its item or reports it gone", () => {
  const pack = backdropPack(entity)!;
  expect(pack.name).toBe("Harbor");
  expect(pack.items.map((i) => i.id)).toEqual(["a", "b"]);
  expect(itemOf(pack, { item: "b" })?.label).toBe("Night");
  expect(itemOf(pack, { item: "zzz" })).toBeNull();
});

test("anything that is not a pack gives null, and an unnamed pack is Untitled", () => {
  expect(backdropPack(null)).toBeNull();
  expect(backdropPack({ kind: "character", id: "x", body: {} })).toBeNull();
  expect(backdropPack({ kind: "pack", id: "x" })).toBeNull();
  expect(backdropPack({ kind: "pack", id: "x", body: {} })?.name).toBe("Untitled pack");
});

const card = (background: unknown) => ({ kind: "character", body: { presentation: { background } } });

test("a character's pinned background is its ref and an overlay of 0.6 unless set, clamped 0 to 1 (RoleCall character-default-background.ts)", async () => {
  const { characterBackdrop } = await import("./scene-backdrop-core");
  expect(characterBackdrop(card({ ref: "r1" }))).toEqual({ ref: "r1", dim: 0.6 });
  expect(characterBackdrop(card({ ref: "r1", overlayOpacity: 0.25 }))).toEqual({ ref: "r1", dim: 0.25 });
  expect(characterBackdrop(card({ ref: "r1", overlayOpacity: 4 }))?.dim).toBe(1);
  expect(characterBackdrop(card({ ref: "r1", overlayOpacity: -1 }))?.dim).toBe(0);
});

const NUL = String.fromCharCode(0);
const up = (mime: string): string => NUL + "b:u:" + mime + ":" + "b".repeat(64);

test("no background, a blank ref and a non-card give none", async () => {
  const { characterBackdrop } = await import("./scene-backdrop-core");
  for (const c of [null, {}, card(undefined), card({ ref: "  " })]) expect(characterBackdrop(c)).toBeNull();
});

test("a pinned video is marked and carries its speed clamped to 0.25 to 2; a video ref is told from a picture", async () => {
  const { characterBackdrop, isVideoRef, refSha, rateOf } = await import("./scene-backdrop-core");
  expect(characterBackdrop(card({ ref: up("video/mp4"), videoPlaybackRate: 9 }))).toEqual({ ref: up("video/mp4"), dim: 0.6, video: true, rate: 2 });
  expect(characterBackdrop(card({ ref: "data:video/mp4;base64,AAAA", videoPlaybackRate: 0.1 }))?.rate).toBe(0.25);
  expect(isVideoRef(up("video/webm"))).toBe(true);
  expect(isVideoRef(up("image/png"), "video/mp4")).toBe(true);
  expect(isVideoRef(up("image/png"))).toBe(false);
  expect(refSha(up("video/mp4"))).toBe("b".repeat(64));
  expect(refSha("data:image/png;base64,AAAA")).toBeNull();
  expect(rateOf({})).toBe(1);
  expect(rateOf({ rate: 0.5 })).toBe(0.5);
});

test("an uploaded ref is read by the one store reader: sha and media type survive an unusual type", () => {
  const sha = "d".repeat(64);
  expect(refSha(`\u0000b:u:video/mp4:${sha}`)).toBe(sha);
  expect(refSha(`\u0000b:u:image/vnd.x_y:${sha}`)).toBe(sha);
  expect(refSha(`\u0000b:b:${sha}`)).toBeNull();
  expect(isVideoRef(`\u0000b:u:video/vnd.x_y:${sha}`)).toBe(true);
  expect(isVideoRef(`\u0000b:u:image/png:${sha}`)).toBe(false);
});
