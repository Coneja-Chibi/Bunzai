/** "Use as background": a pack picture is the backdrop as it stands; cast art is copied into the scene's pack first, once, and a failed copy changes nothing. */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatBackdrop } from "../../../stage/contracts/chat-store";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { artCache } from "../../_shared/art-cache";
import { applyAsBackdrop } from "./stage-gallery-apply";
import type { GalleryItem } from "./stage-gallery-core";

let installed: InstalledDom;
beforeAll(() => { installed = installDom('<!doctype html><html><head><meta name="vaude-session" content="tok"></head><body></body></html>', { url: "http://127.0.0.1:8323/" }); });
afterAll(() => installed.teardown());

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const ref = (n: number): string => `\u0000b:u:image/png:${sha(n)}`;
const chatOf = (backdrop?: ChatBackdrop): Chat => ({ id: "c1", ...(backdrop ? { backdrop } : {}) } as unknown as Chat);

let items: { id: string; label: string; ref: string }[];
let backdrops: (ChatBackdrop | null)[];
let patches: number;
let uploads: string[];
let adopted: string[];

beforeEach(() => {
  items = [{ id: "a", label: "Dusk", ref: ref(1) }];
  backdrops = []; patches = 0; uploads = []; adopted = [];
  installed.reinstall();
});

function makeCtx(opts: { patchFails?: boolean; packs?: { id: string }[] } = {}): AppContext {
  return {
    api: {
      listEntities: async () => opts.packs ?? [{ id: "st" }],
      getLightEditableEntity: async () => ({ entity: { schemaVersion: "1", kind: "pack", id: "st", body: { name: "Backdrops", pack: { items: items.map((i) => ({ ...i })) } } }, revision: "r1" }),
      adoptAssets: async (assets: string[]) => { adopted.push(...assets); return assets.map((a) => ({ ref: `g-${a.slice(-4)}`, asset: a, sha: a.slice(-64), mime: "image/png", bytes: 3 })); },
      uploadAsset: async (file: File) => { uploads.push(file.name); return { sha: sha(9), mime: "image/png", bytes: 3, ref: "g-up", asset: ref(9) }; },
      discardAssetUploads: async () => undefined,
      patchEditedEntity: async (_k: string, _id: string, _rev: string, patch: unknown, _u: string[]) => {
        patches++;
        if (opts.patchFails) throw new Error("disk full");
        items = [...items, { id: "new", label: "added", ref: ref(9) }];
        return { summary: {}, revision: "r2" };
      },
      setSceneBackdrop: async (_id: string, b: ChatBackdrop | null) => { backdrops.push(b); return chatOf(b ?? undefined); },
    },
  } as unknown as AppContext;
}
const pick = (item: GalleryItem, chat = chatOf(), ctx = makeCtx()): Promise<Chat> => applyAsBackdrop(ctx, chat, item);
const packItem: GalleryItem = { id: "pack:st:a", source: "pack", label: "Dusk", ref: ref(1), pack: { pack: "st", item: "a" } };
const dataItem: GalleryItem = { id: "card:0", source: "card", label: "Gala", ref: "data:image/png;base64,AAEC", mime: "image/png" };

describe("Use as background", () => {
  test("a pack picture becomes the backdrop as it stands: one setSceneBackdrop, no pack save", async () => {
    await pick(packItem);
    expect(backdrops).toEqual([{ pack: "st", item: "a" }]);
    expect(patches).toBe(0);
  });

  test("a pack picture keeps the overlay darkness the scene already chose", async () => {
    await pick(packItem, chatOf({ pack: "st", item: "zz", dim: 0.3, rate: 2 }));
    expect(backdrops).toEqual([{ pack: "st", item: "a", dim: 0.3 }]);
  });

  test("cast art held in the library is adopted into the scene's pack, then set as the backdrop", async () => {
    await pick({ id: "card:1", source: "card", label: "Gala", ref: ref(5), mime: "image/png" }, chatOf({ pack: "st", item: "a" }));
    expect(adopted).toEqual([ref(5)]);
    expect(patches).toBe(1);
    expect(backdrops).toEqual([{ pack: "st", item: "new" }]);
  });

  test("inline cast art is uploaded as a file named for it", async () => {
    await pick(dataItem);
    expect(uploads).toEqual(["Gala.png"]);
    expect(backdrops).toEqual([{ pack: "st", item: "new" }]);
  });

  test("the frozen portrait is read from the cache by its snapshot and uploaded", async () => {
    artCache.prime("snapshot:4", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    await pick({ id: "portrait", source: "card", label: "Vera", url: "/api/chats/portrait?id=c1&v=4" });
    expect(uploads).toEqual(["Vera.png"]);
  });

  test("art the pack already holds is reused: no second copy, just the backdrop", async () => {
    items = [{ id: "a", label: "Dusk", ref: ref(5) }];
    await pick({ id: "card:1", source: "card", label: "Gala", ref: ref(5), mime: "image/png" });
    expect(patches).toBe(0);
    expect(backdrops).toEqual([{ pack: "st", item: "a" }]);
  });

  test("a failed pack save sets no backdrop and says why", async () => {
    const error = await pick(dataItem, chatOf(), makeCtx({ patchFails: true })).then(() => null, (e: unknown) => e as Error);
    expect(error?.message).toContain("Could not add");
    expect(backdrops).toEqual([]);
  });

  test("with no pack in the library it asks for one and changes nothing", async () => {
    const error = await pick(dataItem, chatOf(), makeCtx({ packs: [] })).then(() => null, (e: unknown) => e as Error);
    expect(error?.message).toContain("Make a pack");
    expect(backdrops).toEqual([]);
    expect(uploads).toEqual([]);
  });
});
