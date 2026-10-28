/**
 * "What it takes" in the tool editor's rail, as plain lines: one per argument, `name (type, needed|optional) what it means`. It is read off the
 * same parameters object the provider is handed (core/tools.ts toolParameters), not a second description of the fields, so it cannot say anything the AI is not told.
 */
interface Property { type?: string; description?: string; enum?: string[] }

const TYPE_WORD: Record<string, string> = { string: "text", number: "number", boolean: "yes or no" };

export function toolTakes(parameters: Record<string, unknown>): string {
  const properties = (parameters["properties"] ?? {}) as Record<string, Property>;
  const required = new Set((parameters["required"] ?? []) as string[]);
  const lines = Object.entries(properties).map(([name, p]) => {
    const type = p.enum ? `choice: ${p.enum.join(", ")}` : TYPE_WORD[p.type ?? ""] ?? p.type ?? "value";
    return `${name} (${type}, ${required.has(name) ? "needed" : "optional"})${p.description ? ` ${p.description}` : ""}`;
  });
  return lines.length > 0 ? lines.join("\n") : "Nothing: this tool takes no arguments.";
}
