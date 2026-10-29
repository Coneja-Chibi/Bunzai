/** A lorebook of real size opens: every read path charges one memory budget (SANITY_PIECE_BYTES), with no separate count of entries, parts or JSON values that a big book could pass. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import { StudioStore } from "./store";
import { tempDir } from "./test-temp-dir";

test("a 5,000-entry lorebook (about 2 MB of text) can be read and copied", async () => {
  const library = new StudioStore(await tempDir("vaude-big-book-"));
  const entries = Array.from({ length: 5_000 }, (_, i) => ({ ...emptyLoreEntry(`e${i}`), title: `Entry ${i}`, content: "x".repeat(400) }));
  await library.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "big", body: { ...emptyLorebookBody("Big"), entries } });
  const read = (await library.read("lorebook", "big")) as unknown as { body: { entries: unknown[] } };
  expect(read.body.entries).toHaveLength(5_000);
  const copy = await library.duplicate("lorebook", "big");
  expect(copy).not.toBeNull();
  const copied = (await library.read("lorebook", copy!.id)) as unknown as { body: { entries: unknown[] } };
  expect(copied.body.entries).toHaveLength(5_000);
}, 120_000);
