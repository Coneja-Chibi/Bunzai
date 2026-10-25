/**
 * Behaviors the engine claims that neither RoleCall's corpus nor its tests pin, each checked by a
 * mutation during review: the ADR-012 bounds (a per-string output ceiling, a step budget, and no
 * variable written once either trips), readOnly over block setvar, {{rcounter}} state living on the
 * caller's context, the recording maps' pass-through, and re-normalization of a macro's output
 * (RoleCall's VVS-609 marker-path test, ported).
 */
import { describe, expect, test } from "bun:test";
import { MAX_EVAL_STEPS, MAX_OUTPUT_CHARS } from "./limits";
import { createDefaultContext, processMacros } from "./process";

const big = (n: number): string => "x".repeat(n);

describe("the output ceiling is per string", () => {
  test("nested text is not charged more than once", () => {
    const text = big(400_000);
    expect(processMacros(`{{trim::{{trim::{{trim::${text}}}}}}}`, createDefaultContext()).text).toBe(text);
  });

  test("several large values in one run are all kept", () => {
    const ctx = createDefaultContext();
    const text = big(400_000);
    const r = processMacros(`{{setvar::a::${text}}}{{setvar::b::${text}}}{{setvar::c::${text}}}ok`, ctx);
    expect(r.text).toBe("ok");
    expect(r.errors).toEqual([]);
    expect(ctx.localVariables.get("c")?.value).toBe(text);
  });

  test("past the ceiling the run stops and no cut-off value is stored", () => {
    const ctx = createDefaultContext();
    const r = processMacros(`{{setvar::a::${big(MAX_OUTPUT_CHARS + 10)}}}{{setvar::b::after}}`, ctx);
    expect(r.errors.some((e) => e.message.includes("ceiling"))).toBe(true);
    expect(ctx.localVariables.has("a")).toBe(false);
    expect(ctx.localVariables.has("b")).toBe(false);
  });

  test("string-building macros refuse an oversized result before building it", () => {
    const ctx = createDefaultContext();
    expect(processMacros("{{pad::x::300000000}}", ctx).errors[0]?.message).toContain("too large");
    expect(processMacros(`{{repeat::${big(2_000)}::1000}}`, ctx).errors[0]?.message).toContain("too large");
  });
});

describe("the step budget", () => {
  test("a template wider than the budget stops with one error and writes nothing after it", () => {
    const ctx = createDefaultContext();
    const r = processMacros("{{noop}}".repeat(MAX_EVAL_STEPS + 5) + "{{setvar::late::1}}", ctx);
    expect(r.errors.filter((e) => e.message.includes("step budget")).length).toBe(1);
    expect(ctx.localVariables.has("late")).toBe(false);
  });
});

describe("state rules", () => {
  test("readOnly turns a block setvar into a no-op", () => {
    const ctx = createDefaultContext({ readOnly: true });
    processMacros("{{setvar::note}}hello{{/setvar}}", ctx);
    expect(ctx.localVariables.has("note")).toBe(false);
  });

  test("{{rcounter}} keeps counting across calls that share a context", () => {
    const ctx = createDefaultContext();
    expect(processMacros("{{rcounter::step}}", ctx).text).toBe("1");
    expect(processMacros("{{rcounter::step}}", ctx).text).toBe("2");
  });

  test("the recording maps pass accessors through", () => {
    const ctx = createDefaultContext({ localVariables: new Map([["a", { value: "1", createdAt: 0, updatedAt: 0 }]]) });
    expect(processMacros("{{countvar}}", ctx).errors).toEqual([]);
    expect(processMacros("{{allvars}}", ctx).text).toContain("a");
  });
});

