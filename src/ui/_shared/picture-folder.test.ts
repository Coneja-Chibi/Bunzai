/** A dropped folder of pictures becomes one zip; a folder of cards or mixed files does not. */
import { expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { pictureFolderFiles, zipPictureFolder } from "./picture-folder";

const f = (name: string, size = 3): File => new File([new Uint8Array(size)], name);

test("a backgrounds folder of jpg and png is a picture folder, by its name", () => {
  expect(pictureFolderFiles("backgrounds", [f("a.jpg"), f("b.png"), f(".DS_Store")])?.map((x) => x.name)).toEqual(["a.jpg", "b.png"]);
});

test("a folder with no png is a picture folder whatever it is called, but a folder of pngs not named like a shelf is not (cards travel as png)", () => {
  expect(pictureFolderFiles("trip", [f("a.jpg"), f("b.webp")])).not.toBeNull();
  expect(pictureFolderFiles("my cards", [f("a.png"), f("b.png")])).toBeNull();
});

test("anything else in the folder, or nothing, or too much, is not one", () => {
  expect(pictureFolderFiles("backgrounds", [f("a.jpg"), f("card.json")])).toBeNull();
  expect(pictureFolderFiles("backgrounds", [])).toBeNull();
  expect(pictureFolderFiles("backgrounds", Array.from({ length: 300 }, (_, i) => f(`${String(i)}.jpg`)))).toBeNull();
});

test("the zip holds each picture once under its name, and is named for the folder", async () => {
  const zip = await zipPictureFolder("backgrounds", [f("a.jpg", 5), f("a.jpg", 7)]);
  expect(zip?.name).toBe("backgrounds.zip");
  expect(Object.keys(unzipSync(new Uint8Array(await zip!.arrayBuffer()))).sort()).toEqual(["a (2).jpg", "a.jpg"]);
  expect(await zipPictureFolder("x", [f("a.txt")])).toBeNull();
});

test("two pictures whose names differ only by case stay two files in the zip, as Windows extracts them", async () => {
  const zip = await zipPictureFolder("backgrounds", [f("A.png", 5), f("a.png", 7)]);
  const names = Object.keys(unzipSync(new Uint8Array(await zip!.arrayBuffer())));
  expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(2);
});

test("a folder that holds archiver litter beside the pictures is still a picture folder, and the litter is left out", () => {
  expect(pictureFolderFiles("backgrounds", [f("a.jpg"), f("._a.jpg"), f("Thumbs.db")])?.map((x) => x.name)).toEqual(["a.jpg"]);
});
