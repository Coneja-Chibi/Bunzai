/**
 * Standardize on a real library with a model that answers from what it is shown: the whole fixture book converts in bounded parallel
 * batches with a receipt per write, a bad item is rejected alone, a person's edit made while the model worked is never overwritten,
 * Preserve entries are never sent or touched, Cancel leaves only receipted writes (and a second run continues), and Revert gives back
 * every source exactly and retires every split.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { emptyLoreEntry } from "../core/lore";
import { readEntry } from "../core/compendium";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import type { RunSnapshot } from "../core/compendium";
import { dismissRun, lockedBooks, runOf, startStandardize, cancelRun } from "./compendium-standardize";
import { revertStandardization } from "./compendium-standardize-revert";
import { compendiumRig } from "./fake-compendium-rig";
import { writeBook } from "./world-book-writer";

const classic = (id: string, title: string, content = `${title} is a person of the harbor.`, over: Partial<LorebookEntry> = {}): LorebookEntry => ({ ...emptyLoreEntry(id), title, content, triggers: [{ keyword: title, isRegex: false }], ...over });
const CJK = (n: number): string => "\u65E5\u672C\u8A9E".repeat(n / 3);
const NAMES = ["Aria", "Bram", "Cato", "Dido", "Eben", "Fenn", "Gale"];
const fixture = (): LorebookEntry[] => NAMES.map((n, i) => classic(`c${i}`, n));

type Answer = (n: number, name: string) => unknown;
const OK: Answer = (n, name) => ({ source: n, items: [{ type: "character", entry: { name, tagline: `About ${name}` } }] });

async function rig(entries: LorebookEntry[] = fixture(), config: Record<string, unknown> = {}, realStore = false) {
  const base = await compendiumRig({ on: true, books: { bk: { access: "read_write" } }, standardize: { batchSize: 3, parallelism: 2 }, ...config } as never, entries);
  const requests: ProviderRequest[] = [];
  const state = { live: 0, peak: 0, delay: 0, ignoreAbort: false, answer: OK, onCall: undefined as undefined | ((req: ProviderRequest) => Promise<void> | void), fail: undefined as undefined | ((req: ProviderRequest) => string | Error | undefined) };
  const provider: Provider = {
    id: "fake",
    async send(req, opts) {
      requests.push(req);
      state.live += 1;
      state.peak = Math.max(state.peak, state.live);
      try {
        await state.onCall?.(req);
        if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
        if (opts?.signal?.aborted && !state.ignoreAbort) throw new DOMException("aborted", "AbortError");
        const forced = state.fail?.(req);
        if (forced instanceof Error) throw forced;
        if (forced !== undefined) return { content: forced, finish_reason: "stop", raw: {} } as ProviderCompletion;
        const user = req.messages[1]!.content;
        const blocks = [...user.matchAll(/\[(\d+)\] NAME: (.*)/g)];
        return { content: JSON.stringify({ entries: blocks.map((m) => state.answer(Number(m[1]), m[2]!)) }), finish_reason: "stop", raw: {} } as ProviderCompletion;
      } finally { state.live -= 1; }
    },
  };
  const deps = { ...base.deps, ...(realStore ? { store: base.library } : {}), connect: async () => ({ provider, kind: "openrouter" as const, context: 32_000 }) };
  const run = async (by: "entries" | "tokens" = "entries"): Promise<RunSnapshot> => {
    const started = await startStandardize(deps, base.chat.id, "bk", { by });
    if (!started.ok) throw new Error(started.error);
    await started.done;
    return runOf(base.chat.id, "bk")!;
  };
  const receipts = async () => (await base.chats.listReceipts(base.chat.id, { limit: 200 })).filter((r) => r.kind === "standardize");
  return { ...base, deps, state, requests, run, receipts };
}

afterEach(() => undefined);

describe("a run over the whole book", () => {
  test("every classic entry is typed, in batches of 3 with at most 2 asked at once, one filed receipt per write, the prose kept", async () => {
    const r = await rig();
    r.state.delay = 15;
    const done = await r.run();
    expect(done).toMatchObject({ status: "complete", total: 7, processed: 7, rewritten: 7, consumed: 0, created: 0, failed: 0, batches: { done: 3, total: 3 }, typed: { character: 7 } });
    expect(r.requests).toHaveLength(3);
    expect(r.state.peak).toBe(2);
    const book = await r.entries();
    expect(book.map((e) => readEntry(e, 0).type)).toEqual(Array(7).fill("character"));
    expect(book[0]).toMatchObject({ title: "Aria", metadata: { structured_data: { name: "Aria", tagline: "About Aria", preserved_prose: "Aria is a person of the harbor." } } });
    expect(book[0]!.content).not.toContain("Aria is a person of the harbor.");
    const receipts = await r.receipts();
    expect(receipts).toHaveLength(3);
    expect(receipts.every((x) => x.status === "filed" && x.model === "vera-1")).toBe(true);
    expect(receipts.flatMap((x) => x.writes.map((w) => w.entryId)).sort()).toEqual(book.map((e) => e.id).sort());
  });

  test("by tokens packs entries to the budget", async () => {
    const r = await rig([classic("a", "Aria", "word ".repeat(200)), classic("b", "Bram", "word ".repeat(200)), classic("c", "Cato", "x")]);
    const done = await r.run("tokens");
    expect(done.batches.total).toBeGreaterThanOrEqual(1);
    expect(done.processed).toBe(3);
  });

  test("a typed entry, a Preserve entry and a retired one are not sent and not touched", async () => {
    const preserved = classic("p", "Pia", "Do not touch.", { metadata: { preserve_during_standardize: true } });
    const retired = classic("r", "Old", "Retired text.", { enabled: false, metadata: { retired: { at: 1 } } });
    const r = await rig([...fixture().slice(0, 2), preserved, retired]);
    const done = await r.run();
    expect(done).toMatchObject({ total: 2, rewritten: 2 });
    expect(r.requests.map((q) => q.messages[1]!.content).join("\n")).not.toMatch(/Pia|Do not touch|Retired text/);
    const book = await r.entries();
    expect(book[2]).toEqual(preserved);
    expect(book[3]).toEqual(retired);
  });

  test("it asks nothing when the Compendium is off, the book is read only, or nothing waits", async () => {
    for (const [config, text] of [[{ on: false }, /off for this scene/], [{ books: { bk: { access: "read_only" } } }, /does not allow writing/]] as const) {
      const r = await rig(fixture(), config);
      const started = await startStandardize(r.deps, r.chat.id, "bk", { by: "entries" });
      expect(started).toMatchObject({ ok: false, status: 409 });
      if (!started.ok) expect(started.error).toMatch(text);
      expect(r.requests).toHaveLength(0);
    }
    const r = await rig([classic("p", "Pia", "x", { metadata: { preserve_during_standardize: true } })]);
    const none = await startStandardize(r.deps, r.chat.id, "bk", { by: "entries" });
    expect(none).toMatchObject({ ok: false, status: 409 });
  });
});

describe("a receipt holds 64 KiB of UTF-8, not 64 thousand characters", () => {
  test("a long Japanese entry is left classic with the size reason when its receipt could not hold it, never written without one", async () => {
    const huge = classic("big", "Huge", CJK(12_000));
    const r = await rig([huge, classic("c1", "Bram")], { standardize: { batchSize: 2 } });
    const done = await r.run();
    expect(done).toMatchObject({ rewritten: 1, failed: 1, status: "complete" });
    expect(done.warnings.join("|")).toMatch(/Huge: its conversion is larger than one receipt holds/);
    const book = await r.entries();
    expect(book[0]).toEqual(huge);
    expect((await r.receipts()).every((x) => x.status === "filed")).toBe(true);
    expect(await revertStandardization(r.deps, r.chat.id, "bk")).toMatchObject({ rewrites: 1, skipped: [] });
    expect(await r.entries()).toEqual([huge, classic("c1", "Bram")]);
  });

  test("a Japanese entry that does fit is filed, and Revert gives it back exactly", async () => {
    const jp = classic("jp", "Fits", CJK(3_000));
    const r = await rig([jp], { standardize: { batchSize: 1 } });
    expect(await r.run()).toMatchObject({ rewritten: 1, failed: 0 });
    expect((await r.receipts()).map((x) => x.status)).toEqual(["filed"]);
    await revertStandardization(r.deps, r.chat.id, "bk");
    expect(await r.entries()).toEqual([jp]);
  });
});

describe("through the library's own read path", () => {
  test("the book is read the way the scene reads it in the app (a body projection with a revision), and a run still converts and receipts", async () => {
    const r = await rig(fixture().slice(0, 3), { standardize: { batchSize: 3 } }, true);
    const done = await r.run();
    expect(done).toMatchObject({ status: "complete", rewritten: 3, failed: 0 });
    expect((await r.receipts()).map((x) => x.status)).toEqual(["filed"]);
    expect((await r.entries()).every((e) => readEntry(e, 0).type === "character")).toBe(true);
  });
});

describe("what the model gets wrong", () => {
  test("a malformed item is rejected alone: its source keeps the good items, a wholly bad source stays classic with the reason", async () => {
    const r = await rig(fixture().slice(0, 3), { standardize: { batchSize: 3, autoRetry: false } });
    r.state.answer = (n, name) => n === 1 ? { source: n, items: [{ type: "character", entry: { name, tagline: "ok" } }, { type: "location", entry: { name: "Dock", climate: 5 } }] }
      : n === 2 ? { source: n, items: [{ type: "dragon", entry: { name } }] } : OK(n, name);
    const done = await r.run();
    expect(done).toMatchObject({ rewritten: 2, failed: 1, status: "complete" });
    expect(done.warnings.join("|")).toMatch(/Aria: item 2: climate must be text/);
    expect(done.warnings.join("|")).toMatch(/Bram: item 1: its type "dragon" is not one of the eleven/);
    const book = await r.entries();
    expect(readEntry(book[0]!, 0).type).toBe("character");
    expect(book[1]).toEqual(classic("c1", "Bram"));
    expect(readEntry(book[2]!, 0).type).toBe("character");
  });

  test("an unreadable answer gets one repair call, and with nothing readable the entries stay classic", async () => {
    const r = await rig(fixture().slice(0, 2), { standardize: { batchSize: 2, autoRetry: false } });
    r.state.fail = () => "sorry, I cannot";
    const done = await r.run();
    expect(r.requests).toHaveLength(2);
    expect(done).toMatchObject({ status: "failed", rewritten: 0, failed: 2 });
    expect(done.error).toMatch(/No entry could be converted/);
    expect(await r.entries()).toEqual(fixture().slice(0, 2));
    expect(await r.receipts()).toEqual([]);
  });

  test("entries the model leaves out are asked about again, up to the Tool Loop Cap", async () => {
    const r = await rig(fixture().slice(0, 4), { standardize: { batchSize: 4, maxRounds: 3, autoRetry: false } });
    r.state.fail = (req) => {
      const asked = [...req.messages[1]!.content.matchAll(/\[(\d+)\] NAME: (.*)/g)];
      return asked.length > 2 ? JSON.stringify({ entries: asked.slice(0, 2).map((m) => OK(Number(m[1]), m[2]!)) }) : undefined;
    };
    const done = await r.run();
    expect(r.requests.map((q) => (q.messages[1]!.content.match(/\[\d+\] NAME/g) ?? []).length)).toEqual([4, 2]);
    expect(done).toMatchObject({ rewritten: 4, failed: 0 });
    const capped = await rig(fixture().slice(0, 4), { standardize: { batchSize: 4, maxRounds: 1, autoRetry: false } });
    capped.state.fail = r.state.fail;
    expect(await capped.run()).toMatchObject({ rewritten: 2, failed: 2 });
  });

  test("auto-retry asks once more for entries that came back unusable, and not at all when it is off", async () => {
    for (const autoRetry of [true, false]) {
      const r = await rig(fixture().slice(0, 2), { standardize: { batchSize: 2, autoRetry } });
      let first = true;
      r.state.fail = () => { if (first) { first = false; return JSON.stringify({ entries: [{ source: 1, items: [] }, { source: 2, items: [] }] }); } return undefined; };
      const done = await r.run();
      expect(done.rewritten).toBe(autoRetry ? 2 : 0);
    }
  });

  test("a provider error fails the batch's entries with the reason and leaves them classic", async () => {
    const r = await rig(fixture().slice(0, 3), { standardize: { batchSize: 3, autoRetry: false } });
    r.state.fail = () => new Error("upstream said no");
    const done = await r.run();
    expect(done).toMatchObject({ status: "failed", failed: 3 });
    expect(done.warnings[0]).toMatch(/the model did not answer: upstream said no/);
    expect(await r.entries()).toEqual(fixture().slice(0, 3));
  });
});

describe("the person editing while it runs", () => {
  test("an entry edited while the model was working is not overwritten and not converted; the others are", async () => {
    const r = await rig(fixture().slice(0, 3), { standardize: { batchSize: 3 } });
    let edited = false;
    r.state.onCall = async () => {
      if (edited) return;
      edited = true;
      await writeBook(r.deps.store, "bk", (entries) => entries.map((e) => (e.id === "c1" ? { ...e, content: "Bram, as the person rewrote him." } : e)));
    };
    const done = await r.run();
    expect(done).toMatchObject({ rewritten: 2, failed: 1 });
    expect(done.warnings.join("|")).toMatch(/Bram: it was edited while the model was working/);
    const book = await r.entries();
    expect(book[1]).toEqual({ ...classic("c1", "Bram"), content: "Bram, as the person rewrote him." });
    expect(readEntry(book[0]!, 0).type).toBe("character");
  });
});

describe("Cancel and a second run", () => {
  test("Cancel leaves only receipted writes; entries not reached stay classic; running again continues", async () => {
    const r = await rig(fixture(), { standardize: { batchSize: 2, parallelism: 1 } });
    let calls = 0;
    r.state.onCall = async () => { if (++calls === 2) cancelRun(r.chat.id, "bk"); };
    r.state.delay = 5;
    const stopped = await r.run();
    expect(stopped.status).toBe("cancelled");
    expect(stopped.rewritten).toBe(2);
    const book = await r.entries();
    const typed = book.filter((e) => readEntry(e, 0).type !== null).map((e) => e.id);
    const receipted = (await r.receipts()).flatMap((x) => x.writes.map((w) => w.entryId));
    expect(typed.sort()).toEqual(receipted.sort());
    expect(typed).toHaveLength(2);
    expect(book.slice(2)).toEqual(book.slice(2).map((e) => classic(e.id, e.title)));
    expect((await r.receipts()).every((x) => x.status === "filed")).toBe(true);

    r.state.onCall = undefined;
    const again = await r.run();
    expect(again).toMatchObject({ status: "complete", total: 5, rewritten: 5 });
    expect((await r.entries()).every((e) => readEntry(e, 0).type === "character")).toBe(true);
  });

  test("a model that answers after Cancel anyway gets nothing written: the answer is dropped, no receipt is made", async () => {
    const r = await rig(fixture().slice(0, 3), { standardize: { batchSize: 3 } });
    r.state.ignoreAbort = true;
    r.state.onCall = async () => { cancelRun(r.chat.id, "bk"); };
    const stopped = await r.run();
    expect(stopped).toMatchObject({ status: "cancelled", rewritten: 0, processed: 0 });
    expect(await r.entries()).toEqual(fixture().slice(0, 3));
    expect(await r.receipts()).toEqual([]);
  });

  test("a run is locked while it works, a second start is refused, and Revert waits for it", async () => {
    const r = await rig(fixture().slice(0, 2), { standardize: { batchSize: 2 } });
    let release!: () => void;
    r.state.onCall = () => new Promise<void>((resolve) => { release = resolve; });
    const started = await startStandardize(r.deps, r.chat.id, "bk", { by: "entries" });
    if (!started.ok) throw new Error(started.error);
    expect(lockedBooks(r.chat.id)).toEqual(["bk"]);
    expect(await startStandardize(r.deps, r.chat.id, "bk", { by: "entries" })).toMatchObject({ ok: false, status: 409, error: "Standardization is already running for this book." });
    await expect(revertStandardization(r.deps, r.chat.id, "bk")).rejects.toThrow(/is running/);
    expect(dismissRun(r.chat.id, "bk")).toBe(false);
    release();
    await started.done;
    expect(lockedBooks(r.chat.id)).toEqual([]);
    expect(dismissRun(r.chat.id, "bk")).toBe(true);
    expect(runOf(r.chat.id, "bk")).toBeNull();
  });
});

describe("Revert", () => {
  test("every source is back exactly as it was, a split is retired and never deleted, a consumed source is back, nothing is flagged in the book", async () => {
    const twin = { ...emptyLoreEntry("t"), title: "Aria Vane", content: "Aria Vane is typed.", metadata: { entry_type: "character", structured_data: { name: "Aria Vane", aliases: ["Aria"] } } } as LorebookEntry;
    const original = [twin, classic("c0", "Aria"), classic("c1", "Harbor Town", "A town ruled by Gale.", { metadata: { note: "mine" } }), classic("c2", "Cato")];
    const r = await rig(original, { standardize: { batchSize: 4 } });
    r.state.answer = (n, name) => n === 1 ? { source: n, items: [{ type: "character", entry: { name: "Aria", tagline: "merged" } }] }
      : n === 2 ? { source: n, items: [{ type: "location", entry: { name } }, { type: "character", entry: { name: "Gale" } }] } : OK(n, name);
    const done = await r.run();
    expect(done).toMatchObject({ rewritten: 2, consumed: 1, created: 1, dedup: 1 });
    const after = await r.entries();
    expect(after).toHaveLength(5);
    expect(after[1]).toMatchObject({ enabled: false, metadata: { retired: { receipt: expect.any(String) } } });

    const result = await revertStandardization(r.deps, r.chat.id, "bk");
    expect(result).toMatchObject({ rewrites: 2, merges: 1, splits: 1, consumed: 1, skipped: [] });
    const back = await r.entries();
    expect(back.slice(0, 4)).toEqual(original);
    expect(back[4]).toMatchObject({ title: "Gale", enabled: false, metadata: { retired: expect.anything() } });
    expect(JSON.stringify(back)).not.toMatch(/standardiz|original_classic_content|_swipe|consumed_by/i);
    expect((await r.receipts()).every((x) => x.status === "undone")).toBe(true);
    expect(await revertStandardization(r.deps, r.chat.id, "bk")).toMatchObject({ receipts: 0 });
  });

  test("an entry changed since the run is left as it is and named, and the run can be reverted again later", async () => {
    const r = await rig(fixture().slice(0, 2), { standardize: { batchSize: 2 } });
    await r.run();
    await writeBook(r.deps.store, "bk", (entries) => entries.map((e) => (e.id === "c0" ? { ...e, metadata: { ...e.metadata, structured_data: { ...(e.metadata!["structured_data"] as object), memories: ["filed later"] } } } : e)));
    const result = await revertStandardization(r.deps, r.chat.id, "bk");
    expect(result.skipped.join("|")).toMatch(/Aria was edited since it was filed/);
    const back = await r.entries();
    expect(readEntry(back[0]!, 0).type).toBe("character");
    expect(back[1]).toEqual(classic("c1", "Bram"));
    expect((await r.receipts()).some((x) => x.status === "filed")).toBe(true);
  });
});
