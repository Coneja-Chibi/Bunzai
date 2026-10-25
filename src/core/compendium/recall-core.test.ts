/** Recall's pure core: the index (budget, handles, aliases, freshness, depth), the request text, and the one strict parse of the answer. */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry } from "../lore/empty-book";
import { fixtureBook, typedEntry } from "./fixture-book";
import { buildRecallIndex, isStillLive, type RecallBook, type RecallIndexOptions } from "./recall-index";
import { MAX_RECALL_GUIDANCE, moreNudge, recallMessages, RECALL_SYSTEM } from "./recall-prompt";
import { MAX_REASON, parseRecall } from "./recall-parse";

const BOOK: RecallBook = { id: "b1", name: "Harbor", entries: fixtureBook(), categories: [{ id: "cat-people", name: "People", sortOrder: 0 }] };
const OPTS: RecallIndexOptions = { detail: "taglines", depth: 2, bookDisplay: "unified", tokenBudget: 100_000 };

describe("the index", () => {
  test("lists every readable entry once under its tree group, with handles, aliases and taglines, and is the same every time", () => {
    const a = buildRecallIndex([BOOK], OPTS);
    expect(buildRecallIndex([BOOK], OPTS).text).toBe(a.text);
    expect(a.omitted).toBe(0);
    expect(a.text).toContain("Cast (");
    expect(a.text).toMatch(/\[e\d+\] Mira Vance \(aka The Lamplighter\) - Keeps the last lantern lit\./);
    expect(a.candidates.get("e1")).toMatchObject({ bookName: "Harbor" });
    expect(a.candidates.get("e1")!.key.startsWith("b1:")).toBe(true);
    // 239 entries in the fixture; the 3 switched off and the retired ones (one character, two plots) are not offered
    const offered = BOOK.entries.filter((e) => e.enabled).length;
    expect(a.candidates.size).toBe(offered);
    expect(a.text).not.toContain("Switched Off");
    expect(a.text).not.toContain("[e" + (offered + 1) + "]");
  });

  test("names only drops taglines, preview adds the entry's own text, whitespace folded", () => {
    const names = buildRecallIndex([BOOK], { ...OPTS, detail: "names" });
    expect(names.text).toContain("Mira Vance (aka The Lamplighter)\n");
    expect(names.text).not.toContain("Keeps the last lantern lit");
    const xan = typedEntry("x", "Xan", "character", { name: "Xan", tagline: "Tall." }, {}, { content: "Long  body\n text." });
    const preview = buildRecallIndex([{ id: "b", name: "B", entries: [xan], categories: [] }], { ...OPTS, detail: "preview" });
    expect(preview.text).toContain("[e1] Xan - Tall. | Long body text.");
  });

  test("a token budget stops the list, says how many it left out, and the cut entries get no handle", () => {
    const full = buildRecallIndex([BOOK], OPTS);
    const cut = buildRecallIndex([BOOK], { ...OPTS, tokenBudget: 400 });
    expect(cut.candidates.size).toBeLessThan(full.candidates.size);
    expect(cut.omitted).toBe(full.candidates.size - cut.candidates.size);
    expect(cut.text.endsWith(`(+${cut.omitted} more entries not shown)`)).toBe(true);
    expect(cut.candidates.size).toBeGreaterThan(0);
  });

  test("depth 1 groups every entry under its top bucket; deeper depth shows sub-groups", () => {
    const flat = buildRecallIndex([BOOK], { ...OPTS, depth: 1 });
    const deep = buildRecallIndex([BOOK], { ...OPTS, depth: 3 });
    expect(deep.text.split("\n").length).toBeGreaterThan(flat.text.split("\n").length);
    expect(deep.candidates.size).toBe(flat.candidates.size);
  });

  test("unified shows several books under one heading, per book gives each its own header, and an empty book is not listed", () => {
    const other: RecallBook = { id: "b2", name: "Salt", entries: [typedEntry("s1", "Salt Court", "organization", { name: "Salt Court" })], categories: [] };
    const empty: RecallBook = { id: "b3", name: "Void", entries: [], categories: [] };
    const unified = buildRecallIndex([BOOK, other, empty], OPTS).text;
    expect(unified).toContain("World Knowledge (combined):");
    expect(unified).toContain('Book: "Salt"');
    expect(unified).not.toContain("Void");
    const per = buildRecallIndex([BOOK, other], { ...OPTS, bookDisplay: "per_book" }).text;
    expect(per).toContain('=== Lorebook: "Salt" (1 entries) ===');
    expect(per).not.toContain("combined");
  });

  test("an entry the live window still covers is left out: a recap, an event or a plot the narrator just read", () => {
    const live = { firstMessage: 50, firstUserTurn: 10 };
    const recap = typedEntry("r", "Recent Recap", "summary", { title: "Recent Recap", turn_range: { from: 48, to: 60 } });
    const old = typedEntry("o", "Old Recap", "summary", { title: "Old Recap", turn_range: { from: 1, to: 20 } });
    const event = typedEntry("e", "Fresh Event", "event", { name: "Fresh Event" }, { turnNumber: 12 });
    const plain = { ...emptyLoreEntry("p"), title: "Plain" };
    expect([recap, old, event, plain].map((e) => isStillLive(e, live))).toEqual([true, false, true, false]);
    const index = buildRecallIndex([{ id: "b", name: "B", entries: [recap, old, event, plain], categories: [] }], { ...OPTS, live });
    expect([...index.candidates.values()].map((c) => c.name).sort()).toEqual(["Old Recap", "Plain"]);
  });
});

