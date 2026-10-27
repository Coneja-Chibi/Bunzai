/** The scene readers' one body read, on the real library: what a full read holds, and null once a piece is gone. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyRegexSetBody, type RegexSetBody } from "../entities/regex/schema";
import { bodyReader } from "./body-reader";
import { StudioStore } from "./store";
import { tempDirSync } from "./test-temp-dir";

test("a regex set reads the same body through the store's body read as through a full read", async () => {
  const store = new StudioStore(tempDirSync("bunraku-body-reader-"));
  const body = { ...emptyRegexSetBody("Tidy"), rules: [{ id: "r1", label: "r1", find: "storms", flags: "g", replace: "weather", phases: ["display"], enabled: true, sortOrder: 0 }] } as unknown as RegexSetBody;
  const saved = await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "regex", id: "tidy", body });
  const read = bodyReader<RegexSetBody>(store, "regex");
  expect(await read(saved.id)).toEqual((await store.read("regex", saved.id))!.body as RegexSetBody);
  expect(await bodyReader<RegexSetBody>({ read: store.read.bind(store) }, "regex")(saved.id)).toEqual(await read(saved.id));
  expect((await read(saved.id))?.rules.map((r) => r.find)).toEqual(["storms"]);
  expect(await read("nope")).toBeNull();
  expect(await bodyReader(store, "preset")(saved.id)).toBeNull();
});
