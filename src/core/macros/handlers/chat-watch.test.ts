/** The chat-watch macros through the real engine: whole-word counting over the last N messages, recency, a tally, seeded odds. */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../index";
import { indexStats } from "./chat-watch";
import { runFormulaReadOnly } from "../../formula";

const ctx = createDefaultContext({
  messages: [
    { role: "user", content: "The storm rolls in. Storms are early." },
    { role: "assistant", content: "Rain and STORM. The guild watches." },
    { role: "user", content: "The guild, the guild." },
  ],
  messageCount: 3,
});
const run = (text: string, seed = 1) => processMacros(text, { ...ctx, randomSeed: seed });

test("mentions counts whole words, any case, over the last N messages", () => {
  expect(run("{{mentions::storm}}").text).toBe("2");
  expect(run("{{mentions::the guild::1}}").text).toBe("2");
  expect(run("{{mentions::storm::1}}").text).toBe("0");
  expect(run("{{mentions::storm::0}}").errors[0]?.message).toBe("The message count must be a whole number of 1 or more");
  expect(run("{{mentions::(}}").text).toBe("0");
});

test("lastmention says how many messages ago, 1 being the latest; empty when never", () => {
  expect(run("{{lastmention::guild}}").text).toBe("1");
  expect(run("{{lastmention::rain}}").text).toBe("2");
  expect(run("[{{lastmention::dragon}}]").text).toBe("[]");
});

test("tally names the most mentioned word, the first listed on a tie, empty when none is", () => {
  expect(run("{{tally::storm,guild}}").text).toBe("guild");
  expect(run("{{tally::storm,guild::2}}").text).toBe("guild");
  expect(run("{{tally::rain,watches}}").text).toBe("rain");
  expect(run("[{{tally::dragon,elf}}]").text).toBe("[]");
});

test("odds is true about that often, the same for the same seed, and goes with if; the run is not cached", () => {
  const trues = Array.from({ length: 400 }, (_, i) => run("{{odds::25}}", i + 1).text).filter((t) => t === "true").length;
  expect(trues).toBeGreaterThan(60);
  expect(trues).toBeLessThan(140);
  expect(run("{{odds::25}}", 9).text).toBe(run("{{odds::25}}", 9).text);
  expect(run("{{odds::100}}").text).toBe("true");
  expect(run("{{odds::0}}").text).toBe("false");
  expect(run("{{odds::101}}").errors).toHaveLength(1);
  expect(run("{{if::{{odds::100}}::hit::miss}}").text).toBe("hit");
  expect(run("{{odds::50}}").cacheable).toBe(false);
});

test("none of them changes anything", () => {
  const done = run("{{mentions::storm}}{{lastmention::guild}}{{tally::storm,guild}}{{odds::50}}");
  expect(done.sideEffects).toEqual([]);
  expect(done.errors).toEqual([]);
});

test("a word with an accent matches whole in either Unicode form, and not inside a longer word", () => {
  const cafe = createDefaultContext({ messages: [{ role: "user", content: "Caf\u0065\u0301 time, then the caf\u00e9 again. Cafe-goers." }], messageCount: 1 });
  expect(processMacros("{{mentions::caf\u00e9}}", cafe).text).toBe("2");
  expect(processMacros("{{mentions::cafe\u0301}}", cafe).text).toBe("2");
  expect(processMacros("{{mentions::cafe}}", cafe).text).toBe("1");
});

// Owner rule (limits rework): no per-run, per-list or length caps; the chat is indexed once per message list. These replace the WORDS_PER_RUN tests.
test("a run may look up any number of different words, and a tally takes any number of words", () => {
  const chat = createDefaultContext({ messages: [{ role: "user", content: "w1 w2 storm" }], messageCount: 1 });
  const flood = Array.from({ length: 2_000 }, (_, i) => `{{mentions::w${i}}}`).join(",");
  const done = processMacros(flood, chat);
  expect(done.errors).toEqual([]);
  expect(done.text.split(",").filter((t) => t === "1")).toHaveLength(2);
  const words = Array.from({ length: 500 }, (_, i) => `x${i}`).join(",");
  expect(processMacros(`{{tally::${words},storm}}`, chat).text).toBe("storm");
  expect(processMacros("{{tally::}}", chat).errors[0]?.message).toBe("Give at least one word or phrase");
  expect(processMacros(`{{mentions::${"w".repeat(5_000)}}}`, chat).text).toBe("0");
});