describe("the request", () => {
  const base = { index: "INDEX", conversation: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }], minEntries: 0, maxEntries: 10 };

  test("RoleCall's selector prompt, the index and conversation, and a JSON-only ask naming the handle form and the cap", () => {
    const [system, user] = recallMessages(base);
    expect(system!.content).toBe(RECALL_SYSTEM);
    expect(system!.content).toContain("You are a lorebook retrieval agent.");
    expect(user!.content).toContain("## Knowledge Tree Index\n\nINDEX");
    expect(user!.content).toContain("## Recent Conversation (last 2 messages)\n\n[user]: Hello\n\n[assistant]: Hi");
    expect(user!.content).toContain('"entry_ids"');
    expect(user!.content).toContain("Select at most 10 entries.");
  });

  test("the Guide's text comes before the inline guidance, both under the line that they cannot widen access, and a minimum is a hard requirement", () => {
    const [system] = recallMessages({ ...base, minEntries: 3, guideText: "From the guide.", guidance: "Inline." });
    expect(system!.content.indexOf("From the guide.")).toBeLessThan(system!.content.indexOf("Inline."));
    expect(system!.content).toContain("cannot expand lorebook access");
    expect(system!.content).toContain("at least 3 entries");
    expect(moreNudge(1, 3)).toContain("at least 3");
  });

  test("guidance is bounded", () => {
    const [system] = recallMessages({ ...base, guidance: "x".repeat(MAX_RECALL_GUIDANCE * 2) });
    expect(system!.content.length).toBeLessThan(RECALL_SYSTEM.length + MAX_RECALL_GUIDANCE + 400);
  });
});

describe("the answer", () => {
  const index = buildRecallIndex([BOOK], OPTS);
  const parse = (text: string, max = 10) => parseRecall(text, index.candidates, max);

  test("a plain or fenced JSON object with handles and reasons resolves to the entries, with the reasons kept short", () => {
    const long = "r".repeat(MAX_REASON * 3);
    const plain = parse(`{"entry_ids": ["e1", "e2"], "reasons": {"e1": " Present. ", "e2": "${long}"}}`);
    expect(plain.ok && plain.picks.map((p) => p.candidate.handle)).toEqual(["e1", "e2"]);
    expect(plain.ok && plain.picks[0]!.reason).toBe("Present.");
    expect(plain.ok && plain.picks[1]!.reason.length).toBe(MAX_REASON);
    const fenced = parse('Sure!\n```json\n{"entry_ids": ["e3"]}\n```');
    expect(fenced.ok && fenced.picks[0]!.candidate.handle).toBe("e3");
    const wrapped = parse('Here you go: {"entry_ids": ["e4"], "reasons": {"e4": "a } brace"}} done');
    expect(wrapped.ok && wrapped.picks.length).toBe(1);
  });

  test("prose, broken JSON and a wrong shape are refusals with a reason, never an empty success", () => {
    expect(parse("I cannot help with that.")).toMatchObject({ ok: false, reason: "no_json" });
    expect(parse('{"entry_ids": ["e1"')).toMatchObject({ ok: false, reason: "no_json" });
    expect(parse('{"entries": ["e1"]}')).toMatchObject({ ok: false, reason: "bad_shape" });
    expect(parse('{"entry_ids": "e1"}')).toMatchObject({ ok: false, reason: "bad_shape" });
    expect(parse('{"entry_ids": [1, 2]}')).toMatchObject({ ok: false, reason: "bad_shape" });
    expect(parse("[1,2]")).toMatchObject({ ok: false });
  });

  test("a handle the index never printed is dropped and counted, a repeat counts once, and the cap trims the rest", () => {
    const r = parse('{"entry_ids": ["e1", "e999", "e1", "e2", "e3"]}', 2);
    expect(r).toMatchObject({ ok: true, unknown: ["e999"], repeated: 1, trimmed: 1 });
    expect(r.ok && r.picks.map((p) => p.candidate.handle)).toEqual(["e1", "e2"]);
    expect(parse('{"entry_ids": []}')).toMatchObject({ ok: true, picks: [] });
  });
});
