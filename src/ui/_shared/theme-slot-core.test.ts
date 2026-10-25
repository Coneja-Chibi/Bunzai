/** readSlotItems: the host's second look at slot data. Off-shape or hostile items are dropped, never repaired. */
import { expect, test } from "bun:test";
import type { ThemeSlots } from "../../extensions/slot-registry";
import { SLOT_ATTRIBUTE as MOD_SLOT_ATTRIBUTE, slotPayload } from "../shell/theme-mod";
import { readSlotItems, SLOT_ATTRIBUTE } from "./theme-slot-core";

const logo = `/api/themes/assets/bunraku.theme.encore/logo?digest=${"a".repeat(64)}`;
const read = (slots: object, assets: object = {}, classes: string[] = []): ReturnType<typeof readSlotItems> =>
  readSlotItems(JSON.stringify({ slots, assets, classes }));

test("a class the package did not define is dropped and the text stays; a defined one is kept", () => {
  const items = read({ "library.header": [{ kind: "text", text: "kept", class: "gate-card" }, { kind: "text", text: "styled", class: "mod-banner" }] }, {}, ["mod-banner"]).get("library.header");
  expect(items).toEqual([{ kind: "text", text: "kept" }, { kind: "text", text: "styled", className: "mod-banner" }]);
});

test("an image resolves to the digest asset URL; an external URL or an unknown asset is refused", () => {
  const items = read(
    { "library.header": [{ kind: "image", asset: "logo", alt: "Encore" }, { kind: "image", asset: "ext", alt: "x" }, { kind: "image", asset: "missing", alt: "x" }] },
    { logo, ext: "https://example.com/a.png" },
  ).get("library.header");
  expect(items).toEqual([{ kind: "image", src: logo, alt: "Encore" }]);
});

test("limits hold: text over 280 characters is dropped and a slot keeps at most four items", () => {
  const long = { kind: "text", text: "x".repeat(281) };
  const four = ["a", "b", "c", "d", "e"].map((text) => ({ kind: "text", text }));
  expect(read({ "library.header": [long, ...four] }).get("library.header")?.map((i) => (i as { text: string }).text)).toEqual(["a", "b", "c"]);
});

test("no payload, a bad payload, an unknown slot id and an unknown item kind all read as empty", () => {
  expect(readSlotItems(null).size).toBe(0);
  expect(readSlotItems("{not json").size).toBe(0);
  expect(readSlotItems('{"slots":[],"assets":{}}').size).toBe(0);
  expect(read({ "made.up": [{ kind: "text", text: "x" }] }).size).toBe(0);
  expect(read({ "library.header": [{ kind: "html", html: "<b>" }, "text", null] }).size).toBe(0);
});

test("the painter's payload reads back to the same drawn items, and an empty theme has no payload", () => {
  const slots: ThemeSlots = { "library.header": [{ kind: "image", asset: "logo", alt: "L" }, { kind: "text", text: "hi", class: "mod-banner" }] };
  const payload = slotPayload(slots, [{ id: "logo", url: logo }], ["mod-banner"]);
  expect(readSlotItems(payload).get("library.header")).toEqual([{ kind: "image", src: logo, alt: "L" }, { kind: "text", text: "hi", className: "mod-banner" }]);
  expect(slotPayload({}, [], [])).toBeNull();
  expect(slotPayload({ "library.header": [] }, [], [])).toBeNull();
});

test("an image may use the object URL the painter makes in static browser mode, but not a remote or data URL", () => {
  const items = read({ "library.header": ["blob:http://127.0.0.1/abc", "https://example.com/a.png", "data:image/png;base64,AA"].map((_, i) => ({ kind: "image", asset: `a${String(i)}`, alt: "x" })) },
    { a0: "blob:http://127.0.0.1/abc", a1: "https://example.com/a.png", a2: "data:image/png;base64,AA" }).get("library.header");
  expect(items).toEqual([{ kind: "image", src: "blob:http://127.0.0.1/abc", alt: "x" }]);
});

test("the attribute name is the one the painter writes", () => { expect(SLOT_ATTRIBUTE).toBe(MOD_SLOT_ATTRIBUTE); });
