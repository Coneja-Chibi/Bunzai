/**
 * The unbounded-list guard: a JSX `.map` that renders row-like elements is flagged unless the file windows through
 * useVirtualRows, the map carries `bounded-ok`, or the baseline already knows it.
 */
import { expect, test } from "bun:test";
import { unboundedLists } from "./unbounded-lists-core";

const rows = `export function A({ xs }: { xs: { id: string }[] }) {
  return <div>{xs.map((x) => <ListRow key={x.id} label={x.id} />)}</div>;
}`;

test("flags a JSX map that renders row-like elements", () => {
  const hits = unboundedLists("src/ui/a.tsx", rows);
  expect(hits).toHaveLength(1);
  expect(hits[0]!.id).toBe("src/ui/a.tsx::A::ListRow");
  expect(hits[0]!.line).toBe(2);
});

test("flags a keyed plain element and a block-bodied callback", () => {
  expect(unboundedLists("src/ui/a.tsx", `export const A = ({ xs }: { xs: string[] }) => <ul>{xs.map((x) => { return <li key={x}>{x}</li>; })}</ul>;`)).toHaveLength(1);
});

test("ignores maps with no key and no row part, and maps outside JSX", () => {
  expect(unboundedLists("src/ui/a.tsx", `export const A = ({ xs }: { xs: string[] }) => <p>{xs.map((x) => <b>{x}</b>)}</p>;`)).toEqual([]);
  expect(unboundedLists("src/ui/a.tsx", `export const A = (xs: string[]) => xs.map((x) => <ListRow key={x} />);`)).toEqual([]);
});

test("passes a file that windows through useVirtualRows", () => {
  expect(unboundedLists("src/ui/a.tsx", `${rows}\nconst v = useVirtualRows({});`)).toEqual([]);
});

test("passes a map carrying bounded-ok", () => {
  expect(unboundedLists("src/ui/a.tsx", rows.replace("return <div>", "// bounded-ok: at most 6 pinned rows\n  return <div>"))).toEqual([]);
});

test("ids are stable per file and owner, so a baseline suppresses exactly the known hit", () => {
  const known = new Set(unboundedLists("src/ui/a.tsx", rows).map((h) => h.id));
  const grown = `${rows}\nexport function B({ xs }: { xs: string[] }) { return <div>{xs.map((x) => <Tile key={x} />)}</div>; }`;
  expect(unboundedLists("src/ui/a.tsx", grown).filter((h) => !known.has(h.id)).map((h) => h.id)).toEqual(["src/ui/a.tsx::B::Tile"]);
});

test("a second map of the same part in one function gets its own id", () => {
  const two = `export function A({ xs }: { xs: string[] }) { return <div>{xs.map((x) => <Card key={x} />)}{xs.map((x) => <Card key={x} />)}</div>; }`;
  expect(new Set(unboundedLists("src/ui/a.tsx", two).map((h) => h.id)).size).toBe(2);
});

const wrap = (pre: string, recv: string): string => `${pre}\nexport function A({ xs }: { xs: string[] }) { return <div>{${recv}.map((x) => <Card key={String(x)} />)}</div>; }`;
const flagged = (pre: string, recv: string): number => unboundedLists("src/ui/a.tsx", wrap(pre, recv)).length;

test("exempts an array literal receiver", () => {
  expect(flagged("", `["a", "b"]`)).toBe(0);
  expect(flagged("", `(["a", "b"] as const)`)).toBe(0);
});

test("exempts a module-level const built from a literal or as const, and a SCREAMING_CASE import", () => {
  expect(flagged(`const TABS = ["a", "b"];`, "TABS")).toBe(0);
  expect(flagged(`const TABS = ["a", "b"] as const;`, "TABS.filter(Boolean)")).toBe(0);
  expect(flagged(`import { TABS } from "./tabs";`, "TABS")).toBe(0);
  expect(flagged(`import { tabs } from "./tabs";`, "tabs")).toBe(1);
  expect(flagged(`const TABS = load();`, "TABS")).toBe(1);
  expect(flagged(`let TABS = ["a"];`, "TABS")).toBe(1);
});

test("exempts .slice with a literal bound up to 50 and flags larger or dynamic bounds", () => {
  expect(flagged("", "xs.slice(0, 8)")).toBe(0);
  expect(flagged("", "xs.slice(-5)")).toBe(0);
  expect(flagged("", "xs.slice(0, 50)")).toBe(0);
  expect(flagged("", "xs.slice(0, 51)")).toBe(1);
  expect(flagged("", "xs.slice(0, n)")).toBe(1);
  expect(flagged("", "xs.slice(2)")).toBe(1);
});

test("exempts Object.entries of a literal object and flags Object.entries of data", () => {
  expect(flagged(`const LABELS = { a: "A", b: "B" };`, "Object.entries(LABELS)")).toBe(0);
  expect(flagged("", "Object.entries({ a: 1 })")).toBe(0);
  expect(flagged("", "Object.entries(xs)")).toBe(1);
});

test("exempts Array.from with a literal length up to 50", () => {
  expect(flagged("", "Array.from({ length: 5 })")).toBe(0);
  expect(flagged("", "Array.from({ length: 51 })")).toBe(1);
  expect(flagged("", "Array.from({ length: xs.length })")).toBe(1);
});

test("still flags maps over props, state and hook results, even after filter", () => {
  expect(flagged("", "xs")).toBe(1);
  expect(flagged("", "xs.filter(Boolean)")).toBe(1);
  expect(flagged("", "useEntries().items")).toBe(1);
  expect(flagged(`const TABS = ["a"];`, "[...TABS, ...xs]")).toBe(1);
});
