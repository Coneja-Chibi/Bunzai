/**
 * Prop reach (rc-parity 12, decision 4): every registered prop declares what it can reach beyond the scene (`none`, `model` or
 * `egress`), and a prop whose own files call the model or the network cannot declare less. The scan reads each prop's files, so a
 * prop that gains a model or network call without changing its declaration fails here. Mood Music and Spotify reach outside their
 * own folders (the Stage wing's Music and Spotify tabs), so those files are named.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { stripComments } from "../../../../../scripts/hooks/lib";
import { refreshSpecOf } from "../../../../core/trackers";
import type { TrackerModule } from "../../../../stage/contracts/chat-tracker-types";
import { reachNotes } from "./prop-contract";
import { sceneProps } from "./registry";

const BASE = "src/ui/apps/scenes";
/** Calls that spend the person's model, and calls that leave the machine. */
const MODEL = /generate-kit|proposeTrackerItem|proposeTrackerRefresh|AddByModel|RefreshByModel/;
const NETWORK = /uploadAssetFromUrl|addLinkToPack|spotifyGet|spotifyPost|spotifyFeedFor/;

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { recursive: true }).map((p) => `${dir}/${String(p).replace(/\\/g, "/")}`).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

/** The folder (or files) that make up one prop. A tracker prop is `tracker-<module>` in props/trackers/<dir>. */
const TRACKER_DIR: Record<string, string> = { battle: "battle", resources: "resources" };
function sourcesOf(id: string): string[] {
  if (id === "mood-music") return [...filesIn(`${BASE}/props/mood-music`), `${BASE}/stage-music-panel.tsx`, `${BASE}/stage-music-mini.tsx`];
  if (id === "spotify") return [...filesIn(`${BASE}/props/spotify`), `${BASE}/stage-spotify-panel.tsx`, `${BASE}/stage-spotify-mini.tsx`, `${BASE}/use-stage-spotify.ts`];
  if (id.startsWith("tracker-")) {
    const module = id.slice("tracker-".length);
    return ["quests", "cast", "map", "renown"].includes(module) ? [] : filesIn(`${BASE}/props/trackers/${TRACKER_DIR[module] ?? module}`);
  }
  return filesIn(`${BASE}/props/${id}`);
}
const text = (files: string[]): string => files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

describe("prop reach", () => {
  test("every registered prop declares a reach", () => {
    expect(sceneProps().filter((p) => !["none", "model", "egress"].includes(p.reach)).map((p) => p.id)).toEqual([]);
  });

  test("a prop whose files call the model does not declare none, and one that reaches the network declares egress", () => {
    const wrong: string[] = [];
    for (const p of sceneProps()) {
      const source = text(sourcesOf(p.id));
      if (MODEL.test(source) && p.reach === "none") wrong.push(`${p.id} calls the model but declares none`);
      if (NETWORK.test(source) && p.reach !== "egress") wrong.push(`${p.id} reaches the network but declares ${p.reach}`);
    }
    expect(wrong).toEqual([]);
  });

  test("a tracker that refreshes from chat history calls the model, so it declares it (Stats and Combat included)", () => {
    const wrong = sceneProps().filter((p) => p.id.startsWith("tracker-") && refreshSpecOf(p.id.slice("tracker-".length) as TrackerModule) !== undefined && p.reach !== "model");
    expect(wrong.map((p) => p.id)).toEqual([]);
  });

  test("the scan finds the files it is meant to read", () => {
    for (const p of sceneProps().filter((p) => !["quests", "cast", "map", "renown"].some((m) => p.id === `tracker-${m}`))) expect(sourcesOf(p.id).length).toBeGreaterThan(0);
    expect(MODEL.test(text(sourcesOf("tracker-events")))).toBe(true);
    expect(NETWORK.test(text(sourcesOf("spotify")))).toBe(true);
    expect(NETWORK.test(text(sourcesOf("mood-music")))).toBe(true);
  });

  test("the notes the Props wing shows say what a prop reaches", () => {
    expect(reachNotes({ reach: "none" })).toEqual([]);
    expect(reachNotes({ reach: "model" })).toEqual(["Calls your model"]);
    expect(reachNotes({ reach: "egress", writes: true })).toEqual(["Reaches the internet", "Writes to your library"]);
  });

  test("Mood Music, which adds sound files to a pack, declares that it writes", () => {
    expect(sceneProps().find((p) => p.id === "mood-music")).toMatchObject({ reach: "egress", writes: true });
  });
});