test("phrases and punctuation match as before: confirmed in the messages that hold the first word, remembered for the list", () => {
  const chat = createDefaultContext({
    messages: [
      { role: "user", content: "The guild watches. The Guild, the guild." },
      { role: "assistant", content: "the guild  watches (twice) and the guild watches" },
      { role: "user", content: "re-entry of the guild watches; re-entry." },
    ],
    messageCount: 3,
  });
  const n = (q: string, last = "") => processMacros(`{{mentions::${q}${last}}}`, chat).text;
  expect(n("the guild watches")).toBe("3");
  expect(n("guild watches")).toBe("3");
  expect(n("guild watches", "::1")).toBe("1");
  expect(n("re-entry")).toBe("2");
  expect(n("(twice)")).toBe("1");
  expect(n("watches (")).toBe("0"); // the bracket is followed by a word, so it is not a whole match (as before)
  expect(n("the guild")).toBe("6");
  expect(processMacros("{{lastmention::re-entry}}", chat).text).toBe("1");
  expect(processMacros("{{lastmention::(twice)}}", chat).text).toBe("2");
  expect(processMacros("[{{lastmention::nothing here}}]", chat).text).toBe("[]");
  // the second ask is answered from what the list remembers
  expect(n("guild watches")).toBe("3");
});

test("10,000 different lookups over a 200-message, 400 KB chat stay fast", () => {
  const filler = (i: number) => Array.from({ length: 330 }, (_, j) => `word${(i * 7 + j * 13) % 4_000}`).join(" ");
  const chat = createDefaultContext({ messages: Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: filler(i) })), messageCount: 200 });
  expect(chat.messages.reduce((n, m) => n + m.content.length, 0)).toBeGreaterThan(400_000 * 0.9);
  const singles = Array.from({ length: 10_000 }, (_, i) => `{{mentions::word${i % 5_000}}}`).join(",");
  const phrases = Array.from({ length: 1_000 }, (_, i) => `{{mentions::word${i} word${(i + 6) % 4_000}}}`).join(",");
  const started = performance.now();
  expect(processMacros(singles, chat).errors).toEqual([]);
  expect(processMacros(phrases, chat).errors).toEqual([]);
  const ms = performance.now() - started;
  console.log(`chat-watch: 10,000 single and 1,000 phrase lookups over 200 messages: ${Math.round(ms)} ms`);
  expect(ms).toBeLessThan(5_000);
});

// Second fix round: a positional index, a deadline inside every loop that scales with the input, and the oracle the index must agree with.
const WORDS = "the a she he and of to in was it her his that with as".split(" ");
const chatOf = (n: number, seed = 7) => {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const text = () => Array.from({ length: 350 }, () => `${WORDS[Math.floor(rnd() * WORDS.length)]} w${Math.floor(rnd() * 3000)}`).join(" ");
  return createDefaultContext({ messages: Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: text() })), messageCount: n });
};
const fakeClock = (step: number) => { let t = 0; return { now: () => (t += step) }; };

