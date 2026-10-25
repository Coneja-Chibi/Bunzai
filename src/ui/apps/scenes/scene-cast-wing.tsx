/**
 * The Cast wing (approved wireframe; RoleCall's left-cast group): FoldoutTabs over Character, Persona and
 * Participants. The Character and Persona tabs edit the Library card and persona in the scene and move
 * THIS scene onto what was saved (ChatStore rules 13 and 26); casting another persona is confirmed, runs
 * on this scene only, and never touches the default persona setting. Every change waits while a reply is
 * being written, and says why. The Update available notice and its way back (scene-card.tsx) stay on top.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PersonaBody } from "../../../entities/persona/schema";
import type { CharacterBody, CharacterVariant } from "../../../entities/character/schema";
import { emptyPersonaBody } from "../../../entities/persona";
import { bodyOf, isRecord, str } from "../../../core/guards";
import { type OpenScene, DEFAULT_PERSONA_PREF } from "../../../studio/scenes";
import { ApiHttpError } from "../../_shared/api-fetch";
import { toErrorMessage } from "../../_shared/error-message";
import { createAndOpenPiece } from "../library/new-piece";
import { CardNotice, isNewer, UpdateBadge, type CardState } from "./scene-card";
import { FoldoutTabs } from "./scene-foldout";
import { pickerPersonas, PersonaPicker } from "./scene-persona-picker";
import { CAST_TABS, type CastTab } from "./cast/cast-core";
import { tabOr } from "./scene-wing-data";
import { CastConfirm, NewPersona } from "./cast/cast-dialogs";
import { CharacterForm } from "./cast/cast-character-tab";
import { PersonaForm } from "./cast/cast-persona-tab";
import { ParticipantsTab } from "./cast/cast-participants-tab";
import { CastHero } from "./cast/cast-parts";
import { artAccentOf } from "../../../studio/summary";
import { personaMacroBlock } from "../../../core/assembly/preset";
import type { PresetScan } from "./cast/cast-injection";
import { useBoothPreset } from "./use-booth-preset";
import { useCastEditor } from "./cast/use-cast-editor";
import { ThemeSlot } from "../../_shared/theme-slot";
import { useCastPiece, type CastPiece } from "./cast/use-cast-piece";

type Body = Record<string, unknown>;

/** Mounted once the piece is read, so each editing session starts from one read (key: the piece and its read). */
function CharacterSession({ ctx, scene, piece, busy, onScene, onSaved, onVariant }: {
  ctx: AppContext; scene: OpenScene; piece: Extract<CastPiece, { state: "ready" }>; busy: boolean; onScene(s: OpenScene): void; onSaved(v: number | undefined): void; onVariant(id: string | null): void;
}): JSX.Element {
  const id = scene.chat.cast.character.id;
  const editor = useCastEditor<Body>({ ctx, chatId: scene.chat.id, entity: piece.entity, revision: piece.revision, busy, onScene, onSaved });
  const frozen = bodyOf(scene.snapshot.character)["variants"];
  const variants = Array.isArray(frozen) ? (frozen as CharacterVariant[]) : [];
  return <CharacterForm ctx={ctx} id={id} chatId={scene.chat.id} editor={editor} summary={piece.summary} art={artAccentOf(piece.entity)} version={scene.chat.cast.character.version} variants={variants} variantId={scene.chat.variantId} busy={busy} onVariant={onVariant} />;
}

function PersonaSession({ ctx, scene, piece, busy, onScene, onSaved, defaultId, stats, onOpenPicker, onSetDefault }: {
  ctx: AppContext; scene: OpenScene; piece: Extract<CastPiece, { state: "ready" }>; busy: boolean; onScene(s: OpenScene): void; onSaved(v: number | undefined): void; defaultId: string | null;
  stats: { messages: number; scenes: number; streak: number } | null; onOpenPicker(): void; onSetDefault(): void;
}): JSX.Element {
  const id = scene.chat.cast.persona!.id;
  const editor = useCastEditor<PersonaBody>({ ctx, chatId: scene.chat.id, entity: piece.entity, revision: piece.revision, busy, onScene, onSaved });
  // RoleCall scans the scene's preset for a block that already carries {{persona}} (PersonaPanel.tsx:582-628), here by the assembler's own test.
  const preset = useBoothPreset(ctx, scene.chat.preset?.id ?? null);
  const scan: PresetScan = preset.state === "loading" ? "loading" : preset.state === "ready" ? personaMacroBlock(preset.body, scene.chat.preset?.toggles) : null;
  return <PersonaForm ctx={ctx} id={id} editor={editor} summary={piece.summary} art={artAccentOf(piece.entity)} stats={stats} defaultId={defaultId} busy={busy}
    character={bodyOf(scene.snapshot.character) as unknown as CharacterBody} scan={scan} onOpenPicker={onOpenPicker} onSetDefault={onSetDefault} />;
}

