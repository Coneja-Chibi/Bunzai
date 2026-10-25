/**
 * The command loader: folders-as-schema for Kit's slash commands, the impure edge mirroring
 * tools/discover.ts exactly. Every `*.ts` here that default-exports a KitCommand is discovered; the
 * infra files (command.ts, discover.ts), shared "_" helpers, and tests are skipped. Adding a command
 * is dropping a file, nothing central to edit. Sorted for a stable order.
 */
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { KitCommand } from "./command";
import { packagedDropIns } from "../packaged-drop-ins";
import { loadDropIns } from "../drop-in-loader";

const INFRA = new Set(["command.ts", "discover.ts"]);

const isCommandFile = (name: string): boolean =>
  name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.startsWith("_") && !INFRA.has(name);

const isCommand = (value: unknown): value is KitCommand => {
  const command = value as Partial<KitCommand> | undefined;
  return typeof command?.name === "string" && typeof command.run === "function";
};

/** Collect, rejecting duplicate names whichever path produced the list. */
function collect(candidates: readonly unknown[]): KitCommand[] {
  const commands: KitCommand[] = [];
  for (const candidate of candidates) {
    if (!isCommand(candidate)) continue;
    if (commands.some((existing) => existing.name === candidate.name)) {
      throw new Error(`commands: duplicate name ${candidate.name}`);
    }
    commands.push(candidate);
  }
  return commands;
}

/** Load every drop-in command directory under Kit, sorted by path and rejecting duplicate names. */
export async function discoverCommands(dir?: string): Promise<KitCommand[]> {
  // THIS IS KIT'S FIRST STARTUP CALL, and the reason a compiled binary died on launch: the walk below
  // reads the directory `import.meta.url` sits in, which does not exist inside a single-file
  // executable. See packaged-drop-ins.ts.
  const baked = dir === undefined ? packagedDropIns("commands") : null;
  if (baked) return collect(baked);
  const base = dir ?? fileURLToPath(new URL("..", import.meta.url));
  return collect(await loadDropIns(
    base,
    (path) => isCommandFile(basename(path)) && (dir !== undefined || basename(dirname(path)) === "commands"),
    true,
  ));
}
