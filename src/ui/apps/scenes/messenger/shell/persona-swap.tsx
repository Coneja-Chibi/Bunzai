/**
 * Swap persona from the sidebar's user panel (backlog slice 30): the Cast wing's own Casting Call (`PersonaPicker`) and its own confirm (`CastConfirm`), casting through the same call and the same
 * refusal wording (cast/persona-cast.ts), held off while a reply is being written. It casts into this scene only and never touches the default persona. New persona hands over to the My Persona
 * program, where the form is.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { StudioEntitySummary } from "../../../../app-contract";
import { bodyOf, str } from "../../../../../core/guards";
import { DEFAULT_PERSONA_PREF } from "../../../../../studio/scenes";
import { CastConfirm } from "../../cast/cast-dialogs";
import { castPersona, castProblem } from "../../cast/persona-cast";
import { pickerPersonas, PersonaPicker } from "../../scene-persona-picker";
import type { WingArgs } from "../wing-props";

export function PersonaSwap({ args, onClose, onNew }: { args: WingArgs; onClose(): void; onNew(): void }): JSX.Element {
  const { ctx, scene, busy } = args;
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [confirm, setConfirm] = useState<{ to: string | null; toName: string | null } | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const personas = useMemo(() => pickerPersonas(library ?? []), [library]);
  const personaId = scene.chat.cast.persona?.id ?? null;
  useEffect(() => {
    let live = true;
    ctx.api.listEntities("persona").then((l) => live && setLibrary(l), () => live && setLibrary([]));
    return () => { live = false; };
  }, [ctx.api]);
  const ask = (to: string | null): void => setConfirm({ to, toName: to ? (personas.find((p) => p.id === to)?.name ?? to) : null });
  const cast = async (to: string | null): Promise<void> => {
    setWorking(true);
    setProblem(null);
    try {
      args.replaceScene(await castPersona(ctx.api, scene.chat, to));
      setConfirm(null);
      onClose();
    } catch (e) {
      setConfirm(null);
      setProblem(castProblem(e));
    } finally {
      setWorking(false);
    }
  };
  const from = str(bodyOf(scene.snapshot.persona)["name"]) || null;
  return (
    <>
      <PersonaPicker ctx={ctx} personas={personas} activeId={personaId} defaultId={str(ctx.prefs.get(DEFAULT_PERSONA_PREF)) || null} busy={busy || working} onCast={ask}
        onNew={() => { onClose(); onNew(); }} onClose={onClose} />
      {busy && <p className="msn-swap-note" role="status">A reply is being written. You can swap persona when it finishes.</p>}
      {problem && <p className="msn-swap-note" role="alert">{problem}</p>}
      {confirm && <CastConfirm from={from} to={confirm.toName} onCancel={() => setConfirm(null)} onConfirm={() => void cast(confirm.to)} />}
    </>
  );
}