describe("VVS-609: a macro's output is normalized before it is evaluated again", () => {
  const viaMarker = (scenario: string): string => processMacros("{{scenario}}", createDefaultContext({ scenario })).text;
  const DOT_SWITCH = "{{.cuma = 3}}\ncuma: {{.cuma}}\nPosition: {{switch::{{.cuma}}::1:Royal::2:Noble::3:Knight::4:Merchant::5:Scholar::6:Mage}}";
  const COMPOUND =
    "{{.roll = 3}}\n" +
    "{{.f1 = {{switch::{{.roll}}::1:Royal::2:Noble::3:Knight::4:Merchant::5:{{noop}}::6:Mage}}}}" +
    "\nEcho f1: {{.f1}}\n" +
    "{{.check = 5}}\n" +
    "{{.v2 = {{if::{{compare::{{.check}}::>::3}}::{{.f1}} the Bold::commoner}}}}" +
    "\nEcho v2: {{.v2}}";

  test("baseline: resolves at the top level", () => {
    expect(processMacros(DOT_SWITCH, createDefaultContext()).text).toContain("Position: Knight");
  });

  test("resolves through the {{scenario}} marker", () => {
    const out = viaMarker(DOT_SWITCH);
    expect(out).toContain("cuma: 3");
    expect(out).toContain("Position: Knight");
  });

  test("resolves the compound shape through the marker", () => {
    const out = viaMarker(COMPOUND);
    expect(out).toContain("Echo f1: Knight");
    expect(out).toContain("Echo v2: Knight the Bold");
  });

  test("a bare dot-read resolves through the marker", () => {
    expect(viaMarker("cuma: {{.cuma = 3}}{{.cuma}}")).toBe("cuma: 3");
  });
});

describe("scope prefixes", () => {
  test("a prefix that names an Object property is a plain key, as in RoleCall", () => {
    const ctx = createDefaultContext();
    const r = processMacros("{{setvar::constructor:x::1}}{{state.set::__proto__:y::2}}", ctx);
    expect(r.errors).toEqual([]);
    expect(ctx.localVariables.get("constructor:x")?.value).toBe(1);
    expect(ctx.localVariables.get("__proto__:y")?.value).toBe(2);
  });
});

describe("once a bound trips, nothing else runs or is stored", () => {
  const over = `{{upper::${big(MAX_OUTPUT_CHARS + 200_000)}}}`;

  test("later macros, lazy or eager, do not run: no template, no counter", () => {
    const ctx = createDefaultContext();
    processMacros(`${over}{{template::t::hello}}{{rcounter::k}}`, ctx);
    expect(ctx.templates?.has("t")).toBe(false);
    expect(ctx.counters?.has("k")).toBe(false);
  });

  test("an arg cut off by the ceiling never reaches a handler that stores it", () => {
    const ctx = createDefaultContext();
    const half = `{{repeat::${big(600)}::1000}}`;
    processMacros(`{{macro::m::${half}${half}}}`, ctx);
    expect(ctx.userMacros?.has("m")).toBe(false);
  });

  test("an arg cut off by the step budget never reaches a handler that stores it", () => {
    const ctx = createDefaultContext();
    const r = processMacros(`{{macro::m::${"{{noop}}".repeat(MAX_EVAL_STEPS + 5)}}}`, ctx);
    expect(r.errors.some((e) => e.message.includes("step budget"))).toBe(true);
    expect(ctx.userMacros?.has("m")).toBe(false);
  });

  test("a lazy handler is unwound out of the arg that tripped, before it writes", () => {
    const ctx = createDefaultContext();
    processMacros(`{{template::${big(MAX_OUTPUT_CHARS + 10)}::body}}`, ctx);
    expect(ctx.templates?.size).toBe(0);
  });

  test("a block setvar whose content trips is not written", () => {
    const ctx = createDefaultContext();
    processMacros(`{{setvar::v}}${over}{{/setvar}}`, ctx);
    expect(ctx.localVariables.has("v")).toBe(false);
  });

  test("a variable write past the ceiling is refused, not stored cut off", () => {
    const ctx = createDefaultContext();
    const text = big(900_000);
    const r = processMacros(`{{setvar::a::${text}}}{{addvar::a::${text}}}`, ctx);
    expect(r.errors.some((e) => e.message.includes("ceiling"))).toBe(true);
    expect(ctx.localVariables.get("a")?.value).toBe(text);
  });
});

describe("the output ceiling also holds for the whole run", () => {
  test("many nodes each under the ceiling still stop at it", () => {
    const r = processMacros(`{{repeat::${big(1_000)}::900}}`.repeat(3), createDefaultContext());
    expect(r.text.length).toBe(MAX_OUTPUT_CHARS);
    expect(r.errors.filter((e) => e.message.includes("ceiling")).length).toBe(1);
  });

  test("a handler result past the ceiling is cut to it", () => {
    const r = processMacros(`{{replace::${"a".repeat(600_000)}::a::aa}}`, createDefaultContext());
    expect(r.text.length).toBe(MAX_OUTPUT_CHARS);
    expect(r.errors.some((e) => e.message.includes("ceiling"))).toBe(true);
  });
});
