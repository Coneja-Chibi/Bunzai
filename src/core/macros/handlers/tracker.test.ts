/** The tracker macro through the real engine: the rendered text, a record's field, a list's row field; unknown names are macro errors; nothing is written. */
import { expect, test } from "bun:test";
import type { TrackerBody } from "../../../entities/tracker/schema";
import { renderTracker } from "../../tracker";
import { createDefaultContext, processMacros, type MacroContext } from "../index";

const health: TrackerBody = { name: "Health", description: "", layout: "record", note: "", fields: [{ name: "hp", description: "", type: "number" }, { name: "hurt", description: "", type: "boolean" }] };
const party: TrackerBody = { name: "Party", description: "", layout: "list", note: "", fields: [{ name: "hp", description: "", type: "number" }] };
const hv = { hp: 7, hurt: true };
const pv = [{ name: "Vera", hp: 4 }, { name: "Odd Job", hp: 9 }];
const view = (body: TrackerBody, value: unknown) => [body.name.toLowerCase(), { body, value, text: renderTracker(body, value as never) }] as const;
const ctx: MacroContext = { ...createDefaultContext({}), trackers: new Map([view(health, hv), view(party, pv)]) };
const run = (text: string, context: MacroContext = ctx) => processMacros(text, { ...context, randomSeed: 1 });

test("{{tracker::Name}} is the tracker's text, whatever the case of the name", () => {
  expect(run("{{tracker::Health}}").text).toBe("Health: hp=7, hurt=true");
  expect(run("{{tracker::health}}").text).toBe("Health: hp=7, hurt=true");
  expect(run("{{tracker::Party}}").text).toBe("Party:\n- Vera: hp=4\n- Odd Job: hp=9");
});

test("{{tracker::Name::field}} reads a record's field, and {{tracker::Name::row::field}} a list row's", () => {
  expect(run("{{tracker::Health::hp}}").text).toBe("7");
  expect(run("{{tracker::Health::hurt}}").text).toBe("true");
  expect(run("{{tracker::Party::Vera::hp}}").text).toBe("4");
  expect(run("{{tracker::Party::odd job::hp}}").text).toBe("9");
  expect(run("{{if::{{tracker::Health::hp}}>5::high::low}}").text).toBe("high");
});

test("an unknown tracker, field or row, or the wrong form for the layout, is a macro error naming it", () => {
  expect(run("{{tracker::Nope}}").errors[0]?.message).toBe("There is no tracker named Nope. Trackers: Health, Party.");
  expect(run("{{tracker::Health::mp}}").errors[0]?.message).toBe("Health has no field mp. Fields: hp, hurt.");
  expect(run("{{tracker::Party::Nobody::hp}}").errors[0]?.message).toBe("Party has no row Nobody.");
  expect(run("{{tracker::Party::Vera::mp}}").errors[0]?.message).toBe("Party has no field mp. Fields: hp.");
  expect(run("{{tracker::Party::hp}}").errors[0]?.message).toBe("Party is a list: use {{tracker::Party::row::field}}.");
  expect(run("{{tracker::Health::hp::x}}").errors[0]?.message).toBe("Health is a record: use {{tracker::Health::field}}.");
  expect(run("{{tracker}}").errors[0]?.message).toBe("Give a tracker name");
});

test("with no linked trackers every use is an error, and a run changes nothing", () => {
  const none = { ...createDefaultContext({}) };
  expect(run("{{tracker::Health}}", none).errors[0]?.message).toBe("There is no tracker named Health. No tracker is linked to this scene.");
  const done = run("{{tracker::Health::hp}}");
  expect(done.sideEffects).toEqual([]);
  expect(done.cacheable).toBe(true);
});
