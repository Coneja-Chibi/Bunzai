/**
 * The cache planner, trimming, and the base counter: predicted cache hits against each mode's rules,
 * cost at cache prices, stepped trimming that keeps the start of the prompt still, and a base count
 * that never throws on text it did not expect.
 */
import { describe, expect, test } from "bun:test";
import { countMessage, countPrompt, MESSAGE_OVERHEAD } from "./base";
import { backendOf, cacheRulesFor, costOf, predictCache, prefixChain } from "./cache";
import { trimHistory } from "./trim";

const msgs = (n: number, tail = "") => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `line ${i}${i === n - 1 ? tail : ""}` }));

describe("cache planner", () => {
  const openai = cacheRulesFor("openai", "gpt-4o");
  const tokens = [3000, 400, 400, 400, 400];

  test("an automatic cache reads the shared prefix once it passes the minimum", () => {
    const before = prefixChain(msgs(4));
    const now = prefixChain(msgs(5));
    const p = predictCache(openai, now, tokens, { chain: before, at: 0 }, 60_000);
    expect(p).toMatchObject({ read: 3000 + 400 * 3, messages: 4, warmForMs: 4 * 60_000 });
  });

  test("nothing is read when the prefix is too short, the cache has gone cold, or the prompt changed at the start", () => {
    const before = prefixChain(msgs(4));
    expect(predictCache(openai, prefixChain(msgs(5)), [100, 100, 100, 100, 100], { chain: before, at: 0 }, 1000).read).toBe(0);
    expect(predictCache(openai, prefixChain(msgs(5)), tokens, { chain: before, at: 0 }, 6 * 60_000).read).toBe(0);
    const edited = prefixChain([{ role: "user", content: "changed" }, ...msgs(5).slice(1)]);
    expect(predictCache(openai, edited, tokens, { chain: before, at: 0 }, 1000).read).toBe(0);
  });

  test("a breakpoint cache reads the entry the last request wrote, and writes on to this request's last mark", () => {
    const claude = cacheRulesFor("anthropic", "claude-sonnet-4-5");
    const before = prefixChain(msgs(4));
    const now = prefixChain(msgs(5));
    // RoleCall's rolling marks: the system block (0) and the last message (3 last time, 4 now).
    const p = predictCache(claude, now, tokens, { chain: before, at: 0, breakpoints: [0, 3] }, 1000, [0, 4]);
    expect(p).toMatchObject({ read: 4200, write: 400, messages: 4 });
    // Only the system block was marked last time: it is what can be read.
    expect(predictCache(claude, now, tokens, { chain: before, at: 0, breakpoints: [0] }, 1000, [0, 4])).toMatchObject({ read: 3000, write: 1600 });
    // Nothing sent before: everything up to the last mark is written.
    expect(predictCache(claude, now, tokens, undefined, 1000, [0, 4])).toMatchObject({ read: 0, write: 4600 });
  });

  test("a written entry beyond a breakpoint's lookback of 20 blocks is not found", () => {
    const claude = cacheRulesFor("anthropic", "claude-sonnet-4-5");
    const many = Array.from({ length: 30 }, () => 100);
    const before = prefixChain(msgs(29));
    const now = prefixChain(msgs(30));
    // Last time marked message 4 (and nothing later); this time only the last message (29) is marked.
    const p = predictCache(claude, now, [3000, ...many.slice(1)], { chain: before, at: 0, breakpoints: [4] }, 1000, [29]);
    expect(p.read).toBe(0);
  });

  test("Anthropic's minimums follow the model, however its id is spelled", () => {
    expect(cacheRulesFor("anthropic", "claude-3-5-haiku-20241022").minTokens).toBe(2048);
    expect(cacheRulesFor("openrouter", "anthropic/claude-opus-4.5").minTokens).toBe(4096);
    expect(cacheRulesFor("openrouter", "anthropic/claude-opus-4.6").minTokens).toBe(4096);
    expect(cacheRulesFor("anthropic", "claude-opus-4-7").minTokens).toBe(2048);
    expect(cacheRulesFor("anthropic", "claude-fable-5-1").minTokens).toBe(512);
    expect(cacheRulesFor("anthropic", "claude-sonnet-4-5").minTokens).toBe(1024);
    expect(cacheRulesFor("anthropic", "claude-opus-5-5").readMultiplier).toBe(0.05);
    expect(cacheRulesFor("anthropic", "claude-fable-5-1").readMultiplier).toBe(0.025);
  });

  test("OpenAI's newer models keep a cache longer and charge its writes; a local server is free", () => {
    expect(cacheRulesFor("openai", "gpt-5.6-sol")).toMatchObject({ ttlMs: 30 * 60_000, writeMultiplier: 1.25 });
    expect(cacheRulesFor("openai", "gpt-5")).toMatchObject({ ttlMs: 5 * 60_000, writeMultiplier: 1, readMultiplier: 0.1 });
    expect(cacheRulesFor("ollama", "llama3")).toMatchObject({ mode: "automatic", minTokens: 0, readMultiplier: 0, writeMultiplier: 0 });
  });

  test("aggregators cache as the backend the model id names", () => {
    expect(backendOf("openrouter", "anthropic/claude-opus-5-5")).toBe("anthropic");
    expect(backendOf("nanogpt", "deepseek-chat")).toBe("deepseek");
    expect(backendOf("custom", "mystery-7b")).toBe("unknown");
    expect(cacheRulesFor("custom", "mystery-7b").mode).toBe("none");
  });

  test("B12: the fable/mythos rename and qwen's qwq/dashscope aliases are recognized behind an aggregator", () => {
    expect(backendOf("openrouter", "fable-5-1")).toBe("anthropic");
    expect(backendOf("openrouter", "mythos-preview")).toBe("anthropic");
    expect(backendOf("openrouter", "qwq-32b")).toBe("qwen");
  });

  test("the B12 fold onto classifyModelId widened recognition beyond the two reported aliases (see cache.ts's backendOf docblock)", () => {
    expect(backendOf("openrouter", "google/gemma-3-27b")).toBe("gemini");
    expect(backendOf("openrouter", "ministral-8b")).toBe("mistral");
    expect(backendOf("openrouter", "zhipu/glm-4.6")).toBe("glm");
    expect(backendOf("openrouter", "xai/grok-4")).toBe("grok");
    expect(backendOf("openrouter", "chatgpt-4o-latest")).toBe("openai");
  });

  test("cost prices cache reads and writes apart, and a reported cost wins", () => {
    const rules = cacheRulesFor("anthropic", "claude-sonnet-5");
    const prices = { input: 10, output: 50 };
    const hit = costOf({ uncached: 100_000, cacheRead: 900_000, output: 10_000 }, prices, rules);
    expect(hit.total).toBeCloseTo(1 + 0.9 + 0.5, 6);
    expect(hit.saved).toBeCloseTo(9 - 0.9, 6);
    const write = costOf({ uncached: 0, cacheWrite: 1_000_000, cacheWrite1h: 1_000_000 }, prices, rules);
    expect(write.total).toBeCloseTo(20, 6);
    expect(write.saved).toBeLessThan(0);
    expect(costOf({ uncached: 1_000_000, cost: 0.42 }, prices, rules).total).toBe(0.42);
  });
});