/** The Cast wing's three tabs (Character, Persona, Participants) and everything that changes who is in the scene. */
export function CastWing({ ctx, scene, busy, card, onScene, onUpdate, onRevert, initialTab }: {
  ctx: AppContext;
  /** The tab to open on (a Messenger program); the wing's first when absent or unknown. */
  initialTab?: string;
  scene: OpenScene;
  /** a reply is being written */
  busy: boolean;
  card: CardState | null;
  onScene(scene: OpenScene): void;
  onUpdate(): void;
  onRevert(): void;
}): JSX.Element {
  const chat = scene.chat;
  const characterId = chat.cast.character.id;
  const persona = chat.cast.persona ?? null;
  const [tab, setTab] = useState<CastTab>(() => tabOr(CAST_TABS.map((t) => t.id), initialTab, "character"));
  const character = useCastPiece(ctx, "character", characterId);
  const personaPiece = useCastPiece(ctx, "persona", persona?.id ?? null);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(() => str(ctx.prefs.get(DEFAULT_PERSONA_PREF)) || null);
  const [picker, setPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ to: string | null; toName: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [stats, setStats] = useState<{ messages: number; scenes: number; streak: number } | null>(null);
  const api = ctx.api;
  const personaId = persona?.id ?? null;
  const frozenName = str(bodyOf(scene.snapshot.persona)["name"]);
  const characterName = str(isRecord(bodyOf(scene.snapshot.character)["identity"]) ? (bodyOf(scene.snapshot.character)["identity"] as Record<string, unknown>)["name"] : "") || "Character";
  const personas = useMemo(() => pickerPersonas(library ?? []), [library]);

  const refreshList = useCallback(() => { api.listEntities("persona").then(setLibrary, () => setLibrary([])); }, [api]);
  useEffect(refreshList, [refreshList]);
  useEffect(() => {
    setStats(null);
    if (!personaId) return;
    let live = true;
    api.personaStats(personaId).then((s) => live && setStats(s), () => undefined);
    return () => { live = false; };
  }, [api, personaId, chat.snapshotVersion, scene.messageCount]);
  // The scene moved onto another card or persona version: read the Library piece again for its next edit.
  // A version this wing saved itself is not read back (the editor already holds it, and its note must stay).
  const characterReload = character.reload;
  const personaReload = personaPiece.reload;
  const mine = useRef<{ character?: number; persona?: number }>({});
  const seen = useRef({ character: chat.cast.character.version, persona: chat.cast.persona?.version, personaId });
  useEffect(() => {
    if (seen.current.character === chat.cast.character.version) return;
    seen.current.character = chat.cast.character.version;
    if (mine.current.character !== chat.cast.character.version) characterReload();
  }, [characterReload, chat.cast.character.version]);
  useEffect(() => {
    const changedPerson = seen.current.personaId !== personaId;
    if (seen.current.persona === chat.cast.persona?.version && !changedPerson) return;
    seen.current.persona = chat.cast.persona?.version;
    seen.current.personaId = personaId;
    // Another persona is read by its own load; only a new version of the same one is read again.
    if (!changedPerson && personaId && mine.current.persona !== chat.cast.persona?.version) personaReload();
  }, [personaReload, personaId, chat.cast.persona?.version]);

  const say = (e: unknown): void => {
    const text = toErrorMessage(e, "that did not go through");
    setProblem(e instanceof ApiHttpError && e.status === 409 && !/reply is being written/i.test(text)
      ? "Could not switch: this scene changed in another window while you were choosing. Nothing was changed. Try again."
      : text);
  };
  const cast = async (to: string | null): Promise<void> => {
    setWorking(true);
    setProblem(null);
    try {
      onScene(await api.editScene("persona", { chatId: chat.id, personaId: to, expectedSnapshotVersion: chat.snapshotVersion }));
      setConfirm(null);
      setPicker(false);
      setCreating(false);
      setTab("persona");
    } catch (e) {
      setConfirm(null);
      say(e);
    } finally {
      setWorking(false);
    }
  };
  const ask = (to: string | null): void => setConfirm({ to, toName: to ? (personas.find((p) => p.id === to)?.name ?? to) : null });
  const create = async (input: { name: string; content: string }, andCast: boolean): Promise<void> => {
    setWorking(true);
    setProblem(null);
    try {
      const body = { ...emptyPersonaBody(input.name), content: input.content };
      const made = await createAndOpenPiece(ctx, "persona", "persona", body);
      refreshList();
      setCreating(false);
      if (andCast) setConfirm({ to: made.id, toName: made.name });
    } catch (e) {
      say(e);
    } finally {
      setWorking(false);
    }
  };
  const setVariant = (variantId: string | null): void => {
    setProblem(null);
    api.editScene("variant", { chatId: chat.id, variantId }).then(onScene, say);
  };
  const setDefault = (): void => {
    if (!personaId) return;
    ctx.prefs.set(DEFAULT_PERSONA_PREF, personaId);
    setDefaultId(personaId);
    ctx.setStatus(`${frozenName || "this persona"} is the default for new scenes`);
  };

  const notices = (
    <>
      {/* A newer card or a card gone from the Library speaks up; the way back after an update is one quiet line (rule 13). */}
      {card && (isNewer(card) || card.latest === null) && <CardNotice card={card} onRevert={onRevert} />}
      {card && isNewer(card) && <div className="cw-upd"><UpdateBadge onClick={onUpdate} /></div>}
      {card && tab === "character" && !isNewer(card) && card.latest !== null && card.previous !== null && (
        <p className="cw-quiet" data-part="scene.cast.revert">Plays version {card.version}. <button type="button" onClick={onRevert}>Back to version {card.previous}</button></p>
      )}
      {busy && <p className="notice" role="status">A reply is being written. You can swap persona or save when it finishes.</p>}
      {problem && <p className="notice gone" role="alert">{problem}</p>}
    </>
  );
  const gone = (what: string, name: string): JSX.Element => (
    <p className="notice gone">{name} is not in the Library any more ({what} may be in the Trash). This scene keeps playing its own copy. {what === "persona" ? "Cast another persona, or restore it from the Library's Trash." : "Restore it from the Library's Trash to edit it."}</p>
  );

  return (
    <>
      <FoldoutTabs<CastTab> area="Scene" group="Cast" active={tab} onSelect={setTab} tabs={CAST_TABS} />
      <div className="cw-wrap">
        {notices}
        {tab === "character" && <ThemeSlot id="scene.wing.cast.character" />}
        {tab === "persona" && <ThemeSlot id="scene.wing.cast.persona" />}
        {tab === "participants" && <ThemeSlot id="scene.wing.cast.participants" />}
        {picker && <PersonaPicker ctx={ctx} personas={personas} activeId={personaId} defaultId={defaultId} busy={busy || working} onCast={ask} onNew={() => { setPicker(false); setTab("persona"); setCreating(true); }} onClose={() => setPicker(false)} />}
        {tab === "character" && (
          character.piece.state === "ready"
            ? <CharacterSession key={`${characterId}:${character.piece.revision}`} ctx={ctx} scene={scene} piece={character.piece} busy={busy} onScene={onScene} onSaved={(v) => { mine.current.character = v; }} onVariant={setVariant} />
            : <div className="cw-pad"><CastHero icon="mdi:drama-masks" eyebrow="Edit character" title="Identity &" emphasis="Details" />
              {character.piece.state === "gone" ? gone("card", characterName) : character.piece.state === "failed" ? <p className="notice gone">{character.piece.why}</p> : <p className="notice">Opening the card...</p>}</div>
        )}
        {tab === "persona" && !creating && (
          !persona
            ? (
              <div className="cw cw-persona" data-part="scene.cast.persona">
                <CastHero icon="mdi:account-circle-outline" eyebrow="Identity & Details" title="Your" emphasis="Persona" />
                <div className="cw-pad"><div className="empty2"><b>You play as User</b><span>No persona is set, so the AI calls you User. Open the Casting Call to pick one, or make a new one.</span>
                  <div className="cw-acts"><button type="button" className="go" onClick={() => setPicker(true)}>Casting Call</button><button type="button" onClick={() => setCreating(true)}>New persona</button></div></div></div>
              </div>
            )
            : personaPiece.piece.state === "ready"
              ? <PersonaSession key={`${personaId}:${personaPiece.piece.revision}`} ctx={ctx} scene={scene} piece={personaPiece.piece} busy={busy} onScene={onScene} onSaved={(v) => { mine.current.persona = v; }} defaultId={defaultId} stats={stats}
                onOpenPicker={() => setPicker(true)} onSetDefault={setDefault} />
              : <div className="cw-pad"><CastHero icon="mdi:account-circle-outline" eyebrow="Identity & Details" title="Your" emphasis="Persona" />
                {personaPiece.piece.state === "gone" ? gone("persona", frozenName || "This persona") : personaPiece.piece.state === "failed" ? <p className="notice gone">{personaPiece.piece.why}</p> : <p className="notice">Opening the persona...</p>}
                <div className="cw-acts"><button type="button" className="go" onClick={() => setPicker(true)}>Casting Call</button></div></div>
        )}
        {tab === "persona" && creating && <div className="cw-pad"><CastHero icon="mdi:account-circle-outline" eyebrow="New persona" title="Who will you" emphasis="play" /><NewPersona busy={working || busy} onCancel={() => setCreating(false)} onCreate={(i, andCast) => void create(i, andCast)} /></div>}
        {tab === "participants" && <ParticipantsTab ctx={ctx} scene={scene} />}
      </div>
      {confirm && <CastConfirm from={frozenName || persona?.name || null} to={confirm.toName} onCancel={() => setConfirm(null)} onConfirm={() => void cast(confirm.to)} />}
    </>
  );
}
