/** The chat-watch macros through the real engine: whole-word counting over the last N messages, recency, a tally, seeded odds. */
import { expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../index";
import { WORDS_PER_RUN } from "./chat-watch";

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

test("one run searches for at most WORDS_PER_RUN new words; later runs over the same chat are untouched by it", () => {
  // prompt blocks and shown messages are separate runs over one shared message list
  const chat = createDefaultContext({ messages: [{ role: "user", content: "w1 w2 storm" }], messageCount: 1 });
  const flood = Array.from({ length: WORDS_PER_RUN + 1 }, (_, i) => `{{mentions::w${i}}}`).join(",");
  expect(processMacros(flood, chat).errors.map((e) => e.message)).toEqual([`One run can search the chat for at most ${WORDS_PER_RUN} different words`]);
  expect(processMacros("Storms so far: {{mentions::storm}}.", chat).text).toBe("Storms so far: 1.");
  // a word another run already counted costs this run nothing
  const known = Array.from({ length: WORDS_PER_RUN }, (_, i) => `{{mentions::w${i}}}`).join(",");
  expect(processMacros(`${known},{{mentions::storm}},{{mentions::fresh}}`, chat).errors).toEqual([]);
});