describe("stepped trimming", () => {
  test("history that fits is kept whole", () => {
    expect(trimHistory({ fixed: 1000, history: [100, 100, 100], window: 8000, reserve: 1000, chunk: 8 })).toEqual({ drop: 0, used: 1300, overflow: false });
  });

  test("the first kept message moves in steps, so the start of the prompt stays still between them", () => {
    const history: number[] = [];
    const drops: number[] = [];
    for (let turn = 0; turn < 40; turn++) {
      history.push(300, 300);
      drops.push(trimHistory({ fixed: 2000, history, window: 12_000, reserve: 2000, chunk: 8 }).drop);
    }
    const changes = drops.filter((d, i) => i > 0 && d !== drops[i - 1]).length;
    expect(drops.every((d) => d % 8 === 0)).toBe(true);
    // One-message trimming would change the start on nearly every turn past the limit.
    const oneByOne = (() => {
      const h: number[] = [];
      const d: number[] = [];
      for (let turn = 0; turn < 40; turn++) {
        h.push(300, 300);
        d.push(trimHistory({ fixed: 2000, history: h, window: 12_000, reserve: 2000, chunk: 1 }).drop);
      }
      return d.filter((x, i) => i > 0 && x !== d[i - 1]).length;
    })();
    expect(changes).toBeLessThan(oneByOne / 3);
  });

  test("when even the newest message cannot fit, it says so rather than sending", () => {
    const r = trimHistory({ fixed: 7000, history: [500, 500, 3000], window: 8000, reserve: 1000, chunk: 4 });
    expect(r).toEqual({ drop: 2, used: 10_000, overflow: true });
  });
});

describe("base counter", () => {
  test("special-token text counts as text and never throws", () => {
    expect(countMessage("hello <|endoftext|> <|im_start|>").total).toBeGreaterThan(3);
  });

  test("a message's classes sum to its total", () => {
    const mixed = "She laughs. 灯台の光が揺れる。\n```js\nconst x = 1;\n```\nThen quiet.";
    const c = countMessage(mixed);
    expect(c.prose + c.code + c.json + c.cjk).toBe(c.total);
    expect(c.code).toBeGreaterThan(0);
    expect(c.cjk).toBeGreaterThan(0);
    expect(countMessage('{"name":"Vera","tags":["noir"]}')).toMatchObject({ json: countMessage('{"name":"Vera","tags":["noir"]}').total, prose: 0 });
    expect(countMessage("")).toEqual({ total: 0, prose: 0, code: 0, json: 0, cjk: 0 });
  });

  test("a prompt's count is its messages' counts summed", () => {
    const texts = ["one two three", "four five"];
    expect(countPrompt(texts).total).toBe(countMessage(texts[0]!).total + countMessage(texts[1]!).total + 2 * MESSAGE_OVERHEAD);
  });
});
