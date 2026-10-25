/** The Gallery's pure half: which pictures a scene can show (never a link), how many there are, and what "Use as background" reuses. */
import { expect, test } from "bun:test";
import { backdropPack } from "./scene-backdrop-core";
import { cardItems, countText, downloadName, existingPackItem, isLocalArt, packGalleryItems, personaItems, portraitItem, visibleItems } from "./stage-gallery-core";

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const ref = (n: number, mime = "image/png"): string => `\u0000b:u:${mime}:${sha(n)}`;

test("only art the library holds is shown: uploaded refs and inline image or video data, never a link", () => {
  expect(isLocalArt(ref(1))).toBe(true);
  expect(isLocalArt("data:image/png;base64,AAAA")).toBe(true);
  expect(isLocalArt("data:video/mp4;base64,AAAA")).toBe(true);
  expect(isLocalArt("https://example.com/a.png")).toBe(false);
  expect(isLocalArt("http://example.com/a.png")).toBe(false);
  expect(isLocalArt("data:text/html;base64,AAAA")).toBe(false);
  expect(isLocalArt("")).toBe(false);
});

test("a card lists its extra art by role and its background, skipping links, repeats and the portrait", () => {
  const items = cardItems({ body: { media: { portrait: { role: "portrait", ref: ref(1) }, assets: [
    { role: "outfit", label: "Gala", ref: ref(2) },
    { role: "emotion", ref: ref(3), name: "smile.png" },
    { role: "pose", ref: "https://example.com/x.png" },
    { role: "other", ref: ref(2) },
    { role: "background", ref: ref(4) },
  ] }, presentation: { background: { ref: ref(5, "video/mp4") } } } });
  expect(items.map((i) => [i.label, i.source])).toEqual([["Gala", "card"], ["smile.png", "card"], ["Background", "card"], ["Card background", "card"]]);
  expect(items[3]?.mime).toBe("video/mp4");
});

test("a card with no art, and a thing that is not a card, list nothing", () => {
  expect(cardItems({ body: { media: {} } })).toEqual([]);
  expect(cardItems(null)).toEqual([]);
  expect(cardItems({ body: { media: { assets: "nope" } } })).toEqual([]);
});

test("the frozen portrait is the scene's own picture and names the snapshot it came from", () => {
  expect(portraitItem("c 1", 3, "Vera")).toMatchObject({ id: "portrait", source: "card", label: "Vera", url: "/api/chats/portrait?id=c%201&v=3" });
});

test("a persona lists its portrait only when it is held locally", () => {
  expect(personaItems({ body: { name: "Rhea", media: { portrait: { role: "portrait", ref: ref(7) } } } }).map((i) => [i.label, i.source])).toEqual([["Rhea", "persona"]]);
  expect(personaItems({ body: { name: "Rhea", media: { portrait: { role: "portrait", ref: "https://example.com/p.png" } } } })).toEqual([]);
  expect(personaItems(undefined)).toEqual([]);
});

test("a pack lists every picture with the pack and item that name it", () => {
  const pack = backdropPack({ kind: "pack", id: "st", body: { name: "Harbor", pack: { items: [{ id: "a", label: "Dusk", ref: ref(1) }, { id: "b", label: "Night", ref: ref(2, "video/mp4"), mime: "video/mp4" }] } } })!;
  const items = packGalleryItems(pack);
  expect(items.map((i) => [i.label, i.source, i.pack])).toEqual([["Dusk", "pack", { pack: "st", item: "a" }], ["Night", "pack", { pack: "st", item: "b" }]]);
  expect(existingPackItem(pack, ref(2, "video/mp4"))?.id).toBe("b");
  expect(existingPackItem(pack, ref(9))).toBeNull();
  expect(existingPackItem(pack, "data:image/png;base64,AAAA")).toBeNull();
});

test("the count counts pictures, and the tabs split cast art from pack art", () => {
  expect(countText(0)).toBe("0 images");
  expect(countText(1)).toBe("1 image");
  expect(countText(61)).toBe("61 images");
  const all = [{ id: "1", source: "card" }, { id: "2", source: "persona" }, { id: "3", source: "pack" }] as never;
  expect(visibleItems(all, "all")).toHaveLength(3);
  expect(visibleItems(all, "cast").map((i) => i.id)).toEqual(["1", "2"]);
  expect(visibleItems(all, "pack").map((i) => i.id)).toEqual(["3"]);
});

test("a download is named for the picture, with the extension its type needs", () => {
  expect(downloadName("Harbor at dusk", "image/jpeg")).toBe("Harbor at dusk.jpg");
  expect(downloadName("a/b:c", undefined)).toBe("a-b-c.png");
  expect(downloadName("Clip", "video/mp4")).toBe("Clip.mp4");
});