describe("the positional index", () => {
  test("a phrase on a very common first word costs what its rarest word costs: 3,000 different 'the wN' phrases over 1,500 messages stay fast (the first-word walk took seconds)", () => {
    const chat = chatOf(1_500);
    const tallyText = `{{tally::${Array.from({ length: 3_000 }, (_, i) => `the w${i}`).join(",")}}}`;
    const started = performance.now();
    const done = processMacros(tallyText, chat);
    const ms = performance.now() - started;
    console.log(`chat-watch: 3,000 different common-first-word phrases over 1,500 messages: ${Math.round(ms)} ms`);
    expect(done.errors).toEqual([]);
    expect(ms).toBeLessThan(2_000);
  });

  test("a list is indexed once: formula calls over the same chat share it, and a new list gets its own", () => {
    const chat = chatOf(50);
    const before = indexStats.builds;
    runFormulaReadOnly("{{mentions::the}}", chat, 1);
    runFormulaReadOnly("{{mentions::she w12}}", chat, 2);
    processMacros("{{lastmention::he}}", chat);
    expect(indexStats.builds - before).toBe(1);
    runFormulaReadOnly("{{mentions::the}}", chatOf(50, 9), 1);
    expect(indexStats.builds - before).toBe(2);
  });

  test("a phrase is remembered for the list: asking again does not match again", () => {
    const chat = chatOf(300);
    const phrases = Array.from({ length: 300 }, (_, i) => `{{mentions::the w${i}}}`).join(",");
    processMacros(phrases, chat);
    const started = performance.now();
    for (let i = 0; i < 20; i++) processMacros(phrases, chat);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  test("agrees with the regex rule it replaced, on random chats and queries: whole words, case, punctuation edges, separators, overlaps", () => {
    let s = 11;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pieces = ["a", "b", "ab", "A", "B", "c_d", "é", "e\u0301", "9", " ", "  ", "-", ", ", "(", ")", ".", "'", "\n", "x-y"];
    const text = () => Array.from({ length: 30 + Math.floor(rnd() * 40) }, () => pieces[Math.floor(rnd() * pieces.length)]).join("");
    const messages = Array.from({ length: 12 }, () => ({ role: "user" as const, content: text() }));
    const chat = createDefaultContext({ messages, messageCount: 12 });
    const queries = ["a", "ab", "a b", "a  b", "a-b", "b, a", "(a)", "a)", "(a", "x-y", "x - y", "a a", "a a a", "c_d", "é", "e\u0301", "9 a", "-", "(", ".", "a.", "'a", "b ab", "ab a b", "a, b", "é a"];
    const oracle = (q: string, take: number) => {
      const BS = String.fromCharCode(92);
      const literal = [...q.normalize("NFC")].map((c) => (".*+?^${}()|[]".includes(c) ? BS + c : c)).join("");
      const W = "[" + BS + "p{L}" + BS + "p{M}" + BS + "p{N}_]";
      const re = new RegExp("(?<!" + W + ")" + literal + "(?!" + W + ")", "giu");
      return messages.slice(-take).reduce((n, m) => n + (m.content.normalize("NFC").match(re)?.length ?? 0), 0);
    };
    for (const q of queries) for (const take of [12, 5, 1]) expect(processMacros(`{{mentions::${q}::${take}}}`, chat).text, `${q} / ${take}`).toBe(String(oracle(q, take)));
  });
});

describe("the deadline inside the work", () => {
  test("a tally of thousands of phrases stops at the deadline with the error in the report, and is not answered as if it had finished", () => {
    const chat = chatOf(200);
    const tallyText = `{{tally::${Array.from({ length: 20_000 }, (_, i) => `the y${i}`).join(",")}}}`;
    const done = processMacros(tallyText, { ...chat, deadline: { at: 300, ...fakeClock(1) } });
    expect(done.errors.map((e) => e.message)).toContain("the time budget for this run is spent; stopped");
  });

  test("the index build checks it too: a spent deadline over a large chat stops the build, and nothing half-built is kept", () => {
    const chat = chatOf(200);
    const first = processMacros("{{mentions::the}}", { ...chat, deadline: { at: 3, ...fakeClock(1) } });
    expect(first.errors.map((e) => e.message)).toContain("the time budget for this run is spent; stopped");
    // the next run, with time to spare, builds the whole index and answers
    const second = processMacros("{{mentions::the}}", chat);
    expect(second.errors).toEqual([]);
    expect(Number(second.text)).toBeGreaterThan(1_000);
  });

  test("a run with time to spare is not touched by the deadline", () => {
    const chat = chatOf(20);
    expect(processMacros("{{mentions::the}}", { ...chat, deadline: { at: 1e12, ...fakeClock(1) } }).errors).toEqual([]);
  });
});

describe("a soft deadline (the prompt build's)", () => {
  test("only the handlers that watch it fail: the other macros in the same text still expand", () => {
    const chat = chatOf(100);
    const tallyText = `{{tally::${Array.from({ length: 5_000 }, (_, i) => `the w${i % 3000}`).join(",")}}}`;
    const done = processMacros(`A {{char}} B {{calc::2+3}} C ${tallyText} D {{calc::4+4}}`, { ...chat, characterName: "Vera", deadline: { at: 40, soft: true, ...fakeClock(1) } });
    // the macro that ran out of time stays as written (the engine's way with a failed macro); the ones around it are expanded
    expect(done.text.startsWith("A Vera B 5 C {{tally::")).toBe(true);
    expect(done.text.endsWith("}} D 8")).toBe(true);
    expect(done.errors.map((e) => e.message)).toEqual(["the time budget for this run is spent; stopped"]);
  });

  test("a hard deadline (a tool's) stops the whole run after the handler that ran past it, whatever the handler answered", () => {
    const chat = chatOf(100);
    const done = processMacros(`{{calc::1+1}}{{mentions::the}}{{calc::2+2}}`, { ...chat, deadline: { at: 2, ...fakeClock(1) } });
    expect(done.errors.map((e) => e.message)).toContain("the time budget for this run is spent; stopped");
    expect(done.text).not.toContain("4");
  });
});
