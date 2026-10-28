/** "What it takes" is the parameters the provider is handed, as one plain line per argument. */
import { expect, test } from "bun:test";
import type { ToolField } from "../../../../entities/tool/schema";
import { toolParameters } from "../../../../core/tools";
import { toolTakes } from "./tool-takes";

test("one line per field: name, type, needed or optional, and what it means, from the same parameters the provider gets", () => {
  const fields: ToolField[] = [
    { name: "dice", description: "The dice to roll, like 1d20+5.", type: "text", required: true },
    { name: "target", description: "Who it is aimed at.", type: "text", required: false },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense"], required: false },
    { name: "n", description: "How many.", type: "number", required: true },
    { name: "hard", description: "A hard check.", type: "boolean", required: false },
  ];
  expect(toolTakes(toolParameters(fields)).split("\n")).toEqual([
    "dice (text, needed) The dice to roll, like 1d20+5.",
    "target (text, optional) Who it is aimed at.",
    "mood (choice: calm, tense, optional)",
    "n (number, needed) How many.",
    "hard (yes or no, optional) A hard check.",
  ]);
});

test("a tool with no fields says so", () => {
  expect(toolTakes(toolParameters([]))).toBe("Nothing: this tool takes no arguments.");
});
