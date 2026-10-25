/**
 * A scene's regex at the page (ChatStore rule 42): the library sets the scene has switched on, read once per change, and the
 * display pass over its stable messages. Display regex changes what is drawn and nothing stored (RoleCall: useDisplayMessages.ts
 * applies it in the render memo and never writes it back). Every rule runs in the sandbox worker (ADR-009), in batches; while a
 * batch is out the raw text shows, and a worker that cannot run says so on the status line and leaves every message as written.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { RegexRule } from "../../../entities/regex/schema";
import { bodyOf } from "../../../core/guards";
import type { OpenScene } from "../../../studio/scenes";
import { displayDepth, sceneRules, type SceneSet } from "../../../core/regex/scene-pass";
import { runRegexBatchSandboxed } from "../workbench/regex/run-in-worker";

const CHUNK = 100;

/** The sets by id, in the order given. A set that is gone, trashed or unreadable is left out (rule 42); null while they load. */
export function useSceneRegexSets(api: AppContext["api"], ids: readonly string[]): SceneSet[] | null {
  const [sets, setSets] = useState<SceneSet[] | null>(ids.length === 0 ? [] : null);
  const key = ids.join("\n");
  useEffect(() => {
    let live = true;
    if (ids.length === 0) { setSets([]); return; }
    void Promise.all(ids.map(async (id): Promise<SceneSet | null> => {
      try {
        const body = bodyOf(await api.getEntity(`kind=regex&id=${encodeURIComponent(id)}`));
        return Array.isArray(body["rules"]) ? { id, rules: body["rules"] as RegexRule[], enabled: body["enabled"] !== false, ...(typeof body["name"] === "string" ? { name: body["name"] } : {}) } : null;
      } catch {
        return null;
      }
    })).then((all) => live && setSets(all.filter((s): s is SceneSet => s !== null)));
    return () => { live = false; };
    // the api object is rebuilt on every status change; only the ids decide a reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return sets;
}

export interface DisplayItem { id: string; text: string; index: number }

/** The display text of each stable message the scene's sets change, by message id; messages they leave alone are absent. */
export function useDisplayRegex(sets: readonly SceneSet[] | null, items: readonly DisplayItem[], count: number, expand: (text: string, index: number) => string, onFailed: (why: string) => void): ReadonlyMap<string, string> {
  const rules = useMemo(() => (sets ? sceneRules(sets, "display") : []), [sets]);
  const cached = useRef<{ rules: unknown; map: Map<string, string> }>({ rules: null, map: new Map() });
  const [out, setOut] = useState<ReadonlyMap<string, string>>(new Map());
  const failed = useRef(onFailed);
  failed.current = onFailed;
  const grow = useRef(expand);
  grow.current = expand;
  useEffect(() => {
    if (rules.length === 0) { setOut((old) => (old.size === 0 ? old : new Map())); return; }
    if (cached.current.rules !== rules) cached.current = { rules, map: new Map() };
    const cache = cached.current.map;
    const control = new AbortController();
    const keyOf = (i: DisplayItem): string => `${displayDepth(i.index, count)}\u0000${i.text}`;
    const settle = (): void => {
      const next = new Map<string, string>();
      for (const i of items) {
        const done = cache.get(keyOf(i));
        if (done !== undefined && done !== i.text) next.set(i.id, done.includes("{{") ? grow.current(done, i.index) : done);
      }
      if (!control.signal.aborted) setOut(next);
    };
    void (async () => {
      const misses = new Map<string, DisplayItem>();
      for (const i of items) if (i.text && !cache.has(keyOf(i))) misses.set(keyOf(i), i);
      const todo = [...misses];
      for (let at = 0; at < todo.length; at += CHUNK) {
        const chunk = todo.slice(at, at + CHUNK);
        const run = await runRegexBatchSandboxed(chunk.map(([, i]) => ({ text: i.text, depth: displayDepth(i.index, count) })), rules, { phase: "display", target: "display", signal: control.signal });
        if (control.signal.aborted) return;
        if (!run.ok) { failed.current(`Regex could not run, so messages show as written: ${run.error}`); setOut(new Map()); return; }
        chunk.forEach(([k], n) => cache.set(k, run.texts[n]!));
      }
      settle();
    })();
    settle();
    return () => control.abort();
  }, [rules, items, count]);
  return out;
}

/** The page's one call: the display text of each stable message the scene's regex sets change (`byId` is what the macros already made of them). */
export function useSceneRegex(ctx: AppContext, scene: OpenScene | null, byId: ReadonlyMap<string, string>, expand: (text: string, index: number) => string): ReadonlyMap<string, string> {
  const sets = useSceneRegexSets(ctx.api, scene?.chat.regex?.sets ?? NONE);
  const items = useMemo(() => (scene ? scene.messages.filter((m) => !m.cut).map((m, i) => ({ id: m.id, text: byId.get(m.id) ?? "", index: scene.messageOffset + i })) : []), [scene, byId]);
  return useDisplayRegex(sets, items, scene?.messageCount ?? 0, expand, ctx.setStatus);
}

const NONE: readonly string[] = [];
