/**
 * Import chat history (04b Track D; RoleCall `tv-ingest.ts`): a long scene is read in pages and cut into token-sized chunks without
 * being held whole, each chunk files through the book writer with an `ingest` receipt, Continuity and the three phases change what a
 * call is told and may file, a chunk that cannot be read files nothing and the run goes on, Cancel stops between or inside calls, the
 * scene's lane is free between chunks, and the whole run can be undone.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { ProviderError } from "../stage/contracts/provider";
import { cancelIngest, latestRun, startIngest, undoIngest } from "./compendium-ingest";
import { enqueue } from "./compendium-queue";
import { compendiumRig, HARBOR, WOLF } from "./fake-compendium-rig";

const CONFIG = { on: true, ingest: { chunkTokens: 1000 }, books: { bk: { access: "read_write" as const } } };
const said = (filings: unknown[], arcs: unknown[] = []) => JSON.stringify({ filings, arcs });
const char = (name: string) => ({ type: "character", entry: { name } });
const WORDS = "word ".repeat(250);

async function rig(config: Parameters<typeof compendiumRig>[0] = CONFIG, pairs = 6) {
  const r = await compendiumRig(config);
  // Greeting 0, user 1, reply 2, then `pairs` more of (user, reply) = indices 3 to 2 + 2 * pairs, each about 250 words.
  await r.chats.appendMessages(r.chat.activeBranchId, Array.from({ length: pairs * 2 }, (_, i) => ({ role: i % 2 === 0 ? "user" as const : "assistant" as const, content: `m${3 + i} ${WORDS}` })));
  const total = 3 + pairs * 2;
  const finish = async (): Promise<NonNullable<ReturnType<typeof latestRun>>> => {
    for (let i = 0; i < 400 && latestRun(r.chat.id)?.status === "running"; i++) await new Promise((x) => setTimeout(x, 5));
    return latestRun(r.chat.id)!;
  };
  const start = (from = 0, to = total) => startIngest(r.deps, { chatId: r.chat.id, bookId: "bk", from, to });
  return { ...r, total, finish, start };
}
afterEach(() => undefined);

describe("reading and chunking", () => {
  test("the chat is read in pages and cut into chunks of about the token budget, each chunk one call, none holding the whole chat", async () => {
    const r = await rig(CONFIG, 120);
    const pages: number[] = [];
    const real = r.chats.readMessages.bind(r.chats);
    r.chats.readMessages = async (b, page) => { pages.push(page.limit); return real(b, page); };
    const run = await r.start(0, 100);
    const done = await r.finish();
    expect(done.status).toBe("done");
    expect(pages.length).toBeGreaterThan(0);
    expect(Math.max(...pages)).toBeLessThanOrEqual(100);
    expect(r.requests.length).toBe(done.lines.length);
    expect(done.lines.length).toBeGreaterThan(20);
    const sizes = done.lines.map((l) => l.to - l.from);
    expect(sizes.every((s) => s >= 1 && s <= 6)).toBe(true);
    expect(done.lines[0]!.from).toBe(0);
    expect(done.lines.at(-1)!.to).toBe(100);
    expect(done.lines.slice(1).every((l, i) => l.from === done.lines[i]!.to)).toBe(true);
    expect(run.id).toBe(done.id);
  });

  test("only the range asked for is sent: From is where it starts and To is exclusive", async () => {
    const r = await rig();
    r.script.push(said([]), said([]), said([]), said([]), said([]));
    await r.start(5, 9);
    const done = await r.finish();
    const sent = r.requests.map((q) => q.messages[1]!.content as string).join("\n");
    expect(sent).toContain("m5 ");
    expect(sent).toContain("m8 ");
    expect(sent).not.toContain("m4 ");
    expect(sent).not.toContain("m9 ");
    expect(done.lines[0]!.from).toBe(5);
    expect(done.lines.at(-1)!.to).toBe(9);
  });
});

describe("filing", () => {
  test("each chunk is a receipt of kind ingest with its writes, the book changes by one patch per chunk, and Undo ingest takes the run back", async () => {
    const r = await rig();
    r.script.push(said([char("Ada")]), said([char("Bram")]), said([char("Cole")]), said([]), said([]), said([]));
    await r.start(3, 9);
    const done = await r.finish();
    const receipts = (await r.chats.listReceipts(r.chat.id)).filter((x) => x.kind === "ingest").reverse();
    expect(receipts.map((x) => [x.status, x.writes.length])).toEqual(done.lines.map((l) => [l.status, l.created + l.updated]));
    expect(receipts.filter((x) => x.status === "filed").length).toBeGreaterThan(0);
    const names = (await r.entries()).map((e) => e.title);
    expect(names).toContain("Ada");
    const undo = await undoIngest(r.deps, r.chat.id, done.id);
    expect(undo.failed).toEqual([]);
    const after = await r.entries();
    expect(after.filter((e) => e.enabled).map((e) => e.title).sort()).toEqual([HARBOR.title, WOLF.title].sort());
    expect((await r.chats.receipt(receipts[0]!.id))!.status).toBe("undone");
  });

  test("Continuity tells each chunk what the ones before it filed, and off it does not", async () => {
    for (const continuity of [true, false]) {
      const r = await rig({ ...CONFIG, ingest: { chunkTokens: 1000, continuity } });
      r.script.push(said([char("Ada")]), said([]), said([]));
      await r.start(3, 7);
      await r.finish();
      const prompts = r.requests.map((q) => q.messages[0]!.content as string);
      expect(prompts[0]).not.toContain("PREVIOUS INGEST ACTIVITY");
      expect(prompts[1]!.includes("character: Ada")).toBe(continuity);
    }
  });

  test("Search shows the existing entries; off it does not. Facts off refuses fact types by name; Narrative on asks for plots and files recaps with a plot and an [Arc]", async () => {
    const search = await rig();
    search.script.push(said([]), said([]));
    await search.start(3, 5);
    await search.finish();
    expect(search.requests[0]!.messages[0]!.content).toContain("Lycanthrope (aka: Wolfman)");
    const blind = await rig({ ...CONFIG, ingest: { chunkTokens: 1000, search: false } });
    blind.script.push(said([]));
    await blind.start(3, 5);
    await blind.finish();
    expect(blind.requests[0]!.messages[0]!.content).not.toContain("EXISTING ENTRIES");

    const story = await rig({ ...CONFIG, ingest: { chunkTokens: 32000, facts: false } });
    story.script.push(said([char("Ada"), { type: "summary", entry: { title: "The Howl", parent_plot: "The Lantern", summary: "It howled." } }], [{ plot: "The Lantern", overview: "A howl." }]));
    await story.start(3, 7);
    const done = await story.finish();
    expect(story.requests[0]!.messages[0]!.content).toContain("NARRATIVE");
    expect(done.lines[0]!.reason).toContain("filing character entries is switched off");
    const titles = (await story.entries()).map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(["The Howl", "The Lantern", "[Arc] The Lantern"]));
    expect(titles).not.toContain("Ada");

    const facts = await rig({ ...CONFIG, ingest: { chunkTokens: 32000, narrative: false } });
    facts.script.push(said([{ type: "summary", entry: { title: "X", parent_plot: "P" } }, char("Ada")], [{ plot: "P", overview: "o" }]));
    await facts.start(3, 7);
    await facts.finish();
    expect(facts.requests[0]!.messages[0]!.content).not.toContain("NARRATIVE");
    expect((await facts.entries()).map((e) => e.title)).toEqual(expect.arrayContaining(["Ada"]));
    expect((await facts.entries()).map((e) => e.title)).not.toContain("[Arc] P");
  });

  test("the scene's own model is used when asked, the Compendium's otherwise", async () => {
    const own = await rig({ ...CONFIG, model: { id: "other", model: "scribe-2" }, ingest: { chunkTokens: 32000, model: "scene" } });
    own.script.push(said([]));
    await own.start(3, 5);
    await own.finish();
    expect(own.requests[0]!.model).toBe("vera-1");
    const comp = await rig({ ...CONFIG, model: { id: "other", model: "scribe-2" }, ingest: { chunkTokens: 32000 } });
    comp.script.push(said([]));
    await comp.start(3, 5);
    await comp.finish();
    expect(comp.requests[0]!.model).toBe("scribe-2");
  });
});

describe("when a chunk cannot be filed", () => {
  test("prose twice files nothing for that chunk, names it, and the run goes on to the next", async () => {
    const r = await rig(CONFIG, 3);
    r.script.push("Done!", "Still prose.", said([char("Ada")]), said([char("Bram")]), said([char("Cole")]));
    await r.start(3, 9);
    const done = await r.finish();
    expect(done.status).toBe("done");
    expect(done.lines[0]).toMatchObject({ status: "failed" });
    expect(done.errors[0]).toContain("Chunk 1: the model's answer could not be read");
    expect(done.lines.slice(1).some((l) => l.status === "filed")).toBe(true);
    expect((await r.entries()).map((e) => e.title)).not.toContain("Done!");
  });

  test("a provider failure is that chunk's failed receipt with the provider's words", async () => {
    const r = await rig(CONFIG, 1);
    r.script.push(new ProviderError("overloaded", { category: "service_unavailable", code: "service_unavailable", status: 503 }), said([]));
    await r.start(3, 5);
    const done = await r.finish();
    expect(done.lines[0]).toMatchObject({ status: "failed", reason: "overloaded" });
  });
});

describe("running, cancelling, and never blocking the scene", () => {
  test("Cancel stops mid-call and between chunks: the call in flight is interrupted, finished chunks stay filed, later ones are never asked", async () => {
    const r = await rig();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    r.provider.send = async (_req, opts) => {
      calls += 1;
      if (calls === 1) return { content: said([char("Ada")]), finish_reason: "stop", raw: {} } as never;
      await new Promise<void>((_, rej) => { opts?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); void gate; });
      return { content: said([]), finish_reason: "stop", raw: {} } as never;
    };
    const run = await r.start(3, 15);
    for (let i = 0; i < 200 && calls < 2; i++) await new Promise((x) => setTimeout(x, 5));
    expect(cancelIngest(r.chat.id, run.id)).toBe(true);
    const done = await r.finish();
    release();
    expect(done.status).toBe("cancelled");
    expect(calls).toBe(2);
    expect(done.lines.map((l) => l.status)).toEqual(["filed", "interrupted"]);
    expect((await r.entries()).map((e) => e.title)).toContain("Ada");
    expect(cancelIngest(r.chat.id, run.id)).toBe(false);
  });

  test("while a chunk waits on the model the scene's lane is free: another pass runs at once", async () => {
    const r = await rig();
    let release!: () => void;
    r.provider.send = () => new Promise((res) => { release = () => res({ content: said([]), finish_reason: "stop", raw: {} } as never); });
    await r.start(3, 15);
    for (let i = 0; i < 200 && !release; i++) await new Promise((x) => setTimeout(x, 5));
    let other = false;
    await enqueue(r.chat.id, async () => { other = true; });
    expect(other).toBe(true);
    expect(latestRun(r.chat.id)!.status).toBe("running");
    r.provider.send = async () => ({ content: said([]), finish_reason: "stop", raw: {} }) as never;
    release();
    await r.finish();
  });

  test("a second run while one is going, a read-only book, a bad range and no phase are refused before any model call", async () => {
    const r = await rig();
    r.provider.send = () => new Promise(() => undefined);
    await r.start(3, 9);
    await expect(r.start(3, 9)).rejects.toThrow("already running");
    const ro = await rig({ on: true });
    await expect(ro.start()).rejects.toThrow("does not allow the Compendium to write");
    const bad = await rig();
    for (const [from, to] of [[5, 5], [9, 3], [-1, 4], [0, 999], [1.5, 4]] as const) await expect(bad.start(from, to)).rejects.toThrow("pick a range");
    const none = await rig({ ...CONFIG, ingest: { facts: false, narrative: false } });
    await expect(none.start()).rejects.toThrow("switch on Facts or Narrative");
    expect([...ro.requests, ...bad.requests, ...none.requests]).toHaveLength(0);
  });
});
