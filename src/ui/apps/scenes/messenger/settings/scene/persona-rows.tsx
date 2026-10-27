/**
 * Who you play, as rows. "Playing as" is the Casting Call's choice for this scene as a select, kept to the Cast wing's own rules: casting another persona is confirmed first (the same words as
 * cast-dialogs.tsx `CastConfirm`), runs through `castPersona` (cast/persona-cast.ts) with `castProblem` for a refusal, is held off while a reply is being written, and changes this scene only. The persona's
 * card (name, art, history) is the persona program, reached by a drill row. `usePersonaLibrary` and `DefaultPersona` serve the You scope's "Default persona for new scenes", the pref the Cast wing's
 * "Set as default" writes.
 */
import { useEffect, useReducer, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../../../app-contract";
import { bodyOf, str } from "../../../../../../core/guards";
import { DEFAULT_PERSONA_PREF } from "../../../../../../studio/scenes";
import { castPersona, castProblem } from "../../../cast/persona-cast";
import { ActionRow, DrillRow, SelectRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";

const SAY = "msn-st-secd";

/** The personas in the library, read once; null until they are read (a failed read is an empty list). */
export function usePersonaLibrary(ctx: AppContext): StudioEntitySummary[] | null {
  const [list, setList] = useState<StudioEntitySummary[] | null>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    let live = true;
    api.current.listEntities("persona").then((l) => live && setList(l), () => live && setList([]));
    return () => { live = false; };
  }, []);
  return list;
}

const nameOf = (list: readonly StudioEntitySummary[] | null, id: string | null, fallback: string): string => (id ? list?.find((p) => p.id === id)?.name ?? fallback : "no persona");

export function PlayingAs({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { ctx, scene } = a;
  const chat = scene.chat;
  const library = usePersonaLibrary(ctx);
  const current = chat.cast.persona?.id ?? "";
  const from = str(bodyOf(scene.snapshot.persona)["name"]);
  const [asked, setAsked] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const known = (library ?? []).some((p) => p.id === current);
  const options = [{ value: "", label: "No persona" }, ...(current && !known ? [{ value: current, label: from || current }] : []), ...(library ?? []).map((p) => ({ value: p.id, label: p.name || "Unnamed" }))];
  const target = asked !== null && asked !== current ? asked : null;
  const to = target === null ? null : nameOf(library, target || null, target);
  const toWords = to ?? "User";
  const cast = async (): Promise<void> => {
    if (target === null || working || a.busy) return;
    setWorking(true);
    setProblem(null);
    try {
      a.replaceScene(await castPersona(ctx.api, chat, target || null));
      setAsked(null);
    } catch (e) {
      setProblem(castProblem(e));
      setAsked(null);
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <SelectRow label="Playing as" description="The persona used in this scene. Changing it is confirmed first and affects this scene only." value={asked ?? current} options={options} onChange={(next) => { setProblem(null); setAsked(next); }} />
      {target !== null && (
        <>
          <p className={SAY} role="status">
            {a.busy
              ? "A reply is being written. You can switch persona when it finishes."
              : `From your next message on, the AI sees ${toWords} instead of ${from || "User"}. What you already wrote stays under ${from || "User"}. The lorebooks of ${to ?? "no persona"} join the scene, and ${from || "the previous persona"}'s leave it. Your default persona and the library are not changed.`}
          </p>
          {!a.busy && <ActionRow label={target ? `Play as ${to}` : "Play with no persona"} action="Confirm" variant="primary" onAction={() => void cast()} />}
          <ActionRow label="Keep the current persona" action="Cancel" onAction={() => setAsked(null)} />
        </>
      )}
      {problem && <p className={SAY} role="alert">{problem}</p>}
      <DrillRow label="Persona details" description="Name, description and art of who you play." value={from || "No persona"} onOpen={() => open("persona")} />
    </>
  );
}

/** The persona new scenes start with: the pref the Cast wing's "Set as default" writes. The Cast wing cannot clear it, so there is no empty choice once one is set. */
export function DefaultPersona({ ctx }: { ctx: AppContext }): JSX.Element {
  const library = usePersonaLibrary(ctx);
  const [, again] = useReducer((n: number) => n + 1, 0);
  const id = str(ctx.prefs.get(DEFAULT_PERSONA_PREF));
  const known = (library ?? []).some((p) => p.id === id);
  const options = [...(id ? [] : [{ value: "", label: "Not chosen" }]), ...(id && !known ? [{ value: id, label: library === null ? "Loading..." : "No longer in your library" }] : []), ...(library ?? []).map((p) => ({ value: p.id, label: p.name || "Unnamed" }))];
  return (
    <SelectRow label="Default persona for new scenes" description="Scenes you start from now on begin with this persona. A scene you are in keeps its own." value={id} options={options}
      onChange={(next) => { if (next === "") return; ctx.prefs.set(DEFAULT_PERSONA_PREF, next); again(); ctx.setStatus(`${nameOf(library, next, "this persona")} is the default for new scenes`); }} />
  );
}
