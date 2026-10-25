/** part-names: well-formed parts pass; undotted, label-keyed, computed and bare-expression names fail; unnamed wings and tabs fail. */
import { describe, expect, test } from "bun:test";
import { carriesPart, mustCarryPart, partProblems } from "./part-names-core";

const bad = (jsx: string): string[] => partProblems(jsx).map((p) => p.why);

describe("partProblems: names that pass", () => {
  test("a dotted literal, an id-keyed template, a two-literal choice and a forwarded literal prop", () => {
    expect(partProblems('<div data-part="scene.props.tile">')).toEqual([]);
    expect(partProblems("<div data-part={`props.tracker.${view.module}`}>")).toEqual([]);
    expect(partProblems("<div data-part={`scene.popout.${kind.id}`}>")).toEqual([]);
    expect(partProblems('<div data-part={stopped ? "compendium.standardize.stopped" : "compendium.standardize.complete"}>')).toEqual([]);
    expect(partProblems('function F({ "data-part": part }: P) { return <section data-part={part}>; }')).toEqual([]);
  });
});

describe("partProblems: names that fail", () => {
  test("an undotted or malformed literal", () => {
    expect(bad('<div data-part="compendium">')).toHaveLength(1);
    expect(bad('<div data-part="Scene.Wing">')).toHaveLength(1);
    expect(bad('<div data-part="scene wing">')).toHaveLength(1);
  });
  test("a part keyed on a label, a name or a computed string", () => {
    expect(bad("<section data-part={`gen.group.${title}`}>")).toHaveLength(1);
    expect(bad("<section data-part={`scene.x.${g.label}`}>")).toHaveLength(1);
    expect(bad("<section data-part={`scene.x.${t.name}`}>")).toHaveLength(1);
    expect(bad("<section data-part={`scene.x.${a + b}`}>")).toHaveLength(1);
    expect(bad("<section data-part={`scene.x.${slug(title)}`}>")).toHaveLength(1);
  });
  test("a template with no dotted prefix, and a bare expression no literal feeds", () => {
    expect(bad("<div data-part={`${id}`}>")).toHaveLength(1);
    expect(bad("<div data-part={`wing${id}`}>")).toHaveLength(1);
    expect(bad("<div data-part={part ?? \"scene.cast.section\"}>")).toHaveLength(1);
    expect(bad("<div data-part={part}>")).toHaveLength(1);
    expect(bad('<div data-part={on ? "scene.a.b" : label}>')).toHaveLength(1);
  });
  test("reports the line", () => {
    expect(partProblems('<a>\n<div data-part="x">')[0]!.line).toBe(2);
  });
});

describe("wings and tabs must carry a part", () => {
  test("which files are held to it", () => {
    expect(mustCarryPart("src/ui/apps/scenes/scene-world-wing.tsx")).toBe(true);
    expect(mustCarryPart("src/ui/apps/scenes/cast/cast-persona-tab.tsx")).toBe(true);
    expect(mustCarryPart("src/ui/apps/scenes/popout/popout-panel.tsx")).toBe(true);
    expect(mustCarryPart("src/ui/apps/scenes/scene-world-wing.test.tsx")).toBe(false);
    expect(mustCarryPart("src/ui/apps/scenes/scene-bubble.tsx")).toBe(false);
    expect(mustCarryPart("src/ui/apps/library/library-tab.tsx")).toBe(false);
  });
  test("a file with a well-formed part passes; one with none, or only a malformed one, fails", () => {
    expect(carriesPart('<div className="wbody" data-part="scene.world">')).toBe(true);
    expect(carriesPart('<div className="wbody">')).toBe(false);
    expect(carriesPart('<div className="wbody" data-part="world">')).toBe(false);
  });
});
